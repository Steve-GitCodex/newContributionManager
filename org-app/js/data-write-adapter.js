// Writes the app's year/month blob back to the org's flat Firestore collections.
// Edits commit before the read that finds records to prune, so a page closed mid-save
// keeps the edit; the next save repeats the pruning.

const DataWriteAdapter = (function () {
    const BATCH_LIMIT = 450;

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

    function writes(collectionName, records) {
        return records.map(record => ({
            type: 'set',
            ref: OrgDb.doc(collectionName, record.id),
            data: record
        }));
    }

    async function deletions(collectionName, records) {
        const kept = new Set(records.map(record => record.id));
        const existing = await OrgDb.getAll(collectionName);

        return Object.keys(existing)
            .filter(id => !kept.has(id))
            .map(id => ({ type: 'delete', ref: OrgDb.doc(collectionName, id) }));
    }

    function monthOperations(contributionsData) {
        const operations = [];

        for (const year of Object.keys(contributionsData)) {
            for (const monthName of Object.keys(contributionsData[year] || {})) {
                if (ContributionMapper.MONTHS.indexOf(monthName) === -1) continue;
                operations.push({
                    type: 'set',
                    ref: OrgDb.doc('months', `${year}-${monthName}`),
                    data: { year: Number(year), monthName }
                });
            }
        }

        return operations;
    }

    async function saveAll(contributionsData, blacklistData, budgetData, campaignsData, userRole) {
        const operations = [];
        const prunable = [];

        if (contributionsData && Object.keys(contributionsData).length > 0) {
            const records = ContributionMapper.flattenContributions(contributionsData);
            operations.push(...writes('contributions', records));
            operations.push(...monthOperations(contributionsData));
            prunable.push(['contributions', records]);
        }

        if (blacklistData && userRole === 'admin') {
            const records = ContributionMapper.flattenBlacklist(blacklistData);
            operations.push(...writes('blacklist', records));
            prunable.push(['blacklist', records]);
        }

        if (budgetData && userRole === 'admin') {
            operations.push({ type: 'set', ref: OrgDb.doc('budgets', OrgDb.BUDGET_ID), data: budgetData });
        }

        if (campaignsData) {
            const { campaigns, campaignContributions } = ContributionMapper.flattenCampaigns(campaignsData);
            operations.push(...writes('campaigns', campaigns));
            operations.push(...writes('campaignContributions', campaignContributions));
            prunable.push(['campaigns', campaigns], ['campaignContributions', campaignContributions]);
        }

        operations.push({ type: 'set', ref: OrgDb.doc('meta', 'state'), data: { lastSync: Date.now() } });

        await commit(operations);

        const stale = await Promise.all(prunable.map(([name, records]) => deletions(name, records)));
        await commit(stale.flat());

        return true;
    }

    return { saveAll };
})();
