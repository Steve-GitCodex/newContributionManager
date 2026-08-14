// Event Handlers Module
// Centralized event handling for all user interactions

const EventHandlers = (function () {
    // State references (will be injected)
    let state = {
        contributionsData: {},
        blacklistData: { blacklistedMembers: [] },
        currentYear: '',
        currentMonth: '',
        phoneNumber: ''
    };

    // Injected save callback (kept separate from data state)
    let _saveCallback = null;

    // Helper: Show confirmation dialog
    function showConfirmation(title, text, confirmText = 'Yes', icon = 'warning') {
        return Swal.fire({
            title,
            text,
            icon,
            showCancelButton: true,
            confirmButtonText: confirmText,
            cancelButtonText: 'Cancel',
            customClass: { container: 'swal-alert' }
        });
    }

    // Helper: Show success toast
    function showSuccessToast(title, text = '', timer = 2000) {
        return Swal.fire({
            icon: 'success',
            title,
            text,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer,
            customClass: { container: 'swal-alert' }
        });
    }

    // Helper: Show error message
    function showError(title, text, icon = 'error') {
        return Swal.fire({ icon, title, text, customClass: { container: 'swal-alert' } });
    }

    // Helper: Save and update
    function saveAndUpdate() {
        if (_saveCallback) _saveCallback();
    }

    return {
        // Initialize state references
        init(stateObj, saveCallback) {
            state = stateObj;
            _saveCallback = saveCallback;
        },

        // Toggle payment status
        togglePaymentStatus(e) {
            const index = parseInt(e.target.closest('.toggle-payment').dataset.index);
            state.contributionsData = ContributionsManager.togglePaymentStatus(
                state.contributionsData,
                state.currentYear,
                state.currentMonth,
                index
            );
            if (_saveCallback) _saveCallback();
        },

        // Remove contribution
        removeContribution(e) {
            const index = parseInt(e.target.closest('.remove-contribution').dataset.index);

            showConfirmation(
                'Remove Contribution?',
                'Are you sure you want to remove this contribution?',
                'Yes, remove it'
            ).then((result) => {
                if (result.isConfirmed) {
                    state.contributionsData = ContributionsManager.removeContribution(
                        state.contributionsData,
                        state.currentYear,
                        state.currentMonth,
                        index
                    );
                    saveAndUpdate();
                    showSuccessToast('Removed!', 'The contribution has been removed.', 1500);
                }
            });
        },

        // Handle blacklist member from contribution list
        handleBlacklistMember(e) {
            const name = decodeURIComponent(e.target.closest('.blacklist-member').dataset.name);

            showConfirmation(
                'Blacklist Member?',
                `Are you sure you want to blacklist ${name}? They will be excluded from future months.`,
                'Yes, blacklist'
            ).then((result) => {
                if (result.isConfirmed) {
                    if (!state.blacklistData.blacklistedMembers.includes(name)) {
                        state.blacklistData.blacklistedMembers.push(name);
                        // Reassign to trigger Proxy listener for reactive display update
                        state.blacklistData = state.blacklistData;
                        saveAndUpdate();
                        showSuccessToast('Member Blacklisted', `${name} has been added to the blacklist.`);
                    } else {
                        showError('Already Blacklisted', `${name} is already on the blacklist.`, 'info');
                    }
                }
            });
        },

        // Edit contribution
        editContribution(e) {
            const index = parseInt(e.target.closest('.edit-contribution').dataset.index);
            const currentData = state.contributionsData[state.currentYear][state.currentMonth];
            const contribution = currentData.contributions[index];

            Swal.fire({
                title: 'Edit Contribution',
                html: Templates.EDIT_CONTRIBUTION_FORM(contribution),
                showCancelButton: true,
                confirmButtonText: 'Save Changes',
                cancelButtonText: 'Cancel',
                preConfirm: () => {
                    const name = document.getElementById('edit-name').value.trim();
                    const amountStr = document.getElementById('edit-amount').value.trim();
                    const paid = document.getElementById('edit-paid').checked;

                    const nameValidation = Utils.validateName(name);
                    if (!nameValidation.valid) {
                        Swal.showValidationMessage(nameValidation.error);
                        return false;
                    }

                    const amountValidation = Utils.validateAmount(amountStr);
                    if (!amountValidation.valid) {
                        Swal.showValidationMessage(amountValidation.error);
                        return false;
                    }

                    if (name !== contribution.name && state.blacklistData.blacklistedMembers.includes(name)) {
                        Swal.showValidationMessage('This member is blacklisted and cannot make contributions');
                        return false;
                    }

                    return { name, amount: amountValidation.amount, paid };
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    state.contributionsData = ContributionsManager.editContribution(
                        state.contributionsData,
                        state.currentYear,
                        state.currentMonth,
                        index,
                        result.value.name,
                        result.value.amount,
                        result.value.paid
                    );

                    saveAndUpdate();
                    showSuccessToast('Contribution Updated', '', 2000);
                }
            });
        },

        // Add to blacklist
        addToBlacklist() {
            const dom = DOMManager.getBlacklistViewElements();
            const name = dom.blacklistNameInput.value.trim();

            if (!name) {
                showError('Invalid Name', 'Please enter a valid name');
                return;
            }

            if (state.blacklistData.blacklistedMembers.includes(name)) {
                showError('Already Blacklisted', `${name} is already on the blacklist.`, 'info');
                return;
            }

            state.blacklistData.blacklistedMembers.push(name);
            // Reassign to trigger Proxy listener for reactive display update
            state.blacklistData = state.blacklistData;
            saveAndUpdate();
            dom.blacklistNameInput.value = '';
            showSuccessToast('Member Blacklisted', `${name} has been added to the blacklist.`);
        },

        // Remove from blacklist
        removeFromBlacklist(e) {
            const index = parseInt(e.target.closest('.remove-from-blacklist').dataset.index);
            const name = state.blacklistData.blacklistedMembers[index];

            showConfirmation(
                'Remove from Blacklist?',
                `Are you sure you want to remove ${name} from the blacklist?`,
                'Yes, remove',
                'question'
            ).then((result) => {
                if (result.isConfirmed) {
                    state.blacklistData.blacklistedMembers.splice(index, 1);
                    // Reassign to trigger Proxy listener for reactive display update
                    state.blacklistData = state.blacklistData;
                    saveAndUpdate();
                    showSuccessToast('Member Removed', `${name} has been removed from the blacklist.`);
                }
            });
        },

        // Handle form submission
        handleFormSubmit(e) {
            e.preventDefault();

            const dom = DOMManager.getFormElements();
            const name = dom.memberNameInput.value.trim();
            const amountStr = dom.contributionAmountInput.value.trim();
            const paid = dom.contributionPaidInput.checked;

            if (AuthModule.getUserRole() === 'viewer') {
                Swal.fire({
                    icon: 'error',
                    title: 'Permission Denied',
                    text: 'You do not have permission to add contributions'
                });
                return;
            }

            const nameValidation = Utils.validateName(name);
            if (!nameValidation.valid) {
                showError('Invalid Name', nameValidation.error);
                return;
            }

            const amountValidation = Utils.validateAmount(amountStr);
            if (!amountValidation.valid) {
                showError('Invalid Amount', amountValidation.error);
                return;
            }

            const amount = amountValidation.amount;

            if (state.blacklistData.blacklistedMembers.includes(name)) {
                showError('Member Blacklisted', 'This member is blacklisted and cannot make contributions.', 'warning');
                return;
            }

            state.contributionsData = ContributionsManager.addContribution(
                state.contributionsData,
                state.currentYear,
                state.currentMonth,
                name,
                amount,
                paid
            );

            saveAndUpdate();
            showSuccessToast('Contribution Added');
            UIRenderer.clearContributionForm();

            // Close modal if it exists
            if (typeof ModalManager !== 'undefined' && ModalManager.isOpen()) {
                ModalManager.close();
            }
        },

        // Save phone number
        savePhoneNumber() {
            const dom = DOMManager.get('phoneNumberInput');
            const result = Utils.savePhoneNumber(dom.value.trim());

            if (!result.success) {
                showError('Invalid Number', result.error);
                return;
            }

            state.phoneNumber = dom.value.trim();
            showSuccessToast('Phone Number Saved', 'Your phone number has been saved successfully!');
        },

        // Share report via WhatsApp
        shareReport(currentView) {
            if (!state.phoneNumber) {
                Swal.fire({
                    title: 'No Sharing Number',
                    text: 'Please save your phone number first',
                    icon: 'warning'
                });
                return;
            }

            let message = '';

            if (currentView === 'monthly') {
                const currentData = state.contributionsData[state.currentYear]?.[state.currentMonth] || { contributions: [], total: 0 };
                message = Utils.formatMonthlyWhatsAppMessage(state.currentMonth, state.currentYear, currentData);
            } else {
                message = Utils.formatYearlyWhatsAppMessage(state.currentYear, state.contributionsData);
            }

            Swal.fire({
                title: 'Share Report',
                html: `
                    <div class="share-options">
                        <button id="share-whatsapp" class="btn btn-success share-btn">
                            <i class="fab fa-whatsapp"></i> WhatsApp
                        </button>
                        <button id="share-copy" class="btn btn-info share-btn">
                            <i class="fas fa-copy"></i> Copy Text
                        </button>
                    </div>
                `,
                showConfirmButton: false,
                showCloseButton: true,
                didOpen: () => {
                    document.getElementById('share-whatsapp').addEventListener('click', () => {
                        const whatsappUrl = `https://wa.me/${state.phoneNumber}?text=${encodeURIComponent(message)}`;
                        window.open(whatsappUrl, '_blank');
                        Swal.close();
                    });

                    document.getElementById('share-copy').addEventListener('click', () => {
                        navigator.clipboard.writeText(message).then(() => {
                            Swal.fire({
                                icon: 'success',
                                title: 'Copied!',
                                text: 'Report copied to clipboard',
                                toast: true,
                                position: 'top-end',
                                showConfirmButton: false,
                                timer: 2000
                            });
                        });
                    });
                }
            });
        },

        // Budget Event Handlers
        refreshBudgetTable() {
            const budgetDom = { budgetContent: document.getElementById('budget-content') };
            const totalIncome = BudgetManager.calculateBudgetFromIncome(state.contributionsData || {});
            BudgetManager.renderBudgetUI(budgetDom, state.budgetData, totalIncome);

            // Add expense button - re-attach after every render since the form markup is fully regenerated
            const addExpenseBtn = document.getElementById('add-expense-btn');
            if (addExpenseBtn) {
                const newAddBtn = addExpenseBtn.cloneNode(true);
                addExpenseBtn.parentNode.replaceChild(newAddBtn, addExpenseBtn);

                newAddBtn.addEventListener('click', async () => {
                    const amountInput = document.getElementById('expense-amount');
                    const categorySelect = document.getElementById('expense-category');
                    const dateInput = document.getElementById('expense-date');
                    const descriptionInput = document.getElementById('expense-description');

                    // Clear previous field errors
                    [amountInput, categorySelect, dateInput].forEach(el => {
                        el.classList.remove('input-error');
                        const existing = el.parentElement.querySelector('.field-error');
                        if (existing) existing.remove();
                    });

                    const amount = parseFloat(amountInput.value);
                    const category = categorySelect.value;
                    const date = dateInput.value;
                    let isValid = true;

                    const markFieldError = (input, message) => {
                        input.classList.add('input-error');
                        const errorSpan = document.createElement('span');
                        errorSpan.className = 'field-error';
                        errorSpan.textContent = message;
                        input.parentElement.appendChild(errorSpan);
                        isValid = false;
                    };

                    if (isNaN(amount) || amount <= 0) markFieldError(amountInput, 'Enter an amount greater than 0');
                    if (!category) markFieldError(categorySelect, 'Please select a category');
                    if (!date) markFieldError(dateInput, 'Please select a date');

                    if (!isValid) return;

                    newAddBtn.disabled = true;
                    newAddBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

                    try {
                        const expenseId = await BudgetManager.addExpense(
                            state.budgetData,
                            amount,
                            category,
                            date,
                            descriptionInput.value
                        );

                        if (expenseId) {
                            showSuccessToast('Expense Added', `Added ${amount.toLocaleString()} to ${category}`);
                            amountInput.value = '';
                            descriptionInput.value = '';
                            categorySelect.value = '';
                            _saveCallback();
                            this.refreshBudgetTable();
                        } else {
                            newAddBtn.disabled = false;
                            newAddBtn.innerHTML = '<i class="fas fa-plus"></i> Add Expense';
                            showError('Add Failed', 'Could not add expense. Please try again.');
                        }
                    } catch (error) {
                        newAddBtn.disabled = false;
                        newAddBtn.innerHTML = '<i class="fas fa-plus"></i> Add Expense';
                        showError('Add Failed', 'An unexpected error occurred. Please try again.');
                    }
                });
            }

            // Set today\'s date as default (form is fully re-rendered on each call)
            const expenseDateInput = document.getElementById('expense-date');
            if (expenseDateInput) {
                expenseDateInput.value = moment().format('YYYY-MM-DD');
            }

            // Delete expense buttons - clone to remove stale listeners
            document.querySelectorAll('.delete-expense').forEach(btn => {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);

                newBtn.addEventListener('click', async (e) => {
                    const expenseId = e.currentTarget.dataset.expenseId;

                    const result = await showConfirmation(
                        'Delete Expense?',
                        'Are you sure you want to delete this expense?',
                        'Delete'
                    );

                    if (result.isConfirmed) {
                        try {
                            const success = await BudgetManager.removeExpense(state.budgetData, expenseId);
                            if (success) {
                                showSuccessToast('Expense Deleted');
                                _saveCallback();
                                this.refreshBudgetTable();
                            }
                        } catch (error) {
                            showError('Delete Failed', 'Failed to delete expense');
                        }
                    }
                });
            });

            // Edit expense buttons - clone to remove stale listeners
            document.querySelectorAll('.edit-expense').forEach(btn => {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);

                newBtn.addEventListener('click', async (e) => {
                    const expenseId = e.currentTarget.dataset.expenseId;
                    const expense = BudgetManager.getExpenseById(state.budgetData, expenseId);

                    if (!expense) {
                        showError('Error', 'Expense not found');
                        return;
                    }

                    const expenseDate = moment(expense.date).format('YYYY-MM-DD');

                    const { value: formValues } = await Swal.fire({
                        title: 'Edit Expense',
                        width: '500px',
                        customClass: { container: 'swal-modal' },
                        html: `
                            <form style="text-align: left; padding: 20px 0;">
                                <div style="margin-bottom: 20px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">Amount</label>
                                    <input type="number" id="edit-amount" 
                                           value="${expense.amount}" min="0" step="0.01" 
                                           style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; font-size: 16px; box-sizing: border-box; background-color: var(--bg-secondary); color: var(--text-primary); transition: border-color 0.3s ease;">
                                </div>
                                <div style="margin-bottom: 20px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">Category</label>
                                    <select id="edit-category" 
                                            style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; font-size: 16px; box-sizing: border-box; background-color: var(--bg-secondary); color: var(--text-primary); cursor: pointer; transition: border-color 0.3s ease;">
                                        <option value="Food" ${expense.category === 'Food' ? 'selected' : ''}>Food</option>
                                        <option value="Transport" ${expense.category === 'Transport' ? 'selected' : ''}>Transport</option>
                                        <option value="Utilities" ${expense.category === 'Utilities' ? 'selected' : ''}>Utilities</option>
                                        <option value="Entertainment" ${expense.category === 'Entertainment' ? 'selected' : ''}>Entertainment</option>
                                        <option value="Healthcare" ${expense.category === 'Healthcare' ? 'selected' : ''}>Healthcare</option>
                                        <option value="Other" ${expense.category === 'Other' ? 'selected' : ''}>Other</option>
                                    </select>
                                </div>
                                <div style="margin-bottom: 20px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">Date</label>
                                    <input type="date" id="edit-date" 
                                           value="${expenseDate}" 
                                           style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; font-size: 16px; box-sizing: border-box; background-color: var(--bg-secondary); color: var(--text-primary); transition: border-color 0.3s ease;">
                                </div>
                                <div style="margin-bottom: 0;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">Description (Optional)</label>
                                    <input type="text" id="edit-description" 
                                           value="${expense.description || ''}" placeholder="Enter description" 
                                           style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; font-size: 16px; box-sizing: border-box; background-color: var(--bg-secondary); color: var(--text-primary); transition: border-color 0.3s ease;">
                                </div>
                            </form>
                        `,
                        didOpen: (modal) => {
                            modal.querySelector('#edit-amount').focus();
                        },
                        showCancelButton: true,
                        confirmButtonText: 'Update',
                        confirmButtonColor: '#667eea',
                        cancelButtonColor: '#999',
                        cancelButtonText: 'Cancel',
                        preConfirm: () => {
                            const amount = document.getElementById('edit-amount').value;
                            const category = document.getElementById('edit-category').value;
                            const date = document.getElementById('edit-date').value;
                            const description = document.getElementById('edit-description').value;

                            if (!amount || !category || !date) {
                                Swal.showValidationMessage('Please fill in all required fields');
                                return false;
                            }

                            return { amount, category, date, description };
                        }
                    });

                    if (formValues) {
                        try {
                            const success = await BudgetManager.updateExpense(
                                state.budgetData,
                                expenseId,
                                formValues.amount,
                                formValues.category,
                                formValues.date,
                                formValues.description
                            );

                            if (success) {
                                showSuccessToast('Expense Updated');
                                _saveCallback();
                                this.refreshBudgetTable();
                            }
                        } catch (error) {
                            showError('Update Failed', 'Failed to update expense');
                        }
                    }
                });
            });
        },

        setupBudgetEventHandlers() {
            // Render the budget UI and attach all listeners (add, edit, delete) via refreshBudgetTable
            this.refreshBudgetTable();
        },

        // Setup special giving event handlers
        setupSpecialGivingEventHandlers() {
            // Create campaign button - handle both regular and empty state buttons
            const createCampaignBtn = document.getElementById('create-campaign-btn');
            const createCampaignBtnEmpty = document.getElementById('create-campaign-btn-empty');
            
            const handleCreateCampaign = async () => {
                const { value: formValues } = await Swal.fire({
                    title: 'Create Special Giving Campaign',
                    width: '500px',
                    customClass: { container: 'swal-modal' },
                    html: Templates.CREATE_CAMPAIGN_FORM,
                    showCancelButton: true,
                    confirmButtonText: 'Create Campaign',
                    confirmButtonColor: '#667eea',
                    cancelButtonColor: '#999',
                    preConfirm: () => {
                        const purpose = document.getElementById('campaign-purpose').value;
                        const target = document.getElementById('campaign-target').value;
                        const targetDate = document.getElementById('campaign-target-date').value;
                        const reason = document.getElementById('campaign-reason').value;
                        const notes = document.getElementById('campaign-notes').value;

                        if (!purpose || !target) {
                            Swal.showValidationMessage('Please fill in campaign purpose and target amount');
                            return false;
                        }

                        if (Number(target) <= 0) {
                            Swal.showValidationMessage('Target amount must be greater than 0');
                            return false;
                        }

                        // Validate target date if provided
                        if (targetDate) {
                            const selectedDate = moment(targetDate);
                            const today = moment().startOf('day');
                            if (selectedDate.isBefore(today)) {
                                Swal.showValidationMessage('Target date cannot be in the past');
                                return false;
                            }
                        }

                        return { purpose, target, targetDate, reason, notes };
                    }
                });
            
            if (formValues) {
                const { purpose, target, targetDate, reason, notes } = formValues;
                const campaignId = SpecialGivingManager.createCampaign(state.campaignsData, purpose, target, targetDate, reason, notes);
                
                if (campaignId) {
                    _saveCallback();
                    ViewManager.updateDisplay(state);
                    Swal.fire('Success', 'Campaign created successfully!', 'success');
                } else {
                    Swal.fire('Error', 'Failed to create campaign', 'error');
                }
            }
            };
            
            if (createCampaignBtn) {
                const newBtn = createCampaignBtn.cloneNode(true);
                createCampaignBtn.parentNode.replaceChild(newBtn, createCampaignBtn);
                newBtn.addEventListener('click', handleCreateCampaign);
            }
            
            if (createCampaignBtnEmpty) {
                const newBtnEmpty = createCampaignBtnEmpty.cloneNode(true);
                createCampaignBtnEmpty.parentNode.replaceChild(newBtnEmpty, createCampaignBtnEmpty);
                newBtnEmpty.addEventListener('click', handleCreateCampaign);
            }

            // Contribute buttons
            document.querySelectorAll('.contribute-btn').forEach(btn => {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);

                newBtn.addEventListener('click', async (e) => {
                    const campaignId = e.currentTarget.getAttribute('data-campaign-id');
                    const campaign = SpecialGivingManager.getCampaignById(state.campaignsData, campaignId);

                    if (!campaign) {
                        showError('Error', 'Campaign not found');
                        return;
                    }

                    // Step 1: Get contributor name
                    const { value: name } = await Swal.fire({
                        title: `Contribute to: ${campaign.purpose}`,
                        input: 'text',
                        inputPlaceholder: 'Your full name',
                        confirmButtonText: 'Next',
                        confirmButtonColor: '#667eea',
                        cancelButtonColor: '#999',
                        inputValidator: (value) => {
                            if (!value || !value.trim()) {
                                return 'Please enter your name';
                            }
                        }
                    });

                    if (!name) return; // User cancelled

                    // Step 2: Get pledged amount
                    const { value: pledgedAmount } = await Swal.fire({
                        title: `Pledged amount`,
                        html: `
                            <p style="color: #666; margin-bottom: 20px;">
                                Target: <strong>${campaign.targetAmount.toLocaleString()}</strong> | 
                                Raised: <strong style="color: #27ae60;">${campaign.amountRaised.toLocaleString()}</strong>
                            </p>
                        `,
                        input: 'text',
                        inputPlaceholder: '0.00',
                        inputAttributes: {
                            inputmode: 'decimal'
                        },
                        confirmButtonText: 'Next',
                        confirmButtonColor: '#667eea',
                        cancelButtonColor: '#999',
                        inputValidator: (value) => {
                            if (!value || !value.trim()) {
                                return 'Please enter an amount';
                            }
                            const num = Number(value);
                            if (isNaN(num) || num <= 0) {
                                return 'Please enter a valid amount greater than 0';
                            }
                        }
                    });

                    if (!pledgedAmount) return; // User cancelled

                    // Step 3: Get optional paid amount
                    const { value: paidAmount } = await Swal.fire({
                        title: 'Amount paid now (optional)',
                        input: 'text',
                        inputValue: '0',
                        inputPlaceholder: '0.00',
                        inputAttributes: {
                            inputmode: 'decimal'
                        },
                        confirmButtonText: 'Next',
                        confirmButtonColor: '#667eea',
                        cancelButtonColor: '#999',
                        inputValidator: (value) => {
                            if (!value || !value.trim()) {
                                return 'Please enter an amount';
                            }
                            const num = Number(value);
                            const pledged = Number(pledgedAmount);
                            if (isNaN(num) || num < 0) {
                                return 'Please enter a valid amount';
                            }
                            if (num > pledged) {
                                return `Amount paid cannot exceed pledged amount (${pledged})`;
                            }
                        }
                    });

                    if (!paidAmount && paidAmount !== '0') return; // User cancelled

                    // Step 4: Get optional message
                    const { value: message } = await Swal.fire({
                        title: 'Add a message (optional)',
                        input: 'textarea',
                        inputPlaceholder: 'A message of support or prayer',
                        confirmButtonText: 'Contribute',
                        confirmButtonColor: '#27ae60',
                        cancelButtonColor: '#999'
                    });

                    // Proceed with contribution
                    try {
                        const contributionId = SpecialGivingManager.addContribution(
                            state.campaignsData,
                            campaignId,
                            name.trim(),
                            pledgedAmount,
                            Number(paidAmount) || 0,
                            message || ''
                        );

                        if (contributionId) {
                            showSuccessToast('Thank You!', `Pledge of ${Number(pledgedAmount).toLocaleString()} recorded`);

                            // Trigger save
                            _saveCallback();

                            // Re-render
                            const campaigns = SpecialGivingManager.getAllCampaigns(state.campaignsData);
                            UIRenderer.renderSpecialGivingView(campaigns);
                            this.setupSpecialGivingEventHandlers();
                        }
                    } catch (error) {
                        showError('Contribution Failed', 'Failed to process your contribution');
                    }
                });
            });

            // View details buttons
            document.querySelectorAll('.view-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const campaignId = e.currentTarget.getAttribute('data-campaign-id');
                    const campaign = SpecialGivingManager.getCampaignById(state.campaignsData, campaignId);
                    const contributions = SpecialGivingManager.getCampaignContributions(state.campaignsData, campaignId);

                    if (!campaign) {
                        showError('Error', 'Campaign not found');
                        return;
                    }

                    // Pagination for large contributor lists
                    const itemsPerPage = 10;
                    let currentPage = 0;

                    const renderContributorsPage = () => {
                        const start = currentPage * itemsPerPage;
                        const end = start + itemsPerPage;
                        const pageContributions = contributions.slice(start, end);

                        let contributorsHtml = '';
                        if (contributions.length === 0) {
                            contributorsHtml = '<p style="text-align: center; color: #999; padding: 20px;">No contributions yet</p>';
                        } else {
                            pageContributions.forEach(contrib => {
                                const pledged = contrib.pledgedAmount || contrib.amount;
                                const paid = contrib.amountPaid || 0;
                                const outstanding = pledged - paid;
                                const isPaid = paid >= pledged;
                                const paidColor = isPaid ? '#27ae60' : (paid > 0 ? '#f39c12' : '#e74c3c');

                                contributorsHtml += `
                                    <div class="contributor-item ${isPaid ? 'paid' : (paid > 0 ? 'partial' : 'unpaid')}" data-contribution-id="${contrib.id}">
                                        <div class="contributor-info">
                                            <div class="contributor-name">${contrib.contributorName}</div>
                                            <div class="contributor-amount" style="font-size: 13px; color: var(--text-primary); margin-top: 4px;">
                                                <strong>Pledged:</strong> ${pledged.toLocaleString()} | 
                                                <strong style="color: ${paidColor};">Paid:</strong> ${paid.toLocaleString()} | 
                                                <strong style="color: var(--accent-red);">Outstanding:</strong> ${outstanding.toLocaleString()}
                                            </div>
                                            <div class="contributor-date">${contrib.formattedDate}</div>
                                            ${contrib.notes ? `<div class="contributor-note">"${contrib.notes}"</div>` : ''}
                                        </div>
                                        <div class="contributor-actions">
                                            <button class="pay-contribution-btn" data-requires="staff" data-contribution-id="${contrib.id}" title="Record payment" style="background: none; border: none; cursor: pointer; color: var(--accent-green); font-size: 16px; padding: 4px 8px;">
                                                <i class="fas fa-dollar-sign"></i>
                                            </button>
                                            <button class="edit-contribution-btn" data-requires="staff" data-contribution-id="${contrib.id}" title="Edit contribution" style="background: none; border: none; cursor: pointer; color: #3498db; font-size: 16px; padding: 4px 8px;">
                                                <i class="fas fa-pencil-alt"></i>
                                            </button>
                                            <button class="delete-contribution-btn" data-requires="staff" data-contribution-id="${contrib.id}" title="Delete contribution" style="background: none; border: none; cursor: pointer; color: #e74c3c; font-size: 16px; padding: 4px 8px;">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                `;
                            });
                        }

                        return contributorsHtml;
                    };

                    const renderPagination = () => {
                        const totalPages = Math.ceil(contributions.length / itemsPerPage);
                        if (totalPages <= 1) return '';

                        const start = currentPage * itemsPerPage + 1;
                        const end = Math.min((currentPage + 1) * itemsPerPage, contributions.length);

                        return `
                            <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                                <p style="color: #666; margin-bottom: 10px; font-size: 12px;">Showing ${start} - ${end} of ${contributions.length} contributors</p>
                                <div style="display: flex; gap: 10px; justify-content: center;">
                                    ${currentPage > 0 ? `<button id="prev-page" class="btn" style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">← Previous</button>` : ''}
                                    ${end < contributions.length ? `<button id="next-page" class="btn" style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">Next →</button>` : ''}
                                </div>
                            </div>
                        `;
                    };

                    const updateModal = async () => {
                        const contributorsHtml = renderContributorsPage();
                        const paginationHtml = renderPagination();

                        const modal = document.querySelector('.swal2-modal');
                        if (modal) {
                            const contentDiv = modal.querySelector('.swal2-html-container');
                            if (contentDiv) {
                                contentDiv.innerHTML = `
                                    <div style="text-align: left;">
                                        <div class="campaign-details-info">
                                            ${campaign.reason ? `<div class="detail-item"><span class="detail-item-label">Reason:</span><span class="detail-item-value">${campaign.reason}</span></div>` : ''}
                                            <div class="detail-item"><span class="detail-item-label">Target Amount:</span><span class="detail-item-value">${campaign.targetAmount.toLocaleString()}</span></div>
                                            <div class="detail-item"><span class="detail-item-label">Amount Raised:</span><span class="detail-item-value" style="color: #27ae60;">${campaign.amountRaised.toLocaleString()}</span></div>
                                            <div class="detail-item"><span class="detail-item-label">Progress:</span><span class="detail-item-value">${campaign.progress}%</span></div>
                                            <div class="detail-item"><span class="detail-item-label">Status:</span><span class="detail-item-value">${campaign.status === 'active' ? '🟢 Active' : '⚫ Resolved'}</span></div>
                                            <div class="detail-item"><span class="detail-item-label">Created:</span><span class="detail-item-value">${campaign.formattedDateCreated}</span></div>
                                        </div>
                                        <div class="contributors-section">
                                            <h3>Contributors (${contributions.length})</h3>
                                            <div class="contributors-list">
                                                ${contributorsHtml}
                                            </div>
                                            ${paginationHtml}
                                        </div>
                                    </div>
                                `;

                                // Attach pagination listeners
                                const prevBtn = contentDiv.querySelector('#prev-page');
                                const nextBtn = contentDiv.querySelector('#next-page');

                                if (prevBtn) {
                                    prevBtn.addEventListener('click', () => {
                                        currentPage--;
                                        updateModal();
                                    });
                                }

                                if (nextBtn) {
                                    nextBtn.addEventListener('click', () => {
                                        currentPage++;
                                        updateModal();
                                    });
                                }

                                // Attach edit contribution listeners
                                const editButtons = contentDiv.querySelectorAll('.edit-contribution-btn');
                                editButtons.forEach(btn => {
                                    btn.addEventListener('click', async (e) => {
                                        const contributionId = e.currentTarget.getAttribute('data-contribution-id');
                                        const contribution = contributions.find(c => c.id === contributionId);

                                        if (!contribution) {
                                            showError('Error', 'Contribution not found');
                                            return;
                                        }

                                        // Step 1: Edit name
                                        const { value: newName } = await Swal.fire({
                                            title: 'Edit Contributor Name',
                                            input: 'text',
                                            inputValue: contribution.contributorName,
                                            inputPlaceholder: 'Contributor name',
                                            inputAttributes: {
                                                maxlength: 100
                                            },
                                            showCancelButton: true,
                                            confirmButtonText: 'Next',
                                            inputValidator: (value) => {
                                                if (!value || value.trim().length === 0) {
                                                    return 'Please enter contributor name';
                                                }
                                            }
                                        });

                                        if (!newName) return;

                                        // Step 2: Edit pledged amount
                                        const { value: newPledgedAmount } = await Swal.fire({
                                            title: 'Edit Pledged Amount',
                                            input: 'text',
                                            inputValue: (contribution.pledgedAmount || contribution.amount).toString(),
                                            inputPlaceholder: 'Pledged amount',
                                            inputmode: 'decimal',
                                            showCancelButton: true,
                                            confirmButtonText: 'Next',
                                            inputValidator: (value) => {
                                                if (!value || isNaN(value) || Number(value) <= 0) {
                                                    return 'Please enter a valid pledged amount';
                                                }
                                                const paid = contribution.amountPaid || 0;
                                                if (Number(value) < paid) {
                                                    return `Pledged amount cannot be less than already paid (${paid})`;
                                                }
                                            }
                                        });

                                        if (!newPledgedAmount) return;

                                        // Step 3: Edit paid amount
                                        const { value: newPaidAmount } = await Swal.fire({
                                            title: 'Edit Amount Paid',
                                            input: 'text',
                                            inputValue: (contribution.amountPaid || 0).toString(),
                                            inputPlaceholder: 'Amount paid',
                                            inputmode: 'decimal',
                                            showCancelButton: true,
                                            confirmButtonText: 'Next',
                                            inputValidator: (value) => {
                                                if (!value || isNaN(value) || Number(value) < 0) {
                                                    return 'Please enter a valid amount';
                                                }
                                                if (Number(value) > Number(newPledgedAmount)) {
                                                    return `Amount paid cannot exceed pledged amount (${newPledgedAmount})`;
                                                }
                                            }
                                        });

                                        if (!newPaidAmount && newPaidAmount !== '0') return;

                                        // Step 4: Edit notes
                                        const { value: newNotes } = await Swal.fire({
                                            title: 'Edit Message (optional)',
                                            input: 'textarea',
                                            inputValue: contribution.notes || '',
                                            inputPlaceholder: 'Message (optional)',
                                            inputAttributes: {
                                                maxlength: 500
                                            },
                                            showCancelButton: true,
                                            confirmButtonText: 'Update'
                                        });

                                        if (newNotes === undefined) return;

                                        try {
                                            const updated = SpecialGivingManager.updateContribution(state.campaignsData, campaignId, contributionId, {
                                                contributorName: newName.trim(),
                                                pledgedAmount: Number(newPledgedAmount),
                                                amountPaid: Number(newPaidAmount),
                                                notes: newNotes.trim()
                                            });

                                            if (updated) {
                                                showSuccessToast('Updated', 'Contribution has been updated successfully');

                                                // Trigger save
                                                _saveCallback();

                                                // Refresh modal
                                                const updatedCampaign = SpecialGivingManager.getCampaignById(state.campaignsData, campaignId);
                                                const updatedContributions = SpecialGivingManager.getCampaignContributions(state.campaignsData, campaignId);

                                                // Update variables for closure
                                                Object.assign(campaign, updatedCampaign);
                                                contributions.length = 0;
                                                contributions.push(...updatedContributions);

                                                updateModal();

                                                // Also refresh the campaign cards in the main view
                                                const allCampaigns = SpecialGivingManager.getAllCampaigns(state.campaignsData);
                                                UIRenderer.renderSpecialGivingView(allCampaigns);
                                                EventHandlers.setupSpecialGivingEventHandlers();
                                            }
                                        } catch (error) {
                                            showError('Update Failed', 'Failed to update contribution');
                                        }
                                    });
                                });

                                // Attach pay contribution listeners
                                const payButtons = contentDiv.querySelectorAll('.pay-contribution-btn');
                                payButtons.forEach(btn => {
                                    btn.addEventListener('click', async (e) => {
                                        e.stopPropagation();
                                        const contributionId = e.currentTarget.getAttribute('data-contribution-id');
                                        const contribution = contributions.find(c => c.id === contributionId);

                                        if (!contribution) {
                                            showError('Error', 'Contribution not found');
                                            return;
                                        }

                                        const pledged = contribution.pledgedAmount || contribution.amount;
                                        const paid = contribution.amountPaid || 0;
                                        const outstanding = pledged - paid;

                                        if (outstanding <= 0) {
                                            showError('Already Paid', 'Full amount has been paid');
                                            return;
                                        }

                                        const { value: paymentAmount } = await Swal.fire({
                                            title: `Record Payment for ${contribution.contributorName}`,
                                            html: Templates.RECORD_PAYMENT_INFO(contribution, pledged, paid, outstanding),
                                            input: 'text',
                                            inputPlaceholder: 'Amount to pay',
                                            inputAttributes: {
                                                inputmode: 'decimal'
                                            },
                                            confirmButtonText: 'Record Payment',
                                            confirmButtonColor: '#27ae60',
                                            cancelButtonColor: '#999',
                                            inputValidator: (value) => {
                                                if (!value || !value.trim()) {
                                                    return 'Please enter an amount';
                                                }
                                                const num = Number(value);
                                                if (isNaN(num) || num <= 0) {
                                                    return 'Please enter a valid amount greater than 0';
                                                }
                                                if (num > outstanding) {
                                                    return `Cannot exceed outstanding amount of ${outstanding}`;
                                                }
                                            }
                                        });

                                        if (!paymentAmount) return;

                                        try {
                                            const result = SpecialGivingManager.recordPayment(state.campaignsData, campaignId, contributionId, paymentAmount);

                                            if (result !== null) {
                                                showSuccessToast('Payment Recorded', `${paymentAmount} recorded for ${contribution.contributorName}`);

                                                // Trigger save
                                                _saveCallback();

                                                // Update modal
                                                const updatedCampaign = SpecialGivingManager.getCampaignById(state.campaignsData, campaignId);
                                                const updatedContributions = SpecialGivingManager.getCampaignContributions(state.campaignsData, campaignId);

                                                // Update variables for closure
                                                Object.assign(campaign, updatedCampaign);
                                                contributions.length = 0;
                                                contributions.push(...updatedContributions);

                                                updateModal();

                                                // Also refresh the campaign cards in the main view
                                                const allCampaigns = SpecialGivingManager.getAllCampaigns(state.campaignsData);
                                                UIRenderer.renderSpecialGivingView(allCampaigns);
                                                EventHandlers.setupSpecialGivingEventHandlers();
                                            }
                                        } catch (error) {
                                            showError('Payment Failed', 'Failed to record payment');
                                        }
                                    });
                                });

                                // Attach delete contribution listeners
                                const deleteButtons = contentDiv.querySelectorAll('.delete-contribution-btn');
                                deleteButtons.forEach(btn => {
                                    btn.addEventListener('click', async (e) => {
                                        const contributionId = e.currentTarget.getAttribute('data-contribution-id');
                                        const contribution = contributions.find(c => c.id === contributionId);

                                        if (!contribution) {
                                            showError('Error', 'Contribution not found');
                                            return;
                                        }

                                        const result = await Swal.fire({
                                            title: 'Delete Contribution?',
                                            text: `Remove ${contribution.contributorName}'s contribution of ${contribution.pledgedAmount.toLocaleString()}? This action cannot be undone.`,
                                            icon: 'warning',
                                            showCancelButton: true,
                                            confirmButtonText: 'Delete',
                                            confirmButtonColor: '#e74c3c',
                                            cancelButtonColor: '#999',
                                            reverseButtons: true
                                        });

                                        if (result.isConfirmed) {
                                            try {
                                                const deleted = SpecialGivingManager.removeContribution(state.campaignsData, campaignId, contributionId);

                                                if (deleted) {
                                                    showSuccessToast('Deleted', 'Contribution has been removed');

                                                    // Trigger save
                                                    _saveCallback();

                                                    // Update modal
                                                    const updatedCampaign = SpecialGivingManager.getCampaignById(state.campaignsData, campaignId);
                                                    const updatedContributions = SpecialGivingManager.getCampaignContributions(state.campaignsData, campaignId);

                                                    // Update variables for closure
                                                    Object.assign(campaign, updatedCampaign);
                                                    contributions.length = 0;
                                                    contributions.push(...updatedContributions);

                                                    // Reset pagination if needed
                                                    const maxPage = Math.ceil(contributions.length / itemsPerPage) - 1;
                                                    if (currentPage > maxPage && maxPage >= 0) {
                                                        currentPage = Math.max(0, maxPage);
                                                    }

                                                    updateModal();

                                                    // Also refresh the campaign cards in the main view
                                                    const allCampaigns = SpecialGivingManager.getAllCampaigns(state.campaignsData);
                                                    UIRenderer.renderSpecialGivingView(allCampaigns);
                                                    EventHandlers.setupSpecialGivingEventHandlers();
                                                }
                                            } catch (error) {
                                                showError('Delete Failed', 'Failed to delete contribution');
                                            }
                                        }
                                    });
                                });
                            }
                        }
                    };

                    Swal.fire({
                        title: campaign.purpose,
                        width: '600px',
                        html: `
                            <div style="text-align: left;">
                                <div class="campaign-details-info">
                                    ${campaign.reason ? `<div class="detail-item"><span class="detail-item-label">Reason:</span><span class="detail-item-value">${campaign.reason}</span></div>` : ''}
                                    <div class="detail-item"><span class="detail-item-label">Target Amount:</span><span class="detail-item-value">${campaign.targetAmount.toLocaleString()}</span></div>
                                    <div class="detail-item"><span class="detail-item-label">Amount Raised:</span><span class="detail-item-value" style="color: #27ae60;">${campaign.amountRaised.toLocaleString()}</span></div>
                                    <div class="detail-item"><span class="detail-item-label">Progress:</span><span class="detail-item-value">${campaign.progress}%</span></div>
                                    <div class="detail-item"><span class="detail-item-label">Status:</span><span class="detail-item-value">${campaign.status === 'active' ? '🟢 Active' : '⚫ Resolved'}</span></div>
                                    <div class="detail-item"><span class="detail-item-label">Created:</span><span class="detail-item-value">${campaign.formattedDateCreated}</span></div>
                                </div>
                                <div class="contributors-section">
                                    <h3>Contributors (${contributions.length})</h3>
                                    <div class="contributors-list">
                                        ${renderContributorsPage()}
                                    </div>
                                    ${renderPagination()}
                                </div>
                            </div>
                        `,
                        showConfirmButton: false,
                        showCloseButton: true,
                        didOpen: () => {
                            // Setup pagination after modal opens
                            setTimeout(updateModal, 100);
                        }
                    });
                });
            });

            // Share campaign buttons
            document.querySelectorAll('.share-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const campaignId = e.currentTarget.getAttribute('data-campaign-id');
                    const campaign = SpecialGivingManager.getCampaignById(state.campaignsData, campaignId);
                    const contributions = SpecialGivingManager.getCampaignContributions(state.campaignsData, campaignId);

                    if (!campaign) {
                        showError('Error', 'Campaign not found');
                        return;
                    }

                    // Create a fresh function scope for this export
                    const handleExports = async () => {
                        // CSV export
                        const csvBtn = document.getElementById('csv-export-btn');
                        csvBtn.addEventListener('click', async () => {
                            try {
                                const result = await CampaignExportManager.exportAsCSV(campaign, contributions);
                                showSuccessToast('Success', `Spreadsheet queued for download (${(result.size / 1024).toFixed(2)} KB)`);
                                setTimeout(() => Swal.close(), 3500);
                            } catch (error) {
                                showError('Export Error', error.message);
                            }
                        }, { once: true });

                        // Text export
                        const textBtn = document.getElementById('text-export-btn');
                        textBtn.addEventListener('click', async () => {
                            try {
                                const result = await CampaignExportManager.exportAsText(campaign, contributions);
                                showSuccessToast('Success', `Text file queued for download (${(result.size / 1024).toFixed(2)} KB)`);
                                setTimeout(() => Swal.close(), 3500);
                            } catch (error) {
                                showError('Export Error', error.message);
                            }
                        }, { once: true });

                        // PDF export
                        const pdfBtn = document.getElementById('pdf-export-btn');
                        pdfBtn.addEventListener('click', async () => {
                            try {
                                const result = await CampaignExportManager.exportAsPDF(campaign, contributions);
                                showSuccessToast('Success', `Print dialog opened for ${result.contributors} contributor${result.contributors === 1 ? '' : 's'} — choose "Save as PDF"`);
                                setTimeout(() => Swal.close(), 3500);
                            } catch (error) {
                                showError('Export Error', error.message);
                            }
                        }, { once: true });
                    };

                    Swal.fire({
                        title: 'Share Campaign',
                        html: `
                            <div style="text-align: center; padding: 20px 0;">
                                <p style="color: #666; margin-bottom: 30px; font-size: 15px;">Select export format:</p>
                                <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
                                    <button id="csv-export-btn" style="padding: 12px 20px; background-color: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.3s;">
                                        📊 Spreadsheet (CSV)
                                    </button>
                                    <button id="text-export-btn" style="padding: 12px 20px; background-color: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.3s;">
                                        📝 Text Export
                                    </button>
                                    <button id="pdf-export-btn" style="padding: 12px 20px; background-color: #9b59b6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.3s;">
                                        📄 PDF Export
                                    </button>
                                </div>
                            </div>
                        `,
                        showConfirmButton: false,
                        showCancelButton: true,
                        cancelButtonText: 'Cancel',
                        cancelButtonColor: '#999',
                        didOpen: (modal) => {
                            
                            // Remove any existing listeners by cloning
                            const csvBtn = document.getElementById('csv-export-btn');
                            const textBtn = document.getElementById('text-export-btn');
                            const pdfBtn = document.getElementById('pdf-export-btn');
                            
                            csvBtn.replaceWith(csvBtn.cloneNode(true));
                            textBtn.replaceWith(textBtn.cloneNode(true));
                            pdfBtn.replaceWith(pdfBtn.cloneNode(true));

                            // Get fresh references and setup export handlers
                            handleExports();

                            // Add hover effects
                            document.querySelectorAll('#csv-export-btn, #text-export-btn, #pdf-export-btn').forEach(btn => {
                                btn.addEventListener('mouseover', () => {
                                    btn.style.opacity = '0.9';
                                    btn.style.transform = 'translateY(-2px)';
                                });
                                btn.addEventListener('mouseout', () => {
                                    btn.style.opacity = '1';
                                    btn.style.transform = 'translateY(0)';
                                });
                            });
                        }
                    });
                });
            });

            // Edit campaign buttons
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const campaignId = e.currentTarget.getAttribute('data-campaign-id');
                    const campaign = SpecialGivingManager.getCampaignById(state.campaignsData, campaignId);

                    if (!campaign) {
                        showError('Error', 'Campaign not found');
                        return;
                    }

                    const { value: formValues } = await Swal.fire({
                        title: 'Edit Campaign',
                        width: '500px',
                        html: Templates.EDIT_CAMPAIGN_FORM(campaign),
                        showCancelButton: true,
                        confirmButtonText: 'Save Changes',
                        confirmButtonColor: '#667eea',
                        cancelButtonColor: '#999',
                        preConfirm: () => {
                            const purpose = document.getElementById('edit-campaign-purpose').value;
                            const target = document.getElementById('edit-campaign-target').value;
                            const targetDate = document.getElementById('edit-campaign-target-date').value;
                            const reason = document.getElementById('edit-campaign-reason').value;
                            const status = document.getElementById('edit-campaign-status').value;

                            if (!purpose || !target) {
                                Swal.showValidationMessage('Please fill in campaign purpose and target amount');
                                return false;
                            }

                            if (Number(target) <= 0) {
                                Swal.showValidationMessage('Target amount must be greater than 0');
                                return false;
                            }

                            // Validate target date if provided
                            if (targetDate) {
                                const selectedDate = moment(targetDate);
                                const today = moment().startOf('day');
                                if (selectedDate.isBefore(today)) {
                                    Swal.showValidationMessage('Target date cannot be in the past');
                                    return false;
                                }
                            }

                            return { purpose, target, targetDate, reason, status };
                        }
                    });

                    if (formValues) {
                        try {
                            SpecialGivingManager.updateCampaign(state.campaignsData, campaignId, {
                                purpose: formValues.purpose,
                                targetAmount: Number(formValues.target),
                                targetDate: formValues.targetDate ? new Date(formValues.targetDate).getTime() : null,
                                reason: formValues.reason,
                                status: formValues.status
                            });

                            showSuccessToast('Campaign Updated', 'Your campaign has been updated successfully');

                            // Trigger save
                            _saveCallback();

                            // Re-render
                            const campaigns = SpecialGivingManager.getAllCampaigns(state.campaignsData);
                            UIRenderer.renderSpecialGivingView(campaigns);
                            this.setupSpecialGivingEventHandlers();
                        } catch (error) {
                            showError('Update Failed', 'Failed to update campaign');
                        }
                    }
                });
            });

            // Delete campaign buttons
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const campaignId = e.currentTarget.getAttribute('data-campaign-id');
                    const campaign = SpecialGivingManager.getCampaignById(state.campaignsData, campaignId);

                    if (!campaign) {
                        showError('Error', 'Campaign not found');
                        return;
                    }

                    const result = await Swal.fire({
                        title: 'Delete Campaign?',
                        text: `Are you sure you want to delete "${campaign.purpose}"? This action cannot be undone.`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Delete',
                        confirmButtonColor: '#e74c3c',
                        cancelButtonColor: '#999',
                        reverseButtons: true
                    });

                    if (result.isConfirmed) {
                        try {
                            SpecialGivingManager.removeCampaign(state.campaignsData, campaignId);
                            showSuccessToast('Campaign Deleted', 'Campaign has been deleted successfully');

                            // Trigger save
                            _saveCallback();

                            // Re-render
                            const campaigns = SpecialGivingManager.getAllCampaigns(state.campaignsData);
                            UIRenderer.renderSpecialGivingView(campaigns);
                            this.setupSpecialGivingEventHandlers();
                        } catch (error) {
                            showError('Delete Failed', 'Failed to delete campaign');
                        }
                    }
                });
            });
        }
    };
})();
