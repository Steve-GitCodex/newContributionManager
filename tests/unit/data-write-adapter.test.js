import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const read = file => readFileSync(resolve(here, '../../org-app/js', file), 'utf8');

const Mapper = new Function('module', `${read('contribution-mapper.js')}; return ContributionMapper;`)(undefined);
const ChangeSet = new Function('module', `${read('change-set.js')}; return ChangeSet;`)(undefined);

function makeOrgDb(commitGate) {
    const committed = [];
    const batches = [];
    const reads = [];

    const orgDb = {
        BUDGET_ID: 'org',
        doc: (collection, id) => ({ collection, id }),
        getAll: async collection => { reads.push(collection); return {}; },
        getRange: async collection => { reads.push(collection); return {}; },
        batch: () => {
            const operations = [];
            batches.push(operations);
            return {
                set: (ref, data) => operations.push({ type: 'set', ref, data }),
                delete: ref => operations.push({ type: 'delete', ref }),
                commit: async () => { if (commitGate) await commitGate; committed.push(...operations); }
            };
        }
    };

    return { orgDb, committed, batches, reads };
}

function loadAdapter(orgDb) {
    return new Function('OrgDb', 'ContributionMapper', 'ChangeSet',
        `${read('data-write-adapter.js')}; return DataWriteAdapter;`)(orgDb, Mapper, ChangeSet);
}

const contributionsBlob = {
    2025: { January: { contributions: [{ name: 'Angela', amount: 500, paid: true }] } }
};

const opsFor = (committed, collection) => committed.filter(op => op.ref.collection === collection);

