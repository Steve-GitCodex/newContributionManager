const UIRenderer = (function() {
    // State reference - points to the shared appState object
    let state = {
        contributionsData: {},
        blacklistData: { blacklistedMembers: [] },
        budgetData: { expenses: {} },
        campaignsData: {},
        currentYear: '',
        currentMonth: '',
        currentView: 'monthly'
    };

    // Injected save callback (kept separate from data state)
    let _saveCallback = null;

    return {
        // Initialize UIRenderer with app state
        init(appState, saveCallback) {
            state = appState;
            _saveCallback = saveCallback;
        },

        // Check if there are any years in the contributions data
        hasAnyYears(contributionsData) {
            for (const year in contributionsData) {
                if (Object.prototype.hasOwnProperty.call(contributionsData, year)) {
                    return true;
                }
            }
            return false;
        },

        // Check if there's any contribution data at all (with actual contributions)
        hasAnyData(contributionsData) {
            for (const year in contributionsData) {
                if (!Object.prototype.hasOwnProperty.call(contributionsData, year)) continue;
                const yearData = contributionsData[year];
                for (const month in yearData) {
                    if (yearData[month].contributions && yearData[month].contributions.length > 0) {
                        return true;
                    }
                }
            }
            return false;
        },

        // Render main empty state when no years exist
        renderMainEmptyState() {
            
            const dom = DOMManager.getAll();
            
            // Hide action bar and contributions section for both views
            if (dom.monthlyView) {
                const actionBar = dom.monthlyView.querySelector('.action-bar');
                const contributions = dom.monthlyView.querySelector('.contributions');
                
                if (actionBar) actionBar.style.display = 'none';
                if (contributions) contributions.style.display = 'none';
                
                // Insert empty state template
                if (!dom.monthlyView.querySelector('[data-empty-state-content]')) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.setAttribute('data-empty-state-content', 'monthly');
                    emptyDiv.innerHTML = Templates.MONTHLY_EMPTY_STATE;
                    dom.monthlyView.appendChild(emptyDiv);
                    
                    // Attach event listener to create first month button
                    const createFirstBtn = emptyDiv.querySelector('#create-first-month-btn');
                    if (createFirstBtn) {
                        createFirstBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            // Show the custom month creation dialog
                            this.showCreateMonthDialog('Create Your First Month');
                        });
                    }
                } else {
                    dom.monthlyView.querySelector('[data-empty-state-content]').style.display = '';
                }
            }
            
            if (dom.yearlyView) {
                const contributions = dom.yearlyView.querySelector('.contributions');
                
                if (contributions) contributions.style.display = 'none';
                
                // Insert empty state template
                if (!dom.yearlyView.querySelector('[data-empty-state-content]')) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.setAttribute('data-empty-state-content', 'yearly');
                    emptyDiv.innerHTML = Templates.YEARLY_EMPTY_STATE;
                    dom.yearlyView.appendChild(emptyDiv);
                } else {
                    dom.yearlyView.querySelector('[data-empty-state-content]').style.display = '';
                }
            }
        },
        
        // Hide empty state and show content when data exists
        hideMainEmptyState() {
            
            const dom = DOMManager.getAll();
            
            // Show action bar and contributions section for both views
            if (dom.monthlyView) {
                const actionBar = dom.monthlyView.querySelector('.action-bar');
                const contributions = dom.monthlyView.querySelector('.contributions');
                const emptyState = dom.monthlyView.querySelector('[data-empty-state-content]');
                
                if (actionBar) actionBar.style.display = '';
                if (contributions) contributions.style.display = '';
                if (emptyState) emptyState.style.display = 'none';
            }
            
            if (dom.yearlyView) {
                const contributions = dom.yearlyView.querySelector('.contributions');
                const emptyState = dom.yearlyView.querySelector('[data-empty-state-content]');
                
                if (contributions) contributions.style.display = '';
                if (emptyState) emptyState.style.display = 'none';
            }
        },

        // Add create custom month button to action bar
        addCreateMonthButton() {
            const actionBar = document.querySelector('.action-bar');
            if (!actionBar) return;
            
            // Check if button already exists
            if (document.getElementById('create-custom-month-btn')) return;
            
            const btn = document.createElement('button');
            btn.id = 'create-custom-month-btn';
            btn.dataset.requires = 'staff';
            btn.className = 'btn btn-primary';
            btn.style.marginLeft = '10px';
            btn.innerHTML = '<i class="fas fa-plus"></i> Create Month';
            btn.addEventListener('click', () => {
                this.showCreateMonthDialog('Create New Month');
            });
            actionBar.appendChild(btn);
        },

        // Add clone to next month button to action bar
        addCloneMonthButton() {
            const actionBar = document.querySelector('.action-bar');
            if (!actionBar) return;
            
            // Check if button already exists
            if (document.getElementById('clone-month-btn')) return;
            
            const btn = document.createElement('button');
            btn.id = 'clone-month-btn';
            btn.dataset.requires = 'staff';
            btn.className = 'btn btn-primary';
            btn.style.marginLeft = '10px';
            btn.innerHTML = '<i class="fas fa-copy"></i> Clone to Next Month';
            btn.addEventListener('click', () => {
                this.cloneMonthToNext();
            });
            actionBar.appendChild(btn);
        },        // Show dialog to create a new month
        showCreateMonthDialog(dialogTitle = 'Create Month') {
            // Get available and potential years
            const currentYear = moment().format('YYYY');
            const years = [];
            
            // Add current year and surrounding years
            for (let i = parseInt(currentYear) - 5; i <= parseInt(currentYear) + 5; i++) {
                years.push(i.toString());
            }
            
            // Add any years that already have data
            for (const year in state.contributionsData) {
                if (!years.includes(year)) {
                    years.push(year);
                }
            }
            
            years.sort();
            
            Swal.fire({
                title: dialogTitle,
                html: Templates.CREATE_MONTH_FORM,
                didOpen: () => {
                    // Populate year selector
                    const yearSelect = document.getElementById('new-month-year');
                    years.forEach(year => {
                        const option = document.createElement('option');
                        option.value = year;
                        option.textContent = year;
                        if (year === currentYear) option.selected = true;
                        yearSelect.appendChild(option);
                    });
                    
                    // Set default month to current
                    const monthSelect = document.getElementById('new-month-select');
                    monthSelect.value = moment().format('MMMM');
                },
                showCancelButton: true,
                confirmButtonText: 'Create Month',
                cancelButtonText: 'Cancel',
                preConfirm: () => {
                    const year = document.getElementById('new-month-year').value;
                    const month = document.getElementById('new-month-select').value;
                    
                    if (!year) {
                        Swal.showValidationMessage('Please select a year');
                        return false;
                    }
                    if (!month) {
                        Swal.showValidationMessage('Please select a month');
                        return false;
                    }
                    
                    return { year, month };
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    const { year, month } = result.value;
                    
                    // Create the month structure
                    if (!state.contributionsData[year]) {
                        state.contributionsData[year] = {};
                    }
                    
                    if (state.contributionsData[year][month]) {
                        Swal.fire({
                            icon: 'info',
                            title: 'Month Already Exists',
                            text: `${month} ${year} already has data. Go to that month to view or edit it.`,
                            timer: 3000
                        });
                        return;
                    }
                    
                    // Create new month with empty contributions
                    state.contributionsData[year][month] = {
                        contributions: [],
                        total: 0
                    };
                    
                    // Update current view/month to show the newly created month
                    state.currentYear = year;
                    state.currentMonth = month;
                    
                    // Update the DOM selectors to reflect the new month
                    const yearSelect = document.getElementById('year-select');
                    const monthSelect = document.getElementById('month-select');
                    
                    // Refresh the year selector with the new year included
                    if (yearSelect) {
                        Utils.populateYearSelect(yearSelect, year, state.contributionsData);
                    }
                    
                    // Refresh the month selector with the new month included
                    if (monthSelect) {
                        Utils.populateMonthSelect(monthSelect, month, state.contributionsData, year);
                    }
                    
                    // Show loading state
                    Swal.fire({
                        title: 'Creating Month...',
                        text: 'Please wait while we save your new month.',
                        icon: 'info',
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        didOpen: async () => {
                            Swal.showLoading();
                            
                            try {
                                // Save the data - wait for it to complete
                                if (_saveCallback) {
                                    _saveCallback(false); // Don't show notification yet
                                    // Wait for debounced save to complete (1 second debounce + Firebase operations)
                                    await new Promise(resolve => setTimeout(resolve, 3000));

                                }
                                
                                // Close loading dialog
                                Swal.close();
                                
                                // Show success message
                                await Swal.fire({
                                    icon: 'success',
                                    title: 'Month Created',
                                    text: `${month} ${year} has been created successfully.`,
                                    timer: 2000,
                                    showConfirmButton: false
                                });
                                
                                // Refresh UI by re-initializing modules and updating display
                                // This ensures all views are synchronized with the latest data

                                
                                // Update state to the newly created month
                                state.currentYear = year;
                                state.currentMonth = month;
                                state.currentView = 'monthly';  // Switch to monthly view to show the newly created month

                                
                                if (typeof ViewManager !== 'undefined' && ViewManager.init) {
                                    ViewManager.init(state);

                                }
                                
                                // Update the DOM selectors to reflect the new month
                                const yearSelect = document.getElementById('year-select');
                                const monthSelect = document.getElementById('month-select');
                                
                                if (yearSelect) {
                                    Utils.populateYearSelect(yearSelect, year, state.contributionsData);
                                    yearSelect.value = year;  // Set the selected value

                                }
                                
                                if (monthSelect) {
                                    Utils.populateMonthSelect(monthSelect, month, state.contributionsData, year);
                                    monthSelect.value = month;  // Set the selected value

                                }
                                
                                // Update active tab UI to monthly
                                const tabButton = document.querySelector('[data-view="monthly"]');
                                if (tabButton) {
                                    const allTabs = document.querySelectorAll('.tab-btn');
                                    allTabs.forEach(tab => tab.classList.remove('active'));
                                    tabButton.classList.add('active');

                                }
                                
                                // Refresh the display - this will re-render all views with latest data

                                if (state.updateDisplayCallback) {
                                    state.updateDisplayCallback();

                                }
                            } catch (error) {
                                Swal.close();
                                Swal.fire({
                                    icon: 'error',
                                    title: 'Error Creating Month',
                                    text: error.message || 'Failed to create month. Please try again.',
                                    timer: 4000
                                });
                            }
                        }
                    });
                }
            });
        },

        // Clone current month to next month
        cloneMonthToNext() {
            const months = moment.months();
            const currentMonth = state.currentMonth;
            const currentYear = state.currentYear;
            
            // Calculate next month
            const currentMonthIndex = months.indexOf(currentMonth);
            let nextMonthIndex = currentMonthIndex + 1;
            let nextYear = currentYear;
            
            if (nextMonthIndex >= 12) {
                nextMonthIndex = 0;
                nextYear = (parseInt(currentYear) + 1).toString();
            }
            
            const nextMonth = months[nextMonthIndex];
            const currentMonthData = state.contributionsData[currentYear]?.[currentMonth];
            
            // Check if current month has data
            if (!currentMonthData || !currentMonthData.contributions || currentMonthData.contributions.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'No Data to Clone',
                    text: `${currentMonth} ${currentYear} has no contributions to clone.`,
                    timer: 3000
                });
                return;
            }
            
            // Check if next month already exists
            if (state.contributionsData[nextYear]?.[nextMonth]) {
                Swal.fire({
                    icon: 'info',
                    title: 'Month Already Exists',
                    text: `${nextMonth} ${nextYear} already has data. Would you like to replace it or keep both?`,
                    showCancelButton: true,
                    confirmButtonText: 'Replace',
                    cancelButtonText: 'Keep Both',
                    allowOutsideClick: false
                }).then((result) => {
                    if (result.isConfirmed) {
                        this.performMonthClone(currentMonth, currentYear, nextMonth, nextYear, true);
                    }
                });
                return;
            }
            
            // Next month doesn't exist, proceed with clone
            Swal.fire({
                icon: 'question',
                title: 'Clone Month',
                text: `Clone ${currentMonth} ${currentYear} to ${nextMonth} ${nextYear}?`,
                showCancelButton: true,
                confirmButtonText: 'Clone',
                cancelButtonText: 'Cancel',
                allowOutsideClick: false
            }).then((result) => {
                if (result.isConfirmed) {
                    this.performMonthClone(currentMonth, currentYear, nextMonth, nextYear, false);
                }
            });
        },

        // Perform the actual month cloning
        performMonthClone(sourceMonth, sourceYear, targetMonth, targetYear, replace) {
            Swal.fire({
                title: 'Cloning Month...',
                text: 'Please wait while we clone your month data.',
                icon: 'info',
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: async () => {
                    Swal.showLoading();
                    
                    try {
                        // Clone the month data
                        const sourceData = state.contributionsData[sourceYear][sourceMonth];
                        // Drop the source ids: keeping them would rewrite the source month's
                        // own documents into the target month and empty the source.
                        const clonedContributions = sourceData.contributions.map(
                            ({ id, createdAt, createdBy, ...rest }) => ({ ...rest, paid: false })
                        );
                        
                        // Ensure target year exists
                        if (!state.contributionsData[targetYear]) {
                            state.contributionsData[targetYear] = {};
                        }
                        
                        // Create or replace target month
                        state.contributionsData[targetYear][targetMonth] = {
                            contributions: clonedContributions,
                            total: sourceData.total
                        };
                        
                        if (_saveCallback) await _saveCallback(false);
                        
                        // Close loading dialog
                        Swal.close();
                        
                        // Show success message
                        await Swal.fire({
                            icon: 'success',
                            title: 'Month Cloned',
                            text: `${sourceMonth} ${sourceYear} has been cloned to ${targetMonth} ${targetYear}`,
                            timer: 2000,
                            showConfirmButton: false
                        });
                        
                        // Update state to show the newly cloned month
                        state.currentYear = targetYear;
                        state.currentMonth = targetMonth;
                        state.currentView = 'monthly';
                        
                        if (typeof ViewManager !== 'undefined' && ViewManager.init) {
                            ViewManager.init(state);
                        }
                        
                        // Update the DOM selectors
                        const yearSelect = document.getElementById('year-select');
                        const monthSelect = document.getElementById('month-select');
                        
                        if (yearSelect) {
                            Utils.populateYearSelect(yearSelect, targetYear, state.contributionsData);
                            yearSelect.value = targetYear;
                        }
                        
                        if (monthSelect) {
                            Utils.populateMonthSelect(monthSelect, targetMonth, state.contributionsData, targetYear);
                            monthSelect.value = targetMonth;
                        }
                        
                        // Update active tab
                        const tabButton = document.querySelector('[data-view="monthly"]');
                        if (tabButton) {
                            const allTabs = document.querySelectorAll('.tab-btn');
                            allTabs.forEach(tab => tab.classList.remove('active'));
                            tabButton.classList.add('active');
                        }
                        
                        // Refresh the display
                        if (state.updateDisplayCallback) {
                            state.updateDisplayCallback();
                        }
                    } catch (error) {
                        Swal.close();
                        Swal.fire({
                            icon: 'error',
                            title: 'Error Cloning Month',
                            text: error.message || 'Failed to clone month. Please try again.',
                            timer: 4000
                        });
                    }
                }
            });
        },

        // Render yearly empty state
        renderYearlyEmptyState() {
            const dom = DOMManager.getAll();
            if (dom.yearlyView) {
                dom.yearlyView.innerHTML = Templates.YEARLY_EMPTY_STATE;
            }
        },

        // Render reports empty state
        renderReportsEmptyState() {
            // Hide the contributions section (form + output) and show empty state
            const dom = DOMManager.getAll();
            if (dom.reportsView) {
                const contributionsSection = dom.reportsView.querySelector('.contributions');
                if (contributionsSection) {
                    contributionsSection.style.display = 'none';
                }

                // Create and show empty state message
                let emptyStateDiv = dom.reportsView.querySelector('[data-empty-state="reports"]');
                if (!emptyStateDiv) {
                    emptyStateDiv = document.createElement('div');
                    emptyStateDiv.setAttribute('data-empty-state', 'reports');
                    emptyStateDiv.innerHTML = Templates.REPORTS_EMPTY_STATE;
                    dom.reportsView.appendChild(emptyStateDiv);
                } else {
                    emptyStateDiv.style.display = 'block';
                }
            }
        },

        hideReportsEmptyState() {
            // Show the contributions section when data is available
            const dom = DOMManager.getAll();
            if (dom.reportsView) {
                const contributionsSection = dom.reportsView.querySelector('.contributions');
                if (contributionsSection) {
                    contributionsSection.style.display = 'block';
                }

                const emptyStateDiv = dom.reportsView.querySelector('[data-empty-state="reports"]');
                if (emptyStateDiv) {
                    emptyStateDiv.style.display = 'none';
                }
            }
        },

        // Render budget empty state
        renderBudgetEmptyState() {
            const dom = DOMManager.getAll();
            const budgetDom = { budgetContent: document.getElementById('budget-content') };
            if (budgetDom.budgetContent) {
                budgetDom.budgetContent.innerHTML = Templates.BUDGET_EMPTY_STATE;
            }
        },

        // Render blacklist empty state
        renderBlacklistEmptyState() {
            // Only replace the table content, keep the form visible
            const dom = DOMManager.getBlacklistViewElements();
            if (dom.blacklistList) {
                const row = document.createElement('tr');
                row.innerHTML = Templates.BLACKLIST_EMPTY_STATE;
                dom.blacklistList.innerHTML = '';
                dom.blacklistList.appendChild(row);
            }
        },

        // Render special giving empty state (no campaigns)
        renderSpecialGivingEmptyState() {
            const dom = DOMManager.getAll();
            const specialDom = { specialGivingContent: document.getElementById('special-giving-content') };
            const actionBar = specialDom.specialGivingContent?.parentElement?.querySelector('.action-bar');
            if (specialDom.specialGivingContent) {
                specialDom.specialGivingContent.innerHTML = Templates.SPECIAL_GIVING_NO_CAMPAIGNS_STATE;
                if (actionBar) actionBar.style.display = 'none';
            }
        },

        // Render monthly view (delegates to ContributionRenderer)
        renderMonthlyView(contributionsData, currentYear, currentMonth, eventHandlers) {
            return ContributionRenderer.renderMonthlyView(contributionsData, currentYear, currentMonth, eventHandlers);
        },

        // Update total amount display (delegates to ContributionRenderer)
        updateTotals(contributionsData, currentYear, currentMonth) {
            return ContributionRenderer.updateTotals(contributionsData, currentYear, currentMonth);
        },

        // Render yearly view (delegates to ContributionRenderer)
        renderYearlyView(contributionsData, currentYear) {
            return ContributionRenderer.renderYearlyView(contributionsData, currentYear);
        },

        // Render blacklist view (delegates to ContributionRenderer)
        renderBlacklistView(blacklistData, eventHandlers) {
            return ContributionRenderer.renderBlacklistView(blacklistData, eventHandlers);
        },

        // Clear form inputs
        clearContributionForm() {
            const dom = DOMManager.getFormElements();
            dom.memberNameInput.value = '';
            dom.contributionAmountInput.value = '';
            dom.contributionPaidInput.checked = true;
            
            // Clear any error styling from form elements
            dom.memberNameInput.classList.remove('error');
            dom.contributionAmountInput.classList.remove('error');
            dom.memberNameInput.style.borderColor = '';
            dom.contributionAmountInput.style.borderColor = '';
        },

        // Show/hide views
        showView(viewName) {
            const dom = DOMManager.getAll();
            
            // Hide all views
            dom.monthlyView.style.display = 'none';
            dom.yearlyView.style.display = 'none';
            dom.blacklistView.style.display = 'none';
            dom.reportsView.style.display = 'none';
            
            const settingsView = document.getElementById('settings-view');
            const specialGivingView = document.getElementById('special-giving-view');
            const budgetView = document.getElementById('budget-view');
            
            if (settingsView) settingsView.style.display = 'none';
            if (specialGivingView) specialGivingView.style.display = 'none';
            if (budgetView) budgetView.style.display = 'none';

            // Show selected view
            switch(viewName) {
                case 'monthly':
                    dom.monthlyView.style.display = 'block';
                    break;
                case 'yearly':
                    dom.yearlyView.style.display = 'block';
                    break;
                case 'blacklist':
                    dom.blacklistView.style.display = 'block';
                    break;
                case 'reports':
                    dom.reportsView.style.display = 'block';
                    break;
                case 'settings':
                    if (settingsView) settingsView.style.display = 'block';
                    break;
                case 'budget':
                    if (budgetView) budgetView.style.display = 'block';
                    break;
                case 'special-giving':
                    if (specialGivingView) specialGivingView.style.display = 'block';
                    break;
            }
        },

        // A saved view outlives a role change, so a demoted member could reopen a tab
        // whose button their role no longer shows.
        permittedView(viewName) {
            const tab = document.querySelector(`.tab-btn[data-view="${viewName}"]`);
            const requires = tab && tab.dataset.requires;
            if (!requires) return viewName;

            const role = document.documentElement.dataset.role || 'viewer';
            const rank = { viewer: 0, editor: 1, admin: 2 };
            const needed = requires.includes('admin') ? rank.admin : rank.editor;

            return rank[role] >= needed ? viewName : 'monthly';
        },

        // Publishes the role to CSS. Everything gated carries data-requires, so content
        // rendered later is restricted without this being called again.
        applyRoleRestrictions(userRole) {
            const role = ['admin', 'editor', 'viewer'].includes(userRole) ? userRole : 'viewer';
            document.documentElement.dataset.role = role;
        },

        // Render special giving campaigns
        renderSpecialGivingView(campaigns) {
            const container = document.getElementById('special-giving-content');
            const actionBar = container?.parentElement?.querySelector('.action-bar');
            if (!container) return;

            if (campaigns.length === 0) {
                container.innerHTML = Templates.CAMPAIGN_EMPTY_STATE;
                if (actionBar) actionBar.style.display = 'none';
                return;
            }

            if (actionBar) actionBar.style.display = 'flex';

            let html = '<div class="campaigns-overview">';
            campaigns.forEach(campaign => {
                html += Templates.CAMPAIGN_CARD(campaign);
            });
            html += '</div>';

            container.innerHTML = html;
        }
    };
})();
