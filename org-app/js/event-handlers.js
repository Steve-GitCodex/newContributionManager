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

            Dialogs.confirm(
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
                    Dialogs.success('Removed!', 'The contribution has been removed.', 1500);
                }
            });
        },

        // Handle blacklist member from contribution list
        handleBlacklistMember(e) {
            const name = decodeURIComponent(e.target.closest('.blacklist-member').dataset.name);

            Dialogs.confirm(
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
                        Dialogs.success('Member Blacklisted', `${name} has been added to the blacklist.`);
                    } else {
                        Dialogs.error('Already Blacklisted', `${name} is already on the blacklist.`, 'info');
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
                    Dialogs.success('Contribution Updated', '', 2000);
                }
            });
        },

        // Add to blacklist
        addToBlacklist() {
            const dom = DOMManager.getBlacklistViewElements();
            const name = dom.blacklistNameInput.value.trim();

            if (!name) {
                Dialogs.error('Invalid Name', 'Please enter a valid name');
                return;
            }

            if (state.blacklistData.blacklistedMembers.includes(name)) {
                Dialogs.error('Already Blacklisted', `${name} is already on the blacklist.`, 'info');
                return;
            }

            state.blacklistData.blacklistedMembers.push(name);
            // Reassign to trigger Proxy listener for reactive display update
            state.blacklistData = state.blacklistData;
            saveAndUpdate();
            dom.blacklistNameInput.value = '';
            Dialogs.success('Member Blacklisted', `${name} has been added to the blacklist.`);
        },

        // Remove from blacklist
        removeFromBlacklist(e) {
            const index = parseInt(e.target.closest('.remove-from-blacklist').dataset.index);
            const name = state.blacklistData.blacklistedMembers[index];

            Dialogs.confirm(
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
                    Dialogs.success('Member Removed', `${name} has been removed from the blacklist.`);
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
                Dialogs.error('Invalid Name', nameValidation.error);
                return;
            }

            const amountValidation = Utils.validateAmount(amountStr);
            if (!amountValidation.valid) {
                Dialogs.error('Invalid Amount', amountValidation.error);
                return;
            }

            const amount = amountValidation.amount;

            if (state.blacklistData.blacklistedMembers.includes(name)) {
                Dialogs.error('Member Blacklisted', 'This member is blacklisted and cannot make contributions.', 'warning');
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
            Dialogs.success('Contribution Added');
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
                Dialogs.error('Invalid Number', result.error);
                return;
            }

            state.phoneNumber = dom.value.trim();
            Dialogs.success('Phone Number Saved', 'Your phone number has been saved successfully!');
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
        }
    };
})();
