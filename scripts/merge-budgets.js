// One-time: collapse per-user budget documents into the single org budget document.
// Dry run by default; pass --apply to write.

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SLUG = process.env.ORG_SLUG || 'aic-isovya-praise';
const BUDGET_ID = 'org';
const APPLY = process.argv.includes('--apply');

const app = initializeApp(
    { credential: cert(JSON.parse(readFileSync('keys/target.json', 'utf8'))) }, 'merge-budgets');
const db = getFirestore(app);

const snapshot = await db.collection(`organizations/${SLUG}/budgets`).get();
const sources = snapshot.docs.filter(doc => doc.id !== BUDGET_ID);
const target = snapshot.docs.find(doc => doc.id === BUDGET_ID);

const expenses = { ...(target?.data().expenses || {}) };
let merged = 0;
let collisions = 0;

for (const doc of sources) {
    for (const [id, expense] of Object.entries(doc.data().expenses || {})) {
        let key = id;
        while (expenses[key]) {
            collisions++;
            key = `${id}-${++merged}`;
        }
        expenses[key] = expense;
        merged++;
    }
}

const total = Object.values(expenses).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
console.log(`${sources.length} per-user document(s) -> budgets/${BUDGET_ID}`);
console.log(`${Object.keys(expenses).length} expenses totalling ${total}${collisions ? ` (${collisions} id collision(s) renamed)` : ''}`);

if (!APPLY) {
    console.log('Dry run. Re-run with --apply to write.');
    process.exit(0);
}

const batch = db.batch();
batch.set(db.doc(`organizations/${SLUG}/budgets/${BUDGET_ID}`), { expenses });
for (const doc of sources) batch.delete(doc.ref);
await batch.commit();

console.log('Merged.');
