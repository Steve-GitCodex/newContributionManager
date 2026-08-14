// Converts between the app's year/month blob shape and the flat Firestore documents.
// Ids are deterministic and carried through a round trip so saving never rewrites
// an existing record: `${year}-${MM}-${member-slug}`, with `--2` for repeats.

const ContributionMapper = (function () {
    const MONTHS = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    function slugify(value) {
        const slug = String(value == null ? '' : value)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return slug || 'unnamed';
    }

    function idAllocator(used) {
        return function allocate(base) {
            if (!used.has(base)) {
                used.add(base);
                return base;
            }
            let suffix = 2;
            while (used.has(`${base}--${suffix}`)) suffix++;
            const id = `${base}--${suffix}`;
            used.add(id);
            return id;
        };
    }

    function carry(source, target, fields) {
        for (const field of fields) {
            if (source[field] !== undefined && source[field] !== null) target[field] = source[field];
        }
        return target;
    }

    function flattenContributions(contributionsData) {
        const flat = [];

        for (const year of Object.keys(contributionsData || {})) {
            const yearData = contributionsData[year];
            if (!yearData || typeof yearData !== 'object') continue;

            const yearNum = parseInt(year, 10);
            if (Number.isNaN(yearNum)) continue;

            for (const monthName of Object.keys(yearData)) {
                const monthIndex = MONTHS.indexOf(monthName);
                if (monthIndex === -1) continue;

                const monthData = yearData[monthName];
                const rows = Array.isArray(monthData && monthData.contributions) ? monthData.contributions : [];
                const allocate = idAllocator(new Set(rows.map(row => row && row.id).filter(Boolean)));
                const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

                for (const row of rows) {
                    if (!row || typeof row.name !== 'string' || !row.name.trim()) continue;
                    const memberName = row.name.trim();

                    flat.push(carry(row, {
                        id: row.id || allocate(`${prefix}-${slugify(memberName)}`),
                        memberName,
                        amount: Number(row.amount) || 0,
                        paid: Boolean(row.paid),
                        year: yearNum,
                        month: monthIndex,
                        monthName,
                        date: Date.UTC(yearNum, monthIndex, 1),
                        deleted: false
                    }, ['notes', 'createdAt', 'createdBy']));
                }
            }
        }

        return flat;
    }

    function rebuildContributions(flatContributions, monthsIndex) {
        const rebuilt = {};

        const ensureMonth = (year, monthName) => {
            if (!rebuilt[year]) rebuilt[year] = {};
            if (!rebuilt[year][monthName]) rebuilt[year][monthName] = { contributions: [], total: 0 };
            return rebuilt[year][monthName];
        };

        for (const key of Object.keys(monthsIndex || {})) {
            const entry = monthsIndex[key];
            if (entry && entry.monthName) ensureMonth(String(entry.year), entry.monthName);
        }

        for (const key of Object.keys(flatContributions || {})) {
            const record = flatContributions[key];
            if (!record || record.deleted) continue;

            const month = ensureMonth(String(record.year), record.monthName);
            const amount = Number(record.amount) || 0;

            month.contributions.push(carry(record, {
                id: record.id || key,
                name: record.memberName,
                amount,
                paid: Boolean(record.paid)
            }, ['notes', 'createdAt', 'createdBy']));
            month.total += amount;
        }

        return rebuilt;
    }

    function flattenBlacklist(blacklistData) {
        const names = Array.isArray(blacklistData && blacklistData.blacklistedMembers)
            ? blacklistData.blacklistedMembers
            : [];

        const allocate = idAllocator(new Set());
        return names
            .filter(name => typeof name === 'string' && name.trim())
            .map(name => ({ id: allocate(slugify(name)), memberName: name.trim() }));
    }

    function rebuildBlacklist(flatBlacklist) {
        const blacklistedMembers = Object.keys(flatBlacklist || {})
            .map(key => flatBlacklist[key] && flatBlacklist[key].memberName)
            .filter(name => typeof name === 'string' && name.trim());

        return { blacklistedMembers };
    }

    function flattenCampaigns(campaignsData) {
        const campaigns = [];
        const campaignContributions = [];

        for (const campaignId of Object.keys(campaignsData || {})) {
            const source = campaignsData[campaignId];
            if (!source || typeof source !== 'object') continue;

            const { contributions: nested, ...metadata } = source;
            campaigns.push({ ...metadata, id: campaignId });

            const keys = Object.keys(nested || {});
            const allocate = idAllocator(new Set(keys));

            for (const key of keys) {
                const row = nested[key];
                if (!row || typeof row !== 'object') continue;

                const contributorName = typeof row.contributorName === 'string' && row.contributorName.trim()
                    ? row.contributorName.trim()
                    : 'Unknown';

                const id = key.startsWith(`${campaignId}--`)
                    ? key
                    : allocate(`${campaignId}--${slugify(contributorName)}`);

                campaignContributions.push(carry(row, {
                    id,
                    campaignId,
                    contributorName,
                    pledgedAmount: Number(row.pledgedAmount) || 0,
                    amountPaid: Number(row.amountPaid) || 0,
                    date: row.date || Date.now()
                }, ['notes']));
            }
        }

        return { campaigns, campaignContributions };
    }

    function rebuildCampaigns(campaignsMap, campaignContributionsMap) {
        const campaigns = {};

        for (const campaignId of Object.keys(campaignsMap || {})) {
            const record = campaignsMap[campaignId];
            if (!record) continue;
            campaigns[campaignId] = { ...record, id: record.id || campaignId, contributions: {} };
        }

        for (const key of Object.keys(campaignContributionsMap || {})) {
            const record = campaignContributionsMap[key];
            if (!record || !campaigns[record.campaignId]) continue;

            campaigns[record.campaignId].contributions[record.id || key] = carry(record, {
                id: record.id || key,
                contributorName: record.contributorName,
                pledgedAmount: Number(record.pledgedAmount) || 0,
                amountPaid: Number(record.amountPaid) || 0,
                date: record.date
            }, ['notes']);
        }

        return campaigns;
    }

    return {
        MONTHS,
        slugify,
        flattenContributions,
        rebuildContributions,
        flattenBlacklist,
        rebuildBlacklist,
        flattenCampaigns,
        rebuildCampaigns
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContributionMapper;
}
