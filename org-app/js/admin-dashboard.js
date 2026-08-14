// Admin Dashboard Module
// Handles admin functionality including user management and financial overview

const AdminDashboard = (function() {
    const auth = FirebaseManager.getAuth();
    let currentUser = null;
    let isInitialized = false;
    let allContributionsData = null;
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
            dom.exportUsersBtn.addEventListener('click', DashboardExport.exportUsersCSV);
        }

        if (dom.exportFinancialBtn) {
            dom.exportFinancialBtn.addEventListener('click', DashboardExport.exportFinancialCSV);
        }

        const printBtn = DOMManager.get('printReport');
        if (printBtn) {
            printBtn.addEventListener('click', DashboardExport.printReport);
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
            const users = await MemberAdmin.loadMembers();

            dom.adminUserList.innerHTML = '';

            for (const uid in users) {
                if (!Object.prototype.hasOwnProperty.call(users, uid)) continue;

                const user = users[uid];
                const row = document.createElement('tr');
                const options = Object.keys(MemberAdmin.ROLES)
                    .map(role => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${MemberAdmin.ROLES[role]}</option>`)
                    .join('');

                row.innerHTML = `
                    <td>${Utils.sanitizeHTML(user.email)}</td>
                    <td>
                        <select class="role-select" data-uid="${uid}">${options}</select>
                    </td>
                    <td>
                        <span class="status-badge ${user.role === 'admin' ? 'active' : 'inactive'}">
                            ${user.role === 'admin' ? 'Active' : 'Limited'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-small save-role" data-requires="admin" data-uid="${uid}">
                            <i class="fas fa-save"></i> Save
                        </button>
                        <button class="btn btn-small btn-danger remove-member" data-requires="admin" data-uid="${uid}" data-email="${Utils.sanitizeHTML(user.email)}">
                            <i class="fas fa-user-minus"></i> Remove
                        </button>
                    </td>
                `;

                dom.adminUserList.appendChild(row);
            }

            document.querySelectorAll('.save-role').forEach(btn => {
                btn.addEventListener('click', saveUserRole);
            });

            document.querySelectorAll('.remove-member').forEach(btn => {
                btn.addEventListener('click', removeMember);
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

        try {
            await MemberAdmin.changeRole(uid, roleSelect.value);
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
            loadUsersData();
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Failed to update user role',
                customClass: { container: 'swal-alert' }
            });
        }
    }

    // Remove a member's access to this organization
    async function removeMember(e) {
        const { uid, email } = e.currentTarget.dataset;
        const currentUid = FirebaseManager.getAuth().currentUser?.uid;

        const confirmed = await Swal.fire({
            icon: 'warning',
            title: 'Remove member?',
            html: `${Utils.sanitizeHTML(email)} loses access to this organization immediately.<br><br>Their sign-in account still exists, so they can be invited back.`,
            showCancelButton: true,
            confirmButtonText: 'Remove',
            cancelButtonText: 'Cancel',
            customClass: { container: 'swal-alert' }
        });

        if (!confirmed.isConfirmed) return;

        try {
            await MemberAdmin.remove(uid, currentUid);
            Swal.fire({
                icon: 'success',
                title: 'Removed',
                text: `${email} is no longer a member.`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                customClass: { container: 'swal-alert' }
            });
            loadUsersData();
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Cannot remove',
                text: error.message || 'Failed to remove the member.',
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
            DashboardExport.useData(allContributionsData);

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
        const summary = DashboardSummary.financialSummary(contributionsData, selectedYear);
        const budgetSummaryByYear = DashboardSummary.budgetSummaryByYear(budgetsData, selectedYear);
        const budgetSummaryAllTime = DashboardSummary.budgetSummary(budgetsData);

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
        DashboardCharts.renderMonthlyChart(contributionsData, selectedYear);
        DashboardCharts.renderPaymentStatusChart(summary);

        // Render budget summary (using all-time data)
        DashboardCharts.renderBudgetSummary(budgetSummaryAllTime);
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
