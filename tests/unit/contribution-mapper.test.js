import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../../org-app/js/contribution-mapper.js'), 'utf8');
const Mapper = new Function('module', `${source}; return ContributionMapper;`)(undefined);

const byId = records => Object.fromEntries(records.map(record => [record.id, record]));

const blob = {
    2025: {
        January: {
            contributions: [
                { name: 'Angela', amount: 500, paid: true },
                { name: 'Joel Ng', amount: 300, paid: false }
            ],
            total: 800
        },
        February: { contributions: [], total: 0 }
    }
};

describe('ContributionMapper — contributions', () => {
    it('mints the same deterministic ids the migration used', () => {
        const flat = Mapper.flattenContributions(blob);
        expect(flat.map(record => record.id)).toEqual(['2025-01-angela', '2025-01-joel-ng']);
    });

    it('suffixes a repeated member within the same month', () => {
        const flat = Mapper.flattenContributions({
            2025: { January: { contributions: [
                { name: 'Angela', amount: 500, paid: true },
                { name: 'Angela', amount: 200, paid: false }
            ] } }
        });
        expect(flat.map(record => record.id)).toEqual(['2025-01-angela', '2025-01-angela--2']);
    });

    it('reuses an id already carried on the row instead of minting a new one', () => {
        const flat = Mapper.flattenContributions({
            2025: { January: { contributions: [
                { id: '2025-01-legacy-id', name: 'Angela', amount: 500, paid: true }
            ] } }
        });
        expect(flat[0].id).toBe('2025-01-legacy-id');
    });

    it('does not collide a new row with an id already in the month', () => {
        const flat = Mapper.flattenContributions({
            2025: { January: { contributions: [
                { id: '2025-01-angela', name: 'Angela', amount: 500, paid: true },
                { name: 'Angela', amount: 200, paid: false }
            ] } }
        });
        expect(flat.map(record => record.id)).toEqual(['2025-01-angela', '2025-01-angela--2']);
    });

    it('survives a full round trip without changing a single id', () => {
        const first = Mapper.flattenContributions(blob);
        const rebuilt = Mapper.rebuildContributions(byId(first), {});
        const second = Mapper.flattenContributions(rebuilt);

        expect(second.map(r => r.id)).toEqual(first.map(r => r.id));
        expect(second).toEqual(first);
    });

    it('preserves notes, createdAt and createdBy across a round trip', () => {
        const flat = [{
            id: '2025-01-angela', memberName: 'Angela', amount: 500, paid: true,
            year: 2025, month: 0, monthName: 'January', date: Date.UTC(2025, 0, 1), deleted: false,
            notes: 'paid in cash', createdAt: 1700000000000, createdBy: 'uid-1'
        }];

        const round = Mapper.flattenContributions(Mapper.rebuildContributions(byId(flat), {}))[0];
        expect(round.notes).toBe('paid in cash');
        expect(round.createdAt).toBe(1700000000000);
        expect(round.createdBy).toBe('uid-1');
    });

    it('rebuilds totals from the records', () => {
        const rebuilt = Mapper.rebuildContributions(byId(Mapper.flattenContributions(blob)), {});
        expect(rebuilt['2025'].January.total).toBe(800);
    });

    it('keeps a month that has no contributions via the months index', () => {
        const rebuilt = Mapper.rebuildContributions({}, {
            '2025-February': { year: 2025, monthName: 'February' }
        });
        expect(rebuilt['2025'].February).toEqual({ contributions: [], total: 0 });
    });

    it('skips soft-deleted records', () => {
        const rebuilt = Mapper.rebuildContributions({
            'a': { id: 'a', memberName: 'Angela', amount: 500, paid: true, year: 2025, monthName: 'January' },
            'b': { id: 'b', memberName: 'Gone', amount: 100, paid: true, year: 2025, monthName: 'January', deleted: true }
        }, {});
        expect(rebuilt['2025'].January.contributions).toHaveLength(1);
    });

    it('drops rows with no usable name', () => {
        const flat = Mapper.flattenContributions({
            2025: { January: { contributions: [{ name: '   ', amount: 5, paid: true }, { amount: 5 }] } }
        });
        expect(flat).toEqual([]);
    });

    it('ignores an unknown month name', () => {
        const flat = Mapper.flattenContributions({
            2025: { Smarch: { contributions: [{ name: 'Angela', amount: 500, paid: true }] } }
        });
        expect(flat).toEqual([]);
    });

    it('coerces amount and paid to their proper types', () => {
        const flat = Mapper.flattenContributions({
            2025: { January: { contributions: [{ name: 'Angela', amount: '500', paid: 'yes' }] } }
        });
        expect(flat[0].amount).toBe(500);
        expect(flat[0].paid).toBe(true);
    });
});

