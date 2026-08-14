import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const read = file => readFileSync(resolve(here, '../../org-app/js', file), 'utf8');

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function deferred() {
    let resolveFn;
    let rejectFn;
    const promise = new Promise((resolve, reject) => { resolveFn = resolve; rejectFn = reject; });
    promise.catch(() => {});
    return { promise, resolve: resolveFn, reject: rejectFn };
}

function makeHarness() {
    const renderedYears = [];
    const loadedYears = new Set();
    const ensureYearGates = new Map();
    const ensureMonthGates = new Map();
    const loadedMonths = new Set();
    let ensureAllGate = null;
    let loadedAll = false;

    const addCreateMonthButtonCalls = [];
    const updateMemberSelectCalls = [];

    const reportsViewElements = {
        reportMemberSelect: {},
        reportTypeSelect: { value: 'total' },
        memberSelectGroup: { style: {} },
        statusFilterGroup: { style: {} }
    };

    const DOMManager = {
        getReportsViewElements: () => reportsViewElements,
        getAll: () => ({ yearSelect: {}, monthSelect: {} })
    };

    const UIRenderer = {
        hasAnyYears: () => true,
        hideMainEmptyState: () => {},
        hideReportsEmptyState: () => {},
        showView: () => {},
        renderYearlyView: (data, year) => { renderedYears.push(year); },
        renderMonthlyView: () => {},
        addCreateMonthButton: () => { addCreateMonthButtonCalls.push(true); },
        applyRoleRestrictions: () => {}
    };

    const AuthModule = { getUserRole: () => 'admin' };

    const populateYearCalls = [];
    const populateMonthCalls = [];
    const Utils = {
        populateYearSelect: (el, year) => populateYearCalls.push(year),
        populateMonthSelect: (el, month, data, year) => populateMonthCalls.push([year, month])
    };

    const swalCalls = [];
    const Swal = { fire: opts => swalCalls.push(opts) };

    const LoadedScope = {
        ensureYear: async (year) => {
            if (!ensureYearGates.has(year)) {
                loadedYears.add(year);
                return;
            }
            const gate = ensureYearGates.get(year);
            await gate.promise;
            loadedYears.add(year);
        },
        requireYear: (year) => {
            if (!loadedYears.has(year)) throw new Error(`not loaded: ${year}`);
        },
        ensureMonth: async (year, month) => {
            const key = `${year}/${month}`;
            if (!ensureMonthGates.has(key)) {
                loadedMonths.add(key);
                return;
            }
            const gate = ensureMonthGates.get(key);
            await gate.promise;
            loadedMonths.add(key);
        },
        requireLoaded: (year, month) => {
            if (!loadedMonths.has(`${year}/${month}`)) throw new Error(`not loaded: ${year}/${month}`);
        },
        ensureAll: async () => {
            if (ensureAllGate) {
                await ensureAllGate.promise;
            }
            loadedAll = true;
        },
        requireAll: () => {
            if (!loadedAll) throw new Error('not loaded: all');
        }
    };

    const ReportsManager = {
        updateMemberSelect: (contributionsData, reportMemberSelect) => {
            updateMemberSelectCalls.push({ contributionsData, reportMemberSelect, loadedAllAtCallTime: loadedAll });
        },
        handleReportTypeChange: () => {},
        populateReportFilters: () => {}
    };
    const BudgetManager = {};
    const BudgetHandlers = {};
    const SpecialGivingManager = {};
    const CampaignHandlers = {};
    const ContributionsManager = {
        findPreviousMonthData: (contributionsData, year, monthName) => {
            const months = MONTH_NAMES;
            for (let index = months.indexOf(monthName) - 1; index >= 0; index--) {
                if (contributionsData[year]?.[months[index]]) return contributionsData[year][months[index]];
            }
            const earlier = String(parseInt(year, 10) - 1);
            if (contributionsData[earlier]?.December) return contributionsData[earlier].December;
            return null;
        },
        createMonthDataFromPrevious: (previousMonthData) => ({ contributions: [...(previousMonthData?.contributions || [])] }),
        addNewMembersToExistingMonth: (existing, previousMonthData) => ({
            data: existing,
            newMembersAdded: 0
        })
    };
    const document = { getElementById: () => null, querySelectorAll: () => [], querySelector: () => null };
    const moment = { months: () => MONTH_NAMES };

    const ViewManager = new Function(
        'DOMManager', 'UIRenderer', 'ReportsManager', 'LoadedScope', 'BudgetManager',
        'BudgetHandlers', 'SpecialGivingManager', 'CampaignHandlers', 'AuthModule',
        'ContributionsManager', 'Utils', 'Swal', 'document', 'moment',
        `${read('view-manager.js')}; return ViewManager;`
    )(DOMManager, UIRenderer, ReportsManager, LoadedScope, BudgetManager,
        BudgetHandlers, SpecialGivingManager, CampaignHandlers, AuthModule,
        ContributionsManager, Utils, Swal, document, moment);

    const state = {
        contributionsData: { 2025: {}, 2026: {} },
        blacklistData: { blacklistedMembers: [] },
        currentYear: '2025',
        currentMonth: 'January',
        currentView: 'yearly'
    };

    ViewManager.init(state, {});

    return {
        ViewManager, state, renderedYears, loadedYears, ensureYearGates,
        ensureMonthGates, loadedMonths, addCreateMonthButtonCalls, updateMemberSelectCalls,
        setEnsureAllGate: gate => { ensureAllGate = gate; },
        populateYearCalls, populateMonthCalls, swalCalls
    };
}

