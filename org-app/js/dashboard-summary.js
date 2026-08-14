// The dashboard's money arithmetic, kept apart from the DOM so it can be tested.
// Budgets arrive as a collection keyed by document id — one `org` document since the
// per-user split was collapsed, but the totals do not care how many there are.

const DashboardSummary = (function () {
    function eachExpense(budgetsData, visit) {
        for (const id in budgetsData) {
            if (!Object.prototype.hasOwnProperty.call(budgetsData, id)) continue;

            const expenses = budgetsData[id] && budgetsData[id].expenses;
            if (!expenses) continue;

            for (const expenseId in expenses) {
                if (!Object.prototype.hasOwnProperty.call(expenses, expenseId)) continue;
                visit(expenses[expenseId], id);
            }
        }
    }

    function financialSummary(contributionsData, selectedYear) {
        const empty = { totalContributions: 0, totalPaid: 0, totalUnpaid: 0, uniqueContributors: 0 };
        const year = selectedYear || moment().format('YYYY');
        const yearData = (contributionsData || {})[year];

        if (!yearData || typeof yearData !== 'object') return empty;

        let totalContributions = 0;
        let totalPaid = 0;
        let totalUnpaid = 0;
        const contributors = new Set();

        for (const month in yearData) {
            if (!Object.prototype.hasOwnProperty.call(yearData, month)) continue;

            const monthData = yearData[month];
            if (!monthData || !Array.isArray(monthData.contributions)) continue;

            for (const contribution of monthData.contributions) {
                const amount = Number(contribution.amount) || 0;
                totalContributions += amount;

                if (contribution.name) contributors.add(contribution.name);
                if (contribution.paid) totalPaid += amount;
                else totalUnpaid += amount;
            }
        }

        return { totalContributions, totalPaid, totalUnpaid, uniqueContributors: contributors.size };
    }

    // One ledger means counting documents would only ever report 1, so the count that
    // carries information is how many expenses were recorded.
    function budgetSummary(budgetsData) {
        let totalExpenses = 0;
        let expenseCount = 0;

        eachExpense(budgetsData, expense => {
            totalExpenses += Number(expense.amount) || 0;
            expenseCount++;
        });

        return { totalExpenses, expenseCount };
    }

    function budgetSummaryByYear(budgetsData, selectedYear) {
        let totalExpenses = 0;
        let expenseCount = 0;

        eachExpense(budgetsData, expense => {
            if (moment(expense.date).format('YYYY') !== String(selectedYear)) return;
            totalExpenses += Number(expense.amount) || 0;
            expenseCount++;
        });

        return { totalExpenses, expenseCount };
    }

    return { financialSummary, budgetSummary, budgetSummaryByYear };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardSummary;
}
