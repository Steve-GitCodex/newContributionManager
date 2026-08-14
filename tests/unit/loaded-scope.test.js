import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const read = file => readFileSync(resolve(here, '../../org-app/js', file), 'utf8');

const Mapper = new Function('module', `${read('contribution-mapper.js')}; return ContributionMapper;`)(undefined);
const ChangeSet = new Function('module', `${read('change-set.js')}; return ChangeSet;`)(undefined);

const stored = {
    '2026-01-angela': { id: '2026-01-angela', memberName: 'Angela', amount: 500, paid: true, year: 2026, month: 0, monthName: 'January' },
    '2026-02-angela': { id: '2026-02-angela', memberName: 'Angela', amount: 600, paid: false, year: 2026, month: 1, monthName: 'February' },
    '2025-12-joel': { id: '2025-12-joel', memberName: 'Joel', amount: 100, paid: true, year: 2025, month: 11, monthName: 'December' }
};

function makeHarness(failing = false) {
    const ranges = [];
    const merged = [];

    const orgDb = {
        getRange: async (collection, prefix) => {
            ranges.push(prefix);
            if (failing) throw new Error('offline');
            const result = {};
            for (const id of Object.keys(stored)) {
                if (id.startsWith(prefix)) result[id] = stored[id];
            }
            return result;
        },
        getAll: async () => {
            ranges.push('*');
            if (failing) throw new Error('offline');
            return { ...stored };
        }
    };

    const writeAdapter = { mergeBaseline: (name, addition) => merged.push([name, addition]) };

    const scope = new Function('OrgDb', 'ContributionMapper', 'ChangeSet', 'DataWriteAdapter', 'module',
        `${read('loaded-scope.js')}; return LoadedScope;`)(orgDb, Mapper, ChangeSet, writeAdapter, undefined);

    return { scope, ranges, merged };
}

const skeleton = () => ({
    2025: { December: { contributions: [], total: 0 } },
    2026: { January: { contributions: [], total: 0 }, February: { contributions: [], total: 0 } }
});

