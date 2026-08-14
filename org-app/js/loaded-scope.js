// Which contribution rows are actually in memory. The blob carries a skeleton entry for
// every month the index knows about, so an unhydrated month is indistinguishable from an
// empty one by shape alone — this registry is the difference.

const LoadedScope = (function () {
    let blob = {};
    let loaded = new Set();
    let loadedYears = new Set();
    let inFlight = new Map();
    let everything = false;

    function init(contributionsData) {
        blob = contributionsData || {};
        loaded = new Set();
        loadedYears = new Set();
        inFlight = new Map();
        everything = false;
    }

    function monthPrefix(year, monthName) {
        const index = ContributionMapper.MONTHS.indexOf(monthName);
        if (index === -1) throw new Error(`Unknown month: ${monthName}`);
        return `${year}-${String(index + 1).padStart(2, '0')}-`;
    }

    function key(year, monthName) {
        return `${year}-${monthName}`;
    }

    function knownMonths(year) {
        return Object.keys(blob[String(year)] || {})
            .filter(monthName => ContributionMapper.MONTHS.indexOf(monthName) !== -1);
    }

    function merge(fetched) {
        const rebuilt = ContributionMapper.rebuildContributions(fetched, {});

        for (const year of Object.keys(rebuilt)) {
            if (!blob[year]) blob[year] = {};
            for (const monthName of Object.keys(rebuilt[year])) {
                if (loaded.has(key(year, monthName))) continue;
                blob[year][monthName] = rebuilt[year][monthName];
            }
        }

        DataWriteAdapter.mergeBaseline('contributions', ChangeSet.captureMap(fetched));
    }

    function once(scopeKey, fetch) {
        if (inFlight.has(scopeKey)) return inFlight.get(scopeKey);

        const pending = fetch()
            .then(fetched => { merge(fetched); })
            .finally(() => { inFlight.delete(scopeKey); });

        inFlight.set(scopeKey, pending);
        return pending;
    }

    async function ensureMonth(year, monthName) {
        const yearKey = String(year);
        if (everything || loaded.has(key(yearKey, monthName))) return;

        await once(key(yearKey, monthName), () => OrgDb.getRange('contributions', monthPrefix(yearKey, monthName)));
        loaded.add(key(yearKey, monthName));
    }

    async function ensureYear(year) {
        const yearKey = String(year);
        if (everything || loadedYears.has(yearKey)) return;

        await once(`year:${yearKey}`, () => OrgDb.getRange('contributions', `${yearKey}-`));
        for (const monthName of knownMonths(yearKey)) loaded.add(key(yearKey, monthName));
        loadedYears.add(yearKey);
    }

    async function ensureAll() {
        if (everything) return;

        await once('all', () => OrgDb.getAll('contributions'));
        for (const year of Object.keys(blob)) {
            for (const monthName of knownMonths(year)) loaded.add(key(year, monthName));
        }
        everything = true;
    }

    function isLoaded(year, monthName) {
        return everything || loaded.has(key(String(year), monthName));
    }

    function requireLoaded(year, monthName) {
        if (!isLoaded(year, monthName)) {
            throw new Error(`Contributions for ${monthName} ${year} are not loaded`);
        }
    }

    function requireYear(year) {
        for (const monthName of knownMonths(year)) requireLoaded(year, monthName);
    }

    function requireAll() {
        if (!everything) throw new Error('Full contribution history is not loaded');
    }

    return { init, ensureMonth, ensureYear, ensureAll, isLoaded, requireLoaded, requireYear, requireAll };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoadedScope;
}
