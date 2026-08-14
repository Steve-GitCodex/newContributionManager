import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../../org-app/js/member-admin.js'), 'utf8');

const MEMBERS = {
    'uid-admin': { email: 'a@x.com', role: 'admin' },
    'uid-staff': { email: 's@x.com', role: 'editor' },
    'uid-member': { email: 'm@x.com', role: 'viewer' }
};

function makeHarness(members = MEMBERS) {
    const deleted = [];
    const updated = [];

    const OrgDb = {
        getAll: async () => members,
        doc: (collection, id) => ({
            update: vi.fn(async data => { updated.push({ collection, id, data }); }),
            delete: vi.fn(async () => { deleted.push({ collection, id }); })
        })
    };

    const factory = new Function('OrgDb', 'module', `${source}; return MemberAdmin;`);
    return { admin: factory(OrgDb, undefined), deleted, updated };
}

describe('MemberAdmin', () => {
    it('removes a member from the organization', async () => {
        const { admin, deleted } = makeHarness();
        await admin.remove('uid-member', 'uid-admin');

        expect(deleted).toEqual([{ collection: 'users', id: 'uid-member' }]);
    });

    it('refuses to remove the signed-in admin themselves', async () => {
        const { admin, deleted } = makeHarness();

        await expect(admin.remove('uid-admin', 'uid-admin')).rejects.toThrow(/cannot remove yourself/i);
        expect(deleted).toEqual([]);
    });

    it('refuses to remove the only admin', async () => {
        const { admin, deleted } = makeHarness();

        await expect(admin.remove('uid-admin', 'uid-staff')).rejects.toThrow(/only admin/i);
        expect(deleted).toEqual([]);
    });

    it('removes an admin when another admin remains', async () => {
        const { admin, deleted } = makeHarness({
            ...MEMBERS,
            'uid-admin-2': { email: 'a2@x.com', role: 'admin' }
        });

        await admin.remove('uid-admin', 'uid-admin-2');
        expect(deleted).toEqual([{ collection: 'users', id: 'uid-admin' }]);
    });

    it('changes a role', async () => {
        const { admin, updated } = makeHarness();
        await admin.changeRole('uid-member', 'editor');

        expect(updated).toEqual([{ collection: 'users', id: 'uid-member', data: { role: 'editor' } }]);
    });

    it('refuses to demote the only admin', async () => {
        const { admin, updated } = makeHarness();

        await expect(admin.changeRole('uid-admin', 'viewer')).rejects.toThrow(/only admin/i);
        expect(updated).toEqual([]);
    });

    it('refuses an unknown role', async () => {
        const { admin, updated } = makeHarness();

        await expect(admin.changeRole('uid-member', 'superadmin')).rejects.toThrow(/choose a role/i);
        expect(updated).toEqual([]);
    });

    it('labels the stored roles for the UI', () => {
        const { admin } = makeHarness();
        expect(admin.ROLES).toEqual({ admin: 'Admin', editor: 'Staff', viewer: 'Member' });
    });
});
