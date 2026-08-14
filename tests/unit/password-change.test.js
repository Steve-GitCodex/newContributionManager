import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../../org-app/js/password-change.js'), 'utf8');

function makeHarness({ reauthError = null, signedIn = true } = {}) {
    const calls = { reauth: [], updated: [] };

    const user = {
        email: 'member@x.com',
        reauthenticateWithCredential: vi.fn(async credential => {
            calls.reauth.push(credential);
            if (reauthError) throw reauthError;
        }),
        updatePassword: vi.fn(async password => { calls.updated.push(password); })
    };

    const FirebaseManager = { getAuth: () => ({ currentUser: signedIn ? user : null }) };
    const firebase = {
        auth: { EmailAuthProvider: { credential: (email, password) => ({ email, password }) } }
    };

    const factory = new Function('FirebaseManager', 'firebase', 'document', 'module',
        `${source}; return PasswordChange;`);

    return { passwords: factory(FirebaseManager, firebase, undefined, undefined), calls, user };
}

const withCode = code => Object.assign(new Error(code), { code });

describe('PasswordChange', () => {
    it('reauthenticates with the current password before updating', async () => {
        const { passwords, calls } = makeHarness();
        await passwords.change('starter-pass', 'a-better-one', 'a-better-one');

        expect(calls.reauth).toEqual([{ email: 'member@x.com', password: 'starter-pass' }]);
        expect(calls.updated).toEqual(['a-better-one']);
    });

    it('reports a wrong current password without updating', async () => {
        const { passwords, calls } = makeHarness({ reauthError: withCode('auth/wrong-password') });

        await expect(passwords.change('not-it', 'a-better-one', 'a-better-one'))
            .rejects.toThrow(/current password is incorrect/i);
        expect(calls.updated).toEqual([]);
    });

    it('says to wait when Firebase rate-limits the attempt', async () => {
        const { passwords } = makeHarness({ reauthError: withCode('auth/too-many-requests') });

        await expect(passwords.change('starter-pass', 'a-better-one', 'a-better-one'))
            .rejects.toThrow(/too many attempts/i);
    });

    it('refuses when the session is gone', async () => {
        const { passwords } = makeHarness({ signedIn: false });

        await expect(passwords.change('starter-pass', 'a-better-one', 'a-better-one'))
            .rejects.toThrow(/session has expired/i);
    });

    it.each([
        ['', 'a-better-one', 'a-better-one', /current password/i],
        ['starter-pass', 'short', 'short', /at least 8 characters/i],
        ['starter-pass', 'a-better-one', 'a-better-two', /do not match/i],
        ['starter-pass', 'starter-pass', 'starter-pass', /different from the current one/i]
    ])('refuses %s / %s / %s before touching Firebase', async (current, next, confirm, expected) => {
        const { passwords, calls } = makeHarness();

        await expect(passwords.change(current, next, confirm)).rejects.toThrow(expected);
        expect(calls.reauth).toEqual([]);
        expect(calls.updated).toEqual([]);
    });

    it('marks its refusals as safe to show the user', async () => {
        const { passwords } = makeHarness();
        const error = await passwords.change('a', 'short', 'short').catch(e => e);

        expect(error.userFacing).toBe(true);
    });

    it('requires at least as long a password as an invite issues', () => {
        const inviteSource = readFileSync(resolve(here, '../../org-app/js/member-invite.js'), 'utf8');
        const inviteMinimum = Number(inviteSource.match(/password\.length < (\d+)/)[1]);
        const { passwords } = makeHarness();

        expect(passwords.MIN_LENGTH).toBeGreaterThanOrEqual(inviteMinimum);
    });
});
