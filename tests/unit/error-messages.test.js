import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../../js/utils/error-handler.js'), 'utf8');
const ErrorHandler = new Function('module', 'window', `${source}; return ErrorHandler;`)(undefined, undefined);

const messageFor = code => ErrorHandler.getUserMessage({ code });
const GENERIC = ErrorHandler.getUserMessage({});

describe('login error messages', () => {
    // Verified against the live project: SDK 9.22 returns invalid-login-credentials
    // for both a wrong password and an unknown email; SDK 12.x returns
    // invalid-credential. Both must map, or a failed login shows the generic text.
    it.each([
        'auth/invalid-login-credentials',
        'auth/invalid-credential'
    ])('maps %s to a specific message', code => {
        const message = messageFor(code);
        expect(message).not.toBe(GENERIC);
        expect(message.toLowerCase()).toContain('incorrect');
    });

    it('does not reveal whether the email exists', () => {
        const codes = [
            'auth/invalid-login-credentials',
            'auth/invalid-credential',
            'auth/user-not-found',
            'auth/wrong-password'
        ];
        const distinct = new Set(codes.map(messageFor));
        expect(distinct.size).toBe(1);
    });

    it.each([
        ['auth/too-many-requests', 'too many'],
        ['auth/network-request-failed', 'connection'],
        ['auth/missing-password', 'password'],
        ['auth/user-disabled', 'disabled']
    ])('maps %s to something actionable', (code, fragment) => {
        expect(messageFor(code).toLowerCase()).toContain(fragment);
    });

    it('no longer tells a rejected user to create an account', () => {
        expect(messageFor('auth/user-not-found').toLowerCase()).not.toContain('create a new account');
    });

    it('never returns a raw Firebase message', () => {
        const raw = 'Firebase: Missing or insufficient permissions on /organizations/x (auth/internal)';
        expect(ErrorHandler.getUserMessage({ code: 'auth/internal', message: raw })).not.toContain(raw);
        expect(ErrorHandler.getUserMessage({ message: raw })).not.toContain('/organizations/x');
    });

    it('shows a message we wrote ourselves for the user', () => {
        const refusal = new Error('You are not a member of Aic Isovya Praise. Ask an administrator to invite you.');
        refusal.userFacing = true;
        expect(ErrorHandler.getUserMessage(refusal)).toBe(refusal.message);
    });

    it('still sanitizes an unmarked error carrying a raw message', () => {
        expect(ErrorHandler.getUserMessage(new Error('collection users at /organizations/x'))).toBe(GENERIC);
    });

    it('falls back to the generic message for an unknown code', () => {
        expect(messageFor('auth/some-future-code')).toBe(GENERIC);
    });

    it('handles a null error without throwing', () => {
        expect(ErrorHandler.getUserMessage(null)).toBe(GENERIC);
    });
});
