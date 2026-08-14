// Reads the org's flat Firestore collections and shapes them for the app.

const DataAdapter = (function () {
    async function loadAll() {
        const [
            contributions,
            months,
            blacklist,
            campaigns,
            campaignContributions,
            meta,
            budget
        ] = await Promise.all([
            OrgDb.getAll('contributions'),
            OrgDb.getAll('months'),
            OrgDb.getAll('blacklist'),
            OrgDb.getAll('campaigns'),
            OrgDb.getAll('campaignContributions'),
            OrgDb.getOne('meta', 'state'),
            OrgDb.getOne('budgets', OrgDb.BUDGET_ID)
        ]);

        return {
            contributionsData: ContributionMapper.rebuildContributions(contributions, months),
            blacklistData: ContributionMapper.rebuildBlacklist(blacklist),
            campaignsData: ContributionMapper.rebuildCampaigns(campaigns, campaignContributions),
            budgetData: budget || { expenses: {} },
            lastSyncTime: (meta && meta.lastSync) || null
        };
    }

    return { loadAll };
})();
