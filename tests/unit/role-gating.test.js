import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const read = rel => readFileSync(resolve(here, '../..', rel), 'utf8');

const uiRenderer = read('org-app/js/ui-renderer.js');
const applyRoleRestrictions = new Function('document', `
    ${uiRenderer.match(/applyRoleRestrictions\(userRole\) \{[\s\S]*?\n        \}/)[0]
        .replace('applyRoleRestrictions(userRole) {', 'function apply(userRole) {')}
    return apply;
`);

function runWith(role) {
    const doc = { documentElement: { dataset: {} } };
    applyRoleRestrictions(doc)(role);
    return doc.documentElement.dataset.role;
}

describe('role publishing', () => {
    it.each(['admin', 'editor', 'viewer'])('publishes %s unchanged', role => {
        expect(runWith(role)).toBe(role);
    });

    it.each([undefined, null, '', 'superadmin', 'owner', 'ADMIN'])(
        'falls back to viewer for %s', role => {
            expect(runWith(role)).toBe('viewer');
        });
});

describe('every mutating control is gated', () => {
    // Scans the source rather than checking a hand-written list. A hand-written
    // list only ever proves what its author remembered — this failed to catch
    // the per-row Blacklist button and the two buttons built with createElement.
    const SOURCES = [
        'org-app/index.html',
        'org-app/js/templates.js',
        'org-app/js/expected-members.js',
        'org-app/js/event-handlers.js',
        'org-app/js/contribution-renderer.js',
        'org-app/js/ui-renderer.js'
    ];

    const MUTATING = /\b(add|create|edit|delete|remove|clone|blacklist|contribute|pay|toggle-payment|save-role)\b/i;

    // Controls that read or export rather than write.
    const READ_ONLY = /\b(view-btn|share|export|print|report|column|search|filter|page|close|cancel|logout|login|theme|modal|swal|tab-btn|save-phone|copy)\b/i;

    const findUngated = () => {
        const offenders = [];
        for (const file of SOURCES) {
            const source = read(file);
            const tags = source.match(/<button\b[^>]*>/gi) || [];
            for (const tag of tags) {
                if (tag.includes('data-requires')) continue;
                const identity = (tag.match(/\b(?:id|class)="([^"]*)"/g) || []).join(' ');
                if (!MUTATING.test(identity) || READ_ONLY.test(identity)) continue;
                offenders.push(`${file}: ${identity}`);
            }
            // Buttons built in JS carry the attribute via dataset instead.
            const created = source.match(/createElement\('button'\)[\s\S]{0,400}?appendChild/g) || [];
            for (const block of created) {
                if (!block.includes('dataset.requires')) {
                    offenders.push(`${file}: createElement button without dataset.requires`);
                }
            }
        }
        return offenders;
    };

    it('leaves no mutating button ungated', () => {
        expect(findUngated()).toEqual([]);
    });

    it('the budget tab is admin only', () => {
        const line = read('org-app/index.html').split('\n').find(l => l.includes('data-view="budget"'));
        expect(line).toContain('data-requires="admin"');
    });

    it.each([
        ['org-app/js/templates.js', 'blacklist-member', 'admin'],
        ['org-app/js/templates.js', 'remove-from-blacklist', 'admin'],
        ['org-app/js/templates.js', 'delete-expense', 'admin'],
        ['org-app/js/templates.js', 'create-first-month-btn', 'staff'],
        ['org-app/js/templates.js', 'delete-contribution-btn', 'staff'],
        ['org-app/js/ui-renderer.js', 'clone-month-btn', 'staff'],
        ['org-app/js/ui-renderer.js', 'create-custom-month-btn', 'staff']
    ])('%s → %s is gated at %s', (file, marker, level) => {
        const source = read(file);
        const index = source.indexOf(marker);
        expect(index, `${marker} not found`).toBeGreaterThan(-1);
        expect(source.slice(index - 200, index + 300)).toContain(level);
    });
});

describe('role stylesheet', () => {
    const css = read('org-app/css/roles.css');

    it('hides staff and admin controls from a viewer', () => {
        expect(css).toContain('[data-role="viewer"] [data-requires~="staff"]');
        expect(css).toContain('[data-role="viewer"] [data-requires~="admin"]');
    });

    it('hides admin controls from staff', () => {
        expect(css).toContain('[data-role="editor"] [data-requires~="admin"]');
    });

    it('does not hide anything from an admin', () => {
        expect(css).not.toContain('[data-role="admin"]');
    });

    it('is loaded by the org app, defaulting to the most restrictive role', () => {
        const html = read('org-app/index.html');
        expect(html).toContain('css/roles.css');
        expect(html).toContain('data-role="viewer"');
    });
});