describe('LoadedScope', () => {
    let harness;
    let blob;

    beforeEach(() => {
        harness = makeHarness();
        blob = skeleton();
        harness.scope.init(blob);
    });

    it('hydrates one month with a separator-terminated prefix', async () => {
        await harness.scope.ensureMonth('2026', 'January');

        expect(harness.ranges).toEqual(['2026-01-']);
        expect(blob['2026'].January.contributions.map(row => row.name)).toEqual(['Angela']);
        expect(blob['2026'].January.total).toBe(500);
    });

    it('leaves other months untouched when hydrating one', async () => {
        await harness.scope.ensureMonth('2026', 'January');
        expect(blob['2026'].February.contributions).toEqual([]);
    });

    it('does not fetch the same month twice', async () => {
        await harness.scope.ensureMonth('2026', 'January');
        await harness.scope.ensureMonth('2026', 'January');

        expect(harness.ranges).toEqual(['2026-01-']);
    });

    it('accepts a numeric year', async () => {
        await harness.scope.ensureMonth(2026, 'January');
        expect(harness.scope.isLoaded('2026', 'January')).toBe(true);
    });

    it('hydrates a whole year in one fetch', async () => {
        await harness.scope.ensureYear('2026');

        expect(harness.ranges).toEqual(['2026-']);
        expect(harness.scope.isLoaded('2026', 'January')).toBe(true);
        expect(harness.scope.isLoaded('2026', 'February')).toBe(true);
        expect(harness.scope.isLoaded('2025', 'December')).toBe(false);
    });

    it('does not refetch a month that a year fetch already covered', async () => {
        await harness.scope.ensureYear('2026');
        await harness.scope.ensureMonth('2026', 'February');

        expect(harness.ranges).toEqual(['2026-']);
    });

    it('still fetches the year when only one of its months is loaded', async () => {
        await harness.scope.ensureMonth('2026', 'January');
        await harness.scope.ensureYear('2026');

        expect(harness.ranges).toEqual(['2026-01-', '2026-']);
    });

    it('hydrates everything once', async () => {
        await harness.scope.ensureAll();
        await harness.scope.ensureAll();
        await harness.scope.ensureMonth('2025', 'December');

        expect(harness.ranges).toEqual(['*']);
        expect(blob['2025'].December.contributions.map(row => row.name)).toEqual(['Joel']);
    });

    it('feeds what it fetched into the write baseline', async () => {
        await harness.scope.ensureMonth('2026', 'January');

        expect(harness.merged).toHaveLength(1);
        expect(harness.merged[0][0]).toBe('contributions');
        expect(Object.keys(harness.merged[0][1])).toEqual(['2026-01-angela']);
    });

    it('reports an unhydrated month as not loaded', () => {
        expect(harness.scope.isLoaded('2026', 'January')).toBe(false);
    });

    it('throws when a required month is not hydrated', () => {
        expect(() => harness.scope.requireLoaded('2026', 'January')).toThrow(/not loaded/i);
    });

    it('throws when a required year is only partly hydrated', async () => {
        await harness.scope.ensureMonth('2026', 'January');
        expect(() => harness.scope.requireYear('2026')).toThrow(/not loaded/i);
    });

    it('accepts a fully hydrated year', async () => {
        await harness.scope.ensureYear('2026');
        expect(() => harness.scope.requireYear('2026')).not.toThrow();
    });

    it('throws from requireAll until everything is hydrated', async () => {
        expect(() => harness.scope.requireAll()).toThrow(/not loaded/i);
        await harness.scope.ensureAll();
        expect(() => harness.scope.requireAll()).not.toThrow();
    });

    it('does not mark a scope loaded when the fetch fails', async () => {
        const failing = makeHarness(true);
        const target = skeleton();
        failing.scope.init(target);

        await expect(failing.scope.ensureMonth('2026', 'January')).rejects.toThrow('offline');
        expect(failing.scope.isLoaded('2026', 'January')).toBe(false);
    });

    it('retries a scope whose first fetch failed', async () => {
        let attempts = 0;
        const orgDb = {
            getRange: async () => {
                attempts++;
                if (attempts === 1) throw new Error('offline');
                return {};
            },
            getAll: async () => ({})
        };

        const scope = new Function('OrgDb', 'ContributionMapper', 'ChangeSet', 'DataWriteAdapter', 'module',
            `${read('loaded-scope.js')}; return LoadedScope;`)(orgDb, Mapper, ChangeSet, { mergeBaseline: () => {} }, undefined);

        scope.init(skeleton());

        await expect(scope.ensureMonth('2026', 'January')).rejects.toThrow('offline');
        await scope.ensureMonth('2026', 'January');

        expect(attempts).toBe(2);
    });

    it('collapses concurrent requests for the same month into one fetch', async () => {
        await Promise.all([
            harness.scope.ensureMonth('2026', 'January'),
            harness.scope.ensureMonth('2026', 'January')
        ]);

        expect(harness.ranges).toEqual(['2026-01-']);
    });

    it('preserves an in-memory edit when ensureYear re-fetches the year', async () => {
        await harness.scope.ensureMonth('2026', 'January');
        blob['2026'].January.contributions.push({ name: 'Unsaved', amount: 999 });

        await harness.scope.ensureYear('2026');

        expect(blob['2026'].January.contributions.map(row => row.name)).toEqual(['Angela', 'Unsaved']);
        expect(blob['2026'].February.contributions.map(row => row.name)).toEqual(['Angela']);
    });

    it('preserves an in-memory edit when ensureAll re-fetches everything', async () => {
        await harness.scope.ensureMonth('2026', 'January');
        blob['2026'].January.contributions.push({ name: 'Unsaved', amount: 999 });

        await harness.scope.ensureAll();

        expect(blob['2026'].January.contributions.map(row => row.name)).toEqual(['Angela', 'Unsaved']);
        expect(blob['2025'].December.contributions.map(row => row.name)).toEqual(['Joel']);
    });

    it('short-circuits a second ensureYear call for a year with no known months', async () => {
        await harness.scope.ensureYear('2024');
        await harness.scope.ensureYear('2024');

        expect(harness.ranges).toEqual(['2024-']);
    });

    it('feeds an already-loaded month\'s fetched rows into the write baseline', async () => {
        await harness.scope.ensureMonth('2026', 'January');
        await harness.scope.ensureYear('2026');

        const contributionMerges = harness.merged.filter(([name]) => name === 'contributions');
        expect(contributionMerges).toHaveLength(2);
        expect(Object.keys(contributionMerges[1][1])).toEqual(
            expect.arrayContaining(['2026-01-angela', '2026-02-angela'])
        );
    });
});

