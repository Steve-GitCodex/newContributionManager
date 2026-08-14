// Report Generator Module
// Pure data computation functions — no DOM side effects

const ReportGenerator = (function() {
    return {
        // Check if data exists in the selected date range
        hasDataInRange(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData) {
            const startMonth = reportStartMonth.value;
            const startYear = reportStartYear.value;
            const endMonth = reportEndMonth.value;
            const endYear = reportEndYear.value;

            const months = moment.months();
            const startDate = moment(`${startYear}-${months.indexOf(startMonth) + 1}`, 'YYYY-M');
            const endDate = moment(`${endYear}-${months.indexOf(endMonth) + 1}`, 'YYYY-M');

            let currentDate = startDate.clone();

            while (currentDate.isSameOrBefore(endDate, 'month')) {
                const year = currentDate.format('YYYY');
                const month = currentDate.format('MMMM');

                if (contributionsData[year]?.[month]?.contributions &&
                    contributionsData[year][month].contributions.length > 0) {
                    return true;
                }

                currentDate.add(1, 'month');
            }

            return false;
        },

        // Generate report based on type
        generateReport(reportTypeSelect, reportMemberSelect, reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData, statusFilter = 'all') {
            const reportType = reportTypeSelect.value;

            try {
                // Check if data exists in the selected range first
                if (!this.hasDataInRange(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData)) {
                    throw new Error(`No data available for the selected date range (${reportStartMonth.value} ${reportStartYear.value} to ${reportEndMonth.value} ${reportEndYear.value})`);
                }

                let reportData = null;

                switch (reportType) {
                    case 'individual':
                        reportData = this.generateIndividualReport(reportMemberSelect, reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData, statusFilter);
                        break;
                    case 'all-members':
                        reportData = this.generateAllMembersReport(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData);
                        break;
                    case 'expected-members':
                        reportData = this.generateExpectedMembersReport(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData);
                        break;
                    case 'month-range':
                        reportData = this.generateMonthRangeReport(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData);
                        break;
                    default:
                        throw new Error('Invalid report type');
                }

                if (reportData) {
                    return reportData;
                }
            } catch (error) {
                showToast('error', 'Report Generation Error', error.message || 'Failed to generate report');
                return null;
            }
        },

        // Generate individual member report
        generateIndividualReport(reportMemberSelect, reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData, statusFilter = 'all') {
            const memberName = reportMemberSelect.value;

            if (!memberName) {
                throw new Error('Please select a member');
            }

            const startMonth = reportStartMonth.value;
            const startYear = reportStartYear.value;
            const endMonth = reportEndMonth.value;
            const endYear = reportEndYear.value;

            const months = moment.months();
            const memberData = [];
            let totalPaid = 0;
            let totalUnpaid = 0;
            let totalAmount = 0;
            let monthsWithContribution = 0;
            let totalMonthsInRange = 0;

            const startDate = moment(`${startYear}-${months.indexOf(startMonth) + 1}`, 'YYYY-M');
            const endDate = moment(`${endYear}-${months.indexOf(endMonth) + 1}`, 'YYYY-M');

            let currentDate = startDate.clone();

            while (currentDate.isSameOrBefore(endDate, 'month')) {
                const year = currentDate.format('YYYY');
                const month = currentDate.format('MMMM');
                totalMonthsInRange++;

                if (contributionsData[year]?.[month]?.contributions) {
                    const contribution = contributionsData[year][month].contributions.find(
                        c => c.name === memberName
                    );

                    if (contribution) {
                        const rowData = {
                            month,
                            year,
                            amount: contribution.amount,
                            paid: contribution.paid,
                            noRecord: false
                        };

                        // Apply status filter for display
                        const shouldDisplay = statusFilter === 'all' ||
                            (statusFilter === 'paid' && contribution.paid) ||
                            (statusFilter === 'unpaid' && !contribution.paid);

                        if (shouldDisplay) {
                            memberData.push(rowData);

                            // Only count in summary if displayed
                            totalAmount += contribution.amount;
                            monthsWithContribution++;
                            if (contribution.paid) {
                                totalPaid += contribution.amount;
                            } else {
                                totalUnpaid += contribution.amount;
                            }
                        }
                    } else {
                        const rowData = {
                            month,
                            year,
                            amount: 0,
                            paid: false,
                            noRecord: true
                        };

                        // Apply status filter
                        if (statusFilter === 'all' || statusFilter === 'no-record') {
                            memberData.push(rowData);
                        }
                    }
                } else {
                    const rowData = {
                        month,
                        year,
                        amount: 0,
                        paid: false,
                        noRecord: true
                    };

                    // Apply status filter
                    if (statusFilter === 'all' || statusFilter === 'no-record') {
                        memberData.push(rowData);
                    }
                }

                currentDate.add(1, 'month');
            }

            return {
                type: 'individual',
                title: `Contribution Report: ${memberName}`,
                subtitle: `Period: ${startMonth} ${startYear} to ${endMonth} ${endYear}${statusFilter !== 'all' ? ` (${statusFilter.replace('-', ' ')})` : ''}`,
                data: memberData,
                summary: {
                    totalAmount,
                    totalPaid,
                    totalUnpaid,
                    monthsContributed: monthsWithContribution,
                    totalMonths: totalMonthsInRange
                },
                memberName,
                statusFilter
            };
        },

        // Generate all members report
        generateAllMembersReport(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData) {
            const startMonth = reportStartMonth.value;
            const startYear = reportStartYear.value;
            const endMonth = reportEndMonth.value;
            const endYear = reportEndYear.value;

            const months = moment.months();
            const membersMap = new Map();

            const startDate = moment(`${startYear}-${months.indexOf(startMonth) + 1}`, 'YYYY-M');
            const endDate = moment(`${endYear}-${months.indexOf(endMonth) + 1}`, 'YYYY-M');

            let currentDate = startDate.clone();

            while (currentDate.isSameOrBefore(endDate, 'month')) {
                const year = currentDate.format('YYYY');
                const month = currentDate.format('MMMM');

                if (contributionsData[year]?.[month]?.contributions) {
                    contributionsData[year][month].contributions.forEach(contribution => {
                        if (!membersMap.has(contribution.name)) {
                            membersMap.set(contribution.name, {
                                name: contribution.name,
                                totalAmount: 0,
                                totalPaid: 0,
                                totalUnpaid: 0,
                                monthsContributed: 0,
                                monthsOutstanding: 0
                            });
                        }

                        const memberData = membersMap.get(contribution.name);
                        memberData.totalAmount += contribution.amount;
                        memberData.monthsContributed++;

                        if (contribution.paid) {
                            memberData.totalPaid += contribution.amount;
                        } else {
                            memberData.totalUnpaid += contribution.amount;
                            memberData.monthsOutstanding++;
                        }
                    });
                }

                currentDate.add(1, 'month');
            }

            const membersArray = Array.from(membersMap.values()).sort((a, b) =>
                a.name.localeCompare(b.name)
            );

            const totalMonthsInRange = endDate.diff(startDate, 'months') + 1;

            return {
                type: 'all-members',
                title: 'All Members Contribution Status',
                subtitle: `Period: ${startMonth} ${startYear} to ${endMonth} ${endYear}`,
                data: membersArray,
                summary: {
                    totalMembers: membersArray.length,
                    totalMonthsInRange,
                    grandTotalAmount: membersArray.reduce((sum, m) => sum + m.totalAmount, 0),
                    grandTotalPaid: membersArray.reduce((sum, m) => sum + m.totalPaid, 0),
                    grandTotalUnpaid: membersArray.reduce((sum, m) => sum + m.totalUnpaid, 0)
                }
            };
        },

        // Generate non-contributors report
        generateNonContributorsReport(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData) {
            const startMonth = reportStartMonth.value;
            const startYear = reportStartYear.value;
            const endMonth = reportEndMonth.value;
            const endYear = reportEndYear.value;

            const months = moment.months();
            const membersMap = new Map();

            // Collect all members
            for (const year in contributionsData) {
                if (!contributionsData.hasOwnProperty(year)) continue;
                for (const month in contributionsData[year]) {
                    if (!contributionsData[year].hasOwnProperty(month)) continue;
                    const monthData = contributionsData[year][month];
                    if (monthData.contributions) {
                        monthData.contributions.forEach(c => {
                            if (!membersMap.has(c.name)) {
                                membersMap.set(c.name, {
                                    name: c.name,
                                    lastContributionMonth: null,
                                    lastContributionYear: null,
                                    monthsMissed: 0,
                                    totalOwed: 0
                                });
                            }
                        });
                    }
                }
            }

            const startDate = moment(`${startYear}-${months.indexOf(startMonth) + 1}`, 'YYYY-M');
            const endDate = moment(`${endYear}-${months.indexOf(endMonth) + 1}`, 'YYYY-M');

            let currentDate = startDate.clone();

            while (currentDate.isSameOrBefore(endDate, 'month')) {
                const year = currentDate.format('YYYY');
                const month = currentDate.format('MMMM');

                const contributorsThisMonth = new Set();

                if (contributionsData[year]?.[month]?.contributions) {
                    contributionsData[year][month].contributions.forEach(contribution => {
                        contributorsThisMonth.add(contribution.name);

                        const memberData = membersMap.get(contribution.name);
                        if (memberData && contribution.paid) {
                            memberData.lastContributionMonth = month;
                            memberData.lastContributionYear = year;
                        }
                    });
                }

                membersMap.forEach((memberData, name) => {
                    if (!contributorsThisMonth.has(name)) {
                        memberData.monthsMissed++;

                        let expectedAmount = 0;
                        for (const y in contributionsData) {
                            if (contributionsData[y]?.[month]?.contributions) {
                                const prevContribution = contributionsData[y][month].contributions.find(
                                    c => c.name === name
                                );
                                if (prevContribution) {
                                    expectedAmount = prevContribution.amount;
                                    break;
                                }
                            }
                        }
                        memberData.totalOwed += expectedAmount;
                    }
                });

                currentDate.add(1, 'month');
            }

            const nonContributors = Array.from(membersMap.values())
                .filter(m => m.monthsMissed > 0)
                .sort((a, b) => b.monthsMissed - a.monthsMissed);

            return {
                type: 'non-contributors',
                title: 'Non-Contributing Members Report',
                subtitle: `Period: ${startMonth} ${startYear} to ${endMonth} ${endYear}`,
                data: nonContributors,
                summary: {
                    totalNonContributors: nonContributors.length,
                    totalMonthsMissed: nonContributors.reduce((sum, m) => sum + m.monthsMissed, 0),
                    totalOwed: nonContributors.reduce((sum, m) => sum + m.totalOwed, 0)
                }
            };
        },

        // Generate new members report
        generateNewMembersReport(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData) {
            const startMonth = reportStartMonth.value;
            const startYear = reportStartYear.value;
            const endMonth = reportEndMonth.value;
            const endYear = reportEndYear.value;

            const months = moment.months();
            const newMembers = [];
            const seenMembers = new Set();

            // Mark members before start date
            for (const year in contributionsData) {
                if (!contributionsData.hasOwnProperty(year)) continue;

                const yearNum = parseInt(year);
                const startYearNum = parseInt(startYear);

                for (const month in contributionsData[year]) {
                    if (!contributionsData[year].hasOwnProperty(month)) continue;

                    const monthIndex = months.indexOf(month);
                    const startMonthIndex = months.indexOf(startMonth);

                    const isBeforeStart = yearNum < startYearNum ||
                        (yearNum === startYearNum && monthIndex < startMonthIndex);

                    if (isBeforeStart && contributionsData[year][month].contributions) {
                        contributionsData[year][month].contributions.forEach(c => {
                            seenMembers.add(c.name);
                        });
                    }
                }
            }

            const startDate = moment(`${startYear}-${months.indexOf(startMonth) + 1}`, 'YYYY-M');
            const endDate = moment(`${endYear}-${months.indexOf(endMonth) + 1}`, 'YYYY-M');

            let currentDate = startDate.clone();

            while (currentDate.isSameOrBefore(endDate, 'month')) {
                const year = currentDate.format('YYYY');
                const month = currentDate.format('MMMM');

                if (contributionsData[year]?.[month]?.contributions) {
                    contributionsData[year][month].contributions.forEach(contribution => {
                        if (!seenMembers.has(contribution.name)) {
                            newMembers.push({
                                name: contribution.name,
                                joinMonth: month,
                                joinYear: year,
                                firstAmount: contribution.amount,
                                firstPaid: contribution.paid
                            });
                            seenMembers.add(contribution.name);
                        }
                    });
                }

                currentDate.add(1, 'month');
            }

            return {
                type: 'new-members',
                title: 'New Members Report',
                subtitle: `Period: ${startMonth} ${startYear} to ${endMonth} ${endYear}`,
                data: newMembers,
                summary: {
                    totalNewMembers: newMembers.length
                }
            };
        },

        // Generate expected members report
        generateExpectedMembersReport(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData) {
            // Get expected members list from localStorage
            const expectedMembers = JSON.parse(localStorage.getItem('expectedMembers') || '[]');

            if (expectedMembers.length === 0) {
                throw new Error('No expected members list configured. Please add members to the expected list first.');
            }

            // Parse date range
            const startMonth = reportStartMonth.value;
            const startYear = reportStartYear.value;
            const endMonth = reportEndMonth.value;
            const endYear = reportEndYear.value;

            const months = moment.months();
            const startDate = moment(`${startYear}-${months.indexOf(startMonth) + 1}`, 'YYYY-M');
            const endDate = moment(`${endYear}-${months.indexOf(endMonth) + 1}`, 'YYYY-M');

            const memberStats = expectedMembers.map(memberEntry => {
                // Handle both old format (string) and new format (object)
                const memberName = typeof memberEntry === 'string' ? memberEntry : memberEntry.name;
                const monthlyExpectedAmount = typeof memberEntry === 'string' ? 0 : memberEntry.monthlyAmount;

                let neverContributed = true;
                let totalOwed = 0;
                let monthsMissed = 0;
                let totalMonths = 0;
                let totalExpectedAmount = 0;

                // Check all years and months in contributionsData within the date range
                for (const year in contributionsData) {
                    for (const month in contributionsData[year]) {
                        const monthData = contributionsData[year][month];

                        // Check if this month is within the date range
                        const currentMonthDate = moment(`${year}-${months.indexOf(month) + 1}`, 'YYYY-M');
                        if (currentMonthDate.isBefore(startDate, 'month') || currentMonthDate.isAfter(endDate, 'month')) {
                            continue; // Skip months outside the date range
                        }

                        if (monthData.contributions) {
                            totalMonths++;
                            // Use the member's monthly expected amount, or fall back to month's default amount
                            const expectedAmount = monthlyExpectedAmount || monthData.amount || 0;
                            totalExpectedAmount += expectedAmount;

                            const contribution = monthData.contributions.find(c => c.name === memberName);

                            if (contribution) {
                                // Member has at least one contribution
                                neverContributed = false;

                                if (!contribution.paid) {
                                    totalOwed += contribution.amount;
                                    monthsMissed++;
                                }
                            } else {
                                // No record for this month - they owe the expected amount
                                totalOwed += expectedAmount;
                                monthsMissed++;
                            }
                        }
                    }
                }

                return {
                    name: memberName,
                    monthlyExpectedAmount,
                    neverContributed,
                    totalOwed,
                    monthsMissed,
                    totalMonths,
                    totalExpectedAmount
                };
            });

            return {
                type: 'expected-members',
                title: 'Expected Members List',
                subtitle: 'Members expected to contribute and their status',
                data: memberStats,
                summary: {
                    totalExpected: expectedMembers.length,
                    neverContributed: memberStats.filter(m => m.neverContributed).length,
                    totalOwed: memberStats.reduce((sum, m) => sum + m.totalOwed, 0),
                    totalExpectedAmount: memberStats.reduce((sum, m) => sum + m.totalExpectedAmount, 0)
                }
            };
        },

        // Generate month range report
        generateMonthRangeReport(reportStartMonth, reportStartYear, reportEndMonth, reportEndYear, contributionsData) {
            const startMonth = reportStartMonth.value;
            const startYear = reportStartYear.value;
            const endMonth = reportEndMonth.value;
            const endYear = reportEndYear.value;

            const months = moment.months();
            const monthlyData = [];

            const startDate = moment(`${startYear}-${months.indexOf(startMonth) + 1}`, 'YYYY-M');
            const endDate = moment(`${endYear}-${months.indexOf(endMonth) + 1}`, 'YYYY-M');

            let currentDate = startDate.clone();
            let grandTotal = 0;
            let grandPaid = 0;
            let grandUnpaid = 0;

            while (currentDate.isSameOrBefore(endDate, 'month')) {
                const year = currentDate.format('YYYY');
                const month = currentDate.format('MMMM');

                let monthTotal = 0;
                let monthPaid = 0;
                let monthUnpaid = 0;
                let contributors = 0;

                if (contributionsData[year]?.[month]?.contributions) {
                    const monthData = contributionsData[year][month];
                    contributors = monthData.contributions.length;

                    monthData.contributions.forEach(c => {
                        monthTotal += c.amount;
                        if (c.paid) {
                            monthPaid += c.amount;
                        } else {
                            monthUnpaid += c.amount;
                        }
                    });
                }

                monthlyData.push({
                    month,
                    year,
                    total: monthTotal,
                    paid: monthPaid,
                    unpaid: monthUnpaid,
                    contributors
                });

                grandTotal += monthTotal;
                grandPaid += monthPaid;
                grandUnpaid += monthUnpaid;

                currentDate.add(1, 'month');
            }

            return {
                type: 'month-range',
                title: 'Month Range Summary',
                subtitle: `Period: ${startMonth} ${startYear} to ${endMonth} ${endYear}`,
                data: monthlyData,
                summary: {
                    totalMonths: monthlyData.length,
                    grandTotal,
                    grandPaid,
                    grandUnpaid
                }
            };
        }
    };
})();