describe('DataWriteAdapter', () => {
    let harness;
    let adapter;

    beforeEach(() => {
        harness = makeOrgDb();
        adapter = loadAdapter(harness.orgDb);
    });

    it('writes contributions under their stable ids', async () => {
        await adapter.saveAll(contributionsBlob, null, null, null, 'admin');
        const writes = opsFor(harness.committed, 'contributions');

        expect(writes).toHaveLength(1);
        expect(writes[0].ref.id).toBe('2025-01-angela');
        expect(writes[0].type).toBe('set');
    });

    it('writes nothing for contributions when nothing changed since the baseline', async () => {
        adapter.setBaseline('contributions', ChangeSet.capture(Mapper.flattenContributions(contributionsBlob)));
        adapter.setBaseline('months', ChangeSet.capture([{ id: '2025-January', year: 2025, monthName: 'January' }]));

        await adapter.saveAll(contributionsBlob, null, null, null, 'admin');

        expect(opsFor(harness.committed, 'contributions')).toEqual([]);
        expect(opsFor(harness.committed, 'months')).toEqual([]);
    });

    it('writes only the record that changed', async () => {
        adapter.setBaseline('contributions', ChangeSet.capture(Mapper.flattenContributions({
            2025: {
                January: {
                    contributions: [
                        { id: '2025-01-angela', name: 'Angela', amount: 500, paid: false },
                        { id: '2025-01-joel', name: 'Joel', amount: 300, paid: false }
                    ]
                }
            }
        })));

        await adapter.saveAll({
            2025: {
                January: {
                    contributions: [
                        { id: '2025-01-angela', name: 'Angela', amount: 500, paid: true },
                        { id: '2025-01-joel', name: 'Joel', amount: 300, paid: false }
                    ]
                }
            }
        }, null, null, null, 'admin');

        const writes = opsFor(harness.committed, 'contributions').filter(op => op.type === 'set');
        expect(writes.map(op => op.ref.id)).toEqual(['2025-01-angela']);
    });

    it('deletes a record the baseline holds and the blob no longer has', async () => {
        adapter.setBaseline('contributions', ChangeSet.captureMap({
            '2025-01-angela': { memberName: 'Angela', amount: 500, paid: true, year: 2025, month: 0, monthName: 'January' },
            '2025-01-removed': { memberName: 'Removed', amount: 100, paid: false, year: 2025, month: 0, monthName: 'January' }
        }));

        await adapter.saveAll(contributionsBlob, null, null, null, 'admin');

        const deletes = opsFor(harness.committed, 'contributions').filter(op => op.type === 'delete');
        expect(deletes.map(op => op.ref.id)).toEqual(['2025-01-removed']);
    });

    it('never deletes a record from a month that was never loaded', async () => {
        adapter.setBaseline('contributions', ChangeSet.capture(Mapper.flattenContributions(contributionsBlob)));

        await adapter.saveAll({
            2025: {
                January: { contributions: [{ name: 'Angela', amount: 500, paid: true }] },
                March: { contributions: [] }
            }
        }, null, null, null, 'admin');

        expect(opsFor(harness.committed, 'contributions').filter(op => op.type === 'delete')).toEqual([]);
    });

    it('reads nothing from Firestore while saving', async () => {
        await adapter.saveAll(contributionsBlob, null, null, null, 'admin');
        expect(harness.reads).toEqual([]);
    });

    it('records the month so an empty month is not lost', async () => {
        await adapter.saveAll(contributionsBlob, null, null, null, 'admin');
        const writes = opsFor(harness.committed, 'months');

        expect(writes.map(op => op.ref.id)).toEqual(['2025-January']);
        expect(writes[0].data).toEqual({ year: 2025, monthName: 'January' });
    });

    it('writes the blacklist for an admin', async () => {
        await adapter.saveAll(null, { blacklistedMembers: ['Angela'] }, null, null, 'admin');
        expect(opsFor(harness.committed, 'blacklist').map(op => op.ref.id)).toEqual(['angela']);
    });

    it('refuses to write the blacklist for a non-admin', async () => {
        await adapter.saveAll(null, { blacklistedMembers: ['Angela'] }, null, null, 'editor');
        expect(opsFor(harness.committed, 'blacklist')).toEqual([]);
    });

    it('writes the budget to the single org document', async () => {
        await adapter.saveAll(null, null, { expenses: { e1: 10 } }, null, 'admin');
        const writes = opsFor(harness.committed, 'budgets');

        expect(writes).toHaveLength(1);
        expect(writes[0].ref.id).toBe('org');
        expect(writes[0].data).toEqual({ expenses: { e1: 10 } });
    });

    it('does not rewrite an unchanged budget', async () => {
        adapter.setBaseline('budgets', ChangeSet.capture([{ id: 'org', expenses: { e1: 10 } }]));
        await adapter.saveAll(null, null, { expenses: { e1: 10 } }, null, 'admin');

        expect(opsFor(harness.committed, 'budgets')).toEqual([]);
    });

    it('refuses to write the budget for a non-admin', async () => {
        await adapter.saveAll(null, null, { expenses: { e1: 10 } }, null, 'editor');
        expect(opsFor(harness.committed, 'budgets')).toEqual([]);
    });

    it('writes campaigns to the campaigns collection, not specialGiving', async () => {
        await adapter.saveAll(null, null, null, {
            camp_1: { purpose: 'Roof', contributions: { 'camp_1--angela': { contributorName: 'Angela', pledgedAmount: 500, amountPaid: 100 } } }
        }, 'admin');

        expect(opsFor(harness.committed, 'campaigns').map(op => op.ref.id)).toEqual(['camp_1']);
        expect(opsFor(harness.committed, 'campaignContributions').map(op => op.ref.id)).toEqual(['camp_1--angela']);
        expect(opsFor(harness.committed, 'specialGiving')).toEqual([]);
    });

    it('always stamps meta/state with the sync time', async () => {
        await adapter.saveAll(contributionsBlob, null, null, null, 'admin');
        const meta = opsFor(harness.committed, 'meta');

        expect(meta).toHaveLength(1);
        expect(meta[0].ref.id).toBe('state');
        expect(typeof meta[0].data.lastSync).toBe('number');
    });

    it('adopts the written records as the new baseline', async () => {
        await adapter.saveAll(contributionsBlob, null, null, null, 'admin');
        expect(opsFor(harness.committed, 'contributions')).toHaveLength(1);

        await adapter.saveAll(contributionsBlob, null, null, null, 'admin');
        expect(opsFor(harness.committed, 'contributions')).toHaveLength(1);
    });

    it('never exceeds the Firestore batch limit', async () => {
        const contributions = [];
        for (let i = 0; i < 1200; i++) contributions.push({ name: `Member ${i}`, amount: 10, paid: true });

        await adapter.saveAll({ 2025: { January: { contributions } } }, null, null, null, 'admin');

        expect(harness.batches.length).toBeGreaterThan(1);
        for (const batch of harness.batches) expect(batch.length).toBeLessThanOrEqual(450);
    });

    it('commits every operation across the batches', async () => {
        const contributions = [];
        for (let i = 0; i < 1200; i++) contributions.push({ name: `Member ${i}`, amount: 10, paid: true });

        await adapter.saveAll({ 2025: { January: { contributions } } }, null, null, null, 'admin');

        expect(opsFor(harness.committed, 'contributions')).toHaveLength(1200);
    });

    it('leaves collections untouched when nothing was passed for them', async () => {
        await adapter.saveAll(null, null, null, null, 'admin');

        expect(opsFor(harness.committed, 'contributions')).toEqual([]);
        expect(opsFor(harness.committed, 'campaigns')).toEqual([]);
        expect(opsFor(harness.committed, 'blacklist')).toEqual([]);
    });
});

