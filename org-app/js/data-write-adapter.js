// Writes the app's year/month blob back to the org's flat Firestore collections.
// Records absent from the incoming data are deleted, so a save is a full reconcile.

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

    function reconcile(collectionName, records, existingIds) {
        const operations = [];
        const nextIds = new Set();

        for (const record of records) {
            nextIds.add(record.id);
            operations.push({ type: 'set', ref: OrgDb.doc(collectionName, record.id), data: record });
        }

        for (const id of existingIds) {
            if (!nextIds.has(id)) {
                operations.push({ type: 'delete', ref: OrgDb.doc(collectionName, id) });
            }
        }

        return operations;
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

    async function saveAll(contributionsData, blacklistData, budgetData, campaignsData, userRole, currentUserUID) {
        const operations = [];

        if (contributionsData && Object.keys(contributionsData).length > 0) {
            const existing = await OrgDb.getAll('contributions');
            operations.push(...reconcile(
                'contributions',
                ContributionMapper.flattenContributions(contributionsData),
                Object.keys(existing)
            ));
            operations.push(...monthOperations(contributionsData));
        }

        if (blacklistData && userRole === 'admin') {
            const existing = await OrgDb.getAll('blacklist');
            operations.push(...reconcile(
                'blacklist',
                ContributionMapper.flattenBlacklist(blacklistData),
                Object.keys(existing)
            ));
        }

        if (budgetData && currentUserUID) {
            operations.push({ type: 'set', ref: OrgDb.doc('budgets', currentUserUID), data: budgetData });
        }

        if (campaignsData) {
            const { campaigns, campaignContributions } = ContributionMapper.flattenCampaigns(campaignsData);
            const [existingCampaigns, existingContributions] = await Promise.all([
                OrgDb.getAll('campaigns'),
                OrgDb.getAll('campaignContributions')
            ]);

            operations.push(...reconcile('campaigns', campaigns, Object.keys(existingCampaigns)));
            operations.push(...reconcile('campaignContributions', campaignContributions, Object.keys(existingContributions)));
        }

        operations.push({ type: 'set', ref: OrgDb.doc('meta', 'state'), data: { lastSync: Date.now() } });

        await commit(operations);
        return true;
    }

    return { saveAll };
})();
