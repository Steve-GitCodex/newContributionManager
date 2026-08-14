// Writes only documents that differ from the baseline; a scope never loaded into
// the baseline is therefore never written or deleted.
const DataWriteAdapter = (function () {
    const BATCH_LIMIT = 450;
    const baselines = {};
    let baselineEpoch = 0;

    function setBaseline(collectionName, baseline) {
        baselines[collectionName] = baseline || {};
        baselineEpoch++;
    }

    function mergeBaseline(collectionName, addition) {
        baselines[collectionName] = Object.assign({}, baselines[collectionName] || {}, addition || {});
    }

    async function commit(operations) {
        for (let start = 0; start < operations.length; start += BATCH_LIMIT) {
            const batch = OrgDb.batch();
            for (const operation of operations.slice(start, start + BATCH_LIMIT)) {
                if (operation.type === 'delete') batch.delete(operation.ref);
                else batch.set(operation.ref, operation.data);
            }
            await batch.commit();
        }
    }

    function stripId(record) {
        const data = {};
        for (const key of Object.keys(record || {})) {
            if (key !== 'id') data[key] = record[key];
        }
        return data;
    }

    function operationsFor(collectionName, records, dataOf) {
        const shape = dataOf || (record => record);
        const { writes, deletes } = ChangeSet.diff(baselines[collectionName], records);

        return {
            operations: [
                ...writes.map(record => ({ type: 'set', ref: OrgDb.doc(collectionName, record.id), data: shape(record) })),
                ...deletes.map(id => ({ type: 'delete', ref: OrgDb.doc(collectionName, id) }))
            ],
            deletedIds: deletes
        };
    }

    function adoptInto(collectionName, records, deletedIds) {
        const baseline = Object.assign({}, baselines[collectionName]);
        for (const id of deletedIds) delete baseline[id];
        baselines[collectionName] = Object.assign(baseline, ChangeSet.capture(records));
    }

    function monthRecords(contributionsData) {
        const records = [];

        for (const year of Object.keys(contributionsData)) {
            for (const monthName of Object.keys(contributionsData[year] || {})) {
                if (ContributionMapper.MONTHS.indexOf(monthName) === -1) continue;
                records.push({ id: `${year}-${monthName}`, year: Number(year), monthName });
            }
        }

        return records;
    }

    async function saveAll(contributionsData, blacklistData, budgetData, campaignsData, userRole) {
        const operations = [];
        const adopt = [];
        const epochAtEntry = baselineEpoch;

        const stage = (collectionName, records, dataOf) => {
            const staged = operationsFor(collectionName, records, dataOf);
            operations.push(...staged.operations);
            adopt.push([collectionName, records, staged.deletedIds]);
        };

        if (contributionsData && Object.keys(contributionsData).length > 0) {
            stage('contributions', ContributionMapper.flattenContributions(contributionsData));
            stage('months', monthRecords(contributionsData), stripId);
        }

        if (blacklistData && userRole === 'admin') {
            stage('blacklist', ContributionMapper.flattenBlacklist(blacklistData));
        }

        if (budgetData && userRole === 'admin') {
            stage('budgets', [Object.assign({ id: OrgDb.BUDGET_ID }, budgetData)], stripId);
        }

        if (campaignsData) {
            const { campaigns, campaignContributions } = ContributionMapper.flattenCampaigns(campaignsData);

            stage('campaigns', campaigns);
            stage('campaignContributions', campaignContributions);
        }

        operations.push({ type: 'set', ref: OrgDb.doc('meta', 'state'), data: { lastSync: Date.now() } });

        await commit(operations);

        if (baselineEpoch !== epochAtEntry) return true;

        for (const [collectionName, records, deletedIds] of adopt) {
            adoptInto(collectionName, records, deletedIds);
        }

        return true;
    }

    return { setBaseline, mergeBaseline, saveAll };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataWriteAdapter;
}