const periodRows = {
    '2025-07-angela': { id: '2025-07-angela', memberName: 'Angela', amount: 500, paid: true, year: 2025, month: 6, monthName: 'July' },
    '2025-08-joel': { id: '2025-08-joel', memberName: 'Joel', amount: 300, paid: false, year: 2025, month: 7, monthName: 'August' }
};

function makeWiredHarness() {
    let releaseCommit;
    const commitGate = new Promise(resolve => { releaseCommit = resolve; });
    const committed = [];
    let gateCommits = false;

    const orgDb = {
        BUDGET_ID: 'org',
        doc: (collection, id) => ({ collection, id }),
        getRange: async (collection, prefix) => {
            const result = {};
            for (const id of Object.keys(periodRows)) {
                if (id.startsWith(prefix)) result[id] = periodRows[id];
            }
            return result;
        },
        getAll: async () => ({ ...periodRows }),
        batch: () => {
            const operations = [];
            return {
                set: (ref, data) => operations.push({ type: 'set', ref, data }),
                delete: ref => operations.push({ type: 'delete', ref }),
                commit: async () => {
                    if (gateCommits) await commitGate;
                    committed.push(...operations);
                }
            };
        }
    };

    const adapter = new Function('OrgDb', 'ContributionMapper', 'ChangeSet', 'module',
        `${read('data-write-adapter.js')}; return DataWriteAdapter;`)(orgDb, Mapper, ChangeSet, undefined);

    const scope = new Function('OrgDb', 'ContributionMapper', 'ChangeSet', 'DataWriteAdapter', 'module',
        `${read('loaded-scope.js')}; return LoadedScope;`)(orgDb, Mapper, ChangeSet, adapter, undefined);

    return {
        adapter,
        scope,
        committed,
        holdCommits: () => { gateCommits = true; },
        releaseCommits: () => { gateCommits = false; releaseCommit(); }
    };
}

describe('LoadedScope hydrating while a save is in flight', () => {
    it('keeps a mid-save hydration in the baseline so a later removal is persisted', async () => {
        const wired = makeWiredHarness();
        const blob = {
            2025: { July: { contributions: [], total: 0 }, August: { contributions: [], total: 0 } }
        };

        wired.adapter.setBaseline('contributions', {});
        wired.scope.init(blob);

        await wired.scope.ensureMonth(2025, 'August');

        wired.holdCommits();
        const saving = wired.adapter.saveAll(blob, null, null, null, 'admin');

        await wired.scope.ensureMonth(2025, 'July');
        expect(blob['2025'].July.contributions.map(row => row.name)).toEqual(['Angela']);

        wired.releaseCommits();
        await saving;

        blob['2025'].July.contributions = [];
        wired.committed.length = 0;
        await wired.adapter.saveAll(blob, null, null, null, 'admin');

        const deletes = wired.committed.filter(op => op.ref.collection === 'contributions' && op.type === 'delete');
        expect(deletes.map(op => op.ref.id)).toEqual(['2025-07-angela']);
    });

    it('does not delete a month a resync dropped from the baseline mid-save', async () => {
        const wired = makeWiredHarness();
        const blob = {
            2025: { July: { contributions: [], total: 0 }, August: { contributions: [], total: 0 } }
        };

        wired.adapter.setBaseline('contributions', {});
        wired.scope.init(blob);
        await wired.scope.ensureYear(2025);

        wired.holdCommits();
        const saving = wired.adapter.saveAll(blob, null, null, null, 'admin');

        const resynced = {
            2025: { July: { contributions: [], total: 0 }, August: { contributions: [], total: 0 } }
        };
        wired.adapter.setBaseline('contributions', {});
        wired.scope.init(resynced);
        await wired.scope.ensureMonth(2025, 'August');

        wired.releaseCommits();
        await saving;

        wired.committed.length = 0;
        await wired.adapter.saveAll(resynced, null, null, null, 'admin');

        const deletes = wired.committed.filter(op => op.ref.collection === 'contributions' && op.type === 'delete');
        expect(deletes).toEqual([]);
    });
});
