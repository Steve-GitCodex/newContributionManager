// Single choke point for every Firestore path in the org app.
// Everything lives under organizations/{slug} in the central project.

const OrgDb = (function () {
    // The budget is the organization's, not a person's: expenses are set against the
    // whole org's contribution income, so one document holds them all.
    const BUDGET_ID = 'org';

    let slug = (typeof window !== 'undefined' && window.orgSlug) ? String(window.orgSlug).trim() : '';

    function setSlug(value) {
        slug = String(value == null ? '' : value).trim();
    }

    function getSlug() {
        return slug;
    }

    function orgDoc() {
        if (!slug) throw new Error('Organization slug not set');
        return FirebaseManager.getFirestore().collection('organizations').doc(slug);
    }

    function collection(name) {
        return orgDoc().collection(name);
    }

    function doc(name, id) {
        return collection(name).doc(id);
    }

    async function getAll(name) {
        const snapshot = await collection(name).get();
        const result = {};
        snapshot.forEach(entry => { result[entry.id] = entry.data(); });
        return result;
    }

    async function getOne(name, id) {
        const snapshot = await doc(name, id).get();
        return snapshot.exists ? snapshot.data() : null;
    }

    async function setOne(name, id, data) {
        await doc(name, id).set(data);
    }

    function batch() {
        return FirebaseManager.getFirestore().batch();
    }

    return { BUDGET_ID, setSlug, getSlug, orgDoc, collection, doc, getAll, getOne, setOne, batch };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = OrgDb;
}
