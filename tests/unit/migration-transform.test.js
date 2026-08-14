import { describe, it, expect } from 'vitest';
import {
    slugifyKey,
    transformContributions,
    transformBlacklist,
    transformCampaigns,
    extractMembers,
    transformAll,
    toFirestoreDocuments,
    chunk
} from '../../scripts/migrate/transform.js';

const AT = 1770000000000;

const legacyBlob = {
    2026: {
        January: {
            total: 3000,
            contributions: [
                { name: 'Jane Doe', amount: 1000, paid: true },
                { name: 'John Mwangi', amount: 2000, paid: false }
            ]
        },
        February: { total: 0, contributions: [] }
    }
};

describe('slugifyKey', () => {
    it('lowercases and hyphenates', () => {
        expect(slugifyKey('Jane Doe')).toBe('jane-doe');
    });

    it('strips characters Firebase forbids in keys', () => {
        expect(slugifyKey('a.b$c#d[e]f/g')).toBe('a-b-c-d-e-f-g');
    });

    it('falls back rather than producing an empty key', () => {
        expect(slugifyKey('...')).toBe('unnamed');
        expect(slugifyKey(null)).toBe('unnamed');
    });
});

describe('transformContributions', () => {
    it('flattens contributions with readable ids', () => {
        const { contributions } = transformContributions(legacyBlob, AT);
        expect(Object.keys(contributions).sort()).toEqual([
            '2026-01-jane-doe',
            '2026-01-john-mwangi'
        ]);
    });

    it('produces identical ids on a second run', () => {
        const first = transformContributions(legacyBlob, AT).contributions;
        const second = transformContributions(legacyBlob, AT + 999999).contributions;
        expect(Object.keys(second).sort()).toEqual(Object.keys(first).sort());
    });

    it('disambiguates a repeated name within one month', () => {
        const blob = {
            2026: {
                January: {
                    contributions: [
                        { name: 'Jane Doe', amount: 100, paid: true },
                        { name: 'Jane Doe', amount: 250, paid: false }
                    ]
                }
            }
        };
        const { contributions } = transformContributions(blob, AT);
        expect(Object.keys(contributions).sort()).toEqual([
            '2026-01-jane-doe',
            '2026-01-jane-doe--2'
        ]);
        expect(contributions['2026-01-jane-doe--2'].amount).toBe(250);
    });

    it('preserves a month that has no contributions', () => {
        const { monthsIndex } = transformContributions(legacyBlob, AT);
        expect(monthsIndex['2026'].February).toBe(true);
    });

    it('indexes every month, populated or not', () => {
        const { monthsIndex } = transformContributions(legacyBlob, AT);
        expect(Object.keys(monthsIndex['2026']).sort()).toEqual(['February', 'January']);
    });

    it('carries amount, paid and month index onto each record', () => {
        const { contributions } = transformContributions(legacyBlob, AT);
        const jane = contributions['2026-01-jane-doe'];
        expect(jane).toMatchObject({
            memberName: 'Jane Doe',
            amount: 1000,
            paid: true,
            year: 2026,
            month: 0,
            monthName: 'January',
            deleted: false
        });
    });

    it('warns instead of silently dropping an unknown month', () => {
        const { contributions, warnings } = transformContributions(
            { 2026: { Sept: { contributions: [{ name: 'X', amount: 1, paid: true }] } } },
            AT
        );
        expect(Object.keys(contributions)).toHaveLength(0);
        expect(warnings).toEqual([{ type: 'unknown_month', year: '2026', monthName: 'Sept' }]);
    });

    it('warns on a contribution with no usable name', () => {
        const { warnings } = transformContributions(
            { 2026: { January: { contributions: [{ name: '  ', amount: 5, paid: false }] } } },
            AT
        );
        expect(warnings[0].type).toBe('unnamed_contribution');
    });

    it('coerces missing amounts to zero rather than NaN', () => {
        const { contributions } = transformContributions(
            { 2026: { January: { contributions: [{ name: 'Jane', paid: false }] } } },
            AT
        );
        expect(contributions['2026-01-jane'].amount).toBe(0);
    });
});

describe('transformBlacklist', () => {
    it('flattens names into keyed records', () => {
        const result = transformBlacklist({ blacklistedMembers: ['Jane Doe', 'John Mwangi'] }, AT);
        expect(Object.keys(result).sort()).toEqual(['jane-doe', 'john-mwangi']);
        expect(result['jane-doe'].memberName).toBe('Jane Doe');
    });

    it('handles a missing blacklist', () => {
        expect(transformBlacklist(undefined, AT)).toEqual({});
        expect(transformBlacklist({}, AT)).toEqual({});
    });
});

