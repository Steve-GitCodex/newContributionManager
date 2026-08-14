import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../../org-app/js/org-db.js'), 'utf8');

function makeFirestore() {
    const calls = { collection: [], doc: [] };
    const snapshots = new Map();

    const docHandle = (path) => ({
        path,
        collection: name => collectionHandle(`${path}/${name}`),
        get: async () => {
            const data = snapshots.get(path);
            return { exists: data !== undefined, data: () => data };
        },
        set: vi.fn(async data => { snapshots.set(path, data); }),
        update: vi.fn()
    });

    const collectionHandle = (path) => ({
        path,
        doc: id => {
            calls.doc.push(`${path}/${id}`);
            return docHandle(`${path}/${id}`);
        },
        get: async () => ({
            forEach: fn => {
                for (const [key, value] of snapshots) {
                    const parent = key.slice(0, key.lastIndexOf('/'));
                    if (parent === path) fn({ id: key.slice(parent.length + 1), data: () => value });
                }
            }
        })
    });

    return {
        calls,
        snapshots,
        firestore: {
            collection: name => {
                calls.collection.push(name);
                return collectionHandle(name);
            },
            batch: () => ({ marker: 'batch' })
        }
    };
}

function loadOrgDb(firestore) {
    const factory = new Function('FirebaseManager', 'window', 'module', `${source}; return OrgDb;`);
    return factory({ getFirestore: () => firestore }, undefined, undefined);
}

describe('OrgDb', () => {
    let harness;
    let orgDb;

    beforeEach(() => {
        harness = makeFirestore();
        orgDb = loadOrgDb(harness.firestore);
        orgDb.setSlug('aic-isovya-praise');
    });

    it('starts with no slug when the page did not set one', () => {
        expect(loadOrgDb(harness.firestore).getSlug()).toBe('');
    });

    it('refuses to build a path before a slug is set', () => {
        const bare = loadOrgDb(harness.firestore);
        expect(() => bare.collection('contributions')).toThrow('Organization slug not set');
    });

    it('roots every collection under organizations/{slug}', () => {
        expect(orgDb.collection('contributions').path).toBe('organizations/aic-isovya-praise/contributions');
    });

    it('roots a document under its org collection', () => {
        expect(orgDb.doc('budgets', 'user123').path).toBe('organizations/aic-isovya-praise/budgets/user123');
    });

    it('trims a slug given with stray whitespace', () => {
        orgDb.setSlug('  kyuso-welfare  ');
        expect(orgDb.getSlug()).toBe('kyuso-welfare');
        expect(orgDb.collection('members').path).toBe('organizations/kyuso-welfare/members');
    });

    it('never reaches outside the org document', () => {
        orgDb.collection('contributions');
        expect(harness.calls.collection).toEqual(['organizations']);
        expect(harness.calls.doc).toEqual(['organizations/aic-isovya-praise']);
    });

    describe('getAll', () => {
        it('returns an id-keyed map of the collection', async () => {
            harness.snapshots.set('organizations/aic-isovya-praise/members/angela', { name: 'Angela' });
            harness.snapshots.set('organizations/aic-isovya-praise/members/joel-ng', { name: 'Joel Ng' });

            expect(await orgDb.getAll('members')).toEqual({
                angela: { name: 'Angela' },
                'joel-ng': { name: 'Joel Ng' }
            });
        });

        it('returns an empty map for an empty collection', async () => {
            expect(await orgDb.getAll('members')).toEqual({});
        });

        it('does not pick up documents from a sibling collection', async () => {
            harness.snapshots.set('organizations/aic-isovya-praise/members/angela', { name: 'Angela' });
            harness.snapshots.set('organizations/aic-isovya-praise/blacklist/angela', { memberName: 'Angela' });

            expect(Object.keys(await orgDb.getAll('members'))).toEqual(['angela']);
        });
    });

    describe('getOne', () => {
        it('returns the document data when it exists', async () => {
            harness.snapshots.set('organizations/aic-isovya-praise/users/uid-1', { role: 'admin' });
            expect(await orgDb.getOne('users', 'uid-1')).toEqual({ role: 'admin' });
        });

        it('returns null for a missing document rather than throwing', async () => {
            expect(await orgDb.getOne('users', 'nobody')).toBeNull();
        });
    });

    it('writes through setOne to the scoped path', async () => {
        await orgDb.setOne('meta', 'lastSync', { value: 42 });
        expect(harness.snapshots.get('organizations/aic-isovya-praise/meta/lastSync')).toEqual({ value: 42 });
    });

    it('exposes a batch from the same firestore instance', () => {
        expect(orgDb.batch()).toEqual({ marker: 'batch' });
    });
});
