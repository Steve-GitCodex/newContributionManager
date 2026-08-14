import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../../org-app/js/dashboard-summary.js'), 'utf8');

// moment is a CDN global in the browser. Only .format('YYYY') is used here.
const moment = value => ({
    format: () => String(new Date(value === undefined ? Date.now() : value).getFullYear())
});

const Summary = new Function('moment', 'module', `${source}; return DashboardSummary;`)(moment, undefined);

const contributions = {
    2026: {
        January: {
            contributions: [
                { name: 'Angela', amount: 500, paid: true },
                { name: 'Joel', amount: 300, paid: false }
            ]
        },
        February: {
            contributions: [
                { name: 'Angela', amount: 200, paid: true }
            ]
        }
    },
    2025: {
        January: { contributions: [{ name: 'Old', amount: 999, paid: true }] }
    }
};

const budgets = {
    org: {
        expenses: {
            a: { amount: 120, date: Date.UTC(2026, 0, 10) },
            b: { amount: 80, date: Date.UTC(2026, 5, 2) },
            c: { amount: 400, date: Date.UTC(2025, 3, 1) }
        }
    }
};

describe('financialSummary', () => {
    it('totals only the selected year', () => {
        const summary = Summary.financialSummary(contributions, '2026');

        expect(summary.totalContributions).toBe(1000);
        expect(summary.totalPaid).toBe(700);
        expect(summary.totalUnpaid).toBe(300);
    });

    it('counts a contributor once across months', () => {
        expect(Summary.financialSummary(contributions, '2026').uniqueContributors).toBe(2);
    });

    it('returns zeroes for a year with no data', () => {
        expect(Summary.financialSummary(contributions, '2019')).toEqual({
            totalContributions: 0, totalPaid: 0, totalUnpaid: 0, uniqueContributors: 0
        });
    });

    it('survives a month whose contributions are missing or malformed', () => {
        const ragged = { 2026: { January: {}, February: { contributions: null }, March: { contributions: [{ amount: 50, paid: true }] } } };
        expect(Summary.financialSummary(ragged, '2026').totalPaid).toBe(50);
    });

    it('treats a non-numeric amount as zero rather than NaN', () => {
        const bad = { 2026: { January: { contributions: [{ name: 'X', amount: 'abc', paid: true }] } } };
        expect(Summary.financialSummary(bad, '2026').totalContributions).toBe(0);
    });

    it('paid and unpaid add up to the total', () => {
        const summary = Summary.financialSummary(contributions, '2026');
        expect(summary.totalPaid + summary.totalUnpaid).toBe(summary.totalContributions);
    });
});

describe('budgetSummary', () => {
    it('totals every expense in the ledger', () => {
        expect(Summary.budgetSummary(budgets)).toEqual({ totalExpenses: 600, expenseCount: 3 });
    });

    it('counts expenses, not documents, so one org ledger still informs', () => {
        expect(Summary.budgetSummary(budgets).expenseCount).toBe(3);
    });

    it('handles an empty collection', () => {
        expect(Summary.budgetSummary({})).toEqual({ totalExpenses: 0, expenseCount: 0 });
    });

    it('ignores a document with no expenses map', () => {
        expect(Summary.budgetSummary({ org: {} })).toEqual({ totalExpenses: 0, expenseCount: 0 });
    });
});

describe('budgetSummaryByYear', () => {
    it('keeps only the expenses dated in that year', () => {
        expect(Summary.budgetSummaryByYear(budgets, '2026')).toEqual({ totalExpenses: 200, expenseCount: 2 });
    });

    it('matches when the year arrives as a number', () => {
        expect(Summary.budgetSummaryByYear(budgets, 2026).totalExpenses).toBe(200);
    });

    it('reports nothing for a year with no expenses', () => {
        expect(Summary.budgetSummaryByYear(budgets, '2020')).toEqual({ totalExpenses: 0, expenseCount: 0 });
    });

    it('never exceeds the all-time total', () => {
        const allTime = Summary.budgetSummary(budgets).totalExpenses;
        for (const year of ['2025', '2026']) {
            expect(Summary.budgetSummaryByYear(budgets, year).totalExpenses).toBeLessThanOrEqual(allTime);
        }
    });
});
