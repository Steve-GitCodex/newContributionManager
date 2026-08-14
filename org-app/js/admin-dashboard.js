// Admin Dashboard Module
// Handles admin functionality including user management and financial overview
// Now integrated as a module pattern instead of standalone app

const AdminDashboard = (function() {
    const auth = FirebaseManager.getAuth();
    let currentUser = null;
    let isInitialized = false;
    let allContributionsData = null;
    let allBudgetsData = null;
    let chartInstances = {};
    let dom = null; // Cached DOM elements

    // Set current year in footer
    function setCurrentYear() {
        const yearElement = DOMManager.get('currentYearFooter');
        if (yearElement) {
            yearElement.textContent = new Date().getFullYear();
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        
        // Tab switching
        const tabButtons = document.querySelectorAll('[data-tab]');
        
        tabButtons.forEach(tab => {
            tab.addEventListener('click', handleTabChange);
        });

        // Back button
        if (dom.backToAppBtn) {
            dom.backToAppBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }

        // Export buttons
        if (dom.exportUsersBtn) {
            dom.exportUsersBtn.addEventListener('click', exportUsersCSV);
        }

        if (dom.exportFinancialBtn) {
            dom.exportFinancialBtn.addEventListener('click', exportFinancialCSV);
        }

        const printBtn = DOMManager.get('printReport');
        if (printBtn) {
            printBtn.addEventListener('click', printReport);
        }

        const inviteForm = document.getElementById('invite-form');
        if (inviteForm) {
            inviteForm.addEventListener('submit', handleInvite);
        }
    }

    async function handleInvite(e) {
        e.preventDefault();

        const emailInput = document.getElementById('invite-email');
        const passwordInput = document.getElementById('invite-password');
        const roleInput = document.getElementById('invite-role');
        const submitButton = e.currentTarget.querySelector('button[type="submit"]');

        submitButton.disabled = true;

        try {
            const result = await MemberInvite.invite(emailInput.value, passwordInput.value, roleInput.value);

            emailInput.value = '';
            passwordInput.value = '';

            Swal.fire({
                icon: 'success',
                title: result.accountCreated ? 'Member Added' : 'Existing Account Added',
                text: `${result.email} can now sign in as ${MemberInvite.ROLES[result.role]}.`,
                customClass: { container: 'swal-alert' }
            });

            await loadUsersData();
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Could Not Add Member',
                text: error.message,
                customClass: { container: 'swal-alert' }
            });
        } finally {
            submitButton.disabled = false;
        }
    }

    // Handle tab change
    function handleTabChange(e) {
        const tabName = e.currentTarget.dataset.tab;
        
        // Update tab buttons
        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.classList.remove('active');
        });
        e.currentTarget.classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        const tabContent = document.getElementById(`${tabName}-tab`);
        if (tabContent) {
            tabContent.classList.add('active');
        }

        // Load data for specific tab
        if (tabName === 'financial') {
            loadFinancialData();
        }
    }

    // Load and display users
    async function loadUsersData() {
        try {
            const users = await OrgDb.getAll('users');
            
            dom.adminUserList.innerHTML = '';

            for (const uid in users) {
                if (!Object.prototype.hasOwnProperty.call(users, uid)) continue;
                
                const user = users[uid];
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${sanitizeHTML(user.email)}</td>
                    <td>
                        <select class="role-select" data-uid="${uid}">
                            <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Member</option>
                            <option value="editor" ${user.role === 'editor' ? 'selected' : ''}>Staff</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </td>
                    <td>
                        <span class="status-badge ${user.role === 'admin' ? 'active' : 'inactive'}">
                            ${user.role === 'admin' ? 'Active' : 'Limited'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-small save-role" data-uid="${uid}">
                            <i class="fas fa-save"></i> Save
                        </button>
                    </td>
                `;
                
                dom.adminUserList.appendChild(row);
            }

            // Add event listeners to save buttons
            document.querySelectorAll('.save-role').forEach(btn => {
                btn.addEventListener('click', saveUserRole);
            });
        } catch (error) {
            dom.adminUserList.innerHTML = 
                '<tr><td colspan="4" style="text-align: center;">Error loading users</td></tr>';
        }
    }

    // Save user role
    async function saveUserRole(e) {
        const uid = e.currentTarget.dataset.uid;
        const roleSelect = document.querySelector(`.role-select[data-uid="${uid}"]`);
        const newRole = roleSelect.value;

        try {
            await OrgDb.doc('users', uid).update({ role: newRole });
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'User role updated successfully',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                customClass: { container: 'swal-alert' }
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to update user role',
                customClass: { container: 'swal-alert' }
            });
        }
    }

    // Load financial data
    async function loadFinancialData() {
        try {
            const [contributions, months, budgetsData] = await Promise.all([
                OrgDb.getAll('contributions'),
                OrgDb.getAll('months'),
                OrgDb.getAll('budgets')
            ]);

            allContributionsData = ContributionMapper.rebuildContributions(contributions, months);

            // Check if there's any contribution data
            const hasData = Object.keys(allContributionsData).some(year => {
                const yearData = allContributionsData[year];
                return Object.keys(yearData).some(month => {
                    return yearData[month].contributions && yearData[month].contributions.length > 0;
                });
            });

            if (!hasData) {
                // Show empty state
                const financialContent = document.getElementById('financial-tab');
                if (financialContent) {
                    financialContent.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: center; min-height: 60vh; padding: 40px 20px;">
                            <div style="text-align: center; max-width: 500px;">
                                <div style="font-size: 60px; color: var(--text-secondary); margin-bottom: 20px; opacity: 0.5;">
                                    <i class="fas fa-chart-line"></i>
                                </div>
                                <h3 style="color: var(--text-primary); margin-bottom: 10px; font-size: 20px;">No Financial Data</h3>
                                <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 14px;">
                                    Financial overview will appear once contributions are recorded.
                                </p>
                            </div>
                        </div>
                    `;
                }
                return;
            }

            // Populate year selector
            populateYearSelector(allContributionsData, budgetsData);

            // Display data for selected year
            const selectedYear = dom.yearSelector.value;
            updateFinancialDisplay(selectedYear, allContributionsData, budgetsData);
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to load financial data'
            });
        }
    }

    // Populate year selector with available years
    function populateYearSelector(contributionsData, budgetsData) {
        const yearSelector = dom.yearSelector;
        Utils.populateYearSelector(yearSelector, contributionsData);
        
        // Add change event listener
        yearSelector.addEventListener('change', () => {
            const selectedYear = yearSelector.value;
            updateFinancialDisplay(selectedYear, allContributionsData, budgetsData);
        });
    }

    // Update financial display for selected year
    function updateFinancialDisplay(selectedYear, contributionsData, budgetsData) {
        const summary = calculateFinancialSummary(contributionsData, selectedYear);
        const budgetSummaryByYear = calculateBudgetSummaryByYear(budgetsData, selectedYear);
        const budgetSummaryAllTime = calculateBudgetSummary(budgetsData);

        // Update cards (using year-specific expenses)
        dom.totalContributions.textContent = 
            summary.totalContributions.toLocaleString();
        dom.totalPaid.textContent = 
            summary.totalPaid.toLocaleString();
        dom.totalUnpaid.textContent = 
            summary.totalUnpaid.toLocaleString();
        dom.totalExpenses.textContent = 
            budgetSummaryByYear.totalExpenses.toLocaleString();

        // Update additional stats
        const percentPaid = summary.totalContributions > 0 
            ? Math.round((summary.totalPaid / summary.totalContributions) * 100) 
            : 0;
        dom.percentPaid.textContent = percentPaid + '%';
        
        dom.activeContributors.textContent = summary.uniqueContributors;
        
        const avgContribution = summary.uniqueContributors > 0
            ? Math.round(summary.totalContributions / summary.uniqueContributors)
            : 0;
        document.getElementById('avg-contribution').textContent = avgContribution.toLocaleString();
        
        document.getElementById('collection-rate').textContent = percentPaid + '%';

        // Render charts
        renderMonthlyChart(contributionsData, selectedYear);
        renderPaymentStatusChart(summary);

        // Render budget summary (using all-time data)
        renderBudgetSummary(budgetSummaryAllTime);
    }

    // Calculate financial summary from contributions
    function calculateFinancialSummary(contributionsData, selectedYear) {
        let totalContributions = 0;
        let totalPaid = 0;
        let totalUnpaid = 0;
        const contributors = new Set();

        const year = selectedYear || moment().format('YYYY');

        // Only process selected year data
        const yearData = contributionsData[year];
        if (!yearData || typeof yearData !== 'object') {
            return { totalContributions: 0, totalPaid: 0, totalUnpaid: 0, uniqueContributors: 0 };
        }

        // Iterate through months in selected year
        for (const month in yearData) {
            if (!Object.prototype.hasOwnProperty.call(yearData, month)) continue;
            
            const monthData = yearData[month];
            
            // Check if this month has contributions array
            if (monthData && typeof monthData === 'object' && monthData.contributions && Array.isArray(monthData.contributions)) {
                monthData.contributions.forEach(contribution => {
                    const amount = Number(contribution.amount) || 0;
                    totalContributions += amount;
                    
                    if (contribution.name) contributors.add(contribution.name);
                    
                    if (contribution.paid) {
                        totalPaid += amount;
                    } else {
                        totalUnpaid += amount;
                    }
                });
            }
        }

        return { totalContributions, totalPaid, totalUnpaid, uniqueContributors: contributors.size };
    }

    // Calculate budget summary (all-time, for the summary section)
    function calculateBudgetSummary(budgetsData) {
        let totalExpenses = 0;
        let budgetCount = 0;

        for (const uid in budgetsData) {
            if (!Object.prototype.hasOwnProperty.call(budgetsData, uid)) continue;
            
            const userBudget = budgetsData[uid];
            
            // Count users with budget data
            if (userBudget.expenses && Object.keys(userBudget.expenses).length > 0) {
                budgetCount++;
            }

            if (userBudget.expenses) {
                for (const expenseId in userBudget.expenses) {
                    if (!Object.prototype.hasOwnProperty.call(userBudget.expenses, expenseId)) continue;
                    const expense = userBudget.expenses[expenseId];
                    totalExpenses += Number(expense.amount) || 0;
                }
            }
        }

        return { totalExpenses, budgetCount };
    }

    // Calculate budget summary for specific year (for overview cards)
    function calculateBudgetSummaryByYear(budgetsData, selectedYear) {
        let totalExpenses = 0;
        let budgetCount = 0;

        for (const uid in budgetsData) {
            if (!Object.prototype.hasOwnProperty.call(budgetsData, uid)) continue;
            
            const userBudget = budgetsData[uid];
            
            if (userBudget.expenses) {
                for (const expenseId in userBudget.expenses) {
                    if (!Object.prototype.hasOwnProperty.call(userBudget.expenses, expenseId)) continue;
                    const expense = userBudget.expenses[expenseId];
                    const expenseYear = moment(expense.date).format('YYYY');
                    
                    // Only count expenses from selected year
                    if (expenseYear === selectedYear.toString()) {
                        totalExpenses += Number(expense.amount) || 0;
                        budgetCount = 1; // At least one user has expenses
                    }
                }
            }
        }

        return { totalExpenses, budgetCount };
    }

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
                    <label>Users with Expenses:</label>
                    <strong>${budgetSummary.budgetCount}</strong>
                </div>
            </div>
        `;
        document.getElementById('budget-summary').innerHTML = html;
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
            if (!allContributionsData) {
                Swal.fire({
                    icon: 'error',
                    title: 'Export Failed',
                    text: 'No financial data loaded'
                });
                return;
            }

            const selectedYear = document.getElementById('year-selector').value;
            const yearData = allContributionsData[selectedYear];

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
                const budgetSummary = calculateBudgetSummaryByYear(budgetsData, selectedYear);
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
            const summary = calculateFinancialSummary(allContributionsData, selectedYear);
            
            OrgDb.getAll('budgets').then(budgetsData => {
                const budgetSummary = calculateBudgetSummaryByYear(budgetsData, selectedYear);
                const balance = summary.totalPaid - budgetSummary.totalExpenses;
            
            // Get current date
            const printDate = moment().format('MMMM DD, YYYY');
            
            // Generate monthly report rows
            const monthlyRows = generateMonthlyReportRows(allContributionsData[selectedYear]);
            
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

    // Sanitize HTML
    function sanitizeHTML(text) {
        if (!text) return '';
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Public API
    return {
        async init() {
            try {
                // Wait for auth state to be ready
                return new Promise((resolve) => {
                    const unsubscribe = auth.onAuthStateChanged(async (user) => {
                        unsubscribe(); // Unsubscribe after first check
                        
                        if (!user) {
                            window.location.href = 'index.html';
                            resolve();
                            return;
                        }

                        // Check admin role
                        try {
                            const membership = await OrgDb.getOne('users', user.uid);

                            if (!membership || membership.role !== 'admin') {
                                Swal.fire({
                                    icon: 'error',
                                    title: 'Access Denied',
                                    text: 'Only admins can access this page',
                                    willClose: () => {
                                        window.location.href = 'index.html';
                                    }
                                });
                                resolve();
                                return;
                            }

                            currentUser = user;
                            dom = DOMManager.getAdminDashboardElements(); // Cache DOM elements once
                            setupEventListeners();
                            loadUsersData();
                            loadFinancialData();
                            setCurrentYear();
                            isInitialized = true;
                            resolve();
                        } catch (error) {
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: 'Failed to verify admin status',
                                willClose: () => {
                                    window.location.href = 'index.html';
                                }
                            });
                            resolve();
                        }
                    });
                });
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to initialize admin dashboard',
                    willClose: () => {
                        window.location.href = 'index.html';
                    }
                });
            }
        },

        isInitialized() {
            return isInitialized;
        },

        getCurrentUser() {
            return currentUser;
        }
    };
})();
