import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

const SLUG = process.env.ORG_SLUG || 'aic-isovya-praise';
const APPLY = process.argv.includes('--apply');

const slugify = value => String(value ?? '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unnamed';

const idFor = (year, monthName, name, taken) => {
    const base = `${year}-${String(MONTHS.indexOf(monthName) + 1).padStart(2, '0')}-${slugify(name)}`;
    if (!taken.has(base)) { taken.add(base); return base; }
    let n = 2;
    while (taken.has(`${base}--${n}`)) n++;
    taken.add(`${base}--${n}`);
    return `${base}--${n}`;
};

const target = initializeApp(
    { credential: cert(JSON.parse(readFileSync('keys/target.json', 'utf8'))) }, 'target');
const db = getFirestore(target);
const root = db.collection(`organizations/${SLUG}/contributions`);

const snap = await root.get();
const live = {};
snap.forEach(d => { live[d.id] = d.data(); });

// 1. Records whose id encodes a different month than they now claim.
const misfiled = [];
for (const [id, c] of Object.entries(live)) {
    const m = id.match(/^(\d{4})-(\d{2})-/);
    if (!m) continue;
    if (Number(m[1]) !== c.year || MONTHS[Number(m[2]) - 1] !== c.monthName) {
        misfiled.push({ id, record: c });
    }
}

// 2. Months that lost every record to a clone.
const occupied = new Set(Object.values(live).map(c => `${c.year}-${c.monthName}`));
const emptied = [...new Set(misfiled.map(({ id }) => {
    const m = id.match(/^(\d{4})-(\d{2})-/);
    return `${Number(m[1])}-${MONTHS[Number(m[2]) - 1]}`;
}))].filter(key => !occupied.has(key));

console.log(`misfiled records: ${misfiled.length}`);
console.log(`months emptied by a clone: ${emptied.join(', ') || 'none'}\n`);

const taken = new Set(Object.keys(live));
const writes = [];
const deletes = [];

// Re-id the misfiled records, deepest month first so freed ids are reusable.
for (const { id, record } of misfiled.sort((a, b) => b.id.localeCompare(a.id))) {
    taken.delete(id);
    const fresh = idFor(record.year, record.monthName, record.memberName, taken);
    if (fresh === id) continue;
    writes.push({ id: fresh, data: { ...record, id: fresh } });
    deletes.push(id);
}

// Restore emptied months from the legacy database, paid flags included.
if (emptied.length) {
    const sa = JSON.parse(readFileSync('keys/source.json', 'utf8'));
    const legacy = initializeApp({
        credential: cert(sa),
        databaseURL: `https://${sa.project_id}-default-rtdb.firebaseio.com`
    }, 'legacy');
    const legacyData = (await getDatabase(legacy).ref('contributionsData').once('value')).val() || {};

    for (const key of emptied) {
        const [year, monthName] = [key.slice(0, 4), key.slice(5)];
        const rows = legacyData[year]?.[monthName]?.contributions;
        if (!rows) { console.log(`  ${key}: NOT in legacy — cannot restore`); continue; }
        for (const row of rows) {
            if (!row?.name) continue;
            const fresh = idFor(Number(year), monthName, row.name, taken);
            writes.push({
                id: fresh,
                data: {
                    id: fresh,
                    memberName: String(row.name).trim(),
                    amount: Number(row.amount) || 0,
                    paid: Boolean(row.paid),
                    year: Number(year),
                    month: MONTHS.indexOf(monthName),
                    monthName,
                    date: Date.UTC(Number(year), MONTHS.indexOf(monthName), 1),
                    restoredAt: Date.now(),
                    deleted: false
                }
            });
        }
        console.log(`  ${key}: ${rows.length} records recoverable from legacy`);
    }
}

console.log(`\nplanned: ${writes.length} writes, ${deletes.length} deletes`);
for (const d of deletes.slice(0, 6)) console.log(`  delete ${d}`);
for (const w of writes.slice(0, 6)) console.log(`  write  ${w.id} (${w.data.monthName} ${w.data.year}, paid=${w.data.paid})`);

if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to commit.');
    process.exit(0);
}

const batch = db.batch();
let n = 0;
for (const w of writes) { batch.set(root.doc(w.id), w.data); n++; }
for (const d of deletes) { batch.delete(root.doc(d)); n++; }
await batch.commit();
console.log(`\nAPPLIED ${n} operations.`);
process.exit(0);