describe('transformCampaigns', () => {
    const specialGiving = {
        camp_1: {
            purpose: 'Roof Repair',
            targetAmount: 500000,
            contributions: {
                a: { contributorName: 'Jane Doe', pledgedAmount: 5000, amountPaid: 5000 }
            }
        },
        camp_2: { purpose: 'Chairs', targetAmount: 20000 }
    };

    it('keeps a campaign that has no contributions yet', () => {
        const { campaigns } = transformCampaigns(specialGiving, AT);
        expect(Object.keys(campaigns).sort()).toEqual(['camp_1', 'camp_2']);
    });

    it('lifts nested contributions into their own collection', () => {
        const { campaignContributions } = transformCampaigns(specialGiving, AT);
        expect(Object.keys(campaignContributions)).toEqual(['camp_1--jane-doe']);
        expect(campaignContributions['camp_1--jane-doe']).toMatchObject({
            campaignId: 'camp_1',
            contributorName: 'Jane Doe',
            pledgedAmount: 5000,
            amountPaid: 5000
        });
    });

    it('does not leave nested contributions on the campaign record', () => {
        const { campaigns } = transformCampaigns(specialGiving, AT);
        expect(campaigns.camp_1.contributions).toBeUndefined();
        expect(campaigns.camp_1.purpose).toBe('Roof Repair');
    });
});

describe('extractMembers', () => {
    it('builds a roster from both contribution sources without duplicates', () => {
        const contributions = { x: { memberName: 'Jane Doe' }, y: { memberName: 'Jane Doe' } };
        const campaignContributions = { z: { contributorName: 'Paul Mutua' } };
        const members = extractMembers(contributions, campaignContributions, AT);
        expect(Object.keys(members).sort()).toEqual(['jane-doe', 'paul-mutua']);
    });
});

describe('transformAll', () => {
    const legacy = {
        contributionsData: legacyBlob,
        blacklistData: { blacklistedMembers: ['Old Member'] },
        specialGiving: { camp_1: { purpose: 'Roof' } },
        users: { uid1: { email: 'a@b.com', role: 'admin' } },
        budgets: { uid1: { expenses: {} } }
    };

    it('reports counts for every collection', () => {
        const { stats } = transformAll(legacy, AT);
        expect(stats).toMatchObject({
            contributions: 2,
            months: 2,
            blacklist: 1,
            campaigns: 1,
            campaignContributions: 0,
            members: 2,
            users: 1,
            budgets: 1
        });
    });

    it('passes users and budgets through untouched so preserved UIDs still key them', () => {
        const { payload } = transformAll(legacy, AT);
        expect(payload.users).toEqual(legacy.users);
        expect(payload.budgets).toEqual(legacy.budgets);
    });

    it('stamps the migration marker', () => {
        const { payload } = transformAll(legacy, AT);
        expect(payload.settings.migrationStatus).toMatchObject({
            version: 'v2-flat-schema',
            migratedAt: AT
        });
    });

    it('is deterministic across runs', () => {
        expect(transformAll(legacy, AT).payload).toEqual(transformAll(legacy, AT).payload);
    });
});

describe('toFirestoreDocuments', () => {
    const { payload } = transformAll(
        {
            contributionsData: legacyBlob,
            blacklistData: { blacklistedMembers: ['Old Member'] },
            specialGiving: { camp_1: { purpose: 'Roof' } },
            users: { uid1: { email: 'a@b.com', role: 'admin' } },
            budgets: { uid1: { expenses: {} } }
        },
        AT
    );
    const docs = toFirestoreDocuments(payload, 'aic-isovya-praise');
    const paths = docs.map(d => d.path);

    it('nests every collection under the org document', () => {
        expect(paths.every(p => p.startsWith('organizations/aic-isovya-praise/'))).toBe(true);
    });

    it('produces an even segment count so each path lands on a document', () => {
        expect(paths.every(p => p.split('/').length % 2 === 0)).toBe(true);
    });

    it('maps contributions into their own subcollection', () => {
        expect(paths).toContain('organizations/aic-isovya-praise/contributions/2026-01-jane-doe');
    });

    it('writes one document per month, including empty ones', () => {
        expect(paths).toContain('organizations/aic-isovya-praise/months/2026-January');
        expect(paths).toContain('organizations/aic-isovya-praise/months/2026-February');
    });

    it('carries year and month name as queryable fields', () => {
        const february = docs.find(d => d.path.endsWith('months/2026-February'));
        expect(february.data).toEqual({ year: 2026, monthName: 'February' });
    });

    it('keeps users and budgets keyed by uid', () => {
        expect(paths).toContain('organizations/aic-isovya-praise/users/uid1');
        expect(paths).toContain('organizations/aic-isovya-praise/budgets/uid1');
    });

    it('records the migration marker as a document', () => {
        const marker = docs.find(d => d.path.endsWith('settings/migration'));
        expect(marker.data.version).toBe('v2-flat-schema');
    });

    it('emits no duplicate paths', () => {
        expect(new Set(paths).size).toBe(paths.length);
    });
});

describe('chunk', () => {
    it('splits into batches under the limit', () => {
        expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('returns a single batch when under the limit', () => {
        expect(chunk([1, 2], 500)).toEqual([[1, 2]]);
    });

    it('returns nothing for an empty list', () => {
        expect(chunk([], 500)).toEqual([]);
    });
});
