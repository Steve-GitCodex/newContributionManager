// View Manager Module
// Handles view switching and view-specific operations

const ViewManager = (function() {
    let state = {
        contributionsData: {},
        blacklistData: { blacklistedMembers: [] },
        currentYear: '',
        currentMonth: '',
        currentView: 'monthly'
    };

    // Injected event handler callbacks (kept separate from data state)
    let _eventHandlers = null;

    let renderGeneration = 0;

    return {
        // Initialize view manager with state
        init(stateObj, eventHandlers) {
            state = stateObj;
            _eventHandlers = eventHandlers;
        },

        // Handle view change
        handleViewChange(newView) {
            state.currentView = newView;
            const dom = DOMManager.getAll();

            // Update tab UI
            this.updateTabUI(newView);

            // Update UI based on view
            UIRenderer.showView(newView);

            // Update control states
            if (newView === 'monthly') {
                if (dom.monthSelect) dom.monthSelect.disabled = false;
                if (dom.createMonthBtn) dom.createMonthBtn.disabled = false;
            } else {
                if (dom.monthSelect) dom.monthSelect.disabled = true;
                if (dom.createMonthBtn) dom.createMonthBtn.disabled = true;
            }

            // Perform view-specific actions
            if (newView === 'reports') {
                const reportsDom = DOMManager.getReportsViewElements();
                // Trigger initial report type change to show/hide appropriate filters
                ReportsManager.handleReportTypeChange(reportsDom.reportTypeSelect, reportsDom.memberSelectGroup, reportsDom.statusFilterGroup);
                if (reportsDom.generateReportBtn) reportsDom.generateReportBtn.disabled = true;
            }

            // Update display
            this.updateDisplay().catch(error => {
                console.error('Error updating display:', error);

                Swal.fire({
                    icon: 'error',
                    title: 'Could not load this view',
                    text: 'Your connection may have dropped. Some data is not available.',
                    toast: true,
                    position: 'top-end',
                    timer: 4000,
                    showConfirmButton: false
                });
            });
        },

        // Update tab UI active states
        updateTabUI(activeView) {
            const tabButtons = document.querySelectorAll('.tab-btn');
            const tabContents = document.querySelectorAll('.tab-content');

            // Remove active class from all tabs and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to current tab and content
            const activeTabBtn = document.querySelector(`[data-view="${activeView}"]`);
            const activeTabContent = document.getElementById(`${activeView}-view`);

            if (activeTabBtn) activeTabBtn.classList.add('active');
            if (activeTabContent) activeTabContent.classList.add('active');
        },

        // Update display based on current view
        async updateDisplay() {
            const myRenderGeneration = ++renderGeneration;
            const reportsDom = DOMManager.getReportsViewElements();
            if (reportsDom.reportStartMonth && reportsDom.reportStartYear) {
                ReportsManager.populateReportFilters(
                    reportsDom.reportStartMonth,
                    reportsDom.reportEndMonth,
                    reportsDom.reportStartYear,
                    reportsDom.reportEndYear,
                    state.currentMonth,
                    state.currentYear,
                    state.contributionsData
                );
            }
            
            // Check if there are ANY years in the data (not whether they have contributions)
            const hasYears = UIRenderer.hasAnyYears(state.contributionsData);


            // Only show main empty state for views that depend on contribution data
            if (!hasYears) {
                if (state.currentView === 'monthly' || state.currentView === 'yearly') {
                    // These views depend on contribution data - show empty state inside the tab

                    UIRenderer.renderMainEmptyState();
                    return;
                } else {
                    // Other tabs work independently - they handle their own empty states

                }
                
                if (state.currentView === 'reports') {
                    // Reports has its own empty state

                    UIRenderer.renderReportsEmptyState();
                } else if (state.currentView === 'blacklist') {
                    // Blacklist is independent - show its own UI with form and empty state

                    const hasMembersBlacklisted = state.blacklistData && 
                        state.blacklistData.blacklistedMembers && 
                        state.blacklistData.blacklistedMembers.length > 0;
                    if (hasMembersBlacklisted) {
                        UIRenderer.renderBlacklistView(state.blacklistData, _eventHandlers);
                    } else {
                        UIRenderer.renderBlacklistEmptyState();
                    }
                } else if (state.currentView === 'budget') {
                    // Budget is independent - show its own UI

                    const hasBudgetData = state.budgetData && Object.keys(state.budgetData).length > 0;
                    if (hasBudgetData) {
                        const budgetDom = { budgetContent: document.getElementById('budget-content') };
                        const totalIncome = BudgetManager.calculateBudgetFromIncome({});
                        BudgetManager.renderBudgetUI(budgetDom, state.budgetData, totalIncome);
                        setTimeout(() => {
                            if (myRenderGeneration !== renderGeneration) return;
                            BudgetHandlers.setup();
                        }, 100);
                    } else {
                        UIRenderer.renderBudgetEmptyState();
                    }
                } else if (state.currentView === 'special-giving') {
                    // Special Giving is independent - show its own UI

                    const campaigns = SpecialGivingManager.getAllCampaigns(state.campaignsData);
                    if (campaigns && campaigns.length > 0) {
                        UIRenderer.renderSpecialGivingView(campaigns);
                        setTimeout(() => {
                            if (myRenderGeneration !== renderGeneration) return;
                            CampaignHandlers.setup();
                        }, 100);
                    } else {
                        UIRenderer.renderSpecialGivingEmptyState();
                        setTimeout(() => {
                            if (myRenderGeneration !== renderGeneration) return;
                            CampaignHandlers.setup();
                        }, 100);
                    }
                }
                // Settings doesn't need special handling - always shows
                UIRenderer.applyRoleRestrictions(AuthModule.getUserRole());
                return;
            }

            // If we have years, show normal views (they handle their own empty states)

            
            // Hide empty state overlays when data exists
            UIRenderer.hideMainEmptyState();
            
            if (state.currentView === 'monthly') {
                await LoadedScope.ensureMonth(state.currentYear, state.currentMonth);
                if (myRenderGeneration !== renderGeneration) return;
                LoadedScope.requireLoaded(state.currentYear, state.currentMonth);

                UIRenderer.renderMonthlyView(
                    state.contributionsData,
                    state.currentYear,
                    state.currentMonth,
                    _eventHandlers
                );
                // Add "Create Month" button to action bar
                setTimeout(() => {
                    if (myRenderGeneration !== renderGeneration) return;
                    UIRenderer.addCreateMonthButton();
                }, 100);
            } else if (state.currentView === 'yearly') {
                await LoadedScope.ensureYear(state.currentYear);
                if (myRenderGeneration !== renderGeneration) return;
                LoadedScope.requireYear(state.currentYear);

                UIRenderer.renderYearlyView(state.contributionsData, state.currentYear);
            } else if (state.currentView === 'blacklist') {
                const hasMembersBlacklisted = state.blacklistData &&
                    state.blacklistData.blacklistedMembers &&
                    state.blacklistData.blacklistedMembers.length > 0;
                if (hasMembersBlacklisted) {
                    UIRenderer.renderBlacklistView(state.blacklistData, _eventHandlers);
                } else {
                    UIRenderer.renderBlacklistEmptyState();
                }
            } else if (state.currentView === 'budget') {
                await LoadedScope.ensureAll();
                if (myRenderGeneration !== renderGeneration) return;
                LoadedScope.requireAll();

                const budgetDom = { budgetContent: document.getElementById('budget-content') };
                const totalIncome = BudgetManager.calculateBudgetFromIncome(state.contributionsData);
                BudgetManager.renderBudgetUI(budgetDom, state.budgetData, totalIncome);
                setTimeout(() => {
                    if (myRenderGeneration !== renderGeneration) return;
                    BudgetHandlers.setup();
                }, 100);
            } else if (state.currentView === 'reports') {
                const reportsViewDom = DOMManager.getReportsViewElements();
                if (reportsViewDom.generateReportBtn) reportsViewDom.generateReportBtn.disabled = true;

                await LoadedScope.ensureAll();
                if (myRenderGeneration !== renderGeneration) return;
                LoadedScope.requireAll();

                UIRenderer.hideReportsEmptyState();
                if (reportsViewDom.generateReportBtn) reportsViewDom.generateReportBtn.disabled = false;
                ReportsManager.updateMemberSelect(state.contributionsData, reportsViewDom.reportMemberSelect);
                ReportsManager.handleReportTypeChange(reportsViewDom.reportTypeSelect, reportsViewDom.memberSelectGroup, reportsViewDom.statusFilterGroup);
            } else if (state.currentView === 'special-giving') {
                const campaigns = SpecialGivingManager.getAllCampaigns(state.campaignsData);
                if (campaigns && campaigns.length > 0) {
                    UIRenderer.renderSpecialGivingView(campaigns);
                    setTimeout(() => {
                        if (myRenderGeneration !== renderGeneration) return;
                        CampaignHandlers.setup();
                    }, 100);
                } else {
                    UIRenderer.renderSpecialGivingEmptyState();
                    setTimeout(() => {
                        if (myRenderGeneration !== renderGeneration) return;
                        CampaignHandlers.setup();
                    }, 100);
                }
            }

            // Apply role restrictions after rendering
            UIRenderer.applyRoleRestrictions(AuthModule.getUserRole());
        },

        // Handle period change (year/month selection)
        handlePeriodChange(newYear, newMonth) {
            const previousYear = state.currentYear;
            const previousMonth = state.currentMonth;

            state.currentYear = newYear;
            state.currentMonth = newMonth;

            // Ensure year exists in data
            if (!state.contributionsData[newYear]) {
                state.contributionsData[newYear] = {};
            }

            const updatePromise = this.updateDisplay();
            const myRenderGeneration = renderGeneration;

            updatePromise.catch(error => {
                if (myRenderGeneration !== renderGeneration) return;

                console.error('Error updating display:', error);
                state.currentYear = previousYear;
                state.currentMonth = previousMonth;

                const dom = DOMManager.getAll();
                if (dom.yearSelect) {
                    Utils.populateYearSelect(dom.yearSelect, previousYear, state.contributionsData);
                }
                if (dom.monthSelect) {
                    Utils.populateMonthSelect(dom.monthSelect, previousMonth, state.contributionsData, previousYear);
                }

                Swal.fire({
                    icon: 'error',
                    title: 'Could not load that period',
                    text: 'Your connection may have dropped. The previous period is still shown.',
                    toast: true,
                    position: 'top-end',
                    timer: 4000,
                    showConfirmButton: false
                });
            });
        },

        // Handle create month
        async handleCreateMonth(previousMonthData, monthExists, overwrite) {
            if (!state.contributionsData[state.currentYear]) {
                state.contributionsData[state.currentYear] = {};
            }

            await LoadedScope.ensureMonth(state.currentYear, state.currentMonth);

            let result = { newMembersAdded: 0 };

            if (monthExists && !overwrite) {
                result = ContributionsManager.addNewMembersToExistingMonth(
                    state.contributionsData[state.currentYear][state.currentMonth],
                    previousMonthData,
                    state.blacklistData
                );
                state.contributionsData[state.currentYear][state.currentMonth] = result.data;
            } else {
                state.contributionsData[state.currentYear][state.currentMonth] =
                    ContributionsManager.createMonthDataFromPrevious(previousMonthData, state.blacklistData);
            }

            return result;
        },

        // Nearest earlier month present in the blob, mirroring ContributionsManager.findPreviousMonthData's
        // selection so callers can hydrate that month before findPreviousMonthData reads its rows.
        locatePreviousMonth(year, monthName) {
            const months = moment.months();

            for (let index = months.indexOf(monthName) - 1; index >= 0; index--) {
                if (state.contributionsData[year]?.[months[index]]) return { year, monthName: months[index] };
            }

            const earlier = String(parseInt(year, 10) - 1);
            if (state.contributionsData[earlier]?.December) return { year: earlier, monthName: 'December' };

            return null;
        },

        // Check and create current month if needed
        async checkAndCreateCurrentMonth() {
            // SAFETY: Never auto-create a year if there's no data in the system at all
            if (!UIRenderer.hasAnyYears(state.contributionsData)) {
                return false; // No data exists, don't create anything
            }

            if (!state.contributionsData[state.currentYear]) {
                state.contributionsData[state.currentYear] = {};
            }

            if (!state.contributionsData[state.currentYear][state.currentMonth]) {
                const source = this.locatePreviousMonth(state.currentYear, state.currentMonth);
                if (source) {
                    await LoadedScope.ensureMonth(source.year, source.monthName);
                    LoadedScope.requireLoaded(source.year, source.monthName);
                }

                const previousMonthData = ContributionsManager.findPreviousMonthData(
                    state.contributionsData,
                    state.currentYear,
                    state.currentMonth
                );

                // Only auto-create a month if the previous month has contributions
                if (previousMonthData && previousMonthData.contributions && previousMonthData.contributions.length > 0) {
                    state.contributionsData[state.currentYear][state.currentMonth] =
                        ContributionsManager.createMonthDataFromPrevious(previousMonthData, state.blacklistData);
                    return true; // Month was created
                }

                return false; // Month not created (previous month has no contributions)
            }
            return false; // Month already exists
        },

        // Get current view
        getCurrentView() {
            return state.currentView;
        },

        // Generate report
        generateReport() {
            const dom = DOMManager.getReportsViewElements();

            try {
                LoadedScope.requireAll();
            } catch (error) {
                console.error('Refusing to report on a partial history:', error);

                Swal.fire({
                    icon: 'error',
                    title: 'Contribution history is still loading',
                    text: 'A report cannot be generated until every month has loaded.',
                    toast: true,
                    position: 'top-end',
                    timer: 4000,
                    showConfirmButton: false
                });
                return;
            }

            const reportData = ReportsManager.generateReport(
                dom.reportTypeSelect,
                dom.reportMemberSelect,
                dom.reportStartMonth,
                dom.reportStartYear,
                dom.reportEndMonth,
                dom.reportEndYear,
                state.contributionsData,
                dom.statusFilter ? dom.statusFilter.value : 'all'
            );

            if (reportData) {
                ReportsManager.displayReport(
                    reportData,
                    dom.reportTitle,
                    dom.reportContent,
                    dom.reportOutput
                );
            }
        }
    };
})();
