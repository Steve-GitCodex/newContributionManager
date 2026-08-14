// Reports how many documents each access pattern touches. Read-only.

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SLUG = process.env.ORG_SLUG || 'aic-isovya-praise';

const app = initializeApp(
    { credential: cert(JSON.parse(readFileSync('keys/target.json', 'utf8'))) }, 'measure-scoped');
const db = getFirestore(app);

const org = db.collection('organizations').doc(SLUG);

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const countAll = async name => (await org.collection(name).get()).size;

const eager = ['blacklist', 'campaigns', 'campaignContributions'];
let eagerTotal = 2; // meta/state and budgets/org

const monthsSnapshot = await org.collection('months').get();
console.log(`months: ${monthsSnapshot.size}`);
eagerTotal += monthsSnapshot.size;

const existingMonths = new Set();
monthsSnapshot.forEach(entry => {
    const data = entry.data();
    if (data && data.monthName) existingMonths.add(`${data.year}-${data.monthName}`);
});

for (const name of eager) {
    const size = await countAll(name);
    console.log(`${name}: ${size}`);
    eagerTotal += size;
}

const contributions = await countAll('contributions');
console.log(`contributions: ${contributions}`);

const rangeFor = async (year, monthName) => {
    const monthIndex = MONTHS.indexOf(monthName);
    const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
    const snapshot = await org.collection('contributions')
        .orderBy('__name__').startAt(prefix).endAt(`${prefix}`).get();
    return snapshot.size;
};

// Mirrors ViewManager.locatePreviousMonth, which app.js's loadData also hydrates.
const locatePreviousMonth = (year, monthName) => {
    for (let index = MONTHS.indexOf(monthName) - 1; index >= 0; index--) {
        if (existingMonths.has(`${year}-${MONTHS[index]}`)) return { year, monthName: MONTHS[index] };
    }

    const earlier = String(parseInt(year, 10) - 1);
    if (existingMonths.has(`${earlier}-December`)) return { year: earlier, monthName: 'December' };

    return null;
};

const now = new Date();
const currentYear = String(now.getFullYear());
const currentMonthName = MONTHS[now.getMonth()];

const currentMonthCount = await rangeFor(currentYear, currentMonthName);

const previous = locatePreviousMonth(currentYear, currentMonthName);
const previousMonthCount = previous ? await rangeFor(previous.year, previous.monthName) : 0;

const yearPrefix = `${currentYear}-`;
const year = await org.collection('contributions')
    .orderBy('__name__').startAt(yearPrefix).endAt(`${yearPrefix}`).get();

const newStartupTotal = eagerTotal + currentMonthCount + previousMonthCount;

console.log('');
console.log(`old startup:  ${eagerTotal + contributions} documents`);
console.log(`new startup:  ${newStartupTotal} documents (current month ${currentMonthName}: ${currentMonthCount}` +
    (previous ? `, previous month ${previous.monthName} ${previous.year}: ${previousMonthCount})` : ', no previous month hydrated)'));
console.log(`year switch:  ${year.size} documents`);
console.log(`open reports: ${contributions} documents, once per session`);
