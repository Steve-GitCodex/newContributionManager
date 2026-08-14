import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

const SLUG = process.env.ORG_SLUG || 'aic-isovya-praise';
const APPLY = process.argv.includes('--apply');
const WANTED = process.argv.filter(a => /^\d{4}-[A-Z][a-z]+$/.test(a));

const slugify = v => String(v ?? '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unnamed';

const target = initializeApp(
    { credential: cert(JSON.parse(readFileSync('keys/target.json', 'utf8'))) }, 'target');
const db = getFirestore(target);
const root = db.collection(`organizations/${SLUG}/contributions`);
const monthsRoot = db.collection(`organizations/${SLUG}/months`);

const snap = await root.get();
const taken = new Set();
const present = new Set();
snap.forEach(d => {
    taken.add(d.id);
    const c = d.data();
    present.add(`${c.year}-${c.monthName}`);
});

const sa = JSON.parse(readFileSync('keys/source.json', 'utf8'));
const legacy = initializeApp({
    credential: cert(sa),
    databaseURL: `https://${sa.project_id}-default-rtdb.firebaseio.com`
}, 'legacy');
const legacyData = (await getDatabase(legacy).ref('contributionsData').once('value')).val() || {};

const allocate = (year, monthName, name) => {
    const base = `${year}-${String(MONTHS.indexOf(monthName) + 1).padStart(2, '0')}-${slugify(name)}`;
    if (!taken.has(base)) { taken.add(base); return base; }
    let n = 2;
    while (taken.has(`${base}--${n}`)) n++;
    taken.add(`${base}--${n}`);
    return `${base}--${n}`;
};

const writes = [];
for (const key of WANTED) {
    const [year, monthName] = [key.slice(0, 4), key.slice(5)];
    if (present.has(`${Number(year)}-${monthName}`)) {
        console.log(`  ${key}: already has records — skipping, refusing to duplicate`);
        continue;
    }
    const rows = legacyData[year]?.[monthName]?.contributions;
    if (!rows) { console.log(`  ${key}: NOT in legacy`); continue; }

    for (const row of rows) {
        if (!row?.name) continue;
        const id = allocate(Number(year), monthName, row.name);
        writes.push({
            id,
            data: {
                id,
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
    const paid = rows.filter(r => r.paid).length;
    console.log(`  ${key}: ${rows.length} records from legacy (${paid} paid, ${rows.length - paid} unpaid)`);
}

console.log(`\nplanned: ${writes.length} writes, 0 deletes (restore only)`);

if (!APPLY) {
    console.log('DRY RUN — nothing written. Re-run with --apply to commit.');
    process.exit(0);
}

const batch = db.batch();
for (const w of writes) batch.set(root.doc(w.id), w.data);
for (const key of WANTED) {
    const [year, monthName] = [key.slice(0, 4), key.slice(5)];
    batch.set(monthsRoot.doc(`${year}-${monthName}`), { year: Number(year), monthName });
}
await batch.commit();
console.log(`APPLIED ${writes.length} restores.`);
process.exit(0);
