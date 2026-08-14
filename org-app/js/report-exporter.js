// Report Exporter Module
// Text generation, file export, print, and WhatsApp share functionality

const ReportExporter = (function() {
    return {
        // Export report as text file
        exportAsText(reportData) {
            if (!reportData) {
                showToast('warning', 'No Report', 'Please generate a report first');
                return;
            }

            let text = `${reportData.title}\n`;
            text += `${reportData.subtitle}\n`;
            text += '='.repeat(50) + '\n\n';

            switch (reportData.type) {
                case 'individual':
                    text += this.generateIndividualReportText(reportData);
                    break;
                case 'all-members':
                    text += this.generateAllMembersReportText(reportData);
                    break;
                case 'expected-members':
                    text += this.generateExpectedMembersReportText(reportData);
                    break;
                case 'month-range':
                    text += this.generateMonthRangeReportText(reportData);
                    break;
            }

            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `report_${moment().format('YYYY-MM-DD_HH-mm-ss')}.txt`;
            link.click();
            URL.revokeObjectURL(url);

            showToast('success', 'Report Exported', 'Report has been downloaded as text file');
        },

        // Generate text for individual report
        generateIndividualReportText(reportData) {
            let text = '';
            reportData.data.forEach(row => {
                const status = row.noRecord ? 'No Record' : (row.paid ? 'Paid' : 'Unpaid');
                text += `${row.month} ${row.year} - ${row.amount}/= - ${status}\n`;
            });
            text += '\n' + '-'.repeat(50) + '\n';
            text += 'SUMMARY\n';
            text += '-'.repeat(50) + '\n';
            text += `Total Months: ${reportData.summary.totalMonths}\n`;
            text += `Months with Contributions: ${reportData.summary.monthsContributed}\n`;
            text += `Total Amount: ${reportData.summary.totalAmount.toLocaleString()}/=\n`;
            text += `Total Paid: ${reportData.summary.totalPaid.toLocaleString()}/=\n`;
            text += `Total Unpaid: ${reportData.summary.totalUnpaid.toLocaleString()}/=\n`;
            return text;
        },

        // Generate text for all members report
        generateAllMembersReportText(reportData) {
            let text = '';
            reportData.data.forEach(member => {
                text += `${member.name}\n`;
                text += `  Months: ${member.monthsContributed}\n`;
                text += `  Total: ${member.totalAmount.toLocaleString()}/=\n`;
                text += `  Paid: ${member.totalPaid.toLocaleString()}/=\n`;
                text += `  Unpaid: ${member.totalUnpaid.toLocaleString()}/=\n`;
                text += `  Outstanding Months: ${member.monthsOutstanding}\n\n`;
            });
            text += '\n' + '-'.repeat(50) + '\n';
            text += 'SUMMARY\n';
            text += '-'.repeat(50) + '\n';
            text += `Total Members: ${reportData.summary.totalMembers}\n`;
            text += `Grand Total: ${reportData.summary.grandTotalAmount.toLocaleString()}/=\n`;
            text += `Total Paid: ${reportData.summary.grandTotalPaid.toLocaleString()}/=\n`;
            text += `Total Unpaid: ${reportData.summary.grandTotalUnpaid.toLocaleString()}/=\n`;
            return text;
        },

        // Generate text for expected members report
        generateExpectedMembersReportText(reportData) {
            let text = '';
            reportData.data.forEach(member => {
                const neverContributed = member.neverContributed ? 'Never Contributed' : 'Has Contributed';
                text += `${member.name}\n`;
                text += `  Monthly Expected: ${member.monthlyExpectedAmount.toLocaleString()}/=\n`;
                text += `  Status: ${neverContributed}\n`;
                text += `  Total Months: ${member.totalMonths}\n`;
                text += `  Months Missed: ${member.monthsMissed}\n`;
                text += `  Total Expected Amount: ${member.totalExpectedAmount.toLocaleString()}/=\n`;
                text += `  Total Owed: ${member.totalOwed.toLocaleString()}/=\n\n`;
            });
            text += '\n' + '-'.repeat(50) + '\n';
            text += 'SUMMARY\n';
            text += '-'.repeat(50) + '\n';
            text += `Total Expected Members: ${reportData.summary.totalExpected}\n`;
            text += `Never Contributed: ${reportData.summary.neverContributed}\n`;
            text += `Total Expected Amount: ${reportData.summary.totalExpectedAmount.toLocaleString()}/=\n`;
            text += `Total Owed: ${reportData.summary.totalOwed.toLocaleString()}/=\n`;
            return text;
        },

        // Generate text for non-contributors report
        generateNonContributorsReportText(reportData) {
            let text = '';
            reportData.data.forEach(member => {
                const lastContribution = member.lastContributionMonth
                    ? `${member.lastContributionMonth} ${member.lastContributionYear}`
                    : 'Never';
                text += `${member.name}\n`;
                text += `  Months Missed: ${member.monthsMissed}\n`;
                text += `  Last Contribution: ${lastContribution}\n`;
                text += `  Amount Owed: ${member.totalOwed.toLocaleString()}/=\n\n`;
            });
            text += '\n' + '-'.repeat(50) + '\n';
            text += 'SUMMARY\n';
            text += '-'.repeat(50) + '\n';
            text += `Total Non-Contributors: ${reportData.summary.totalNonContributors}\n`;
            text += `Total Months Missed: ${reportData.summary.totalMonthsMissed}\n`;
            text += `Total Amount Owed: ${reportData.summary.totalOwed.toLocaleString()}/=\n`;
            return text;
        },

        // Generate text for new members report
        generateNewMembersReportText(reportData) {
            let text = '';
            reportData.data.forEach(member => {
                const status = member.firstPaid ? 'Paid' : 'Unpaid';
                text += `${member.name}\n`;
                text += `  Joined: ${member.joinMonth} ${member.joinYear}\n`;
                text += `  First Amount: ${member.firstAmount.toLocaleString()}/=\n`;
                text += `  First Payment: ${status}\n\n`;
            });
            text += '\n' + '-'.repeat(50) + '\n';
            text += 'SUMMARY\n';
            text += '-'.repeat(50) + '\n';
            text += `Total New Members: ${reportData.summary.totalNewMembers}\n`;
            return text;
        },

        // Generate text for month range report
        generateMonthRangeReportText(reportData) {
            let text = '';
            reportData.data.forEach(row => {
                text += `${row.month} ${row.year}\n`;
                text += `  Contributors: ${row.contributors}\n`;
                text += `  Total: ${row.total.toLocaleString()}/=\n`;
                text += `  Paid: ${row.paid.toLocaleString()}/=\n`;
                text += `  Unpaid: ${row.unpaid.toLocaleString()}/=\n\n`;
            });
            text += '\n' + '-'.repeat(50) + '\n';
            text += 'SUMMARY\n';
            text += '-'.repeat(50) + '\n';
            text += `Total Months: ${reportData.summary.totalMonths}\n`;
            text += `Grand Total: ${reportData.summary.grandTotal.toLocaleString()}/=\n`;
            text += `Total Paid: ${reportData.summary.grandPaid.toLocaleString()}/=\n`;
            text += `Total Unpaid: ${reportData.summary.grandUnpaid.toLocaleString()}/=\n`;
            return text;
        },

        // Print report content
        print(reportData, reportContent) {
            if (!reportData) {
                showToast('warning', 'No Report', 'Please generate a report first');
                return;
            }

            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Print Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { color: #4a69bd; }
                        .subtitle { color: #666; margin-bottom: 20px; }
                        .report-subtitle { font-size: 15px; color: #666; margin-bottom: 16px; padding: 12px 16px; background-color: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px; }
                        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #dbe2f4; color: #1e2a52; font-weight: bold; border-bottom: 2px solid #4a69bd; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .paid { color: green; }
                        .unpaid { color: red; }
                        .no-record { color: orange; }
                        .summary { margin-top: 20px; padding: 15px; background-color: #f5f5f5; }
                        .report-summary { margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 8px; }
                        @media print {
                            button { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <h1>${reportData.title}</h1>
                    ${reportContent.innerHTML}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        },

        // Share report via WhatsApp
        shareViaWhatsapp(reportData, phoneNumber) {
            if (!reportData) {
                showToast('warning', 'No Report', 'Please generate a report first');
                return;
            }

            if (!phoneNumber) {
                showToast('warning', 'No Phone Number', 'Please save your phone number in the settings first');
                return;
            }

            let message = `*${reportData.title}*\n`;
            message += `${reportData.subtitle}\n`;
            message += '--'.repeat(25) + '\n\n';

            switch (reportData.type) {
                case 'individual':
                    message += this.generateIndividualReportText(reportData);
                    break;
                case 'all-members':
                    message += `Total Members: ${reportData.summary.totalMembers}\n`;
                    message += `Grand Total: ${reportData.summary.grandTotalAmount.toLocaleString()}/=\n`;
                    message += `Total Paid: ${reportData.summary.grandTotalPaid.toLocaleString()}/=\n`;
                    message += `Total Unpaid: ${reportData.summary.grandTotalUnpaid.toLocaleString()}/=\n`;
                    break;
                case 'expected-members':
                    message += this.generateExpectedMembersReportText(reportData);
                    break;
                case 'month-range':
                    message += this.generateMonthRangeReportText(reportData);
                    break;
            }

            message += '\n_Generated from Contribution Manager_';

            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        }
    };
})();
