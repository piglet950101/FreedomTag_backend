import express from 'express';
import { storage } from '../storage';

const router = express.Router();

// ========== Legacy Donor/Tag API ==========

// PIN verification endpoint - creates server-side session
router.post('/donor/verify-pin', async (req, res) => {
    try {
        const { tagCode, pin } = req.body || {};
        if (!tagCode || !pin) {
            return res.status(400).json({ error: 'tagCode and pin required' });
        }

        const tag = await storage.getTag(String(tagCode));
        if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        // Verify PIN
        if (tag.pin !== String(pin)) {
            return res.status(401).json({ error: 'Invalid PIN' });
        }

        const wallet = await storage.getWallet(tag.walletId);
        if (!wallet) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        // Regenerate session to prevent fixation attacks
        req.session.regenerate((err) => {
            if (err) {
                return res.status(500).json({ error: 'Session error' });
            }

            // Create server-side session with new session ID
            req.session.donorAuth = {
                tagCode: tag.tagCode,
                beneficiaryName: tag.beneficiaryName || '',
            };

            // Save session before responding
            req.session.save((err) => {
                if (err) {
                    return res.status(500).json({ error: 'Session save error' });
                }

                // Return donor info and balance
                res.json({
                    tagCode: tag.tagCode,
                    beneficiaryName: tag.beneficiaryName,
                    beneficiaryType: tag.beneficiaryType,
                    balanceZAR: wallet.balanceZAR,
                    walletId: wallet.id,
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Donor logout endpoint
router.post('/donor/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.json({ success: true });
    });
});


// ========== Donor Donation Tracking APIs ==========

// Track donations by donor email
router.get('/donor/track/:email', async (req, res) => {
    try {
        const email = req.params.email;
        const allTransactions = await storage.getAllTransactions();

        // Find all donations by this donor
        const donorTransactions = allTransactions.filter(
            tx => tx.kind === 'DONATION' && tx.donorEmail === email
        );

        // Enrich with tag and organization info
        const enrichedTransactions = await Promise.all(
            donorTransactions.map(async (tx) => {
                const toWallet = tx.toWalletId ? await storage.getWallet(tx.toWalletId) : null;
                let tagInfo = null;
                let orgInfo = null;

                if (toWallet) {
                    const allTags = await storage.getAllTags();
                    const tag = allTags.find(t => t.walletId === toWallet.id);
                    if (tag) {
                        tagInfo = {
                            tagCode: tag.tagCode,
                            beneficiaryName: tag.beneficiaryName,
                            beneficiaryType: tag.beneficiaryType
                        };

                        if (tag.organizationId) {
                            const org = await storage.getOrganization(tag.organizationId);
                            if (org) {
                                orgInfo = {
                                    id: org.id,
                                    name: org.name,
                                    smartContractAddress: org.smartContractAddress,
                                    blockchainNetwork: org.blockchainNetwork
                                };
                            }
                        }
                    }
                }

                return {
                    id: tx.id,
                    ts: tx.ts,
                    amount: tx.amount,
                    currency: tx.currency || 'ZAR',
                    tagInfo,
                    orgInfo,
                    blockchainTxHash: tx.blockchainTxHash,
                    blockchainNetwork: tx.blockchainNetwork
                };
            })
        );

        res.json({
            donations: enrichedTransactions,
            totalAmount: donorTransactions.reduce((sum, tx) => sum + tx.amount, 0),
            count: donorTransactions.length
        });
    } catch (error) {
        console.error('Track donor error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Track donations and received donations by Freedom Tag account number (tagCode)
router.get('/donor/track/tag/:tagCode', async (req, res) => {
    try {
        const tagCode = req.params.tagCode;
        const allTransactions = await storage.getAllTransactions();

        // Find all donations made BY this tag holder (as donor)
        const donationsMade = allTransactions.filter(
            tx => tx.kind === 'DONATION' && tx.donorTagCode === tagCode
        );

        // Find all donations received TO this tag (as beneficiary)
        const tag = await storage.getTag(tagCode);
        let donationsReceived: any[] = [];

        if (tag) {
            const wallet = await storage.getWallet(tag.walletId);
            if (wallet) {
                donationsReceived = allTransactions.filter(
                    tx => tx.kind === 'DONATION' && tx.toWalletId === wallet.id
                );
            }
        }

        // Enrich donations made
        const enrichedDonationsMade = await Promise.all(
            donationsMade.map(async (tx) => {
                const toWallet = tx.toWalletId ? await storage.getWallet(tx.toWalletId) : null;
                let tagInfo = null;
                let orgInfo = null;

                if (toWallet) {
                    const allTags = await storage.getAllTags();
                    const toTag = allTags.find(t => t.walletId === toWallet.id);
                    if (toTag) {
                        tagInfo = {
                            tagCode: toTag.tagCode,
                            beneficiaryName: toTag.beneficiaryName,
                            beneficiaryType: toTag.beneficiaryType
                        };

                        if (toTag.organizationId) {
                            const org = await storage.getOrganization(toTag.organizationId);
                            if (org) {
                                orgInfo = {
                                    id: org.id,
                                    name: org.name,
                                    smartContractAddress: org.smartContractAddress,
                                    blockchainNetwork: org.blockchainNetwork
                                };
                            }
                        }
                    }
                }

                return {
                    id: tx.id,
                    ts: tx.ts,
                    amount: tx.amount,
                    currency: tx.currency || 'ZAR',
                    type: 'made' as const,
                    tagInfo,
                    orgInfo,
                    blockchainTxHash: tx.blockchainTxHash,
                    blockchainNetwork: tx.blockchainNetwork
                };
            })
        );

        // Enrich donations received
        const enrichedDonationsReceived = await Promise.all(
            donationsReceived.map(async (tx) => {
                let orgInfo = null;

                if (tag?.organizationId) {
                    const org = await storage.getOrganization(tag.organizationId);
                    if (org) {
                        orgInfo = {
                            id: org.id,
                            name: org.name,
                            smartContractAddress: org.smartContractAddress,
                            blockchainNetwork: org.blockchainNetwork
                        };
                    }
                }

                return {
                    id: tx.id,
                    ts: tx.ts,
                    amount: tx.amount,
                    currency: tx.currency || 'ZAR',
                    type: 'received' as const,
                    donorName: tx.donorName,
                    donorEmail: tx.donorEmail,
                    orgInfo,
                    blockchainTxHash: tx.blockchainTxHash,
                    blockchainNetwork: tx.blockchainNetwork
                };
            })
        );

        const tagInfo = tag ? {
            tagCode: tag.tagCode,
            beneficiaryName: tag.beneficiaryName,
            beneficiaryType: tag.beneficiaryType,
            currentBalance: tag.walletId ? (await storage.getWallet(tag.walletId))?.balanceZAR : 0
        } : null;

        res.json({
            tagInfo,
            donationsMade: enrichedDonationsMade,
            donationsReceived: enrichedDonationsReceived,
            totalDonated: donationsMade.reduce((sum, tx) => sum + tx.amount, 0),
            totalReceived: donationsReceived.reduce((sum, tx) => sum + tx.amount, 0),
            countDonated: donationsMade.length,
            countReceived: donationsReceived.length
        });
    } catch (error) {
        console.error('Track by tag error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get donation flow for a specific transaction
router.get('/donor/flow/:transactionId', async (req, res) => {
    try {
        const txId = req.params.transactionId;
        const allTransactions = await storage.getAllTransactions();
        const donation = allTransactions.find(tx => tx.id === txId);

        if (!donation) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const flow = {
            donation: {
                id: donation.id,
                ts: donation.ts,
                amount: donation.amount,
                currency: donation.currency || 'ZAR',
                donorName: donation.donorName,
                donorEmail: donation.donorEmail,
                blockchainTxHash: donation.blockchainTxHash,
                blockchainNetwork: donation.blockchainNetwork
            },
            tag: null as any,
            organization: null as any,
            distributions: [] as any[]
        };

        // Get tag info
        if (donation.toWalletId) {
            const toWallet = await storage.getWallet(donation.toWalletId);
            if (toWallet) {
                const allTags = await storage.getAllTags();
                const tag = allTags.find(t => t.walletId === toWallet.id);
                if (tag) {
                    flow.tag = {
                        tagCode: tag.tagCode,
                        beneficiaryName: tag.beneficiaryName,
                        beneficiaryType: tag.beneficiaryType,
                        currentBalance: toWallet.balanceZAR
                    };

                    // Get organization info
                    if (tag.organizationId) {
                        const org = await storage.getOrganization(tag.organizationId);
                        if (org) {
                            flow.organization = {
                                id: org.id,
                                name: org.name,
                                smartContractAddress: org.smartContractAddress,
                                blockchainNetwork: org.blockchainNetwork
                            };
                        }
                    }

                    // Find distributions from this tag
                    const distributions = allTransactions.filter(
                        tx => tx.kind === 'DISTRIBUTION' && tx.fromWalletId === toWallet.id
                    );

                    flow.distributions = await Promise.all(
                        distributions.map(async (dist) => {
                            const toWallet = dist.toWalletId ? await storage.getWallet(dist.toWalletId) : null;
                            const allTags = await storage.getAllTags();
                            const toTag = toWallet ? allTags.find(t => t.walletId === toWallet.id) : null;

                            return {
                                id: dist.id,
                                ts: dist.ts,
                                amount: dist.amount,
                                toBeneficiary: toTag ? {
                                    tagCode: toTag.tagCode,
                                    beneficiaryName: toTag.beneficiaryName
                                } : null
                            };
                        })
                    );
                }
            }
        }

        res.json(flow);
    } catch (error) {
        console.error('Get flow error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
