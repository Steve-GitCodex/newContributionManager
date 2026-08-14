import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const read = rel => readFileSync(resolve(here, '../..', rel), 'utf8');

const entryPage = read('pages/organization.html');
const orgApp = read('org-app/index.html');

describe('organization entry point', () => {
    it('is the only page that reads a slug from the URL', () => {
        expect(entryPage).toContain("get('slug')");
    });

    it('hands the slug over through sessionStorage, not the URL', () => {
        expect(entryPage).toContain("sessionStorage.setItem('orgContext'");
        expect(entryPage).toContain("window.location.replace('/org-app/index.html')");
    });

    it('opens the app on a clean address with no query string', () => {
        const redirect = entryPage.match(/location\.replace\('\/org-app\/index\.html[^']*'\)/)[0];
        expect(redirect).not.toContain('?');
        expect(redirect).not.toContain('slug=');
    });

    it('sends a slug-less visit to the error page', () => {
        expect(entryPage).toContain('/pages/error-pages/no-organization.html');
    });
});

describe('the app refuses to select an organization from the address bar', () => {
    const bootstrap = orgApp.match(/<script>\s*\(function \(\)[\s\S]*?<\/script>/)[0];

    it('never reads the query string when resolving the organization', () => {
        expect(bootstrap).not.toContain('URLSearchParams');
        expect(bootstrap).not.toContain('location.search');
    });

    it('resolves the organization only from sessionStorage', () => {
        expect(bootstrap).toContain("sessionStorage.getItem('orgContext')");
    });

    it('redirects away when there is no stored organization', () => {
        expect(bootstrap).toContain('/pages/error-pages/no-organization.html');
    });
});

describe('links into the app', () => {
    const loader = read('js/pages/organizations-loader.js');
    const dashboard = read('js/pages/superadmin-dashboard.js');

    it('org cards point at the entry page, not the app', () => {
        expect(loader).toContain('/pages/organization.html?slug=');
        expect(loader).not.toContain('/org-app/index.html?slug=');
    });

    it('the shareable superadmin URL is the entry page', () => {
        expect(dashboard).toContain('/pages/organization.html?slug=');
        expect(dashboard).not.toContain('/org-app/index.html?slug=');
    });

    it('the entry page carries no Firebase SDK, so the hop stays cheap', () => {
        expect(entryPage).not.toContain('firebasejs');
    });
});
