import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../../org-app/js/password-reset.js'), 'utf8');

function makeHarness({ sendError = null } = {}) {
    const sent = [];
    const sendPasswordResetEmail = vi.fn(async email => {
        sent.push(email);
        if (sendError) throw sendError;
    });

    const FirebaseManager = { getAuth: () => ({ sendPasswordResetEmail, currentUser: { email: 'member@x.com' } }) };
    const factory = new Function('FirebaseManager', 'Swal', 'ErrorHandler', 'document', 'module',
        `${source}; return PasswordReset;`);

    return { reset: factory(FirebaseManager, undefined, undefined, undefined, undefined), sent };
}

const withCode = code => Object.assign(new Error(code), { code });

describe('PasswordReset', () => {
    it('sends to the normalized address', async () => {
        const { reset, sent } = makeHarness();
        await reset.send('  Member@X.com  ');

        expect(sent).toEqual(['member@x.com']);
    });

    it('says the same thing whether or not the address has an account', async () => {
        const known = makeHarness();
        const unknown = makeHarness({ sendError: withCode('auth/user-not-found') });

        const knownMessage = await known.reset.send('member@x.com');
        const unknownMessage = await unknown.reset.send('nobody@x.com');

        expect(knownMessage).toBe(unknownMessage);
        expect(knownMessage).toBe(known.reset.SENT_MESSAGE);
    });

    it('rejects a malformed address before calling Firebase', async () => {
        const { reset, sent } = makeHarness();

        await expect(reset.send('not-an-email')).rejects.toThrow(/valid email/i);
        expect(sent).toEqual([]);
    });

    it.each([
        ['auth/too-many-requests', /too many attempts/i],
        ['auth/network-request-failed', /no connection/i],
        ['auth/invalid-email', /valid email/i],
        ['auth/internal-error', /could not send/i]
    ])('turns %s into something the user can act on', async (code, expected) => {
        const { reset } = makeHarness({ sendError: withCode(code) });
        await expect(reset.send('member@x.com')).rejects.toThrow(expected);
    });

    it('never leaks a raw Firebase message', async () => {
        const raw = 'Firebase: Error (auth/internal-error) at /identitytoolkit/v3/relyingparty';
        const { reset } = makeHarness({ sendError: Object.assign(new Error(raw), { code: 'auth/internal-error' }) });
        const error = await reset.send('member@x.com').catch(e => e);

        expect(error.message).not.toContain('identitytoolkit');
        expect(error.userFacing).toBe(true);
    });
});
