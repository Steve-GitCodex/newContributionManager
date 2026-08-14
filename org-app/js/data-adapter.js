// Reads the org's flat Firestore collections and shapes them for the app.
// Contribution rows are not read here: the months index gives every known month a
// skeleton entry, and LoadedScope fills the rows in for the periods actually viewed.

const DataAdapter = (function () {
    async function loadInitial() {
        const [months, blacklist, campaigns, campaignContributions, meta, budget] = await Promise.all([
            OrgDb.getAll('months'),
            OrgDb.getAll('blacklist'),
            OrgDb.getAll('campaigns'),
            OrgDb.getAll('campaignContributions'),
            OrgDb.getOne('meta', 'state'),
            OrgDb.getOne('budgets', OrgDb.BUDGET_ID)
        ]);

        const budgetData = budget || { expenses: {} };
        const contributionsData = ContributionMapper.rebuildContributions({}, months);

        DataWriteAdapter.setBaseline('contributions', {});
        DataWriteAdapter.setBaseline('months', ChangeSet.captureMap(months));
        DataWriteAdapter.setBaseline('blacklist', ChangeSet.captureMap(blacklist));
        DataWriteAdapter.setBaseline('campaigns', ChangeSet.captureMap(campaigns));
        DataWriteAdapter.setBaseline('campaignContributions', ChangeSet.captureMap(campaignContributions));
        DataWriteAdapter.setBaseline('budgets', ChangeSet.captureMap({ [OrgDb.BUDGET_ID]: budgetData }));

        LoadedScope.init(contributionsData);

        return {
            contributionsData,
            blacklistData: ContributionMapper.rebuildBlacklist(blacklist),
            campaignsData: ContributionMapper.rebuildCampaigns(campaigns, campaignContributions),
            budgetData,
            lastSyncTime: (meta && meta.lastSync) || null
        };
    }

    return { loadInitial };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataAdapter;
}
