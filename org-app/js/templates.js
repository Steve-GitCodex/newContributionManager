// Template Constants
// Centralized template strings for UI components

const Templates = {
    // Monthly Empty State - When no data exists at all (no months/years created)
    MONTHLY_EMPTY_STATE: `
        <style>
            [data-empty-state-content] h2 { display: block !important; text-align: center; }
        </style>
        <div style="display: flex; align-items: center; justify-content: center; min-height: 60vh; padding: 40px 20px;">
            <div style="text-align: center; max-width: 500px;">
                <div style="font-size: 80px; color: var(--primary-color); margin-bottom: 20px; opacity: 0.7;">
                    <i class="fas fa-inbox"></i>
                </div>
                <h2 style="color: var(--text-primary); margin-bottom: 10px; font-size: 24px;">
                Welcome to ContriFlow
                </h2>
                <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 16px; line-height: 1.6;">
                    No contribution data yet. Get started by creating your first month of contributions.
                </p>
                <button id="create-first-month-btn" data-requires="staff" class="btn btn-primary" style="font-size: 16px; padding: 12px 28px;">
                    <i class="fas fa-plus-circle"></i> Create First Month
                </button>
            </div>
        </div>
    `,

    // Empty Month State - When viewing a specific month with no contributions
    EMPTY_MONTH_STATE: `
        <style>
            [data-empty-month-state] h2 { display: block !important; text-align: center; }
        </style>
        <div style="display: flex; align-items: center; justify-content: center; min-height: 50vh; padding: 40px 20px;">
            <div style="text-align: center; max-width: 400px;">
                <div style="font-size: 64px; color: var(--text-secondary); margin-bottom: 20px; opacity: 0.4;">
                    <i class="fas fa-inbox"></i>
                </div>
                <h3 style="color: var(--text-primary); margin-bottom: 10px; font-size: 20px; font-weight: 600;">No contributions yet</h3>
                <p style="color: var(--text-secondary); margin-bottom: 25px; font-size: 14px; line-height: 1.6;">
                    This month is empty. Get started by clicking the "Add Contribution" button at the top.
                </p>
                <button id="add-contribution-empty-state" data-requires="staff" class="btn btn-primary" style="font-size: 15px; padding: 11px 26px;">
                    <i class="fas fa-plus-circle"></i> Add Contribution
                </button>
            </div>
        </div>
    `,

    // Yearly Empty State - When viewing a specific year with no contributions
    YEARLY_EMPTY_STATE: `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 50vh; padding: 40px 20px;">
            <div style="text-align: center; max-width: 400px;">
                <div style="font-size: 64px; color: var(--text-secondary); margin-bottom: 20px; opacity: 0.4;">
                    <i class="fas fa-calendar-alt"></i>
                </div>
                <h3 style="color: var(--text-primary); margin-bottom: 10px; font-size: 20px; font-weight: 600;">No contributions this year</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 14px;">
                    This year is empty. Create a new month to start tracking contributions.
                </p>
            </div>
        </div>
    `,

    // Empty state for a year that exists but has no contributions yet
    EMPTY_YEAR_STATE: `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 60vh; padding: 40px 20px;">
            <div style="text-align: center; max-width: 500px;">
                <div style="font-size: 60px; color: var(--text-secondary); margin-bottom: 20px; opacity: 0.5;">
                    <i class="fas fa-inbox"></i>
                </div>
                <h3 style="display: block; width: 100%; text-align: center; color: var(--text-primary); margin-bottom: 10px; font-size: 20px; font-weight: 600;">No contributions this year</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 14px;">
                    This year is empty. Create a month to start tracking contributions.
                </p>
            </div>
        </div>
    `,

    REPORTS_EMPTY_STATE: `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 60vh; padding: 40px 20px;">
            <div style="text-align: center; max-width: 500px;">
                <div style="font-size: 60px; color: var(--text-secondary); margin-bottom: 20px; opacity: 0.5;">
                    <i class="fas fa-chart-bar"></i>
                </div>
                <h3 style="color: var(--text-primary); margin-bottom: 10px; font-size: 20px;">No Report Data</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 14px;">
                    Add contributions to generate reports and insights.
                </p>
            </div>
        </div>
    `,

    BUDGET_EMPTY_STATE: `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 60vh; padding: 40px 20px;">
            <div style="text-align: center; max-width: 500px;">
                <div style="font-size: 60px; color: var(--text-secondary); margin-bottom: 20px; opacity: 0.5;">
                    <i class="fas fa-wallet"></i>
                </div>
                <h3 style="color: var(--text-primary); margin-bottom: 10px; font-size: 20px;">No Budget Data</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 14px;">
                    Create contributions first to set up and track your organization's budget.
                </p>
            </div>
        </div>
    `,

    // Empty state for a month with no contributions
    BLACKLIST_NO_MEMBERS_STATE: `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 60vh; padding: 40px 20px;">
            <div style="text-align: center; max-width: 500px;">
                <div style="font-size: 60px; color: var(--success-color); margin-bottom: 20px; opacity: 0.7;">
                    <i class="fas fa-check-circle"></i>
                </div>
                <h3 style="color: var(--text-primary); margin-bottom: 10px; font-size: 20px;">No Blacklisted Members</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 14px;">
                    Great! No members are currently blacklisted.
                </p>
            </div>
        </div>
    `,

    SPECIAL_GIVING_NO_CAMPAIGNS_STATE: `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 60vh; padding: 40px 20px;">
            <div style="text-align: center; max-width: 500px;">
                <div style="font-size: 60px; color: var(--text-secondary); margin-bottom: 20px; opacity: 0.5;">
                    <i class="fas fa-heart"></i>
                </div>
                <h3 style="color: var(--text-primary); margin-bottom: 10px; font-size: 20px;">No campaigns yet</h3>
                <p style="color: var(--text-secondary); margin-bottom: 30px; font-size: 14px;">
                    Create a campaign to start a special giving initiative
                </p>
                <button id="create-campaign-btn-empty" data-requires="staff" class="btn btn-primary" style="font-size: 16px; padding: 12px 28px;">
                    <i class="fas fa-plus-circle"></i> Create Campaign
                </button>
            </div>
        </div>
    `,

    // Create Month Form - For creating a new month/year of contributions
    CREATE_MONTH_FORM: `
        <div style="padding: 20px;">
            <div style="margin-bottom: 20px;">
                <label for="new-month-year" style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--text-primary);">
                    <i class="fas fa-calendar"></i> Select Year
                </label>
                <select id="new-month-year" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 14px;">
                    <option value="">-- Select Year --</option>
                </select>
            </div>
            <div>
                <label for="new-month-select" style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--text-primary);">
                    <i class="fas fa-calendar-day"></i> Select Month
                </label>
                <select id="new-month-select" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 14px;">
                    <option value="">-- Select Month --</option>
                    <option value="January">January</option>
                    <option value="February">February</option>
                    <option value="March">March</option>
                    <option value="April">April</option>
                    <option value="May">May</option>
                    <option value="June">June</option>
                    <option value="July">July</option>
                    <option value="August">August</option>
                    <option value="September">September</option>
                    <option value="October">October</option>
                    <option value="November">November</option>
                    <option value="December">December</option>
                </select>
            </div>
        </div>
    `,

    // Campaign Card Template
    CAMPAIGN_CARD: (campaign) => {
        const isActive = campaign.status === 'active';
        const pledgedColor = campaign.pledgedProgress >= 100 ? '#27ae60' : campaign.pledgedProgress >= 75 ? '#f39c12' : '#667eea';
        const paidColor = campaign.paidProgress >= 100 ? '#27ae60' : campaign.paidProgress >= 75 ? '#f39c12' : '#3498db';
        
        return `
            <div class="campaign-card">
                <div class="campaign-header">
                    <div>
                        <h3>${campaign.purpose}</h3>
                        <p class="campaign-meta">${campaign.formattedDateCreated} ${campaign.targetDate ? '• Target: ' + campaign.formattedTargetDate : ''}</p>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: flex-start;">
                        <span class="campaign-status ${isActive ? 'active' : 'resolved'}">
                            ${isActive ? 'Active' : 'Resolved'}
                        </span>
                        <button class="icon-btn view-btn" data-campaign-id="${campaign.id}" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="icon-btn share-btn" data-campaign-id="${campaign.id}" title="Share">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    </div>
                </div>

                ${campaign.reason ? `<p class="campaign-reason"><strong>Reason:</strong> ${campaign.reason}</p>` : ''}

                <div class="campaign-stats">
                    <div class="campaign-stat-item pledged-stat">
                        <span class="campaign-stat-label">Pledged</span>
                        <span class="campaign-stat-value">${campaign.amountRaised.toLocaleString()}</span>
                    </div>
                    <div class="campaign-stat-item paid-stat">
                        <span class="campaign-stat-label">Paid</span>
                        <span class="campaign-stat-value">${campaign.totalPaid.toLocaleString()}</span>
                    </div>
                    <div class="campaign-stat-item outstanding-stat">
                        <span class="campaign-stat-label">Outstanding</span>
                        <span class="campaign-stat-value">${campaign.outstandingAmount.toLocaleString()}</span>
                    </div>
                    <div class="campaign-stat-item contrib-stat">
                        <span class="campaign-stat-label">👥 Contributors</span>
                        <span class="campaign-stat-value">${campaign.contributorCount}</span>
                    </div>
                </div>

                <div class="campaign-progress">
                    <div class="progress-label">Pledges Collected</div>
                    <div class="progress-info">
                        <span class="amount">${campaign.amountRaised.toLocaleString()} / ${campaign.targetAmount.toLocaleString()}</span>
                        <span class="percentage">${campaign.pledgedProgress}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(campaign.pledgedProgress, 100)}%; background-color: ${pledgedColor};"></div>
                    </div>
                </div>

                <div class="campaign-progress">
                    <div class="progress-label">Payments Received</div>
                    <div class="progress-info">
                        <span class="amount">${campaign.totalPaid.toLocaleString()} / ${campaign.amountRaised.toLocaleString()}</span>
                        <span class="percentage">${campaign.paidProgress}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(campaign.paidProgress, 100)}%; background-color: ${paidColor};"></div>
                    </div>
                </div>

                <div class="campaign-actions">
                    ${isActive ? `
                        <button class="btn contribute-btn" data-requires="staff" data-campaign-id="${campaign.id}">
                            <i class="fas fa-hands-helping"></i> Contribute
                        </button>
                    ` : ''}
                    <button class="btn edit-btn" data-requires="staff" data-campaign-id="${campaign.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn delete-btn" data-requires="staff" data-campaign-id="${campaign.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    },

    // Create Campaign Modal
    CREATE_CAMPAIGN_FORM: `
        <div style="text-align: left; padding: 20px 0;">
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">Campaign Purpose</label>
                <input type="text" id="campaign-purpose" placeholder="e.g., John's Medical Emergency" 
                       style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; font-size: 16px; box-sizing: border-box; transition: border-color 0.3s ease;">
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">Target Amount</label>
                <input type="number" id="campaign-target" placeholder="0.00" min="0" step="0.01"
                       style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; font-size: 16px; box-sizing: border-box; transition: border-color 0.3s ease;">
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">Target Date (Optional)</label>
                <input type="date" id="campaign-target-date" min="${moment().format('YYYY-MM-DD')}"
                       style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; font-size: 16px; box-sizing: border-box; transition: border-color 0.3s ease;">
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">Reason</label>
                <textarea id="campaign-reason" placeholder="Why is this campaign needed?"
                          style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; font-size: 16px; box-sizing: border-box; min-height: 80px; transition: border-color 0.3s ease; resize: vertical;"></textarea>
            </div>
            <div style="margin-bottom: 0;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">Notes (Optional)</label>
                <textarea id="campaign-notes" placeholder="Additional notes or details"
                          style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; font-size: 16px; box-sizing: border-box; min-height: 60px; transition: border-color 0.3s ease; resize: vertical;"></textarea>
            </div>
        </div>
    `,

    // Edit Campaign Modal
    EDIT_CAMPAIGN_FORM: (campaign) => `
        <div style="text-align: left; padding: 20px 0;">
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">Campaign Purpose</label>
                <input type="text" id="edit-campaign-purpose" placeholder="Campaign purpose" value="${campaign.purpose}"
                       style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; font-size: 16px; box-sizing: border-box; transition: border-color 0.3s ease;">
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">Target Amount</label>
                <input type="number" id="edit-campaign-target" placeholder="0.00" value="${campaign.targetAmount}" min="0" step="0.01"
                       style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; font-size: 16px; box-sizing: border-box; transition: border-color 0.3s ease;">
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">Target Date (Optional)</label>
                <input type="date" id="edit-campaign-target-date" min="${moment().format('YYYY-MM-DD')}" value="${campaign.targetDate ? moment(campaign.targetDate).format('YYYY-MM-DD') : ''}"
                       style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; font-size: 16px; box-sizing: border-box; transition: border-color 0.3s ease;">
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">Reason</label>
                <textarea id="edit-campaign-reason" placeholder="Why is this campaign needed?"
                          style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; font-size: 16px; box-sizing: border-box; min-height: 80px; transition: border-color 0.3s ease; resize: vertical;">${campaign.reason}</textarea>
            </div>
            <div style="margin-bottom: 0;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary); font-size: 14px;">Status</label>
                <select id="edit-campaign-status" style="width: 100%; padding: 12px; border: 2px solid var(--border-color); border-radius: 6px; font-size: 16px; box-sizing: border-box; transition: border-color 0.3s ease;">
                    <option value="active" ${campaign.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="resolved" ${campaign.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                </select>
            </div>
        </div>
    `,

    // Edit Contribution Modal
    EDIT_CONTRIBUTION_FORM: (contribution) => `
        <div class="edit-form-container">
            <div class="edit-form-group">
                <label for="edit-name">Name:</label>
                <input type="text" id="edit-name" class="edit-form-input" value="${Utils.sanitizeHTML(contribution.name)}">
            </div>
            <div class="edit-form-group">
                <label for="edit-amount">Amount:</label>
                <input type="number" id="edit-amount" class="edit-form-input" value="${contribution.amount}">
            </div>
            <div class="edit-form-group">
                <label for="edit-paid">Paid:</label>
                <div class="checkbox-container">
                    <input type="checkbox" id="edit-paid" ${contribution.paid ? 'checked' : ''}>
                </div>
            </div>
        </div>
    `,

    // Record Payment Modal
    RECORD_PAYMENT_INFO: (contribution, pledged, paid, outstanding) => `
        <p style="text-align: left; color: var(--text-secondary); margin-bottom: 15px;">
            <strong>Pledged:</strong> ${pledged.toLocaleString()}<br/>
            <strong>Already Paid:</strong> ${paid.toLocaleString()}<br/>
            <strong style="color: var(--accent-red);">Outstanding:</strong> ${outstanding.toLocaleString()}
        </p>
    `,

    // Contributor Info Modal
    CONTRIBUTOR_ITEM: (contrib, isPaid, paidColor) => {
        const pledged = contrib.pledgedAmount || contrib.amount;
        const paid = contrib.amountPaid || 0;
        const outstanding = pledged - paid;

        return `
            <div class="contributor-item ${isPaid ? 'paid' : (paid > 0 ? 'partial' : 'unpaid')}" data-contribution-id="${contrib.id}">
                <div class="contributor-info">
                    <strong>${contrib.contributorName}</strong><br/>
                    <small style="color: var(--text-secondary);">Pledged: ${pledged.toLocaleString()}</small>
                </div>
                <div class="contributor-amounts" style="display: flex; gap: 20px; font-size: 14px;">
                    <div>
                        <span style="color: var(--text-secondary);">Paid: </span>
                        <strong style="color: ${paidColor};">${paid.toLocaleString()}</strong>
                    </div>
                    <div>
                        <span style="color: var(--text-secondary);">Outstanding: </span>
                        <strong style="color: var(--accent-red);">${outstanding.toLocaleString()}</strong>
                    </div>
                </div>
                <div class="contributor-actions">
                    ${!isPaid ? `<button class="pay-contribution-btn" data-requires="staff" data-contribution-id="${contrib.id}" title="Record payment" style="background: none; border: none; cursor: pointer; color: var(--accent-green); font-size: 16px; padding: 4px 8px;"><i class="fas fa-money-bill-wave"></i></button>` : ''}
                    <button class="edit-contribution-btn" data-requires="staff" data-contribution-id="${contrib.id}" title="Edit contribution" style="background: none; border: none; cursor: pointer; color: var(--primary-color); font-size: 16px; padding: 4px 8px;"><i class="fas fa-edit"></i></button>
                    <button class="delete-contribution-btn" data-requires="staff" data-contribution-id="${contrib.id}" title="Delete contribution" style="background: none; border: none; cursor: pointer; color: var(--accent-red); font-size: 16px; padding: 4px 8px;"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    },

    // Print Report HTML Template
    PRINT_REPORT_HTML: (selectedYear, printDate, summary, budgetSummary, balance, monthlyRows) => `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Financial Report - ${selectedYear}</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'Arial', sans-serif;
                    line-height: 1.6;
                    color: #333;
                    background: white;
                    padding: 40px;
                }
                
                .print-header {
                    text-align: center;
                    border-bottom: 3px solid #667eea;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                
                .print-header h1 {
                    color: #667eea;
                    font-size: 28px;
                    margin-bottom: 5px;
                }
                
                .print-header p {
                    color: #666;
                    font-size: 14px;
                }
                
                .print-meta {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                    font-size: 12px;
                    color: #888;
                }
                
                .section {
                    margin-bottom: 40px;
                }
                
                .section-title {
                    color: #667eea;
                    font-size: 18px;
                    font-weight: bold;
                    border-bottom: 2px solid #f0f0f0;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                }
                
                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 20px;
                    margin-bottom: 30px;
                }
                
                .metric-card {
                    border: 1px solid #ddd;
                    padding: 15px;
                    border-radius: 6px;
                    background: #f9f9f9;
                    text-align: center;
                }
                
                .metric-card .label {
                    font-size: 12px;
                    color: #666;
                    margin-bottom: 8px;
                }
                
                .metric-card .value {
                    font-size: 20px;
                    font-weight: bold;
                    color: #667eea;
                }
                
                .summary-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                }
                
                .summary-table td {
                    padding: 12px;
                    border: 1px solid #ddd;
                    text-align: right;
                }
                
                .summary-table td:first-child {
                    text-align: left;
                    font-weight: bold;
                    background-color: #f9f9f9;
                }
                
                .month-breakdown {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                }
                
                .month-breakdown th {
                    background-color: #e0e5f9;
                    color: #26306b;
                    padding: 12px;
                    text-align: left;
                    border: 1px solid #ddd;
                    border-bottom: 2px solid #667eea;
                    font-weight: bold;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                
                .month-breakdown td {
                    padding: 10px 12px;
                    border: 1px solid #ddd;
                    text-align: right;
                }
                
                .month-breakdown td:first-child {
                    text-align: left;
                }
                
                .month-breakdown tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                
                .month-breakdown tr.total {
                    background-color: #f0f0f0;
                    font-weight: bold;
                    border-top: 2px solid #667eea;
                }
                
                .footer-note {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                    font-size: 12px;
                    color: #888;
                    text-align: center;
                }
                
                @media print {
                    body { padding: 20px; }
                    .metrics-grid { grid-template-columns: repeat(4, 1fr); }
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <h1>Financial Report</h1>
                <p>ContriFlow - Year ${selectedYear}</p>
            </div>
            
            <div class="print-meta">
                <span>Printed on: ${printDate}</span>
                <span>Report for Year: ${selectedYear}</span>
            </div>
            
            <div class="section">
                <div class="section-title">Financial Summary</div>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="label">Total Pledged</div>
                        <div class="value">${summary.totalContributions.toLocaleString()}</div>
                    </div>
                    <div class="metric-card">
                        <div class="label">Total Paid</div>
                        <div class="value">${summary.totalPaid.toLocaleString()}</div>
                    </div>
                    <div class="metric-card">
                        <div class="label">Total Outstanding</div>
                        <div class="value">${summary.totalUnpaid.toLocaleString()}</div>
                    </div>
                    <div class="metric-card">
                        <div class="label">Payment Rate</div>
                        <div class="value">${summary.totalContributions > 0 ? Math.round((summary.totalPaid / summary.totalContributions) * 100) : 0}%</div>
                    </div>
                </div>
                <table class="summary-table">
                    <tr>
                        <td>Yearly Expense</td>
                        <td>${budgetSummary.totalExpenses.toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td>Balance After Expense</td>
                        <td>${balance.toLocaleString()}</td>
                    </tr>
                </table>
            </div>
            
            <div class="section">
                <div class="section-title">Monthly Breakdown</div>
                <table class="month-breakdown">
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th>Total Pledged</th>
                            <th>Total Paid</th>
                            <th>Outstanding</th>
                            <th>Contributors</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${monthlyRows}
                    </tbody>
                </table>
            </div>
            
            <div class="footer-note">
                <p>This is a financial report generated from the ContriFlow system.</p>
                <p>For detailed information or clarifications, please contact the administrator.</p>
            </div>
        </body>
        </html>
    `,

    // Budget UI Template  
    BUDGET_UI: (totalIncome, data, percentageUsed, allExpenses) => `
        <div class="budget-overview">
            <div class="budget-cards">
                <div class="budget-card budget-card-total">
                    <div class="card-icon"><i class="fas fa-coins"></i></div>
                    <div class="card-content">
                        <div class="card-label">Total Income</div>
                        <div class="card-amount">${totalIncome.toLocaleString()}</div>
                    </div>
                </div>

                <div class="budget-card budget-card-spent">
                    <div class="card-icon"><i class="fas fa-money-bill-wave"></i></div>
                    <div class="card-content">
                        <div class="card-label">Total Spent</div>
                        <div class="card-amount">${data.totalExpenses.toLocaleString()}</div>
                    </div>
                </div>

                <div class="budget-card ${data.remaining >= 0 ? 'budget-card-remaining' : 'budget-card-over'}">
                    <div class="card-icon"><i class="fas fa-chart-pie"></i></div>
                    <div class="card-content">
                        <div class="card-label">Remaining</div>
                        <div class="card-amount">${data.remaining.toLocaleString()}</div>
                        <div class="card-status">${data.remaining >= 0 ? 'Available' : 'Over Budget'}</div>
                    </div>
                </div>
            </div>

            <div class="budget-progress">
                <div class="progress-info">
                    <span class="progress-label">Income Usage</span>
                    <span class="progress-percentage">${percentageUsed.toFixed(1)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${percentageUsed > 100 ? 'over-budget' : percentageUsed > 80 ? 'warning' : 'normal'}" 
                         style="width: ${Math.min(percentageUsed, 100)}%"></div>
                </div>
            </div>
        </div>

        <div class="budget-section">
            <h3><i class="fas fa-plus-circle"></i> Add Expense</h3>
            <div class="card">
                <div class="budget-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="expense-amount">Amount</label>
                            <input type="number" id="expense-amount" 
                                   placeholder="0.00" min="0" step="0.01">
                        </div>
                        <div class="form-group">
                            <label for="expense-category">Category</label>
                            <select id="expense-category">
                                <option value="">Select Category</option>
                                <option value="Food">Food</option>
                                <option value="Transport">Transport</option>
                                <option value="Utilities">Utilities</option>
                                <option value="Entertainment">Entertainment</option>
                                <option value="Healthcare">Healthcare</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="expense-date">Date</label>
                            <input type="date" id="expense-date" required>
                        </div>
                        <div class="form-group">
                            <label for="expense-description">Description</label>
                            <input type="text" id="expense-description" 
                                   placeholder="Optional description">
                        </div>
                        <div class="form-group">
                            <button id="add-expense-btn" data-requires="admin" class="btn btn-success">
                                <i class="fas fa-plus"></i> Add Expense
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="budget-section">
            <h3><i class="fas fa-list"></i> All Expenses (${allExpenses.length})</h3>
            <div class="card">
                <div class="expense-filters">
                    <div class="filter-group">
                        <label for="filter-type">Filter By:</label>
                        <select id="filter-type">
                            <option value="all">All Expenses</option>
                            <option value="current-month">Current Month</option>
                            <option value="current-year">Current Year</option>
                            <option value="date-range">Custom Date Range</option>
                        </select>
                    </div>
                    <div class="filter-group" id="date-range-filters" style="display:none;">
                        <input type="date" id="filter-start-date" placeholder="Start Date">
                        <input type="date" id="filter-end-date" placeholder="End Date">
                        <button id="apply-date-filter" class="btn btn-primary">Apply</button>
                    </div>
                    <div class="filter-group">
                        <label for="filter-category">Category:</label>
                        <select id="filter-category">
                            <option value="">All Categories</option>
                            <option value="Food">Food</option>
                            <option value="Transport">Transport</option>
                            <option value="Utilities">Utilities</option>
                            <option value="Entertainment">Entertainment</option>
                            <option value="Healthcare">Healthcare</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>
                ${allExpenses.length === 0 ? 
                    `<div class="no-expenses-message">
                        <i class="fas fa-inbox"></i>
                        <p>No expenses recorded yet</p>
                    </div>` :
                    `<div class="table-responsive">
                        <table class="expenses-table" id="expenses-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Category</th>
                                    <th>Description</th>
                                    <th>Amount</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="expenses-tbody">
                                ${allExpenses.map(expense => `
                                    <tr class="expense-row" data-date="${expense.date}" data-category="${expense.category}">
                                        <td>${expense.formattedDate}</td>
                                        <td><span class="category-badge">${expense.category}</span></td>
                                        <td>${expense.description || '-'}</td>
                                        <td class="amount">${Number(expense.amount).toLocaleString()}</td>
                                        <td>
                                            <button class="btn btn-small edit-expense" data-requires="admin" data-expense-id="${expense.id}" title="Edit">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="btn btn-small delete-expense" data-requires="admin" data-expense-id="${expense.id}" title="Delete">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>`
                }
            </div>
        </div>
    `,

    // Monthly View Contribution Row
    MONTHLY_CONTRIBUTION_ROW: (item, index) => `
        <td>${index + 1}</td>
        <td>${Utils.sanitizeHTML(item.name)}</td>
        <td>${Number(item.amount).toLocaleString()}</td>
        <td>
            <span class="${item.paid ? 'paid' : 'unpaid'}">
                ${item.paid ? '<i class="fas fa-check-circle"></i> Paid' : '<i class="fas fa-times-circle"></i> Unpaid'}
            </span>
        </td>
        <td>
            <button class="btn btn-small toggle-payment" data-requires="staff" data-index="${index}">
                ${item.paid ? '<i class="fas fa-ban"></i> Mark Unpaid' : '<i class="fas fa-check"></i> Mark Paid'}
            </button>
            <button class="btn btn-small remove-contribution" data-requires="staff" data-index="${index}">
                <i class="fas fa-trash"></i> Remove
            </button>
            <button class="btn btn-small blacklist-member" data-requires="admin" data-name="${encodeURIComponent(item.name)}">
                <i class="fas fa-ban"></i> Blacklist
            </button>
            <button class="btn btn-small edit-contribution" data-requires="staff" data-index="${index}">
                <i class="fas fa-edit"></i> Edit
            </button>
        </td>
    `,

    // Comprehensive empty state for months without contributions  
    // Yearly View Month Row
    YEARLY_MONTH_ROW: (month, totalMonthAmount, paidAmount, unpaidAmount) => `
        <td>${month}</td>
        <td>${totalMonthAmount}</td>
        <td class="amount-paid">${paidAmount}</td>
        <td class="amount-unpaid">${unpaidAmount}</td>
    `,

    // Yearly View Summary Row
    YEARLY_SUMMARY_ROW: (totals) => `
        <td><strong>Total</strong></td>
        <td><strong>${totals.yearlyTotalAmount}</strong></td>
        <td class="amount-paid"><strong>${totals.monthlyTotalPaid}</strong></td>
        <td class="amount-unpaid"><strong>${totals.monthlyTotalUnpaid}</strong></td>
    `,

    // Blacklist Member Row
    BLACKLIST_MEMBER_ROW: (name, index) => `
        <td>${index + 1}</td>
        <td>${name}</td>
        <td>
            <button class="btn btn-small remove-from-blacklist" data-requires="admin" data-index="${index}">
                <i class="fas fa-user-plus"></i> Remove
            </button>
        </td>
    `,

    // Blacklist Empty State
    BLACKLIST_EMPTY_STATE: `<td colspan="3" style="text-align: center; padding: 30px 20px; color: var(--text-secondary);"><i class="fas fa-check-circle" style="color: var(--success-color); margin-right: 10px;"></i>No blacklisted members yet. Use the form above to add one.</td>`
};
