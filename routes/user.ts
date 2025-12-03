import express from 'express';
import { storage } from '../storage';

const router = express.Router();


// ========== User Dashboard API ==========

// Get comprehensive dashboard data for Freedom Tag user
router.get('/api/user/dashboard/:tagCode', async (req, res) => {
    try {
        const tagCode = req.params.tagCode;

        // Require authentication - check session
        if (!req.session.donorAuth || req.session.donorAuth.tagCode !== tagCode) {
            return res.status(401).json({ error: 'Not authenticated or unauthorized' });
        }

        const tag = await storage.getTag(tagCode);

        if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        const wallet = await storage.getWallet(tag.walletId);
        const allTransactions = await storage.getAllTransactions();

        // Get donations made by this user (using their tag code)
        const donationsMade = allTransactions.filter(
            tx => (tx.kind === 'DONATION' || tx.kind === 'PHILANTHROPIST_DONATION') &&
                tx.donorTagCode === tagCode
        );

        // Get donations received by this tag
        const donationsReceived = allTransactions.filter(
            tx => (tx.kind === 'DONATION' || tx.kind === 'PHILANTHROPIST_DONATION') &&
                tx.toWalletId === wallet?.id
        );

        // Calculate stats
        const totalGiven = donationsMade.reduce((sum, tx) => sum + tx.amount, 0);
        const totalReceived = donationsReceived.reduce((sum, tx) => sum + tx.amount, 0);

        // Get recurring donations (if user is also a philanthropist)
        let recurringDonations: any[] = [];
        if (tag.userId) {
            recurringDonations = await storage.getRecurringDonationsByPhilanthropist(tag.userId);
        }

        // Get organization info if applicable
        let organization = null;
        if (tag.organizationId) {
            organization = await storage.getOrganization(tag.organizationId);
        }

        res.json({
            tag: {
                tagCode: tag.tagCode,
                beneficiaryName: tag.beneficiaryName,
                beneficiaryType: tag.beneficiaryType,
                description: tag.description,
                website: tag.website,
                facebook: tag.facebook,
                twitter: tag.twitter,
                instagram: tag.instagram,
                linkedin: tag.linkedin,
                logoUrl: tag.logoUrl,
                referralCode: tag.referralCode,
            },
            wallet: {
                id: wallet?.id,
                balance: wallet?.balanceZAR || 0,
            },
            stats: {
                totalGiven,
                totalReceived,
                donationsMadeCount: donationsMade.length,
                donationsReceivedCount: donationsReceived.length,
            },
            organization,
            recurringDonationsCount: recurringDonations.length,
        });
    } catch (error) {
        console.error('Get user dashboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get complete activity history for user
router.get('/api/user/activity/:tagCode', async (req, res) => {
    try {
        const tagCode = req.params.tagCode;

        // Require authentication - check session
        if (!req.session.donorAuth || req.session.donorAuth.tagCode !== tagCode) {
            return res.status(401).json({ error: 'Not authenticated or unauthorized' });
        }

        const tag = await storage.getTag(tagCode);

        if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        const wallet = await storage.getWallet(tag.walletId);
        const allTransactions = await storage.getAllTransactions();

        // Get all transactions involving this user's wallet
        const userTransactions = allTransactions.filter(
            tx => tx.fromWalletId === wallet?.id ||
                tx.toWalletId === wallet?.id ||
                tx.donorTagCode === tagCode
        );

        // Enrich transactions with details
        const enrichedActivity = await Promise.all(
            userTransactions.map(async (tx) => {
                let fromInfo = null;
                let toInfo = null;

                if (tx.fromWalletId) {
                    const fromWallet = await storage.getWallet(tx.fromWalletId);
                    const allTags = await storage.getAllTags();
                    const fromTag = fromWallet ? allTags.find(t => t.walletId === fromWallet.id) : null;
                    if (fromTag) {
                        fromInfo = {
                            tagCode: fromTag.tagCode,
                            beneficiaryName: fromTag.beneficiaryName,
                        };
                    }
                }

                if (tx.toWalletId) {
                    const toWallet = await storage.getWallet(tx.toWalletId);
                    const allTags = await storage.getAllTags();
                    const toTag = toWallet ? allTags.find(t => t.walletId === toWallet.id) : null;
                    if (toTag) {
                        toInfo = {
                            tagCode: toTag.tagCode,
                            beneficiaryName: toTag.beneficiaryName,
                        };
                    }
                }

                return {
                    id: tx.id,
                    ts: tx.ts,
                    kind: tx.kind,
                    amount: tx.amount,
                    currency: tx.currency || 'ZAR',
                    ref: tx.ref,
                    donorName: tx.donorName,
                    donorEmail: tx.donorEmail,
                    donorTagCode: tx.donorTagCode,
                    blockchainTxHash: tx.blockchainTxHash,
                    blockchainNetwork: tx.blockchainNetwork,
                    fromInfo,
                    toInfo,
                    direction: tx.donorTagCode === tagCode ? 'sent' :
                        tx.toWalletId === wallet?.id ? 'received' : 'other'
                };
            })
        );

        // Sort by timestamp descending (most recent first)
        enrichedActivity.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

        res.json({ activity: enrichedActivity });
    } catch (error) {
        console.error('Get user activity error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get recurring donations for user
router.get('/api/user/recurring-donations/:tagCode', async (req, res) => {
    try {
        const tagCode = req.params.tagCode;

        // Require authentication - check session
        if (!req.session.donorAuth || req.session.donorAuth.tagCode !== tagCode) {
            return res.status(401).json({ error: 'Not authenticated or unauthorized' });
        }

        const tag = await storage.getTag(tagCode);

        if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        // Check if user has a philanthropist account
        if (!tag.userId) {
            return res.json({ recurringDonations: [] });
        }

        // Try to find philanthropist by userId
        const philanthropist = await storage.getPhilanthropistByUserId(tag.userId);
        if (!philanthropist) {
            return res.json({ recurringDonations: [] });
        }

        const donations = await storage.getRecurringDonationsByPhilanthropist(philanthropist.id);

        // Enrich with recipient info
        const enrichedDonations = await Promise.all(
            donations.map(async (donation) => {
                let recipientInfo = null;

                if (donation.recipientType === 'TAG') {
                    const recipientTag = await storage.getTag(donation.recipientId);
                    if (recipientTag) {
                        recipientInfo = {
                            type: 'tag',
                            tagCode: recipientTag.tagCode,
                            beneficiaryName: recipientTag.beneficiaryName,
                        };
                    }
                } else if (donation.recipientType === 'ORGANIZATION') {
                    const org = await storage.getOrganization(donation.recipientId);
                    if (org) {
                        recipientInfo = {
                            type: 'organization',
                            name: org.name,
                            smartContractAddress: org.smartContractAddress,
                        };
                    }
                }

                return {
                    ...donation,
                    recipientInfo,
                };
            })
        );

        res.json({ recurringDonations: enrichedDonations });
    } catch (error) {
        console.error('Get recurring donations error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update recurring donation status (pause/cancel)
router.patch('/api/user/recurring-donations/:id', async (req, res) => {
    try {
        // Get donation first to verify ownership
        const donation = await storage.getRecurringDonation(req.params.id);
        if (!donation) {
            return res.status(404).json({ error: 'Recurring donation not found' });
        }

        // Get philanthropist to verify it belongs to this user
        const philanthropist = await storage.getPhilanthropist(donation.philanthropistId);
        if (!philanthropist || !philanthropist.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Get user's tag to verify session
        const allTags = await storage.getAllTags();
        const userTag = allTags.find(t => t.userId === philanthropist.userId);
        if (!userTag || !req.session.donorAuth || req.session.donorAuth.tagCode !== userTag.tagCode) {
            return res.status(401).json({ error: 'Not authenticated or unauthorized' });
        }

        const { status } = req.body || {};
        if (!status || !['active', 'paused', 'cancelled'].includes(status)) {
            return res.status(400).json({ error: 'Valid status required (active, paused, cancelled)' });
        }

        const updated = await storage.updateRecurringDonationStatus(req.params.id, status);
        res.json({ success: true, donation: updated });
    } catch (error) {
        console.error('Update recurring donation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
