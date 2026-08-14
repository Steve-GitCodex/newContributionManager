import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../../org-app/js/change-set.js'), 'utf8');
const ChangeSet = new Function(`${source}; return ChangeSet;`)();

const record = (id, amount, paid = false) => ({ id, memberName: 'Angela', amount, paid });

describe('ChangeSet', () => {
    it('reports nothing to do when the records match the baseline', () => {
        const records = [record('2026-01-angela', 500)];
        const baseline = ChangeSet.capture(records);

        expect(ChangeSet.diff(baseline, records)).toEqual({ writes: [], deletes: [] });
    });

    it('writes only the record whose field changed', () => {
        const baseline = ChangeSet.capture([record('2026-01-angela', 500), record('2026-01-joel', 300)]);
        const { writes, deletes } = ChangeSet.diff(baseline, [
            record('2026-01-angela', 500, true),
            record('2026-01-joel', 300)
        ]);

        expect(writes.map(entry => entry.id)).toEqual(['2026-01-angela']);
        expect(deletes).toEqual([]);
    });

    it('writes a record the baseline has never seen', () => {
        const baseline = ChangeSet.capture([record('2026-01-angela', 500)]);
        const { writes } = ChangeSet.diff(baseline, [record('2026-01-angela', 500), record('2026-01-new', 100)]);

        expect(writes.map(entry => entry.id)).toEqual(['2026-01-new']);
    });

    it('deletes a record that the baseline has and the records do not', () => {
        const baseline = ChangeSet.capture([record('2026-01-angela', 500), record('2026-01-gone', 100)]);
        const { writes, deletes } = ChangeSet.diff(baseline, [record('2026-01-angela', 500)]);

        expect(writes).toEqual([]);
        expect(deletes).toEqual(['2026-01-gone']);
    });

    it('derives deletes solely from ids the baseline held, never from records alone', () => {
        const baseline = ChangeSet.capture([record('2026-03-angela', 500)]);
        const { deletes } = ChangeSet.diff(baseline, [record('2026-03-angela', 500), record('2026-03-unseen', 100)]);

        expect(deletes).toEqual([]);
    });

    it('writes a record present in records but absent from the baseline, as a new row', () => {
        const baseline = {};
        const { writes, deletes } = ChangeSet.diff(baseline, [record('2026-03-angela', 500)]);

        expect(writes.map(entry => entry.id)).toEqual(['2026-03-angela']);
        expect(deletes).toEqual([]);
    });

    it('ignores key order when comparing', () => {
        const baseline = ChangeSet.capture([{ id: 'a', amount: 1, paid: true }]);
        const { writes } = ChangeSet.diff(baseline, [{ paid: true, id: 'a', amount: 1 }]);

        expect(writes).toEqual([]);
    });

    it('ignores nested key order when comparing', () => {
        const baseline = ChangeSet.capture([
            { id: 'budget', expenses: { rent: 100, water: 20 } }
        ]);
        const { writes } = ChangeSet.diff(baseline, [
            { id: 'budget', expenses: { water: 20, rent: 100 } }
        ]);

        expect(writes).toEqual([]);
    });

    it('writes when a nested value actually changes', () => {
        const baseline = ChangeSet.capture([
            { id: 'budget', expenses: { rent: 100, water: 20 } }
        ]);
        const { writes } = ChangeSet.diff(baseline, [
            { id: 'budget', expenses: { rent: 150, water: 20 } }
        ]);

        expect(writes.map(entry => entry.id)).toEqual(['budget']);
    });

    it('writes when array element order differs, since array order is content', () => {
        const baseline = ChangeSet.capture([
            { id: 'campaign', contributors: ['angela', 'joel'] }
        ]);
        const { writes } = ChangeSet.diff(baseline, [
            { id: 'campaign', contributors: ['joel', 'angela'] }
        ]);

        expect(writes.map(entry => entry.id)).toEqual(['campaign']);
    });

    it('ignores the id field itself, so a stored document without one still matches', () => {
        const baseline = ChangeSet.captureMap({ '2026-January': { year: 2026, monthName: 'January' } });
        const { writes } = ChangeSet.diff(baseline, [{ id: '2026-January', year: 2026, monthName: 'January' }]);

        expect(writes).toEqual([]);
    });

    it('treats an empty baseline as everything being new', () => {
        const { writes, deletes } = ChangeSet.diff({}, [record('2026-01-angela', 500)]);

        expect(writes.map(entry => entry.id)).toEqual(['2026-01-angela']);
        expect(deletes).toEqual([]);
    });

    it('survives a null baseline and null records', () => {
        expect(ChangeSet.diff(null, null)).toEqual({ writes: [], deletes: [] });
    });
});
