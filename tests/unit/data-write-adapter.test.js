import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const read = file => readFileSync(resolve(here, '../../org-app/js', file), 'utf8');

const Mapper = new Function('module', `${read('contribution-mapper.js')}; return ContributionMapper;`)(undefined);

function makeOrgDb(existing = {}) {
    const committed = [];
    const batches = [];

    const orgDb = {
        doc: (collection, id) => ({ collection, id }),
        getAll: async collection => existing[collection] || {},
        batch: () => {
            const operations = [];
            batches.push(operations);
            return {
                set: (ref, data) => operations.push({ type: 'set', ref, data }),
                delete: ref => operations.push({ type: 'delete', ref }),
                commit: async () => { committed.push(...operations); }
            };
        }
    };

    return { orgDb, committed, batches };
}

function loadAdapter(orgDb) {
    return new Function('OrgDb', 'ContributionMapper', `${read('data-write-adapter.js')}; return DataWriteAdapter;`)(orgDb, Mapper);
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
        await adapter.saveAll(contributionsBlob, null, null, null, 'admin', 'uid-1');
        const writes = opsFor(harness.committed, 'contributions');

        expect(writes).toHaveLength(1);
        expect(writes[0].ref.id).toBe('2025-01-angela');
        expect(writes[0].type).toBe('set');
    });

    it('does not rewrite ids on a second save of the same data', async () => {
        await adapter.saveAll(contributionsBlob, null, null, null, 'admin', 'uid-1');
        const firstIds = opsFor(harness.committed, 'contributions').map(op => op.ref.id);

        const second = makeOrgDb({ contributions: { '2025-01-angela': {} } });
        await loadAdapter(second.orgDb).saveAll(contributionsBlob, null, null, null, 'admin', 'uid-1');

        const secondOps = opsFor(second.committed, 'contributions');
        expect(secondOps.map(op => op.ref.id)).toEqual(firstIds);
        expect(secondOps.every(op => op.type === 'set')).toBe(true);
    });

    it('deletes a record that is no longer present', async () => {
        const withStale = makeOrgDb({ contributions: { '2025-01-angela': {}, '2025-01-removed': {} } });
        await loadAdapter(withStale.orgDb).saveAll(contributionsBlob, null, null, null, 'admin', 'uid-1');

        const deletes = opsFor(withStale.committed, 'contributions').filter(op => op.type === 'delete');
        expect(deletes.map(op => op.ref.id)).toEqual(['2025-01-removed']);
    });

    it('records the month so an empty month is not lost', async () => {
        await adapter.saveAll(contributionsBlob, null, null, null, 'admin', 'uid-1');
        expect(opsFor(harness.committed, 'months').map(op => op.ref.id)).toEqual(['2025-January']);
    });

    it('writes the blacklist for an admin', async () => {
        await adapter.saveAll(null, { blacklistedMembers: ['Angela'] }, null, null, 'admin', 'uid-1');
        expect(opsFor(harness.committed, 'blacklist').map(op => op.ref.id)).toEqual(['angela']);
    });

    it('refuses to write the blacklist for a non-admin', async () => {
        await adapter.saveAll(null, { blacklistedMembers: ['Angela'] }, null, null, 'editor', 'uid-1');
        expect(opsFor(harness.committed, 'blacklist')).toEqual([]);
    });

    it('scopes the budget write to the current user', async () => {
        await adapter.saveAll(null, null, { expenses: { e1: 10 } }, null, 'viewer', 'uid-1');
        const writes = opsFor(harness.committed, 'budgets');

        expect(writes).toHaveLength(1);
        expect(writes[0].ref.id).toBe('uid-1');
    });

    it('skips the budget when there is no signed-in uid', async () => {
        await adapter.saveAll(null, null, { expenses: {} }, null, 'viewer', null);
        expect(opsFor(harness.committed, 'budgets')).toEqual([]);
    });

    it('writes campaigns to the campaigns collection, not specialGiving', async () => {
        await adapter.saveAll(null, null, null, {
            camp_1: { purpose: 'Roof', contributions: { 'camp_1--angela': { contributorName: 'Angela', pledgedAmount: 500, amountPaid: 100 } } }
        }, 'admin', 'uid-1');

        expect(opsFor(harness.committed, 'campaigns').map(op => op.ref.id)).toEqual(['camp_1']);
        expect(opsFor(harness.committed, 'campaignContributions').map(op => op.ref.id)).toEqual(['camp_1--angela']);
        expect(opsFor(harness.committed, 'specialGiving')).toEqual([]);
    });

    it('always stamps meta/state with the sync time', async () => {
        await adapter.saveAll(contributionsBlob, null, null, null, 'admin', 'uid-1');
        const meta = opsFor(harness.committed, 'meta');

        expect(meta).toHaveLength(1);
        expect(meta[0].ref.id).toBe('state');
        expect(typeof meta[0].data.lastSync).toBe('number');
    });

    it('never exceeds the Firestore batch limit', async () => {
        const contributions = [];
        for (let i = 0; i < 1200; i++) contributions.push({ name: `Member ${i}`, amount: 10, paid: true });

        await adapter.saveAll({ 2025: { January: { contributions } } }, null, null, null, 'admin', 'uid-1');

        expect(harness.batches.length).toBeGreaterThan(1);
        for (const batch of harness.batches) expect(batch.length).toBeLessThanOrEqual(450);
    });

    it('commits every operation across the batches', async () => {
        const contributions = [];
        for (let i = 0; i < 1200; i++) contributions.push({ name: `Member ${i}`, amount: 10, paid: true });

        await adapter.saveAll({ 2025: { January: { contributions } } }, null, null, null, 'admin', 'uid-1');

        expect(opsFor(harness.committed, 'contributions')).toHaveLength(1200);
    });

    it('leaves collections untouched when nothing was passed for them', async () => {
        await adapter.saveAll(null, null, null, null, 'admin', 'uid-1');

        expect(opsFor(harness.committed, 'contributions')).toEqual([]);
        expect(opsFor(harness.committed, 'campaigns')).toEqual([]);
        expect(opsFor(harness.committed, 'blacklist')).toEqual([]);
    });
});
