// Special Giving Manager Module
// Handles special giving campaigns for group support and fundraising
// NOTE: This module is purely business logic - all data is passed in and returned

const SpecialGivingManager = (function() {
    return {
        // Initialize special giving manager (no-op for now, kept for compatibility)
        init(uid) {
            return Promise.resolve(true);
        },

        // Create new special giving campaign
        createCampaign(campaignsData, purpose, targetAmount, targetDate, reason = '', notes = '') {
            try {
                const campaignId = Date.now().toString();
                const dateCreated = Date.now();
                
                const campaign = {
                    id: campaignId,
                    purpose: purpose,
                    targetAmount: Number(targetAmount),
                    amountRaised: 0,
                    dateCreated: dateCreated,
                    targetDate: targetDate ? new Date(targetDate).getTime() : null,
                    reason: reason,
                    status: 'active',
                    notes: notes,
                    contributions: {}
                };

                if (!campaignsData) campaignsData = {};
                campaignsData[campaignId] = campaign;
                
                return campaignId;
            } catch (error) {
                console.error('Error creating campaign:', error);
                return null;
            }
        },

        // Add contribution to campaign
        addContribution(campaignsData, campaignId, contributorName, pledgedAmount, amountPaid = 0, contributionNotes = '') {
            try {
                if (!campaignsData[campaignId]) {
                    throw new Error('Campaign not found');
                }

                const contributionId = Date.now().toString();
                const contribution = {
                    id: contributionId,
                    contributorName: contributorName,
                    pledgedAmount: Number(pledgedAmount),
                    amountPaid: Number(amountPaid),
                    date: Date.now(),
                    notes: contributionNotes
                };

                // Initialize contributions object if it doesn't exist
                if (!campaignsData[campaignId].contributions) {
                    campaignsData[campaignId].contributions = {};
                }

                // Add contribution to campaign
                campaignsData[campaignId].contributions[contributionId] = contribution;
                
                // Update amount raised (use pledged amount)
                campaignsData[campaignId].amountRaised += Number(pledgedAmount);
                
                return contributionId;
            } catch (error) {
                console.error('Error adding contribution:', error);
                return null;
            }
        },

        // Calculate total paid for a campaign
        calculateCampaignPayments(campaignsData, campaignId) {
            if (!campaignsData[campaignId]) return { totalPaid: 0, contributorCount: 0 };
            
            const contributions = campaignsData[campaignId].contributions || {};
            let totalPaid = 0;
            let contributorCount = 0;
            
            for (const contributionId in contributions) {
                if (Object.prototype.hasOwnProperty.call(contributions, contributionId)) {
                    const contribution = contributions[contributionId];
                    totalPaid += Number(contribution.amountPaid || 0);
                    contributorCount++;
                }
            }
            
            return { totalPaid, contributorCount };
        },

        // Get all campaigns
        getAllCampaigns(campaignsData) {
            const campaignsList = [];
            if (!campaignsData) return campaignsList;
            
            for (const campaignId in campaignsData) {
                if (!Object.prototype.hasOwnProperty.call(campaignsData, campaignId)) continue;
                
                const campaign = campaignsData[campaignId];
                const { totalPaid, contributorCount } = this.calculateCampaignPayments(campaignsData, campaignId);
                const amountRaised = Number(campaign.amountRaised) || 0;
                const targetAmount = Number(campaign.targetAmount) || 0;

                const pledgedProgress = targetAmount > 0
                    ? Math.round((amountRaised / targetAmount) * 100)
                    : 0;

                const paidProgress = amountRaised > 0
                    ? Math.round((totalPaid / amountRaised) * 100)
                    : 0;

                const outstandingAmount = Math.max(0, amountRaised - totalPaid);

                campaignsList.push({
                    ...campaign,
                    amountRaised: amountRaised,
                    targetAmount: targetAmount,
                    pledgedProgress: pledgedProgress,
                    paidProgress: paidProgress,
                    totalPaid: totalPaid,
                    contributorCount: contributorCount,
                    outstandingAmount: outstandingAmount,
                    remaining: Math.max(0, targetAmount - amountRaised),
                    formattedDateCreated: moment(campaign.dateCreated).format('DD/MM/YYYY'),
                    formattedTargetDate: campaign.targetDate ? moment(campaign.targetDate).format('DD/MM/YYYY') : 'No target date'
                });
            }
            return campaignsList.sort((a, b) => b.dateCreated - a.dateCreated);
        },

        // Get active campaigns only
        getActiveCampaigns(campaignsData) {
            return this.getAllCampaigns(campaignsData).filter(c => c.status === 'active');
        },

        // Get campaign by ID
        getCampaignById(campaignsData, campaignId) {
            if (!campaignsData[campaignId]) return null;
            
            const campaign = campaignsData[campaignId];
            const { totalPaid, contributorCount } = this.calculateCampaignPayments(campaignsData, campaignId);
            const amountRaised = Number(campaign.amountRaised) || 0;
            const targetAmount = Number(campaign.targetAmount) || 0;

            const pledgedProgress = targetAmount > 0
                ? Math.round((amountRaised / targetAmount) * 100)
                : 0;

            const paidProgress = amountRaised > 0
                ? Math.round((totalPaid / amountRaised) * 100)
                : 0;

            return {
                ...campaign,
                amountRaised: amountRaised,
                targetAmount: targetAmount,
                pledgedProgress: pledgedProgress,
                paidProgress: paidProgress,
                progress: pledgedProgress, // For backward compatibility
                totalPaid: totalPaid,
                contributorCount: contributorCount,
                outstandingAmount: Math.max(0, amountRaised - totalPaid),
                remaining: Math.max(0, targetAmount - amountRaised),
                formattedDateCreated: moment(campaign.dateCreated).format('DD/MM/YYYY'),
                formattedTargetDate: campaign.targetDate ? moment(campaign.targetDate).format('DD/MM/YYYY') : 'No target date'
            };
        },

        // Get campaign contributions
        getCampaignContributions(campaignsData, campaignId) {
            if (!campaignsData[campaignId]) return [];
            
            const contributions = [];
            const campaignContribs = campaignsData[campaignId].contributions || {};
            
            for (const contributionId in campaignContribs) {
                if (!Object.prototype.hasOwnProperty.call(campaignContribs, contributionId)) continue;
                
                const contribution = campaignContribs[contributionId];
                contributions.push({
                    ...contribution,
                    formattedDate: moment(contribution.date).format('DD/MM/YYYY')
                });
            }
            
            return contributions.sort((a, b) => b.date - a.date);
        },

        // Record additional payment for a contribution
        recordPayment(campaignsData, campaignId, contributionId, paymentAmount) {
            try {
                if (!campaignsData[campaignId] || !campaignsData[campaignId].contributions[contributionId]) {
                    throw new Error('Contribution not found');
                }

                const contribution = campaignsData[campaignId].contributions[contributionId];
                const oldPaidAmount = Number(contribution.amountPaid);
                const newPaidAmount = oldPaidAmount + Number(paymentAmount);

                // Don't allow paying more than pledged
                if (newPaidAmount > Number(contribution.pledgedAmount)) {
                    throw new Error('Payment cannot exceed pledged amount');
                }

                // Update data
                campaignsData[campaignId].contributions[contributionId].amountPaid = newPaidAmount;
                
                return newPaidAmount;
            } catch (error) {
                console.error('Error recording payment:', error);
                return null;
            }
        },

        // Remove contribution
        removeContribution(campaignsData, campaignId, contributionId) {
            try {
                if (!campaignsData[campaignId] || !campaignsData[campaignId].contributions[contributionId]) {
                    throw new Error('Contribution not found');
                }

                const contribution = campaignsData[campaignId].contributions[contributionId];
                
                // Update amount raised
                campaignsData[campaignId].amountRaised -= Number(contribution.pledgedAmount || contribution.amount);

                // Remove from data
                delete campaignsData[campaignId].contributions[contributionId];

                return true;
            } catch (error) {
                console.error('Error removing contribution:', error);
                return false;
            }
        },

        // Update contribution
        updateContribution(campaignsData, campaignId, contributionId, updates) {
            try {
                if (!campaignsData[campaignId] || !campaignsData[campaignId].contributions[contributionId]) {
                    throw new Error('Contribution not found');
                }

                const oldContribution = campaignsData[campaignId].contributions[contributionId];
                const oldPledgedAmount = Number(oldContribution.pledgedAmount || oldContribution.amount);
                const newPledgedAmount = updates.pledgedAmount ? Number(updates.pledgedAmount) : oldPledgedAmount;
                const amountDifference = newPledgedAmount - oldPledgedAmount;

                // Update data
                Object.assign(campaignsData[campaignId].contributions[contributionId], updates);

                // Update amount raised if pledged amount changed
                if (amountDifference !== 0) {
                    campaignsData[campaignId].amountRaised += amountDifference;
                }

                // Contribution updated successfully
                return true;
            } catch (error) {
                console.error('Error updating contribution:', error);
                return false;
            }
        },

        // Remove campaign
        removeCampaign(campaignsData, campaignId) {
            try {
                if (!campaignsData[campaignId]) {
                    throw new Error('Campaign not found');
                }

                // Remove from data
                delete campaignsData[campaignId];

                // Campaign deleted successfully
                return true;
            } catch (error) {
                console.error('Error removing campaign:', error);
                return false;
            }
        },

        // Update campaign
        updateCampaign(campaignsData, campaignId, updates) {
            try {
                if (!campaignsData[campaignId]) {
                    throw new Error('Campaign not found');
                }

                // Update data
                Object.assign(campaignsData[campaignId], updates);

                // Campaign updated successfully
                return true;
            } catch (error) {
                console.error('Error updating campaign:', error);
                return false;
            }
        },

        // Mark campaign as resolved
        resolveCampaign(campaignsData, campaignId) {
            return this.updateCampaign(campaignsData, campaignId, { status: 'resolved' });
        },

        // Get campaign statistics
        getCampaignStats(campaignsData) {
            const allCampaigns = this.getAllCampaigns(campaignsData);
            let totalTarget = 0;
            let totalRaised = 0;
            let activeCampaigns = 0;
            let resolvedCampaigns = 0;

            allCampaigns.forEach(campaign => {
                totalTarget += campaign.targetAmount;
                totalRaised += campaign.amountRaised;
                
                if (campaign.status === 'active') {
                    activeCampaigns++;
                } else {
                    resolvedCampaigns++;
                }
            });

            return {
                totalTarget,
                totalRaised,
                activeCampaigns,
                resolvedCampaigns,
                totalCampaigns: allCampaigns.length,
                overallProgress: totalTarget > 0 ? Math.round((totalRaised / totalTarget) * 100) : 0
            };
        }
    };
})();
