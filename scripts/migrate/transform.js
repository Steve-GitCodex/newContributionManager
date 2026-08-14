export const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export function slugifyKey(value) {
    const slug = String(value == null ? '' : value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || 'unnamed';
}

function keyCounter() {
    const seen = new Map();
    return function next(base) {
        const count = (seen.get(base) || 0) + 1;
        seen.set(base, count);
        return count === 1 ? base : `${base}--${count}`;
    };
}

export function transformContributions(contributionsData, migratedAt) {
    const contributions = {};
    const monthsIndex = {};
    const warnings = [];

    for (const year of Object.keys(contributionsData || {})) {
        const yearData = contributionsData[year];
        if (!yearData || typeof yearData !== 'object') continue;

        const yearNum = parseInt(year, 10);
        if (Number.isNaN(yearNum)) {
            warnings.push({ type: 'unparsable_year', year });
            continue;
        }

        for (const monthName of Object.keys(yearData)) {
            const monthIndex = MONTHS.indexOf(monthName);
            if (monthIndex === -1) {
                warnings.push({ type: 'unknown_month', year, monthName });
                continue;
            }

            if (!monthsIndex[year]) monthsIndex[year] = {};
            monthsIndex[year][monthName] = true;

            const monthData = yearData[monthName];
            const rows = Array.isArray(monthData && monthData.contributions)
                ? monthData.contributions
                : [];

            const nextKey = keyCounter();
            for (const row of rows) {
                if (!row || typeof row.name !== 'string' || !row.name.trim()) {
                    warnings.push({ type: 'unnamed_contribution', year, monthName });
                    continue;
                }

                const id = nextKey(`${year}-${String(monthIndex + 1).padStart(2, '0')}-${slugifyKey(row.name)}`);
                contributions[id] = {
                    id,
                    memberName: row.name.trim(),
                    amount: Number(row.amount) || 0,
                    paid: Boolean(row.paid),
                    year: yearNum,
                    month: monthIndex,
                    monthName,
                    date: Date.UTC(yearNum, monthIndex, 1),
                    createdAt: migratedAt,
                    deleted: false
                };
            }
        }
    }

    return { contributions, monthsIndex, warnings };
}

export function transformBlacklist(blacklistData, migratedAt) {
    const blacklist = {};
    const names = Array.isArray(blacklistData && blacklistData.blacklistedMembers)
        ? blacklistData.blacklistedMembers
        : [];

    const nextKey = keyCounter();
    for (const name of names) {
        if (typeof name !== 'string' || !name.trim()) continue;
        const id = nextKey(slugifyKey(name));
        blacklist[id] = { id, memberName: name.trim(), addedAt: migratedAt };
    }

    return blacklist;
}

export function transformCampaigns(specialGiving, migratedAt) {
    const campaigns = {};
    const campaignContributions = {};

    for (const campaignId of Object.keys(specialGiving || {})) {
        const source = specialGiving[campaignId];
        if (!source || typeof source !== 'object') continue;

        const { contributions: nested, ...metadata } = source;
        campaigns[campaignId] = { ...metadata, id: campaignId, migratedAt };

        const nextKey = keyCounter();
        for (const contribId of Object.keys(nested || {})) {
            const row = nested[contribId];
            if (!row || typeof row !== 'object') continue;

            const name = typeof row.contributorName === 'string' && row.contributorName.trim()
                ? row.contributorName.trim()
                : 'Unknown';
            const id = nextKey(`${campaignId}--${slugifyKey(name)}`);

            campaignContributions[id] = {
                id,
                campaignId,
                contributorName: name,
                pledgedAmount: Number(row.pledgedAmount) || 0,
                amountPaid: Number(row.amountPaid) || 0,
                date: row.date || migratedAt,
                ...(row.notes ? { notes: row.notes } : {})
            };
        }
    }

    return { campaigns, campaignContributions };
}

export function extractMembers(contributions, campaignContributions, migratedAt) {
    const members = {};

    const record = name => {
        const id = slugifyKey(name);
        if (members[id]) return;
        members[id] = { id, name, active: true, createdAt: migratedAt };
    };

    for (const id of Object.keys(contributions)) record(contributions[id].memberName);
    for (const id of Object.keys(campaignContributions)) record(campaignContributions[id].contributorName);

    return members;
}

const DOC_COLLECTIONS = [
    'contributions',
    'members',
    'blacklist',
    'campaigns',
    'campaignContributions',
    'users',
    'budgets'
];

export const ORG_COLLECTION = 'organizations';

export function toFirestoreDocuments(payload, slug) {
    const base = `${ORG_COLLECTION}/${slug}`;
    const documents = [];

    for (const collection of DOC_COLLECTIONS) {
        for (const [id, data] of Object.entries(payload[collection] || {})) {
            documents.push({ path: `${base}/${collection}/${id}`, data });
        }
    }

    for (const [year, months] of Object.entries(payload.monthsIndex || {})) {
        for (const monthName of Object.keys(months)) {
            documents.push({
                path: `${base}/months/${year}-${monthName}`,
                data: { year: Number(year), monthName }
            });
        }
    }

    documents.push({ path: `${base}/meta/state`, data: payload.meta || {} });
    documents.push({ path: `${base}/settings/migration`, data: payload.settings.migrationStatus });

    return documents;
}

export function chunk(items, size) {
    const batches = [];
    for (let i = 0; i < items.length; i += size) {
        batches.push(items.slice(i, i + size));
    }
    return batches;
}

export function transformAll(legacy, migratedAt = Date.now()) {
    const { contributions, monthsIndex, warnings } = transformContributions(legacy.contributionsData, migratedAt);
    const blacklist = transformBlacklist(legacy.blacklistData, migratedAt);
    const { campaigns, campaignContributions } = transformCampaigns(legacy.specialGiving, migratedAt);
    const members = extractMembers(contributions, campaignContributions, migratedAt);

    const payload = {
        contributions,
        monthsIndex,
        blacklist,
        campaigns,
        campaignContributions,
        members,
        users: legacy.users || {},
        budgets: legacy.budgets || {},
        meta: { lastSync: migratedAt },
        settings: {
            migrationStatus: { version: 'v2-flat-schema', migratedAt, source: legacy.sourceProjectId || null }
        }
    };

    const stats = {
        contributions: Object.keys(contributions).length,
        months: Object.values(monthsIndex).reduce((sum, months) => sum + Object.keys(months).length, 0),
        blacklist: Object.keys(blacklist).length,
        campaigns: Object.keys(campaigns).length,
        campaignContributions: Object.keys(campaignContributions).length,
        members: Object.keys(members).length,
        users: Object.keys(payload.users).length,
        budgets: Object.keys(payload.budgets).length
    };

    return { payload, stats, warnings };
}
