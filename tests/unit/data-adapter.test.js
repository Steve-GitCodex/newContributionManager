import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const read = file => readFileSync(resolve(here, '../../org-app/js', file), 'utf8');

const Mapper = new Function('module', `${read('contribution-mapper.js')}; return ContributionMapper;`)(undefined);
const ChangeSet = new Function('module', `${read('change-set.js')}; return ChangeSet;`)(undefined);

function makeHarness() {
    const fetched = [];
    const baselines = [];
    const initialised = [];

    const collections = {
        months: {
            '2026-January': { year: 2026, monthName: 'January' },
            '2026-February': { year: 2026, monthName: 'February' }
        },
        blacklist: { angela: { memberName: 'Angela' } },
        campaigns: { camp_1: { id: 'camp_1', purpose: 'Roof' } },
        campaignContributions: {}
    };

    const orgDb = {
        BUDGET_ID: 'org',
        getAll: async name => { fetched.push(name); return collections[name] || {}; },
        getOne: async (name, id) => {
            fetched.push(`${name}/${id}`);
            if (name === 'meta') return { lastSync: 1234 };
            return { expenses: { e1: { amount: 10 } } };
        }
    };

    const adapter = new Function('OrgDb', 'ContributionMapper', 'ChangeSet', 'DataWriteAdapter', 'LoadedScope', 'module',
        `${read('data-adapter.js')}; return DataAdapter;`)(
        orgDb,
        Mapper,
        ChangeSet,
        { setBaseline: (name, baseline) => baselines.push([name, baseline]) },
        { init: blob => initialised.push(blob) },
        undefined
    );

    return { adapter, fetched, baselines, initialised };
}

describe('DataAdapter.loadInitial', () => {
    it('never reads the contributions collection', async () => {
        const harness = makeHarness();
        await harness.adapter.loadInitial();

        expect(harness.fetched).not.toContain('contributions');
    });

    it('builds a month skeleton with no rows', async () => {
        const harness = makeHarness();
        const data = await harness.adapter.loadInitial();

        expect(Object.keys(data.contributionsData)).toEqual(['2026']);
        expect(Object.keys(data.contributionsData['2026']).sort()).toEqual(['February', 'January']);
        expect(data.contributionsData['2026'].January.contributions).toEqual([]);
        expect(data.contributionsData['2026'].January.total).toBe(0);
    });

    it('hands the skeleton to LoadedScope', async () => {
        const harness = makeHarness();
        const data = await harness.adapter.loadInitial();

        expect(harness.initialised).toHaveLength(1);
        expect(harness.initialised[0]).toBe(data.contributionsData);
    });

    it('seeds an empty contributions baseline', async () => {
        const harness = makeHarness();
        await harness.adapter.loadInitial();

        const contributions = harness.baselines.find(entry => entry[0] === 'contributions');
        expect(contributions[1]).toEqual({});
    });

    it('seeds baselines for the eagerly loaded collections', async () => {
        const harness = makeHarness();
        await harness.adapter.loadInitial();

        const names = harness.baselines.map(entry => entry[0]).sort();
        expect(names).toEqual(['blacklist', 'budgets', 'campaignContributions', 'campaigns', 'contributions', 'months']);
    });

    it('seeds the budget baseline under the org document id', async () => {
        const harness = makeHarness();
        await harness.adapter.loadInitial();

        const budgets = harness.baselines.find(entry => entry[0] === 'budgets');
        expect(Object.keys(budgets[1])).toEqual(['org']);
    });

    it('returns the remaining collections unchanged', async () => {
        const harness = makeHarness();
        const data = await harness.adapter.loadInitial();

        expect(data.blacklistData.blacklistedMembers).toEqual(['Angela']);
        expect(Object.keys(data.campaignsData)).toEqual(['camp_1']);
        expect(data.budgetData).toEqual({ expenses: { e1: { amount: 10 } } });
        expect(data.lastSyncTime).toBe(1234);
    });
});
