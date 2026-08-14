import { describe, it, expect, beforeEach, vi } from 'vitest';
import SuperAdminService from '../../js/services/super-admin-service.js';

const CENTRAL_OPTIONS = { projectId: 'universal-contribution-manager', apiKey: 'central-key' };

function makeFirebaseService() {
    return {
        centralGet: vi.fn().mockResolvedValue({ exists: false }),
        centralSet: vi.fn().mockResolvedValue({}),
        centralCreateNested: vi.fn().mockResolvedValue({})
    };
}

function stubFirebase({ createResult, createError, signInResult, signInError } = {}) {
    const deleted = [];
    const auth = {
        createUserWithEmailAndPassword: vi.fn(async () => {
            if (createError) throw createError;
            return createResult || { user: { uid: 'new-admin-uid' } };
        }),
        signInWithEmailAndPassword: vi.fn(async () => {
            if (signInError) throw signInError;
            return signInResult || { user: { uid: 'existing-uid' } };
        })
    };
    const initialized = [];
    global.firebase = {
        app: vi.fn(() => ({ options: CENTRAL_OPTIONS })),
        initializeApp: vi.fn((config, name) => {
            initialized.push({ config, name });
            return { name, delete: vi.fn(async () => deleted.push(name)) };
        }),
        auth: vi.fn(() => auth)
    };
    return { auth, initialized, deleted };
}

describe('createOrganization (no per-org credentials)', () => {
    let service;
    let firebaseService;

    beforeEach(() => {
        firebaseService = makeFirebaseService();
        service = new SuperAdminService(firebaseService);
    });

    it('creates an organization without any Firebase config argument', async () => {
        stubFirebase();
        const org = await service.createOrganization('Kyuso Welfare', 'admin@kyuso.org', 'strongpassword');

        expect(org.slug).toBe('kyuso-welfare');
        expect(org.adminUser).toEqual({ uid: 'new-admin-uid', email: 'admin@kyuso.org' });
    });

    it('never writes firebaseConfig into the org document', async () => {
        stubFirebase();
        await service.createOrganization('Kyuso Welfare', 'admin@kyuso.org', 'strongpassword');

        const [, , written] = firebaseService.centralSet.mock.calls[0];
        expect(written).not.toHaveProperty('firebaseConfig');
        expect(Object.keys(written).sort()).toEqual(['createdAt', 'id', 'name', 'slug', 'status']);
    });

    it('writes membership to Firestore, not a per-org database', async () => {
        stubFirebase();
        await service.createOrganization('Kyuso Welfare', 'admin@kyuso.org', 'strongpassword');

        expect(firebaseService.centralCreateNested).toHaveBeenCalledWith(
            'organizations',
            'kyuso-welfare',
            'users',
            'new-admin-uid',
            expect.objectContaining({ email: 'admin@kyuso.org', role: 'admin' })
        );
    });

    it('provisions the admin on the central project', async () => {
        const { initialized } = stubFirebase();
        await service.createOrganization('Kyuso Welfare', 'admin@kyuso.org', 'strongpassword');

        expect(initialized).toHaveLength(1);
        expect(initialized[0].config).toEqual(CENTRAL_OPTIONS);
    });

    it('uses a throwaway app so the super admin session survives', async () => {
        const { initialized, deleted } = stubFirebase();
        await service.createOrganization('Kyuso Welfare', 'admin@kyuso.org', 'strongpassword');

        expect(initialized[0].name).not.toBe('[DEFAULT]');
        expect(deleted).toEqual([initialized[0].name]);
    });

    it('deletes the throwaway app even when provisioning fails', async () => {
        const { deleted, initialized } = stubFirebase({
            createError: Object.assign(new Error('boom'), { code: 'auth/invalid-email' })
        });

        await expect(
            service.createOrganization('Kyuso Welfare', 'bad', 'strongpassword')
        ).rejects.toThrow();
        expect(deleted).toEqual([initialized[0].name]);
    });

    it('reuses an existing account when the email is already registered', async () => {
        stubFirebase({
            createError: Object.assign(new Error('taken'), { code: 'auth/email-already-in-use' })
        });

        const org = await service.createOrganization('Kyuso Welfare', 'admin@kyuso.org', 'strongpassword');
        expect(org.adminUser.uid).toBe('existing-uid');
    });

    it('explains the failure when the existing password does not match', async () => {
        stubFirebase({
            createError: Object.assign(new Error('taken'), { code: 'auth/email-already-in-use' }),
            signInError: new Error('wrong password')
        });

        await expect(
            service.createOrganization('Kyuso Welfare', 'admin@kyuso.org', 'strongpassword')
        ).rejects.toThrow(/already has an account/);
    });

    it('rejects a duplicate slug before creating any account', async () => {
        const { initialized } = stubFirebase();
        firebaseService.centralGet.mockResolvedValue({ exists: true });

        await expect(
            service.createOrganization('Aic Isovya Praise', 'admin@x.org', 'strongpassword')
        ).rejects.toThrow(/slug already exists/);
        expect(initialized).toHaveLength(0);
    });

    describe('input validation', () => {
        beforeEach(() => stubFirebase());

        it('requires an organization name', async () => {
            await expect(service.createOrganization('  ', 'a@b.com', 'strongpassword'))
                .rejects.toThrow(/name is required/);
        });

        it('requires an administrator email', async () => {
            await expect(service.createOrganization('Kyuso', '', 'strongpassword'))
                .rejects.toThrow(/email is required/);
        });

        it('requires a password of at least 8 characters', async () => {
            await expect(service.createOrganization('Kyuso', 'a@b.com', 'short'))
                .rejects.toThrow(/at least 8 characters/);
        });

        it('does not fall back to a placeholder password', async () => {
            await expect(service.createOrganization('Kyuso', 'a@b.com', ''))
                .rejects.toThrow();
            expect(firebaseService.centralSet).not.toHaveBeenCalled();
        });
    });
});
