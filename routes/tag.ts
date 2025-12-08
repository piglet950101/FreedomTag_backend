import express from 'express';
import { storage } from '../storage';
import { generateReferralCode, calculateReferralReward } from "../utils/referral";


const router = express.Router();

// PUBLIC endpoint - anyone can view tag information
router.get('/tag/:tagCode', async (req, res) => {
  try {
    const requestedTagCode = String(req.params.tagCode);

    const tag = await storage.getTag(requestedTagCode);
    if (!tag) {
      return res.status(404).json({ error: 'unknown tag' });
    }
    const wallet = await storage.getWallet(tag.walletId);
    console.log('💰 Tag wallet:', wallet ? wallet.balanceZar : 0);
    if (!wallet) {
      return res.status(404).json({ error: 'wallet not found' });
    }
    res.json({
      tagCode: tag.tagCode,
      walletId: wallet.id,
      balanceZAR: wallet ? wallet.balanceZar : 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/tags/list', async (_req, res) => {
  try {
    const allTags = await storage.getAllTags();
    const tagsWithBalance = await Promise.all(
      allTags.map(async (tag) => {
        const wallet = await storage.getWallet(tag.walletId);
        return {
          tagCode: tag.tagCode,
          walletId: tag.walletId,
          balanceZAR: wallet?.balanceZAR || 0,
        };
      })
    );
    res.json({ tags: tagsWithBalance });
  } catch (error) {
    res.status(500).json({ error: 'internal server error' });
  }
});


router.get('/tag/:tagCode/info', async (req, res) => {
  try {
    const tag = await storage.getTag(String(req.params.tagCode));
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    const wallet = await storage.getWallet(tag.walletId);

    res.json({
      tagCode: tag.tagCode,
      beneficiaryName: tag.beneficiaryName || 'Anonymous',
      beneficiaryType: tag.beneficiaryType || 'Individual',
      balanceZAR: wallet?.balanceZAR || 0,
    });
  } catch (error) {
    console.error('Get tag info error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



  // Quick Tag Setup - For street encounters (giver creates tag for receiver)
  router.post('/quick-tag-setup', async (req, res) => {
    try {
      
      const { beneficiaryName, beneficiaryPhone, pin, referredBy, userId: requestUserId } = req.body || {};

      if (!beneficiaryName || !pin) {
        return res.status(400).json({ error: 'Beneficiary name and PIN required' });
      }

      if (String(pin).length !== 4) {
        return res.status(400).json({ error: 'PIN must be 4 digits' });
      }

      // Generate unique tag code (street tags use ST prefix)
      const tagCode = `ST${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Create wallet for the tag
      const wallet = await storage.createWallet({
        type: 'TAG',
        name: `${beneficiaryName}'s Freedom Tag`,
        balanceZAR: 0,
      });

      // Generate referral code for the tag
      const referralCode = generateReferralCode('TAG', wallet.id);

      // Validate referral code if provided
      let validReferredBy = null;
      let referrer = null;
      if (referredBy) {
        referrer = await storage.lookupReferralCode(String(referredBy));
        if (referrer) {
          validReferredBy = String(referredBy);
        }
      }

      // Get logged-in user ID from request body or session
      let userId = requestUserId || null;
      if (!userId && req.session && req.session.userAuth) {
        userId = req.session.userAuth.userId;
      }
      console.log('🔐 Final userId for tag creation:', userId);

      // Create the tag (no organization - this is a street tag)
      const tag = await storage.createTag({
        tagCode,
        walletId: wallet.id,
        userId, // Link to authenticated user if logged in
        pin: String(pin),
        organizationId: null,
        beneficiaryType: 'individual',
        beneficiaryName,
        beneficiaryPhone: beneficiaryPhone || null,
        verificationStatus: 'pending',
        referralCode,
        referredBy: validReferredBy,
      });

      console.log('✅ Tag created:', { tagCode: tag.tagCode, userId: tag.userId, walletId: tag.walletId });

      // If referred by someone, create referral record and pay reward
      if (referrer && validReferredBy) {
        const rewardAmount = calculateReferralReward(referrer.type, 'TAG');
        let rewardPaid = 0;

        if (referrer.walletId) {
          try {
            const referrerWallet = await storage.getWallet(referrer.walletId);
            if (referrerWallet) {
              await storage.updateWalletBalance(referrer.walletId, referrerWallet.balanceZAR + rewardAmount);
              rewardPaid = 1;
            }
          } catch (error) {
            console.error('Failed to pay referral reward:', error);
          }
        }

        await storage.createReferral({
          referrerCode: validReferredBy,
          referrerType: referrer.type,
          referredCode: referralCode,
          referredType: 'TAG',
          rewardAmount,
          rewardPaid,
        });
      }

      res.json({
        success: true,
        tagCode: tag.tagCode,
        beneficiaryName,
        beneficiaryPhone: beneficiaryPhone || null,
        referralCode,
        donationUrl: `/donor?tag=${tag.tagCode}`,
      });
    } catch (error) {
      console.error('Quick tag setup error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Agent Tag Setup - Create tag with biometric verification and default PIN
  router.post('/agent/create-tag', async (req, res) => {
    try {
      const { beneficiaryName, beneficiaryPhone, organizationId, accessCode } = req.body || {};

      if (!beneficiaryName || !organizationId || !accessCode) {
        return res.status(400).json({ error: 'Beneficiary name, organization ID, and access code required' });
      }

      // Get organization to verify it exists and validate access code
      const organization = await storage.getOrganization(String(organizationId));
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      // Validate access code (demo: use org email as access code for simplicity)
      // In production, this would be a secure credential system
      if (accessCode !== organization.email) {
        return res.status(401).json({ error: 'Invalid access code' });
      }

      // Use organization's default PIN (fallback to "1066" if not set)
      const defaultPin = "1066"; // Default PIN for all organizations

      // Generate unique tag code with organization prefix (first 2 letters of name)
      const orgPrefix = organization.name.substring(0, 2).toUpperCase();
      const tagCode = `${orgPrefix}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Create wallet for the tag
      const wallet = await storage.createWallet({
        type: 'TAG',
        name: `${beneficiaryName}'s Freedom Tag`,
        balanceZAR: 0,
      });

      // Generate referral code for the tag
      const referralCode = generateReferralCode('TAG', wallet.id);

      // Initialize Sumsub client
      const sumsubModule = await import('../sumsub');
      const sumsubClient = sumsubModule.createSumsubClient();

      // Create Sumsub applicant for biometric verification
      const nameParts = beneficiaryName.trim().split(' ');
      const firstName = nameParts[0] || beneficiaryName;
      const lastName = nameParts.slice(1).join(' ') || beneficiaryName;

      const applicant = await sumsubClient.createApplicant({
        externalUserId: tagCode,
        firstName,
        lastName,
        email: `${tagCode.toLowerCase()}@freedomtag.blockkoin.io`,
        phone: beneficiaryPhone || undefined,
      });

      // Create the tag with default PIN and Sumsub applicant ID
      const tag = await storage.createTag({
        tagCode,
        walletId: wallet.id,
        pin: defaultPin,
        organizationId,
        beneficiaryType: 'individual',
        beneficiaryName,
        beneficiaryPhone: beneficiaryPhone || null,
        verificationStatus: 'pending',
        referralCode,
        sumsubApplicantId: applicant.id,
      });

      // Generate access token for biometric verification
      const tokenData = await sumsubClient.generateAccessToken(
        applicant.id,
        tagCode
      );

      const verificationUrl = sumsubClient.getSdkUrl(applicant.id, tokenData.token);

      res.json({
        success: true,
        tagCode: tag.tagCode,
        beneficiaryName,
        defaultPin,
        verificationUrl,
        accessToken: tokenData.token,
      });
    } catch (error) {
      console.error('Agent tag setup error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });


export default router;
