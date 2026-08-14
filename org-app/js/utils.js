// Utility Functions Module
// Common helper functions used throughout the application

// Show toast notification
function showToast(icon, title, text) {
    Swal.fire({
        icon: icon,
        title: title,
        text: text,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });
}

const Utils = (function() {
    return {
        // Sanitize HTML to prevent XSS
        sanitizeHTML(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        // Validate name input
        validateName(name) {
            const trimmedName = String(name).trim();
            if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 50) {
                return { valid: false, error: 'Name must be between 2 and 50 characters' };
            }
            return { valid: true };
        },

        // Validate amount input
        validateAmount(amountStr) {
            if (!amountStr || !/^\d+$/.test(amountStr)) {
                return { valid: false, error: 'Please enter a valid number for amount' };
            }

            const amount = parseInt(amountStr);
            if (amount <= 0 || amount > 1000000) {
                return { valid: false, error: 'Amount must be between 1 and 1,000,000' };
            }

            return { valid: true, amount };
        },

        // Export data to JSON files
        exportData(blacklistData, contributionsData, currentYear) {
            try {
                if (!contributionsData || !contributionsData[currentYear]) {
                    showToast('error', 'Export Error', `No data found for year ${currentYear}.`);
                    return;
                }

                const blacklistBlob = new Blob([JSON.stringify(blacklistData, null, 2)], {
                    type: 'application/json'
                });

                const yearBlob = new Blob([JSON.stringify(contributionsData[currentYear], null, 2)], {
                    type: 'application/json'
                });

                const blacklistURL = URL.createObjectURL(blacklistBlob);
                const yearURL = URL.createObjectURL(yearBlob);

                const blacklistLink = document.createElement('a');
                blacklistLink.href = blacklistURL;
                blacklistLink.download = 'blacklist.json';
                blacklistLink.click();

                const yearLink = document.createElement('a');
                yearLink.href = yearURL;
                yearLink.download = `${currentYear}.json`;
                yearLink.click();

                URL.revokeObjectURL(blacklistURL);
                URL.revokeObjectURL(yearURL);

                showToast('success', 'Export Complete', 'Your data files have been downloaded.');
            } catch (error) {
                console.error('Error exporting data:', error);
                showToast('error', 'Export Error', 'Failed to export data files.');
            }
        },
        // Save phone number to localStorage
        savePhoneNumber(phoneNumber) {
            if (!phoneNumber) {
                return { success: false, error: 'Please enter a valid phone number' };
            }

            localStorage.setItem('phoneNumber', phoneNumber);
            return { success: true };
        },

        // Get phone number from localStorage
        getPhoneNumber() {
            return localStorage.getItem('phoneNumber') || '';
        },

        // Save current view to localStorage
        saveCurrentView(view) {
            try {
                localStorage.setItem('currentView', view);
            } catch (error) {
                console.error('Error saving current view:', error);
            }
        },

        // Get saved view from localStorage
        getSavedView() {
            try {
                return localStorage.getItem('currentView') || 'monthly';
            } catch (error) {
                console.error('Error getting saved view:', error);
                return 'monthly';
            }
        },

        // Update sync status display
        updateSyncStatus(lastSyncTime) {
            const dbStatus = document.getElementById('db-status');
            const lastSync = document.getElementById('last-synced');

            if (dbStatus) {
                dbStatus.textContent = 'Firebase Realtime Database';
            }

            if (lastSync && lastSyncTime) {
                lastSync.textContent = moment(lastSyncTime).format('YYYY-MM-DD HH:mm:ss');
            } else if (lastSync) {
                lastSync.textContent = 'Never';
            }
        },

        // Populate year select dropdown - dynamically from contributions data
        populateYearSelect(yearSelect, currentYear, contributionsData = null) {
            yearSelect.innerHTML = '';
            
            let years = [];
            
            // If contributions data provided, get years from it
            if (contributionsData) {
                years = this.getAvailableYears(contributionsData);
            } else {
                // Fallback to hardcoded range if no data provided
                const thisYear = parseInt(moment().format('YYYY'));
                for (let year = thisYear - 2; year <= thisYear + 2; year++) {
                    years.push(year);
                }
                years.sort((a, b) => b - a); // Descending
            }

            years.forEach(year => {
                const option = document.createElement('option');
                option.value = year.toString();
                option.textContent = year.toString();

                if (year === parseInt(currentYear)) {
                    option.selected = true;
                }

                yearSelect.appendChild(option);
            });
        },

        // Populate month select dropdown - only with months that have data
        populateMonthSelect(monthSelect, currentMonth, contributionsData = {}, currentYear = null) {
            monthSelect.innerHTML = '';
            
            // Get months with data for current year
            const allMonths = moment.months();
            const monthsWithData = [];
            
            // If we have a current year, get months that have data in that year
            if (currentYear && contributionsData[currentYear]) {
                const yearMonths = contributionsData[currentYear];
                allMonths.forEach((month, index) => {
                    if (yearMonths[month]) {
                        monthsWithData.push({ month, index });
                    }
                });
            }
            
            // If no months with data found, show all months (allows selecting a month before adding data)
            let monoptions = monthsWithData.length > 0 ? monthsWithData : allMonths.map((month, index) => ({ month, index }));
            
            // Sort months with most recent first (reverse chronological order)
            if (Array.isArray(monoptions) && monoptions[0]?.month !== undefined) {
                monoptions.sort((a, b) => b.index - a.index);
            } else {
                monoptions = monoptions.map((month, index) => ({ month, index: allMonths.indexOf(month) }));
                monoptions.sort((a, b) => b.index - a.index);
            }
            
            monoptions.forEach(item => {
                const month = item.month || item;
                const option = document.createElement('option');
                option.value = month;
                option.textContent = month;

                if (month === currentMonth) {
                    option.selected = true;
                }

                monthSelect.appendChild(option);
            });
        },

        // Format WhatsApp message for monthly report
        formatMonthlyWhatsAppMessage(currentMonth, currentYear, monthData) {
            const paidTotal = monthData.contributions.filter(item => item.paid)
                .reduce((sum, item) => sum + item.amount, 0);
            const unpaidTotal = monthData.contributions.filter(item => !item.paid)
                .reduce((sum, item) => sum + item.amount, 0);

            let message = `*${currentMonth} ${currentYear} - CONTRIBUTION REPORT*\n`;
            message += "------------------------------------------\n\n";

            monthData.contributions.forEach((item, index) => {
                message += `${index + 1}. *${item.name}* - ${item.amount.toLocaleString()}/= ${item.paid ? '✅' : '❌'}\n`;
            });

            message += "\n------------------------------------------";
            message += "\n*SUMMARY:*";
            message += `\n▪️ Total Expected: ${monthData.total.toLocaleString()}/=`;
            message += `\n▪️ Total Paid: ${paidTotal.toLocaleString()}/=`;
            message += `\n▪️ Total Unpaid: ${unpaidTotal.toLocaleString()}/=`;
            message += "\n------------------------------------------";
            message += "\n\n_Generated from ContriFlow_";

            return message;
        },

        // Format WhatsApp message for yearly report
        formatYearlyWhatsAppMessage(currentYear, contributionsData) {
            const months = moment.months();
            let yearlyTotalAmount = 0;
            let yearlyPaidAmount = 0;
            let yearlyUnpaidAmount = 0;

            let message = `*${currentYear} YEARLY CONTRIBUTION REPORT*\n`;
            message += "------------------------------------------\n\n";

            for (const month of months) {
                if (contributionsData[currentYear]?.[month]) {
                    const monthData = contributionsData[currentYear][month];

                    const paidAmount = monthData.contributions.filter(item => item.paid)
                        .reduce((sum, item) => sum + item.amount, 0);
                    const unpaidAmount = monthData.contributions.filter(item => !item.paid)
                        .reduce((sum, item) => sum + item.amount, 0);

                    message += `*${month}:*\n`;
                    message += `▪️ Total: ${monthData.total.toLocaleString()}/=\n`;
                    message += `▪️ Paid: ${paidAmount.toLocaleString()}/=\n`;
                    message += `▪️ Unpaid: ${unpaidAmount.toLocaleString()}/=\n\n`;

                    yearlyTotalAmount += monthData.total;
                    yearlyPaidAmount += paidAmount;
                    yearlyUnpaidAmount += unpaidAmount;
                }
            }

            message += "------------------------------------------";
            message += "\n*YEARLY SUMMARY:*";
            message += `\n▪️ Total Expected: ${yearlyTotalAmount.toLocaleString()}/=`;
            message += `\n▪️ Total Paid: ${yearlyPaidAmount.toLocaleString()}/=`;
            message += `\n▪️ Total Unpaid: ${yearlyUnpaidAmount.toLocaleString()}/=`;
            message += "\n------------------------------------------";
            message += "\n\n_Generated from ContriFlow_";

            return message;
        },

        // Get available years from contributions data
        getAvailableYears(contributionsData) {
            const years = Object.keys(contributionsData || {})
                .filter(key => /^\d{4}$/.test(key))
                .map(year => parseInt(year))
                .sort((a, b) => b - a); // Descending order
            return years;
        },

        // Populate year selector with dynamic years
        populateYearSelector(selectElement, contributionsData, defaultYear = null) {
            const years = this.getAvailableYears(contributionsData);
            
            if (years.length === 0) {
                return;
            }

            selectElement.innerHTML = '';
            years.forEach(year => {
                const option = document.createElement('option');
                option.value = year.toString();
                option.textContent = year.toString();
                
                // Set default to current year or provided year
                const selectedYear = defaultYear || parseInt(moment().format('YYYY'));
                if (year === selectedYear) {
                    option.selected = true;
                }
                
                selectElement.appendChild(option);
            });
        }
    };
})();