function flushMicrotasks(times = 3) {
    let p = Promise.resolve();
    for (let i = 0; i < times; i++) {
        p = p.then(() => new Promise(resolve => setTimeout(resolve, 0)));
    }
    return p;
}

describe('ViewManager updateDisplay supersession', () => {
    let h;

    beforeEach(() => {
        h = makeHarness();
    });

    it('lets the newest updateDisplay call render and drops the superseded one', async () => {
        h.ensureYearGates.set('2025', deferred());
        h.ensureYearGates.set('2026', deferred());

        h.state.currentView = 'yearly';
        h.state.currentYear = '2025';
        const first = h.ViewManager.updateDisplay();

        h.state.currentYear = '2026';
        const second = h.ViewManager.updateDisplay();

        h.ensureYearGates.get('2026').resolve();
        await second;

        h.ensureYearGates.get('2025').resolve();
        await first;

        expect(h.renderedYears).toEqual(['2026']);
    });

    it('does not throw when a superseded call resumes after its own scope was never loaded', async () => {
        h.ensureYearGates.set('2025', deferred());
        h.ensureYearGates.set('2026', deferred());

        h.state.currentYear = '2025';
        const first = h.ViewManager.updateDisplay();

        h.state.currentYear = '2026';
        const second = h.ViewManager.updateDisplay();

        h.ensureYearGates.get('2026').resolve();
        await second;

        h.ensureYearGates.get('2025').resolve();
        await expect(first).resolves.toBeUndefined();
    });

    it('does not revert state or DOM when a superseded handlePeriodChange call fails after a newer one already succeeded', async () => {
        const gate2025 = deferred();
        h.ensureYearGates.set('2025', gate2025);

        h.state.currentYear = '2024';
        h.ViewManager.handlePeriodChange('2025', 'January');
        h.ViewManager.handlePeriodChange('2026', 'January');

        await new Promise(resolve => setTimeout(resolve, 0));
        expect(h.state.currentYear).toBe('2026');
        expect(h.renderedYears).toEqual(['2026']);

        gate2025.reject(new Error('offline'));
        await new Promise(resolve => setTimeout(resolve, 0));
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(h.state.currentYear).toBe('2026');
        expect(h.swalCalls.length).toBe(0);
        expect(h.populateYearCalls.length).toBe(0);
    });

    it('reverts state and DOM when the newest call genuinely fails', async () => {
        h.ensureYearGates.set('2026', { promise: Promise.reject(new Error('offline')) });
        h.ensureYearGates.get('2026').promise.catch(() => {});

        h.state.currentYear = '2025';
        h.ViewManager.handlePeriodChange('2026', 'January');

        await new Promise(resolve => setTimeout(resolve, 0));
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(h.state.currentYear).toBe('2025');
        expect(h.swalCalls.length).toBe(1);
        expect(h.populateYearCalls).toEqual(['2025']);
        expect(h.populateMonthCalls).toEqual([['2025', 'January']]);
    });
});