describe('ContributionMapper — blacklist', () => {
    it('slugs names into ids', () => {
        const flat = Mapper.flattenBlacklist({ blacklistedMembers: ['Angela', 'Joel Ng'] });
        expect(flat.map(record => record.id)).toEqual(['angela', 'joel-ng']);
    });

    it('suffixes a duplicate name', () => {
        const flat = Mapper.flattenBlacklist({ blacklistedMembers: ['Angela', 'Angela'] });
        expect(flat.map(record => record.id)).toEqual(['angela', 'angela--2']);
    });

    it('round trips back to the app shape', () => {
        const input = { blacklistedMembers: ['Angela', 'Joel Ng'] };
        expect(Mapper.rebuildBlacklist(byId(Mapper.flattenBlacklist(input)))).toEqual(input);
    });

    it('returns an empty list rather than throwing on missing data', () => {
        expect(Mapper.rebuildBlacklist(null)).toEqual({ blacklistedMembers: [] });
        expect(Mapper.flattenBlacklist(null)).toEqual([]);
    });
});

describe('ContributionMapper — campaigns', () => {
    const campaignsData = {
        camp_1: {
            purpose: 'Roof',
            target: 10000,
            contributions: {
                'camp_1--angela': { contributorName: 'Angela', pledgedAmount: 500, amountPaid: 200, date: 111 }
            }
        }
    };

    it('separates campaign metadata from its contributions', () => {
        const { campaigns, campaignContributions } = Mapper.flattenCampaigns(campaignsData);
        expect(campaigns).toEqual([{ id: 'camp_1', purpose: 'Roof', target: 10000 }]);
        expect(campaignContributions).toHaveLength(1);
        expect(campaignContributions[0].campaignId).toBe('camp_1');
    });

    it('keeps an existing contribution id', () => {
        const { campaignContributions } = Mapper.flattenCampaigns(campaignsData);
        expect(campaignContributions[0].id).toBe('camp_1--angela');
    });

    it('mints a scoped id for a newly added contributor', () => {
        const { campaignContributions } = Mapper.flattenCampaigns({
            camp_1: { contributions: { 1750000000000: { contributorName: 'Joel Ng', pledgedAmount: 100, amountPaid: 0 } } }
        });
        expect(campaignContributions[0].id).toBe('camp_1--joel-ng');
    });

    it('round trips without changing ids', () => {
        const first = Mapper.flattenCampaigns(campaignsData);
        const rebuilt = Mapper.rebuildCampaigns(byId(first.campaigns), byId(first.campaignContributions));
        const second = Mapper.flattenCampaigns(rebuilt);

        expect(second.campaignContributions.map(r => r.id)).toEqual(['camp_1--angela']);
        expect(second.campaigns[0].purpose).toBe('Roof');
    });

    it('drops a contribution whose campaign no longer exists', () => {
        const rebuilt = Mapper.rebuildCampaigns({}, {
            orphan: { id: 'orphan', campaignId: 'gone', contributorName: 'Angela' }
        });
        expect(rebuilt).toEqual({});
    });

    it('defaults a missing contributor name to Unknown', () => {
        const { campaignContributions } = Mapper.flattenCampaigns({
            camp_1: { contributions: { x: { pledgedAmount: 100 } } }
        });
        expect(campaignContributions[0].contributorName).toBe('Unknown');
    });
});
