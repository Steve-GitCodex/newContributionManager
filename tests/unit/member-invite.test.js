import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../../org-app/js/member-invite.js'), 'utf8');

function makeHarness({ existingMembers = {}, createBehaviour = 'ok' } = {}) {
    const written = {};
    const deletedApps = [];

    const auth = {
        createUserWithEmailAndPassword: vi.fn(async () => {
            if (createBehaviour === 'exists' || createBehaviour === 'exists-wrong-password') {
                const error = new Error('exists');
                error.code = 'auth/email-already-in-use';
                throw error;
            }
            if (createBehaviour === 'weak') {
                const error = new Error('weak');
                error.code = 'auth/weak-password';
                throw error;
            }
            return { user: { uid: 'new-uid' } };
        }),
        signInWithEmailAndPassword: vi.fn(async () => {
            if (createBehaviour === 'exists-wrong-password') throw new Error('bad password');
            return { user: { uid: 'existing-uid' } };
        })
    };

    const firebase = {
        initializeApp: vi.fn(() => ({ delete: async () => { deletedApps.push(true); } })),
        auth: () => auth
    };

    const OrgDb = {
        getAll: async () => existingMembers,
        setOne: vi.fn(async (collection, id, data) => { written[`${collection}/${id}`] = data; })
    };

    const FirebaseManager = { getApp: () => ({ options: { projectId: 'central' } }) };

    const factory = new Function('firebase', 'OrgDb', 'FirebaseManager', 'module',
        `${source}; return MemberInvite;`);

    return { invite: factory(firebase, OrgDb, FirebaseManager, undefined), written, auth, firebase, OrgDb, deletedApps };
}

describe('MemberInvite validation', () => {
    let MemberInvite;
    beforeEach(() => { MemberInvite = makeHarness().invite; });

    it('rejects an email with no @', () => {
        expect(() => MemberInvite.validate('nope', 'password123', 'viewer')).toThrow('valid email');
    });

    it('rejects a password under 8 characters', () => {
        expect(() => MemberInvite.validate('a@b.com', 'short', 'viewer')).toThrow('8 characters');
    });

    it('rejects a role outside the three known roles', () => {
        expect(() => MemberInvite.validate('a@b.com', 'password123', 'superadmin')).toThrow('Choose a role');
    });

    it('accepts each valid role', () => {
        for (const role of ['admin', 'editor', 'viewer']) {
            expect(() => MemberInvite.validate('a@b.com', 'password123', role)).not.toThrow();
        }
    });

    it('labels roles with the intended vocabulary', () => {
        expect(MemberInvite.ROLES).toEqual({ admin: 'Admin', editor: 'Staff', viewer: 'Member' });
    });
});

describe('MemberInvite.invite', () => {
    it('creates the account and writes the membership', async () => {
        const harness = makeHarness();
        const result = await harness.invite.invite('New@Example.com ', 'password123', 'editor');

        expect(result).toEqual({ uid: 'new-uid', email: 'new@example.com', role: 'editor', accountCreated: true });
        expect(harness.written['users/new-uid']).toMatchObject({ email: 'new@example.com', role: 'editor' });
    });

    it('normalises the email to lower case', async () => {
        const harness = makeHarness();
        await harness.invite.invite('MiXeD@Example.COM', 'password123', 'viewer');
        expect(harness.written['users/new-uid'].email).toBe('mixed@example.com');
    });

    it('adds an existing account rather than failing', async () => {
        const harness = makeHarness({ createBehaviour: 'exists' });
        const result = await harness.invite.invite('old@example.com', 'password123', 'admin');

        expect(result.accountCreated).toBe(false);
        expect(result.uid).toBe('existing-uid');
        expect(harness.written['users/existing-uid'].role).toBe('admin');
    });

    it('explains the failure when an existing account password does not match', async () => {
        const harness = makeHarness({ createBehaviour: 'exists-wrong-password' });
        await expect(harness.invite.invite('old@example.com', 'password123', 'viewer'))
            .rejects.toThrow('already has an account');
    });

    it('refuses to add someone who is already a member', async () => {
        const harness = makeHarness({ existingMembers: { 'uid-1': { email: 'taken@example.com', role: 'viewer' } } });
        await expect(harness.invite.invite('Taken@example.com', 'password123', 'admin'))
            .rejects.toThrow('already a member');
        expect(harness.OrgDb.setOne).not.toHaveBeenCalled();
    });

    it('provisions on a throwaway app and always deletes it', async () => {
        const harness = makeHarness();
        await harness.invite.invite('new@example.com', 'password123', 'viewer');

        expect(harness.firebase.initializeApp).toHaveBeenCalled();
        expect(harness.deletedApps).toHaveLength(1);
    });

    it('deletes the throwaway app even when provisioning fails', async () => {
        const harness = makeHarness({ createBehaviour: 'weak' });
        await expect(harness.invite.invite('new@example.com', 'password123', 'viewer')).rejects.toThrow();
        expect(harness.deletedApps).toHaveLength(1);
    });

    it('does not write a membership when validation fails', async () => {
        const harness = makeHarness();
        await expect(harness.invite.invite('bad-email', 'password123', 'viewer')).rejects.toThrow();
        expect(harness.OrgDb.setOne).not.toHaveBeenCalled();
    });
});
