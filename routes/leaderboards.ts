import express from 'express';
import { storage } from '../storage';

const router = express.Router();

// Leaderboards - Only smart contract verified organizations
router.get('/leaderboards/organizations', async (_req, res) => {
    try {
        // Get all organizations with smart contracts
        const orgs = await storage.getAllOrganizations();
        const verifiedOrgs = orgs.filter(org => org.smartContractAddress);

        // Calculate total donations for each verified organization
        const leaderboard = await Promise.all(
            verifiedOrgs.map(async (org) => {
                // Get all tags for this organization
                const tags = await storage.getTagsByOrganization(org.id);

                // Sum all donations to these tags
                let totalDonations = 0;
                const allTransactions = await storage.getAllTransactions();
                for (const tag of tags) {
                    const wallet = await storage.getWallet(tag.walletId);
                    if (wallet) {
                        // Get all transactions TO this wallet
                        const donations = allTransactions
                            .filter(t => t.toWalletId === wallet.id && (t.kind === 'GIVE' || t.kind === 'DONOR'))
                            .reduce((sum, t) => sum + t.amount, 0);
                        totalDonations += donations;
                    }
                }

                return {
                    id: org.id,
                    name: org.name,
                    smartContractAddress: org.smartContractAddress,
                    blockchainNetwork: org.blockchainNetwork || 'Ethereum',
                    totalDonations,
                    tagCount: tags.length,
                };
            })
        );

        // Sort by total donations descending
        const sorted = leaderboard.sort((a, b) => b.totalDonations - a.totalDonations);

        res.json({ organizations: sorted.slice(0, 10) }); // Top 10
    } catch (error) {
        console.error('Organizations leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/leaderboards/tags', async (_req, res) => {
    try {
        const allTags = await storage.getAllTags();
        const allTransactions = await storage.getAllTransactions();

        // Calculate total donations for each tag
        const leaderboard = await Promise.all(
            allTags.map(async (tag) => {
                const wallet = await storage.getWallet(tag.walletId);
                let totalReceived = 0;

                if (wallet) {
                    totalReceived = allTransactions
                        .filter(t => t.toWalletId === wallet.id && (t.kind === 'GIVE' || t.kind === 'DONOR'))
                        .reduce((sum, t) => sum + t.amount, 0);
                }

                // Get organization info if exists
                let organization = null;
                if (tag.organizationId) {
                    organization = await storage.getOrganization(tag.organizationId);
                }

                return {
                    tagCode: tag.tagCode,
                    beneficiaryName: tag.beneficiaryName || 'Anonymous',
                    beneficiaryType: tag.beneficiaryType,
                    totalReceived,
                    organizationName: organization?.name,
                    smartContractVerified: !!organization?.smartContractAddress,
                };
            })
        );

        // Sort by total received descending
        const sorted = leaderboard.sort((a, b) => b.totalReceived - a.totalReceived);

        res.json({ tags: sorted.slice(0, 10) }); // Top 10
    } catch (error) {
        console.error('Tags leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/leaderboards/philanthropists', async (_req, res) => {
    try {
        const allPhilanthropists = await storage.getAllPhilanthropists();
        const allTransactions = await storage.getAllTransactions();

        // Only show non-anonymous philanthropists
        const publicPhilanthropists = allPhilanthropists.filter(p => !p.isAnonymous);

        // Calculate total giving for each
        const leaderboard = await Promise.all(
            publicPhilanthropists.map(async (phil) => {
                const wallet = await storage.getWallet(phil.walletId);
                let totalGiven = 0;

                if (wallet) {
                    totalGiven = allTransactions
                        .filter(t => t.fromWalletId === wallet.id && t.kind === 'GIVE')
                        .reduce((sum, t) => sum + t.amount, 0);
                }

                return {
                    id: phil.id,
                    displayName: phil.displayName || 'Anonymous Donor',
                    totalGiven,
                    country: phil.country,
                };
            })
        );

        // Sort by total given descending
        const sorted = leaderboard.sort((a, b) => b.totalGiven - a.totalGiven);

        res.json({ philanthropists: sorted.slice(0, 10) }); // Top 10
    } catch (error) {
        console.error('Philanthropists leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