const julyAndAugust = {
    2025: {
        July: { contributions: [{ name: 'Angela', amount: 500, paid: true }] },
        August: { contributions: [{ name: 'Joel', amount: 300, paid: false }] }
    }
};

const augustOnly = {
    2025: {
        July: { contributions: [] },
        August: { contributions: [{ name: 'Joel', amount: 300, paid: false }] }
    }
};

const fingerprintsOf = blob => ChangeSet.capture(Mapper.flattenContributions(blob));
const deletesIn = committed => opsFor(committed, 'contributions').filter(op => op.type === 'delete').map(op => op.ref.id);

function openGate() {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    return { gate, release };
}

describe('DataWriteAdapter under a baseline change mid-commit', () => {
    it('discards its own adoption when a resync replaced the baseline mid-commit', async () => {
        const { gate, release } = openGate();
        const harness = makeOrgDb(gate);
        const adapter = loadAdapter(harness.orgDb);

        adapter.setBaseline('contributions', fingerprintsOf(julyAndAugust));

        const saving = adapter.saveAll(julyAndAugust, null, null, null, 'admin');

        adapter.setBaseline('contributions', {});
        adapter.mergeBaseline('contributions', fingerprintsOf(augustOnly));

        release();
        await saving;

        harness.committed.length = 0;
        await adapter.saveAll(augustOnly, null, null, null, 'admin');

        expect(deletesIn(harness.committed)).toEqual([]);
    });

    it('keeps ids a hydration merged in mid-commit so a later removal still deletes', async () => {
        const { gate, release } = openGate();
        const harness = makeOrgDb(gate);
        const adapter = loadAdapter(harness.orgDb);

        adapter.setBaseline('contributions', {});
        adapter.mergeBaseline('contributions', fingerprintsOf(augustOnly));

        const saving = adapter.saveAll(augustOnly, null, null, null, 'admin');

        adapter.mergeBaseline('contributions', fingerprintsOf({
            2025: { July: { contributions: [{ id: '2025-07-angela', name: 'Angela', amount: 500, paid: true }] } }
        }));

        release();
        await saving;

        harness.committed.length = 0;
        await adapter.saveAll({
            2025: {
                July: { contributions: [] },
                August: { contributions: [{ name: 'Joel', amount: 300, paid: false }] }
            }
        }, null, null, null, 'admin');

        expect(deletesIn(harness.committed)).toEqual(['2025-07-angela']);
    });

    it('still deletes the ids this save removed after an additive adoption', async () => {
        const harness = makeOrgDb();
        const adapter = loadAdapter(harness.orgDb);

        adapter.setBaseline('contributions', fingerprintsOf(julyAndAugust));
        await adapter.saveAll(augustOnly, null, null, null, 'admin');

        expect(deletesIn(harness.committed)).toEqual(['2025-07-angela']);

        harness.committed.length = 0;
        await adapter.saveAll(augustOnly, null, null, null, 'admin');

        expect(harness.committed.filter(op => op.ref.collection === 'contributions')).toEqual([]);
    });
});
