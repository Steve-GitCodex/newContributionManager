// Campaign Export Manager
// Handles all export functionality for campaigns (text, CSV, PDF)

const CampaignExportManager = (function () {
    /**
     * Generate campaign text export
     */
    const generateCampaignText = (campaign, contributions) => {
        let text = `=== SPECIAL GIVING CAMPAIGN ===\n\n`;
        text += `Purpose: ${campaign.purpose}\n`;
        text += `Status: ${campaign.status === 'active' ? 'Active' : 'Resolved'}\n`;
        text += `Created: ${campaign.formattedDateCreated}\n`;
        if (campaign.targetDate) text += `Target Date: ${campaign.formattedTargetDate}\n`;
        text += `\n--- CAMPAIGN SUMMARY ---\n`;
        text += `Target Amount: ${campaign.targetAmount.toLocaleString()}\n`;
        text += `Amount Pledged: ${campaign.amountRaised.toLocaleString()}\n`;
        text += `Amount Paid: ${campaign.totalPaid.toLocaleString()}\n`;
        text += `Outstanding: ${campaign.outstandingAmount.toLocaleString()}\n`;
        text += `Pledges Progress: ${campaign.pledgedProgress}%\n`;
        text += `Payments Progress: ${campaign.paidProgress}%\n`;
        text += `Total Contributors: ${campaign.contributorCount}\n`;
        if (campaign.reason) text += `\nReason:\n${campaign.reason}\n`;
        if (campaign.notes) text += `\nNotes:\n${campaign.notes}\n`;
        text += `\n--- CONTRIBUTORS (${contributions.length}) ---\n`;
        contributions.forEach((contrib, index) => {
            const pledgedAmt = contrib.pledgedAmount || 0;
            const paidAmt = contrib.amountPaid || 0;
            const formattedDate = contrib.formattedDate || moment(contrib.date).format('DD/MM/YYYY');
            text += `${index + 1}. ${contrib.contributorName}\n`;
            text += `   Pledged: ${pledgedAmt.toLocaleString()}\n`;
            text += `   Paid: ${paidAmt.toLocaleString()}\n`;
            text += `   Outstanding: ${(pledgedAmt - paidAmt).toLocaleString()}\n`;
            text += `   Date: ${formattedDate}\n`;
            if (contrib.notes) text += `   Message: ${contrib.notes}\n`;
        });
        return text;
    };

    /**
     * Generate campaign CSV export
     */
    const generateCSV = (campaign, contributions) => {
        let csv = `Special Giving Campaign Export\n\n`;
        csv += `Campaign: ${campaign.purpose}\n`;
        csv += `Status: ${campaign.status === 'active' ? 'Active' : 'Resolved'}\n`;
        csv += `Created: ${campaign.formattedDateCreated}\n`;
        if (campaign.targetDate) csv += `Target Date: ${campaign.formattedTargetDate}\n\n`;

        csv += `SUMMARY\n`;
        csv += `Metric,Value\n`;
        csv += `Target Amount,"${campaign.targetAmount.toLocaleString()}"\n`;
        csv += `Amount Pledged,"${campaign.amountRaised.toLocaleString()}"\n`;
        csv += `Amount Paid,"${campaign.totalPaid.toLocaleString()}"\n`;
        csv += `Outstanding,"${campaign.outstandingAmount.toLocaleString()}"\n`;
        csv += `Pledges Progress (%),"${campaign.pledgedProgress}%"\n`;
        csv += `Payments Progress (%),"${campaign.paidProgress}%"\n`;
        csv += `Total Contributors,"${campaign.contributorCount}"\n\n`;

        csv += `CONTRIBUTORS\n`;
        csv += `Name,Pledged,Paid,Outstanding,Date,Message\n`;
        contributions.forEach(contrib => {
            const pledgedAmt = contrib.pledgedAmount || 0;
            const paidAmt = contrib.amountPaid || 0;
            const outstanding = pledgedAmt - paidAmt;
            const formattedDate = contrib.formattedDate || moment(contrib.date).format('DD/MM/YYYY');
            csv += `"${contrib.contributorName}","${pledgedAmt.toLocaleString()}","${paidAmt.toLocaleString()}","${outstanding.toLocaleString()}","${formattedDate}","${contrib.notes ? contrib.notes.replace(/"/g, '""') : ''}"\n`;
        });
        return csv;
    };

    /**
     * Handle generic download with validation and error handling
     */
    const downloadFile = (blob, filename, format) => {
        return new Promise((resolve, reject) => {
            try {
                if (!blob || blob.size === 0) {
                    reject(new Error('Failed to create file'));
                    return;
                }

                const blobUrl = URL.createObjectURL(blob);

                if (!blobUrl) {
                    reject(new Error('Failed to create download link'));
                    return;
                }

                if (navigator.msSaveOrOpenBlob) {
                    const saveSuccess = navigator.msSaveOrOpenBlob(blob, filename);
                    if (saveSuccess === false) {
                        reject(new Error('Browser blocked the download'));
                        return;
                    }
                    resolve({ size: blob.size, format });
                    return;
                }

                const link = document.createElement('a');
                if (!link) {
                    reject(new Error('Failed to create download element'));
                    return;
                }

                link.href = blobUrl;
                link.download = filename;
                link.style.position = 'absolute';
                link.style.left = '-9999px';
                document.body.appendChild(link);

                try {
                    link.click();
                } catch (clickError) {
                    console.error(`[${format}] Download failed:`, clickError.message);
                    document.body.removeChild(link);
                    reject(new Error('Unable to trigger download: ' + clickError.message));
                    return;
                }

                // Keep link in DOM for 3 seconds to avoid browser download blocking
                setTimeout(() => {
                    try {
                        if (document.body.contains(link)) {
                            document.body.removeChild(link);
                        }
                    } catch (e) {
                        // Silently handle removal failure
                    }
                }, 3000);

                resolve({ size: blob.size, format });
            } catch (error) {
                console.error(`[${format}] Download error:`, error);
                reject(error);
            }
        });
    };

    /**
     * Export campaign as text file
     */
    const exportAsText = async (campaign, contributions) => {
        try {
            const text = generateCampaignText(campaign, contributions);

            if (!text || text.length === 0) {
                throw new Error('No data to export');
            }

            const filename = `campaign_${campaign.purpose.replace(/\s+/g, '_')}_${Date.now()}.txt`;
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });

            return await downloadFile(blob, filename, 'TEXT');
        } catch (error) {
            console.error('[TEXT] Export error:', error);
            throw error;
        }
    };

    /**
     * Export campaign as CSV file
     */
    const exportAsCSV = async (campaign, contributions) => {
        try {
            const csv = generateCSV(campaign, contributions);

            if (!csv || csv.length === 0) {
                throw new Error('No data to export');
            }

            const filename = `campaign_${campaign.purpose.replace(/\s+/g, '_')}_${Date.now()}.csv`;
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });

            return await downloadFile(blob, filename, 'CSV');
        } catch (error) {
            console.error('[CSV] Export error:', error);
            throw error;
        }
    };

    /**
     * Export campaign as PDF file
     */
    const exportAsPDF = async (campaign, contributions) => {
        const printWindow = window.open('', '_blank');

        if (!printWindow) {
            throw new Error('Could not open the print window. Please allow pop-ups for this site and try again.');
        }

        printWindow.document.write(CampaignPrintTemplate.build(campaign, contributions));
        printWindow.document.close();

        await new Promise(resolve => {
            if (printWindow.document.readyState === 'complete') {
                resolve();
                return;
            }
            printWindow.addEventListener('load', resolve, { once: true });
        });

        printWindow.focus();
        printWindow.print();

        return { contributors: contributions.length, format: 'PDF' };
    };

    // Public API
    return {
        exportAsText,
        exportAsCSV,
        exportAsPDF
    };
})();