describe('ViewManager deferred setTimeout callbacks respect supersession', () => {
    let h;

    beforeEach(() => {
        h = makeHarness();
    });

    it('runs the deferred callback when the call is not superseded', async () => {
        h.state.currentView = 'monthly';
        h.state.currentYear = '2025';
        h.state.currentMonth = 'January';

        await h.ViewManager.updateDisplay();
        await new Promise(resolve => setTimeout(resolve, 150));

        expect(h.addCreateMonthButtonCalls.length).toBe(1);
    });

    it('does not run the deferred callback once a newer call has superseded it', async () => {
        h.state.currentView = 'monthly';
        h.state.currentYear = '2025';
        h.state.currentMonth = 'January';

        await h.ViewManager.updateDisplay();

        h.state.currentView = 'yearly';
        await h.ViewManager.updateDisplay();

        await new Promise(resolve => setTimeout(resolve, 150));

        expect(h.addCreateMonthButtonCalls.length).toBe(0);
    });
});

describe('ViewManager reports member select', () => {
    let h;

    beforeEach(() => {
        h = makeHarness();
    });

    it('does not build the member select before ensureAll resolves', async () => {
        const gate = deferred();
        h.setEnsureAllGate(gate);

        h.state.currentView = 'yearly';
        h.ViewManager.handleViewChange('reports');

        await flushMicrotasks();
        expect(h.updateMemberSelectCalls.length).toBe(0);

        gate.resolve();
        await flushMicrotasks();

        expect(h.updateMemberSelectCalls.length).toBe(1);
        expect(h.updateMemberSelectCalls[0].loadedAllAtCallTime).toBe(true);
        expect(h.updateMemberSelectCalls[0].contributionsData).toBe(h.state.contributionsData);
    });
});

describe('ViewManager month creation hydration', () => {
    let h;

    beforeEach(() => {
        h = makeHarness();
    });

    it('locatePreviousMonth finds the nearest earlier month present in the same year', () => {
        h.state.contributionsData = { 2025: { January: {}, March: {} } };
        expect(h.ViewManager.locatePreviousMonth('2025', 'April')).toEqual({ year: '2025', monthName: 'March' });
    });

    it('locatePreviousMonth falls back to December of the prior year', () => {
        h.state.contributionsData = { 2024: { December: {} }, 2025: {} };
        expect(h.ViewManager.locatePreviousMonth('2025', 'January')).toEqual({ year: '2024', monthName: 'December' });
    });

    it('locatePreviousMonth returns null when there is nothing earlier', () => {
        h.state.contributionsData = { 2025: {} };
        expect(h.ViewManager.locatePreviousMonth('2025', 'January')).toBeNull();
    });

    it('handleCreateMonth does not write the target month until it is hydrated', async () => {
        h.state.contributionsData = { 2025: { January: {} } };
        h.state.currentYear = '2025';
        h.state.currentMonth = 'January';

        const gate = deferred();
        h.ensureMonthGates.set('2025/January', gate);

        const previousMonthData = { contributions: [{ name: 'A' }] };
        const call = h.ViewManager.handleCreateMonth(previousMonthData, false, true);

        await flushMicrotasks();
        expect(h.state.contributionsData['2025'].January).toEqual({});

        gate.resolve();
        await call;

        expect(h.state.contributionsData['2025'].January.contributions).toEqual([{ name: 'A' }]);
    });

    it('checkAndCreateCurrentMonth hydrates the source month before reading it, and creates the current month from it', async () => {
        h.state.contributionsData = {
            2025: { January: { contributions: [{ name: 'A' }] } }
        };
        h.state.currentYear = '2025';
        h.state.currentMonth = 'February';

        const created = await h.ViewManager.checkAndCreateCurrentMonth();

        expect(created).toBe(true);
        expect(h.loadedMonths.has('2025/January')).toBe(true);
        expect(h.state.contributionsData['2025'].February.contributions).toEqual([{ name: 'A' }]);
    });

    it('checkAndCreateCurrentMonth does not create a month when the source has no contributions', async () => {
        h.state.contributionsData = {
            2025: { January: { contributions: [] } }
        };
        h.state.currentYear = '2025';
        h.state.currentMonth = 'February';

        const created = await h.ViewManager.checkAndCreateCurrentMonth();

        expect(created).toBe(false);
        expect(h.state.contributionsData['2025'].February).toBeUndefined();
    });
});
