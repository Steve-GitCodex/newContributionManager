// Chart.js instances for the admin dashboard. Each render destroys the previous
// instance, which Chart.js requires before its canvas can be reused.

const DashboardCharts = (function () {
    const chartInstances = {};

    // Render monthly trends chart
    function renderMonthlyChart(contributionsData, selectedYear) {
        const monthlyData = {};
        const monthsArray = moment.months();

        // Initialize all months
        monthsArray.forEach(month => {
            monthlyData[month] = { total: 0, paid: 0, unpaid: 0 };
        });

        // Only process selected year data
        const yearData = contributionsData[selectedYear];
        if (yearData && typeof yearData === 'object') {
            for (const month in yearData) {
                if (!Object.prototype.hasOwnProperty.call(yearData, month)) continue;
                
                const monthData = yearData[month];
                
                if (monthData && typeof monthData === 'object' && monthData.contributions && Array.isArray(monthData.contributions)) {
                    monthData.contributions.forEach(contribution => {
                        const amount = Number(contribution.amount) || 0;
                        monthlyData[month].total += amount;
                        
                        if (contribution.paid) {
                            monthlyData[month].paid += amount;
                        } else {
                            monthlyData[month].unpaid += amount;
                        }
                    });
                }
            }
        }

        // Prepare data for chart
        const labels = monthsArray;
        const totalData = labels.map(month => monthlyData[month].total);
        const paidData = labels.map(month => monthlyData[month].paid);
        const unpaidData = labels.map(month => monthlyData[month].unpaid);

        // Destroy previous chart if exists
        if (chartInstances.monthly) {
            chartInstances.monthly.destroy();
        }

        // Create new chart
        const ctx = document.getElementById('monthly-chart').getContext('2d');
        chartInstances.monthly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Total',
                        data: totalData,
                        backgroundColor: 'rgba(102, 126, 234, 0.8)',
                        borderColor: 'rgba(102, 126, 234, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Paid',
                        data: paidData,
                        backgroundColor: 'rgba(40, 167, 69, 0.8)',
                        borderColor: 'rgba(40, 167, 69, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Unpaid',
                        data: unpaidData,
                        backgroundColor: 'rgba(220, 53, 69, 0.8)',
                        borderColor: 'rgba(220, 53, 69, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    // Render payment status pie chart
    function renderPaymentStatusChart(summary) {
        // Destroy previous chart if exists
        if (chartInstances.paymentStatus) {
            chartInstances.paymentStatus.destroy();
        }

        // Create new chart
        const ctx = document.getElementById('payment-status-chart').getContext('2d');
        chartInstances.paymentStatus = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Paid', 'Unpaid'],
                datasets: [{
                    data: [summary.totalPaid, summary.totalUnpaid],
                    backgroundColor: [
                        'rgba(40, 167, 69, 0.8)',
                        'rgba(220, 53, 69, 0.8)'
                    ],
                    borderColor: [
                        'rgba(40, 167, 69, 1)',
                        'rgba(220, 53, 69, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                }
            }
        });
    }

    // Render budget summary
    function renderBudgetSummary(budgetSummary) {
        const html = `
            <div class="summary-stats">
                <div class="stat-item">
                    <label>Total Expenses:</label>
                    <strong>${budgetSummary.totalExpenses.toLocaleString()}</strong>
                </div>
                <div class="stat-item">
                    <label>Expenses Recorded:</label>
                    <strong>${budgetSummary.expenseCount}</strong>
                </div>
            </div>
        `;
        document.getElementById('budget-summary').innerHTML = html;
    }
    return { renderMonthlyChart, renderPaymentStatusChart, renderBudgetSummary };
})();
