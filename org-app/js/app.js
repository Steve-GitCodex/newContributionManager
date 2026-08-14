// Main Application Coordinator
// Minimal orchestration layer that wires modules together

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.orgSlug) {
        window.location.replace('/pages/error-pages/no-organization.html');
        return;
    }

    OrgDb.setSlug(window.orgSlug);

    if (!window.orgName) {
        const org = await FirebaseManager.getFirestore()
            .collection('organizations').doc(window.orgSlug).get()
            .catch(() => null);

        if (!org || !org.exists) {
            window.location.replace('/pages/error-pages/no-organization.html');
            return;
        }

        window.orgName = org.data().name;
        sessionStorage.setItem('orgContext', JSON.stringify({ slug: window.orgSlug, name: window.orgName }));
    }

    // Function to hide the initial loading spinner
    function hideLoadingSpinner() {
        const spinner = document.getElementById('initial-loading-spinner');
        if (spinner) {
            spinner.classList.add('hidden');
            // Remove from DOM after fade-out animation
            setTimeout(() => {
                spinner.remove();
            }, 300);
        }
    }

    // State listener registry — keyed by state property name
    const _stateListeners = {};

    function addStateListener(key, fn) {
        if (!_stateListeners[key]) _stateListeners[key] = [];
        _stateListeners[key].push(fn);
    }

    function notifyListeners(key, value) {
        (_stateListeners[key] || []).forEach(fn => fn(value));
    }

    // Application state (wrapped in Proxy to enable reactive listeners)
    // Contains ONLY data — no function callbacks or control flags
    const appState = new Proxy({
        contributionsData: {},
        blacklistData: { blacklistedMembers: [] },
        budgetData: { expenses: {} },
        campaignsData: {},
        currentYear: moment().format('YYYY'),
        currentMonth: moment().format('MMMM'),
        currentView: Utils.getSavedView(), // Restore last viewed tab
        phoneNumber: Utils.getPhoneNumber()
    }, {
        set(target, key, value) {
            target[key] = value;
            notifyListeners(key, value);
            return true;
        }
    });

    // Get Firebase references
    const auth = FirebaseManager.getAuth();

    // Initialize DOM Manager
    DOMManager.init();
    const dom = DOMManager.getAll();

    // Auth initialization flag — not part of app data, kept local
    let appInitialized = false;

    // Data operations
    async function loadData() {
        const startTime = performance.now();
        try {
            const data = await DataAdapter.loadAll();
            
            appState.contributionsData = data.contributionsData;
            appState.blacklistData = data.blacklistData;
            appState.budgetData = data.budgetData || { expenses: {} };
            appState.campaignsData = data.campaignsData || {};
            FirebaseManager.setLastSyncTime(data.lastSyncTime);
            Utils.updateSyncStatus(data.lastSyncTime);
            
            initializeCurrentMonthAndYear();
            hideLoadingSpinner();
        } catch (error) {
            console.error('Failed to load data:', error);
            hideLoadingSpinner();
            Swal.fire({
                icon: 'error',
                title: 'Failed to Load Data',
                text: error.message || 'There was an error loading your data. Please refresh the page.',
                confirmButtonText: 'Refresh',
            }).then(() => {
                window.location.reload();
            });
        }
    }

    let saveTimeout = null;
    async function saveData(showNotification = false) {
        if (saveTimeout) clearTimeout(saveTimeout);
        
        saveTimeout = setTimeout(async () => {
            const startTime = performance.now();
            try {
                const userRole = AuthModule.getUserRole();
                const currentUserUID = AuthModule.getCurrentUser()?.uid;

                if (userRole !== 'admin' && userRole !== 'editor') {
                    throw new Error('You do not have permission to save changes.');
                }

                const backupPayload = {
                    contributionsData: appState.contributionsData,
                    blacklistData: appState.blacklistData,
                    budgetData: appState.budgetData,
                    campaignsData: appState.campaignsData,
                    timestamp: new Date().toISOString()
                };
                localStorage.setItem('contributionsData', JSON.stringify(appState.contributionsData || {}));
                localStorage.setItem('blacklistData', JSON.stringify(appState.blacklistData));
                localStorage.setItem('budgetData', JSON.stringify(appState.budgetData || {}));
                localStorage.setItem('campaignsData', JSON.stringify(appState.campaignsData || {}));
                localStorage.setItem('lastBackup', JSON.stringify(backupPayload));

                const success = await DataWriteAdapter.saveAll(
                    appState.contributionsData,
                    appState.blacklistData,
                    appState.budgetData,
                    appState.campaignsData,
                    userRole,
                    currentUserUID
                );

                if (success) {
                    const now = Date.now();
                    FirebaseManager.setLastSyncTime(now);
                    Utils.updateSyncStatus(now);
                    localStorage.setItem('lastSyncTime', now);
                    
                    if (showNotification) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Saved!',
                            text: 'Your changes have been saved to Firebase.',
                            toast: true,
                            position: 'top-end',
                            showConfirmButton: false,
                            timer: 3000
                        });
                    }
                    
                    try {
                        updateDisplay();
                    } catch (err) {
                        // Update display error handled gracefully
                    }
                }
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Save Failed',
                    text: 'Failed to save changes. Please try syncing manually.',
                    toast: true,
                    position: 'top-end',
                    timer: 3000,
                    showConfirmButton: false
                });
            }
        }, 1000);
    }

    async function syncData() {
        const startTime = performance.now();
        try {
            const data = await DataAdapter.loadAll();
            appState.contributionsData = data.contributionsData;
            appState.blacklistData = data.blacklistData;
            appState.budgetData = data.budgetData || { expenses: {} };
            appState.campaignsData = data.campaignsData || {};
            
            Utils.populateYearSelect(dom.yearSelect, appState.currentYear, appState.contributionsData);
            Utils.populateMonthSelect(dom.monthSelect, appState.currentMonth, appState.contributionsData, appState.currentYear);
            
            if (data.lastSyncTime) {
                FirebaseManager.setLastSyncTime(data.lastSyncTime);
                Utils.updateSyncStatus(data.lastSyncTime);
            }
            
            UIRenderer.init(appState, saveData);
            ViewManager.init(appState, eventHandlers);
            updateDisplay();
        } catch (error) {
            console.error('Failed to sync data:', error);
            Swal.fire({
                icon: 'error',
                title: 'Sync Failed',
                text: error.message || 'Failed to synchronize data with the server. Please check your connection.',
            });
        }
    }

    // Update display function
    function updateDisplay() {
        try {
            ViewManager.updateDisplay().catch(() => {
                // Display update error handled gracefully
            });
        } catch (error) {
            // Silent fail for display updates to avoid interrupting user flow
        }
    }

    // Setup callbacks for event handlers

    // Subscribe updateDisplay to relevant state changes
    // Use queueMicrotask to batch multiple synchronous assignments (e.g. loadData sets 4 keys at once)
    let _displayUpdatePending = false;
    function scheduleDisplayUpdate() {
        if (_displayUpdatePending) return;
        _displayUpdatePending = true;
        queueMicrotask(() => {
            _displayUpdatePending = false;
            updateDisplay();
        });
    }

    const _displayKeys = ['contributionsData', 'blacklistData', 'budgetData', 'campaignsData', 'currentYear', 'currentMonth', 'currentView'];
    _displayKeys.forEach(key => addStateListener(key, scheduleDisplayUpdate));

    // Initialize current month and year based on available data
    function initializeCurrentMonthAndYear() {
        // Always use the actual current month/year, not the most recent month with data
        // This allows checkAndCreateCurrentMonth() to work properly
        appState.currentYear = moment().format('YYYY');
        appState.currentMonth = moment().format('MMMM');
    }

    // Event handler functions
    const eventHandlers = {
        togglePaymentStatus: EventHandlers.togglePaymentStatus.bind(EventHandlers),
        removeContribution: EventHandlers.removeContribution.bind(EventHandlers),
        handleBlacklistMember: EventHandlers.handleBlacklistMember.bind(EventHandlers),
        editContribution: EventHandlers.editContribution.bind(EventHandlers),
        removeFromBlacklist: EventHandlers.removeFromBlacklist.bind(EventHandlers)
    };

    // Initialize modules with state and explicit dependencies
    EventHandlers.init(appState, saveData);
    ViewManager.init(appState, eventHandlers);
    UIRenderer.init(appState, saveData);

    // Event listener setup
    function setupEventListeners() {
        // Initialize Modal Manager and Expected Members Manager
        ModalManager.init();
        ExpectedMembersManager.init();

        // Tab navigation buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                appState.currentView = view;
                Utils.saveCurrentView(view); // Save view preference
                ViewManager.handleViewChange(view);
                
                // Setup budget event handlers if viewing budget tab
                if (view === 'budget') {
                    setTimeout(() => {
                        EventHandlers.setupBudgetEventHandlers();
                    }, 100);
                }

                // Setup special giving event handlers if viewing special-giving tab
                if (view === 'special-giving') {
                    setTimeout(() => {
                        EventHandlers.setupSpecialGivingEventHandlers();
                    }, 100);
                }
            });
        });

        // Period selectors
        if (dom.yearSelect) {
            dom.yearSelect.addEventListener('change', () => {
                const newYear = dom.yearSelect.value; // Keep as string since DB keys are strings
                appState.currentYear = newYear;
                
                // Refresh month selector for the new year
                // First get the available months for this year
                const yearData = appState.contributionsData[newYear] || {};
                const allMonths = moment.months();
                const monthsInYear = allMonths.filter(month => yearData[month]);
                
                // If no months have data in this year, use current month; otherwise use most recent month for this year
                let newMonth = appState.currentMonth;
                if (monthsInYear.length > 0) {
                    if (!monthsInYear.includes(newMonth)) {
                        // Get the most recent month (highest index)
                        const monthsWithIndices = monthsInYear.map(month => ({
                            month,
                            index: allMonths.indexOf(month)
                        }));
                        monthsWithIndices.sort((a, b) => b.index - a.index);
                        newMonth = monthsWithIndices[0].month;
                    }
                }
                
                appState.currentMonth = newMonth;
                // Refresh the month selector to show months for this year
                Utils.populateMonthSelect(dom.monthSelect, newMonth, appState.contributionsData, newYear);
                
                ViewManager.handlePeriodChange(newYear, newMonth);
                updateDisplay();
            });
        }

        if (dom.monthSelect) {
            dom.monthSelect.addEventListener('change', () => {
                const newYear = dom.yearSelect.value;
                const newMonth = dom.monthSelect.value;
                appState.currentYear = newYear;
                appState.currentMonth = newMonth;
                ViewManager.handlePeriodChange(newYear, newMonth);
                updateDisplay();
            });
        }

        // Legacy dropdown support (if exists)
        if (dom.viewTypeSelect) {
            dom.viewTypeSelect.addEventListener('change', () => {
                appState.currentView = dom.viewTypeSelect.value;
                ViewManager.handleViewChange(appState.currentView);
            });
        }

        // Create month button
        if (dom.createMonthBtn) {
            dom.createMonthBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const monthExists = !!appState.contributionsData[appState.currentYear]?.[appState.currentMonth];

            if (monthExists) {
                Swal.fire({
                    icon: 'question',
                    title: 'Month Already Exists',
                    text: `${appState.currentMonth} ${appState.currentYear} already exists. What would you like to do?`,
                    showDenyButton: true,
                    showCancelButton: true,
                    confirmButtonText: 'Overwrite completely',
                    denyButtonText: 'Add new members only',
                    cancelButtonText: 'Cancel'
                }).then((result) => {
                    if (result.isConfirmed || result.isDenied) {
                        const previousMonthData = ContributionsManager.findPreviousMonthData(
                            appState.contributionsData,
                            appState.currentYear,
                            appState.currentMonth
                        );
                        const createResult = ViewManager.handleCreateMonth(
                            previousMonthData,
                            monthExists,
                            result.isConfirmed
                        );
                        
                        saveData(true);
                        updateDisplay();

                        if (result.isDenied) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Month Updated',
                                text: `Added ${createResult.newMembersAdded} new member${createResult.newMembersAdded !== 1 ? 's' : ''} to ${appState.currentMonth} ${appState.currentYear}.`
                            });
                        } else {
                            Swal.fire({
                                icon: 'success',
                                title: 'Month Overwritten',
                                text: `${appState.currentMonth} ${appState.currentYear} has been overwritten successfully.`
                            });
                        }
                    }
                });
            } else {
                const previousMonthData = ContributionsManager.findPreviousMonthData(
                    appState.contributionsData,
                    appState.currentYear,
                    appState.currentMonth
                );
                ViewManager.handleCreateMonth(previousMonthData, false, true);
                saveData(true);
                updateDisplay();
                
                Swal.fire({
                    icon: 'success',
                    title: 'Month Created',
                    text: `${appState.currentMonth} ${appState.currentYear} has been created successfully.`
                });
            }
            });
        }

        // Contribution form
        if (dom.contributionForm) {
            dom.contributionForm.addEventListener('submit', EventHandlers.handleFormSubmit.bind(EventHandlers));
        }

        // Blacklist
        if (dom.addToBlacklistBtn) {
            dom.addToBlacklistBtn.addEventListener('click', EventHandlers.addToBlacklist.bind(EventHandlers));
        }

        // Phone and sharing
        if (dom.savePhoneBtn) {
            dom.savePhoneBtn.addEventListener('click', EventHandlers.savePhoneNumber.bind(EventHandlers));
        }
        if (dom.sendWhatsAppBtn) {
            dom.sendWhatsAppBtn.addEventListener('click', () => {
                EventHandlers.shareReport(appState.currentView);
            });
        }

        // Reports
        const reportsDom = DOMManager.getReportsViewElements();
        if (reportsDom.reportTypeSelect) {
            reportsDom.reportTypeSelect.addEventListener('change', () => {
                ReportsManager.handleReportTypeChange(reportsDom.reportTypeSelect, reportsDom.memberSelectGroup, reportsDom.statusFilterGroup);
            });
        }
        if (reportsDom.generateReportBtn) {
            reportsDom.generateReportBtn.addEventListener('click', () => {
                ViewManager.generateReport();
            });
        }
        if (reportsDom.exportReportText) {
            reportsDom.exportReportText.addEventListener('click', () => {
                ReportsManager.exportReportAsText();
            });
        }
        if (reportsDom.printReport) {
            reportsDom.printReport.addEventListener('click', () => {
                ReportsManager.printReportContent(reportsDom.reportContent);
            });
        }
        if (reportsDom.shareReportWhatsapp) {
            reportsDom.shareReportWhatsapp.addEventListener('click', () => {
                ReportsManager.shareReportViaWhatsapp(appState.phoneNumber);
            });
        }

        // Sync button
        if (dom.exportDataBtn) {
            dom.exportDataBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Sync Data';
            dom.exportDataBtn.addEventListener('click', syncData);
        }
    }

    // Initialize application
    async function init() {
        // Set footer year
        if (dom.currentYearFooter) {
            dom.currentYearFooter.textContent = moment().format('YYYY');
        }
        
        // Set phone number if exists
        if (appState.phoneNumber && dom.phoneNumberInput) {
            dom.phoneNumberInput.value = appState.phoneNumber;
        }

        // Load data from Firebase
        await loadData();

        // Re-initialize modules with updated appState after loading data
        // (loadData replaces appState.contributionsData, so we need to update module references)
        UIRenderer.init(appState, saveData);
        ViewManager.init(appState, eventHandlers);
        EventHandlers.init(appState, saveData);

        // Initialize budget manager for admin users and special giving manager for all users
        const userRole = AuthModule.getUserRole();
        const currentUser = AuthModule.getCurrentUser();
        
        // Initialize managers (they now work with appState data)
        if (userRole === 'admin' && currentUser) {
            await BudgetManager.init(currentUser.uid);
        }

        // Initialize special giving manager for all authenticated users
        if (currentUser && currentUser.uid) {
            await SpecialGivingManager.init(currentUser.uid);
        } else {
            console.warn('Cannot initialize SpecialGivingManager - no user uid available', currentUser);
        }

        // Populate selectors ONLY if there's actual data
        if (UIRenderer.hasAnyYears(appState.contributionsData)) {
            Utils.populateYearSelect(dom.yearSelect, appState.currentYear, appState.contributionsData);
            Utils.populateMonthSelect(dom.monthSelect, appState.currentMonth, appState.contributionsData, appState.currentYear);
        } else {
            // No data - clear selectors and let empty state show
            dom.yearSelect.innerHTML = '';
            dom.monthSelect.innerHTML = '';
        }

        // Check and create current month if needed (only if data exists)
        const monthCreated = ViewManager.checkAndCreateCurrentMonth();
        if (monthCreated) {
            saveData();
        }

        // Initialize reports filters
        const reportsDom = DOMManager.getReportsViewElements();
        ReportsManager.populateReportFilters(
            reportsDom.reportStartMonth,
            reportsDom.reportEndMonth,
            reportsDom.reportStartYear,
            reportsDom.reportEndYear,
            appState.currentMonth,
            appState.currentYear,
            appState.contributionsData
        );
        
        // Initialize report type visibility (show/hide member and status filters)
        ReportsManager.handleReportTypeChange(
            reportsDom.reportTypeSelect, 
            reportsDom.memberSelectGroup, 
            reportsDom.statusFilterGroup
        );
        
        // Initialize member select dropdown
        ReportsManager.updateMemberSelect(appState.contributionsData, reportsDom.reportMemberSelect);

        // Apply role restrictions
        UIRenderer.applyRoleRestrictions(AuthModule.getUserRole());
        Utils.updateSyncStatus(FirebaseManager.getLastSyncTime());

        // Setup event listeners
        setupEventListeners();

        // Activate the saved tab UI and show the view content
        ViewManager.updateTabUI(appState.currentView);
        UIRenderer.showView(appState.currentView);

        // Update display for the current view
        updateDisplay();
    }

    // Auth state handler
    function handleAuthStateChanged(user) {
        if (user) {
            dom.mainContainer.style.display = 'block';
            UIRenderer.applyRoleRestrictions(user.role);

            if (!appInitialized) {
                init();
                appInitialized = true;
            } else {
                updateDisplay();
            }
        } else {
            dom.mainContainer.style.display = 'none';
            appInitialized = false;
        }
    }

    // Initialize auth module
    try {
        // Set the callback BEFORE initializing auth so we catch the initial state
        AuthModule.setAuthStateChangedCallback(handleAuthStateChanged);
        await AuthModule.initAuth(auth, '.auth-section');
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Authentication Error',
            text: 'Failed to initialize authentication. Please refresh the page.'
        });
    }
});
