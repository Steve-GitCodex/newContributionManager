// Special Giving tab: campaign creation, pledges, payments and their dialogs.

const CampaignHandlers = (function () {
    let state = {};
    let _saveCallback = null;

    return {
        init(stateObj, saveCallback) {
            state = stateObj;
            _saveCallback = saveCallback;
        },

        setup() {
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
                        Dialogs.error('Error', 'Campaign not found');
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
                            Dialogs.success('Thank You!', `Pledge of ${Number(pledgedAmount).toLocaleString()} recorded`);

                            // Trigger save
                            _saveCallback();

                            // Re-render
                            const campaigns = SpecialGivingManager.getAllCampaigns(state.campaignsData);
                            UIRenderer.renderSpecialGivingView(campaigns);
                            this.setup();
                        }
                    } catch (error) {
                        Dialogs.error('Contribution Failed', 'Failed to process your contribution');
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
                        Dialogs.error('Error', 'Campaign not found');
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
                                            Dialogs.error('Error', 'Contribution not found');
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
                                                Dialogs.success('Updated', 'Contribution has been updated successfully');

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
                                                CampaignHandlers.setup();
                                            }
                                        } catch (error) {
                                            Dialogs.error('Update Failed', 'Failed to update contribution');
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
                                            Dialogs.error('Error', 'Contribution not found');
                                            return;
                                        }

                                        const pledged = contribution.pledgedAmount || contribution.amount;
                                        const paid = contribution.amountPaid || 0;
                                        const outstanding = pledged - paid;

                                        if (outstanding <= 0) {
                                            Dialogs.error('Already Paid', 'Full amount has been paid');
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
                                                Dialogs.success('Payment Recorded', `${paymentAmount} recorded for ${contribution.contributorName}`);

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
                                                CampaignHandlers.setup();
                                            }
                                        } catch (error) {
                                            Dialogs.error('Payment Failed', 'Failed to record payment');
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
                                            Dialogs.error('Error', 'Contribution not found');
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
                                                    Dialogs.success('Deleted', 'Contribution has been removed');

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
                                                    CampaignHandlers.setup();
                                                }
                                            } catch (error) {
                                                Dialogs.error('Delete Failed', 'Failed to delete contribution');
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
                        Dialogs.error('Error', 'Campaign not found');
                        return;
                    }

                    // Create a fresh function scope for this export
                    const handleExports = async () => {
                        // CSV export
                        const csvBtn = document.getElementById('csv-export-btn');
                        csvBtn.addEventListener('click', async () => {
                            try {
                                const result = await CampaignExportManager.exportAsCSV(campaign, contributions);
                                Dialogs.success('Success', `Spreadsheet queued for download (${(result.size / 1024).toFixed(2)} KB)`);
                                setTimeout(() => Swal.close(), 3500);
                            } catch (error) {
                                Dialogs.error('Export Error', error.message);
                            }
                        }, { once: true });

                        // Text export
                        const textBtn = document.getElementById('text-export-btn');
                        textBtn.addEventListener('click', async () => {
                            try {
                                const result = await CampaignExportManager.exportAsText(campaign, contributions);
                                Dialogs.success('Success', `Text file queued for download (${(result.size / 1024).toFixed(2)} KB)`);
                                setTimeout(() => Swal.close(), 3500);
                            } catch (error) {
                                Dialogs.error('Export Error', error.message);
                            }
                        }, { once: true });

                        // PDF export
                        const pdfBtn = document.getElementById('pdf-export-btn');
                        pdfBtn.addEventListener('click', async () => {
                            try {
                                const result = await CampaignExportManager.exportAsPDF(campaign, contributions);
                                Dialogs.success('Success', `Print dialog opened for ${result.contributors} contributor${result.contributors === 1 ? '' : 's'} — choose "Save as PDF"`);
                                setTimeout(() => Swal.close(), 3500);
                            } catch (error) {
                                Dialogs.error('Export Error', error.message);
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
                        Dialogs.error('Error', 'Campaign not found');
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

                            Dialogs.success('Campaign Updated', 'Your campaign has been updated successfully');

                            // Trigger save
                            _saveCallback();

                            // Re-render
                            const campaigns = SpecialGivingManager.getAllCampaigns(state.campaignsData);
                            UIRenderer.renderSpecialGivingView(campaigns);
                            this.setup();
                        } catch (error) {
                            Dialogs.error('Update Failed', 'Failed to update campaign');
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
                        Dialogs.error('Error', 'Campaign not found');
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
                            Dialogs.success('Campaign Deleted', 'Campaign has been deleted successfully');

                            // Trigger save
                            _saveCallback();

                            // Re-render
                            const campaigns = SpecialGivingManager.getAllCampaigns(state.campaignsData);
                            UIRenderer.renderSpecialGivingView(campaigns);
                            this.setup();
                        } catch (error) {
                            Dialogs.error('Delete Failed', 'Failed to delete campaign');
                        }
                    }
                });
            });
        }
    };
})();
