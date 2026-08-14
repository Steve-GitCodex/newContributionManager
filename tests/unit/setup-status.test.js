import { describe, it, expect } from 'vitest';

// Mirrors the shape FirebaseService.centralGet returns.
const snapshot = (exists, data = null) => ({ exists, data, id: 'setup' });

// The predicate used by both superadmin-login.js and admin-setup.js.
const setupNeeded = status => !status || !status.exists || !status.data?.setupComplete;

describe('setup completion check', () => {
    it('treats a completed setup as done', () => {
        expect(setupNeeded(snapshot(true, { setupComplete: true }))).toBe(false);
    });

    it('requires setup when the document is missing', () => {
        expect(setupNeeded(snapshot(false))).toBe(true);
    });

    it('requires setup when the flag is explicitly false', () => {
        expect(setupNeeded(snapshot(true, { setupComplete: false }))).toBe(true);
    });

    it('requires setup when the document exists but carries no flag', () => {
        expect(setupNeeded(snapshot(true, {}))).toBe(true);
    });

    it('handles a null response without throwing', () => {
        expect(setupNeeded(null)).toBe(true);
        expect(setupNeeded(undefined)).toBe(true);
    });

    it('does not read the flag off the snapshot root', () => {
        // The original bug: setupComplete was read from the snapshot instead of
        // snapshot.data, so a completed setup still reported as needed.
        const completed = snapshot(true, { setupComplete: true });
        expect(completed.setupComplete).toBeUndefined();
        expect(setupNeeded(completed)).toBe(false);
    });
});
