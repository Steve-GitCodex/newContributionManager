// CSV downloads and the printable report for the admin dashboard.

const DashboardExport = (function () {
    // The dashboard owns the loaded contributions; the export reads whatever it last set.
    let contributionsData = null;

    function useData(data) {
        contributionsData = data;
    }

    // Export users to CSV
    function exportUsersCSV() {
        try {
            const table = document.getElementById('admin-users-table');
            const rows = table.querySelectorAll('tr');
            let csv = 'Email,Role,Status\n';

            rows.forEach((row, index) => {
                if (index === 0) return; // Skip header
                
                const cells = row.querySelectorAll('td');
                if (cells.length >= 3) {
                    const email = cells[0].textContent;
                    const role = cells[1].textContent;
                    const status = cells[2].textContent;
                    csv += `"${email}","${role}","${status}"\n`;
                }
            });

            downloadCSV(csv, 'users-data.csv');
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Export Failed',
                text: 'Failed to export user data'
            });
        }
    }

    // Export financial data to CSV
    function exportFinancialCSV() {
        try {
            if (!contributionsData) {
                Swal.fire({
                    icon: 'error',
                    title: 'Export Failed',
                    text: 'No financial data loaded'
                });
                return;
            }

            const selectedYear = document.getElementById('year-selector').value;
            const yearData = contributionsData[selectedYear];

            if (!yearData || typeof yearData !== 'object') {
                Swal.fire({
                    icon: 'error',
                    title: 'Export Failed',
                    text: `No data available for year ${selectedYear}`
                });
                return;
            }

            let csv = 'Month,Total Pledged,Total Paid,Total Outstanding,Contributors\n';
            const monthsArray = moment.months();

            let grandTotalPledged = 0;
            let grandTotalPaid = 0;
            let grandTotalOutstanding = 0;
            let grandTotalContributors = new Set();
            let monthData = {};
            
            // Initialize all months
            monthsArray.forEach(month => {
                monthData[month] = { total: 0, paid: 0, unpaid: 0, contributors: new Set() };
            });
            
            // Collect data from yearData
            for (const month in yearData) {
                if (!Object.prototype.hasOwnProperty.call(yearData, month)) continue;
                
                const data = yearData[month];
                
                if (data && typeof data === 'object' && data.contributions && Array.isArray(data.contributions)) {
                    data.contributions.forEach(contribution => {
                        const amount = Number(contribution.amount) || 0;
                        monthData[month].total += amount;
                        
                        if (contribution.name) {
                            monthData[month].contributors.add(contribution.name);
                            grandTotalContributors.add(contribution.name);
                        }
                        
                        if (contribution.paid) {
                            monthData[month].paid += amount;
                        } else {
                            monthData[month].unpaid += amount;
                        }
                    });
                }
            }
            
            // Generate rows for all months in order
            monthsArray.forEach(month => {
                const data = monthData[month];
                const outstanding = data.total - data.paid;
                
                grandTotalPledged += data.total;
                grandTotalPaid += data.paid;
                grandTotalOutstanding += outstanding;
                
                csv += `"${month}","${data.total.toLocaleString()}","${data.paid.toLocaleString()}","${outstanding.toLocaleString()}","${data.contributors.size}"\n`;
            });

            // Add summary row
            csv += '\n"TOTAL","' + grandTotalPledged.toLocaleString() + '","' + 
                   grandTotalPaid.toLocaleString() + '","' + 
                   grandTotalOutstanding.toLocaleString() + '","' + 
                   grandTotalContributors.size + '"\n';
            
            OrgDb.getAll('budgets').then(budgetsData => {
                const budgetSummary = DashboardSummary.budgetSummaryByYear(budgetsData, selectedYear);
                const balance = grandTotalPaid - budgetSummary.totalExpenses;
                
                csv += '\n"Yearly Expense","' + budgetSummary.totalExpenses.toLocaleString() + '"\n';
                csv += '"Balance After Expense","' + balance.toLocaleString() + '"\n';

                downloadCSV(csv, `financial-data-${selectedYear}.csv`);
                
                Swal.fire({
                    icon: 'success',
                    title: 'Export Successful',
                    text: `Financial data for ${selectedYear} has been exported`
                });
            });
            return;
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Export Failed',
                text: 'Failed to export financial data: ' + error.message
            });
        }
    }

    // Download CSV helper
    function downloadCSV(csv, filename) {
        try {
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            
            if (!blob || blob.size === 0) {
                throw new Error('Failed to create CSV file');
            }

            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            if (!url) {
                throw new Error('Failed to create download link');
            }

            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.position = 'absolute';
            link.style.left = '-9999px';
            
            document.body.appendChild(link);
            link.click();
            
            // Keep link in DOM for 3 seconds to avoid browser download blocking
            setTimeout(() => {
                try {
                    if (document.body.contains(link)) {
                        document.body.removeChild(link);
                    }
                } catch (e) {
                    // Ignore removal errors
                }
            }, 3000);
        } catch (error) {
            throw error;
        }
    }

    // Print report (essential parts only)
    function printReport() {
        try {
            const printWindow = window.open('', '_blank');
            const selectedYear = document.getElementById('year-selector').value;
            const summary = DashboardSummary.financialSummary(contributionsData, selectedYear);
            
            OrgDb.getAll('budgets').then(budgetsData => {
                const budgetSummary = DashboardSummary.budgetSummaryByYear(budgetsData, selectedYear);
                const balance = summary.totalPaid - budgetSummary.totalExpenses;
            
            // Get current date
            const printDate = moment().format('MMMM DD, YYYY');
            
            // Generate monthly report rows
            const monthlyRows = generateMonthlyReportRows(contributionsData[selectedYear]);
            
            // Build print HTML using template
            const printHTML = Templates.PRINT_REPORT_HTML(selectedYear, printDate, summary, budgetSummary, balance, monthlyRows);
            
            printWindow.document.write(printHTML);
            printWindow.document.close();
            
            // Wait for content to load before printing
            setTimeout(() => {
                printWindow.print();
            }, 250);
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Print Error',
                text: 'Failed to generate print report: ' + error.message
            });
        }
    }

    // Helper function to generate monthly report rows
    function generateMonthlyReportRows(yearData) {
        const monthsArray = moment.months();
        
        let html = '';
        let grandTotal = 0;
        let grandPaid = 0;
        let grandOutstanding = 0;
        let grandContributors = new Set();
        let monthData = {};
        
        // Initialize all months
        monthsArray.forEach(month => {
            monthData[month] = { total: 0, paid: 0, unpaid: 0, contributors: new Set() };
        });
        
        // Collect data from yearData
        if (yearData && typeof yearData === 'object') {
            for (const month in yearData) {
                if (!Object.prototype.hasOwnProperty.call(yearData, month)) continue;
                
                const data = yearData[month];
                
                if (data && typeof data === 'object' && data.contributions && Array.isArray(data.contributions)) {
                    data.contributions.forEach(contribution => {
                        const amount = Number(contribution.amount) || 0;
                        monthData[month].total += amount;
                        
                        if (contribution.name) {
                            monthData[month].contributors.add(contribution.name);
                            grandContributors.add(contribution.name);
                        }
                        
                        if (contribution.paid) {
                            monthData[month].paid += amount;
                        } else {
                            monthData[month].unpaid += amount;
                        }
                    });
                }
            }
        }
        
        // Generate rows for all months in order
        monthsArray.forEach(month => {
            const data = monthData[month];
            const outstanding = data.total - data.paid;
            
            grandTotal += data.total;
            grandPaid += data.paid;
            grandOutstanding += outstanding;
            
            html += `
                <tr>
                    <td>${month}</td>
                    <td>${data.total.toLocaleString()}</td>
                    <td>${data.paid.toLocaleString()}</td>
                    <td>${outstanding.toLocaleString()}</td>
                    <td>${data.contributors.size}</td>
                </tr>
            `;
        });
        
        // Add total row
        html += `
            <tr class="total">
                <td>TOTAL</td>
                <td>${grandTotal.toLocaleString()}</td>
                <td>${grandPaid.toLocaleString()}</td>
                <td>${grandOutstanding.toLocaleString()}</td>
                <td>${grandContributors.size}</td>
            </tr>
        `;
        
        return html;
    }

    return { useData, exportUsersCSV, exportFinancialCSV, printReport };
})();
