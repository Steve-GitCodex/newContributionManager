// Campaign Print Template
// Builds the printable HTML document used by the campaign PDF export

const CampaignPrintTemplate = (function () {
    const PRINT_STYLES = `
        @page { size: A4; margin: 14mm; }

        body {
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.5;
            color: #222;
            padding: 0;
        }

        h1 { color: #4a69bd; font-size: 24px; margin-bottom: 4px; }
        h2 { color: #4a69bd; font-size: 17px; margin: 28px 0 10px; }

        .meta { font-size: 13px; color: #555; margin-bottom: 6px; }
        .meta strong { color: #222; }

        .reason {
            margin: 16px 0;
            padding: 12px 16px;
            background-color: #f8f9fa;
            border-left: 4px solid #667eea;
            border-radius: 4px;
            font-size: 13px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        table { width: 100%; border-collapse: collapse; margin-top: 8px; }

        th, td { border: 1px solid #ddd; padding: 8px 10px; font-size: 13px; }

        thead { display: table-header-group; }
        tr { page-break-inside: avoid; break-inside: avoid; }

        th {
            background-color: #dbe2f4;
            color: #1e2a52;
            font-weight: bold;
            text-align: left;
            border-bottom: 2px solid #4a69bd;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .summary-table td:first-child { font-weight: bold; width: 55%; }
        .summary-table td:last-child { text-align: right; }

        .num { text-align: right; }
        .paid { color: #1c7a45; font-weight: bold; }
        .outstanding { color: #b3261e; font-weight: bold; }

        tbody tr:nth-child(even) td {
            background-color: #fafafa;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .footer-note {
            margin-top: 28px;
            padding-top: 12px;
            border-top: 1px solid #ddd;
            font-size: 11px;
            color: #888;
            text-align: center;
        }
    `;

    const escape = (value) => {
        if (value === null || value === undefined) return '';
        return typeof Utils !== 'undefined' && Utils.sanitizeHTML
            ? Utils.sanitizeHTML(String(value))
            : String(value).replace(/[&<>"']/g, ch => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[ch]);
    };

    const summaryRows = (campaign) => [
        ['Target Amount', campaign.targetAmount.toLocaleString()],
        ['Amount Pledged', campaign.amountRaised.toLocaleString()],
        ['Amount Paid', campaign.totalPaid.toLocaleString()],
        ['Outstanding', campaign.outstandingAmount.toLocaleString()],
        ['Pledges Progress', `${campaign.pledgedProgress}%`],
        ['Payments Progress', `${campaign.paidProgress}%`]
    ].map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join('');

    const contributorRows = (contributions) => contributions.map(contrib => {
        const pledged = contrib.pledgedAmount || 0;
        const paid = contrib.amountPaid || 0;
        const date = contrib.formattedDate || moment(contrib.date).format('DD/MM/YYYY');
        return `
            <tr>
                <td>${escape(contrib.contributorName)}</td>
                <td class="num">${pledged.toLocaleString()}</td>
                <td class="num paid">${paid.toLocaleString()}</td>
                <td class="num outstanding">${(pledged - paid).toLocaleString()}</td>
                <td>${escape(date)}</td>
            </tr>
        `;
    }).join('');

    const build = (campaign, contributions) => `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${escape(campaign.purpose)}</title>
            <style>${PRINT_STYLES}</style>
        </head>
        <body>
            <h1>${escape(campaign.purpose)}</h1>
            <div class="meta"><strong>Status:</strong> ${campaign.status === 'active' ? 'Active' : 'Resolved'}</div>
            <div class="meta"><strong>Created:</strong> ${escape(campaign.formattedDateCreated)}</div>
            ${campaign.targetDate ? `<div class="meta"><strong>Target Date:</strong> ${escape(campaign.formattedTargetDate)}</div>` : ''}

            <h2>Campaign Summary</h2>
            <table class="summary-table"><tbody>${summaryRows(campaign)}</tbody></table>

            ${campaign.reason ? `<div class="reason"><strong>Reason:</strong><br/>${escape(campaign.reason).replace(/\n/g, '<br/>')}</div>` : ''}

            <h2>Contributors (${contributions.length})</h2>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th class="num">Pledged</th>
                        <th class="num">Paid</th>
                        <th class="num">Outstanding</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>${contributorRows(contributions)}</tbody>
            </table>

            <div class="footer-note">Generated from ContriFlow</div>
        </body>
        </html>
    `;

    return { build };
})();
