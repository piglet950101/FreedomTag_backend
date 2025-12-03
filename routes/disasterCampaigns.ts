import express from 'express';
import { storage } from '../storage';

const router = express.Router();


// ========== Disaster Relief Campaigns (Dusty Bin) API ==========

// Get current month's disaster campaigns with voting status
router.get('/disaster-campaigns/current', async (req, res) => {
  try {
    const currentMonthYear = new Date().toISOString().slice(0, 7);
    const userId = req.session.userAuth?.userId;

    const campaigns = await storage.getDisasterCampaignsByMonth(currentMonthYear);
    const totalDustUsd = await storage.getTotalDustyBinForMonth(currentMonthYear);

    // Enrich with organization data and user vote status
    const enrichedCampaigns = await Promise.all(campaigns.map(async (campaign) => {
      const org = await storage.getOrganizationById(campaign.organizationId);
      const userHasVoted = userId ? await storage.hasUserVotedForCampaign(userId, campaign.id) : false;

      return {
        ...campaign,
        organization: org,
        userHasVoted,
      };
    }));

    res.json({
      campaigns: enrichedCampaigns,
      totalDustUsd,
    });
  } catch (error) {
    console.error('Get disaster campaigns error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Vote for a disaster campaign
router.post('/disaster-campaigns/:id/vote', async (req, res) => {
  try {
    const userId = req.session.userAuth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const campaignId = String(req.params.id);
    const currentMonthYear = new Date().toISOString().slice(0, 7);

    // Check if campaign exists and is active
    const campaign = await storage.getDisasterCampaignById(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.status !== 'active') {
      return res.status(400).json({ error: 'Campaign is not active' });
    }

    // Check if user already voted this month
    const hasVoted = await storage.hasUserVotedForCampaign(userId, campaignId);
    if (hasVoted) {
      return res.status(400).json({ error: 'You have already voted for this campaign' });
    }

    // Record vote
    await storage.createCampaignVote({
      userId,
      campaignId,
      monthYear: currentMonthYear,
    });

    // Increment vote count
    await storage.incrementCampaignVotes(campaignId);

    res.json({ success: true });
  } catch (error) {
    console.error('Vote for campaign error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create disaster relief campaign (organization only, must have smart contract)
router.post('/disaster-campaigns', async (req, res) => {
  try {
    const userId = req.session.userAuth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user's organization
    const userRole = await storage.getUserRoleByUserId(userId, 'ORGANIZATION');
    if (!userRole) {
      return res.status(403).json({ error: 'Organization access required' });
    }

    const org = await storage.getOrganizationById(userRole.entityId!);
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // MUST have smart contract to participate in Dusty Bin
    if (!org.smartContractAddress) {
      return res.status(403).json({
        error: 'Smart contract verification required. Only blockchain-verified organizations can participate in Dusty Bin disaster relief.'
      });
    }

    const { title, description, disasterType, location, urgencyLevel } = req.body;
    const currentMonthYear = new Date().toISOString().slice(0, 7);

    const campaign = await storage.createDisasterCampaign({
      organizationId: org.id,
      title,
      description,
      disasterType,
      location,
      urgencyLevel,
      monthYear: currentMonthYear,
    });

    res.json(campaign);
  } catch (error) {
    console.error('Create disaster campaign error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
