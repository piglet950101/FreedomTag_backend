import express from 'express';
import { storage } from '../storage';

const router = express.Router();

  // Charity/Organization Signup API
  router.post('/charity/signup', async (req, res) => {
    try {
      const bcrypt = await import('bcryptjs');
      const { generateReferralCode, calculateReferralReward } = await import('../utils/referral');
      const {
        organizationName,
        email,
        password,
        description,
        website,
        facebook,
        twitter,
        instagram,
        linkedin,
        logoUrl,
        referralCode: referredBy
      } = req.body || {};

      if (!organizationName || !email || !password) {
        return res.status(400).json({ error: 'Organization name, email, and password required' });
      }

      // Check if email already exists
      const existingOrg = await storage.getOrganizationByEmail(String(email));
      if (existingOrg) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(String(password), 10);

      // Create wallet for organization
      const wallet = await storage.createWallet({
        type: 'TAG',
        name: `${organizationName} Wallet`,
        balanceZAR: 0,
      });

      // Generate unique tag code (org ID will be used as tag code prefix)
      const orgId = `ORG${Date.now()}`;
      const tagCode = `CH${orgId.slice(-6).toUpperCase()}`;

      // Generate unique referral code for the organization
      const orgReferralCode = generateReferralCode('ORGANIZATION', wallet.id);

      // Validate referral code before storing
      let validReferredBy = null;
      let referrer = null;
      if (referredBy) {
        referrer = await storage.lookupReferralCode(String(referredBy));
        if (referrer) {
          validReferredBy = String(referredBy);
        }
      }

      // Create organization
      const organization = await storage.createOrganization({
        name: String(organizationName),
        type: 'charity',
        country: null,
        taxId: null,
        charityRegistrationNumber: null,
        taxExemptStatus: 'pending',
        referralCode: orgReferralCode,
        referredBy: validReferredBy,
        website: website || null,
        facebook: facebook || null,
        twitter: twitter || null,
        instagram: instagram || null,
        linkedin: linkedin || null,
        description: description || null,
        logoUrl: logoUrl || null,
        email: String(email),
        passwordHash,
      });

      // Create primary tag for the organization
      const tag = await storage.createTag({
        tagCode,
        walletId: wallet.id,
        pin: null,
        organizationId: organization.id,
        beneficiaryType: 'charity',
        beneficiaryName: String(organizationName),
        verificationStatus: 'pending',
        referralCode: orgReferralCode, // Same referral code as org
        referredBy: validReferredBy,
        website: website || null,
        facebook: facebook || null,
        twitter: twitter || null,
        instagram: instagram || null,
        linkedin: linkedin || null,
        description: description || null,
        logoUrl: logoUrl || null,
      });

      // If referred by someone valid, create referral record and pay rewards
      if (referrer && validReferredBy) {
        const referrerReward = calculateReferralReward(referrer.type, 'ORGANIZATION');
        const refereeReward = 2000; // R20 for new charity
        let rewardPaid = 0;

        // Award bonus to referrer's wallet (if they have one)
        if (referrer.walletId) {
          try {
            const referrerWallet = await storage.getWallet(referrer.walletId);
            if (referrerWallet) {
              await storage.updateWalletBalance(referrer.walletId, referrerWallet.balanceZAR + referrerReward);

              // Give R20 bonus to new charity
              await storage.updateWalletBalance(wallet.id, wallet.balanceZAR + refereeReward);

              rewardPaid = 1; // Mark as paid only if both wallet credits succeeded
            }
          } catch (error) {
            console.error('Failed to pay referral reward:', error);
          }
        }

        // Create referral tracking with accurate reward status
        await storage.createReferral({
          referrerCode: validReferredBy,
          referrerType: referrer.type,
          referredCode: orgReferralCode,
          referredType: 'ORGANIZATION',
          rewardAmount: referrerReward,
          rewardPaid,
        });
      }

      res.json({
        organizationId: organization.id,
        tagCode: tag.tagCode,
        referralCode: orgReferralCode,
        walletId: wallet.id,
      });
    } catch (error) {
      console.error('Charity signup error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Charity/Organization Login API
  router.post('/charity/login', async (req, res) => {
    try {
      const bcrypt = await import('bcryptjs');
      const { email, password } = req.body || {};

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      // Check if email exists as a user (beneficiary) first
      const user = await storage.getUserByEmail(String(email));
      if (user) {
        // Email exists as a beneficiary, not as a charity
        return res.status(401).json({ error: 'This email is registered as a beneficiary, not as a charity. Please use the beneficiary login page.' });
      }

      // Find organization by email
      const organization = await storage.getOrganizationByEmail(String(email));
      if (!organization) {
        return res.status(401).json({ error: 'This email is not registered as a charity. Please check your email or sign up as a charity.' });
      }

      // Verify password
      if (!organization.passwordHash) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const isValid = await bcrypt.compare(String(password), String(organization.passwordHash));
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Find primary tag for organization
      const tags = await storage.getTagsByOrganization(organization.id);
      const primaryTag = tags.find((t: any) => t.beneficiaryType === 'charity' || t.beneficiaryType === 'organization');

      // Get wallet info
      let walletInfo: any = null;
      if (primaryTag?.walletId) {
        const wallet = await storage.getWallet(primaryTag.walletId);
        if (wallet) {
          walletInfo = {
            walletId: wallet.id,
            balanceZAR: wallet.balanceZAR,
          };
        }
      }

      // Optionally create a lightweight session for org login (separate from user)
      try {
        req.session.regenerate(() => {
          (req.session as any).organizationAuth = {
            organizationId: organization.id,
            email: organization.email,
            name: organization.name,
          };
          req.session.save(() => {});
        });
      } catch (_) {}

      return res.json({
        organizationId: organization.id,
        organizationName: organization.name,
        tagCode: primaryTag?.tagCode || null,
        referralCode: organization.referralCode || null,
        wallet: walletInfo,
      });
    } catch (error) {
      console.error('Charity login error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Charity Credibility API
  router.get('/charity/credibility/:charityCode', async (req, res) => {
    try {
      const { charityCode } = req.params;
      const referralCode = req.query.ref as string | undefined;

      // Find charity by tag code or organization ID
      const tags = await storage.getAllTags();
      const tag = tags.find(t =>
        t.tagCode === charityCode ||
        t.organizationId === charityCode ||
        t.referralCode === charityCode
      );

      if (!tag || !tag.organizationId) {
        return res.status(404).json({ error: 'Charity not found' });
      }

      const organization = await storage.getOrganization(tag.organizationId);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const wallet = await storage.getWallet(tag.walletId);
      if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      // Get all transactions for this charity
      const allTransactions = await storage.getAllTransactions();
      const charityTransactions = allTransactions.filter(tx =>
        tx.toWalletId === tag.walletId &&
        (tx.kind === 'DONATION' || tx.kind === 'PHILANTHROPIST_DONATION' || tx.kind === 'CRYPTO_FUND' || tx.kind === 'FIAT_FUND')
      );

      // Calculate total donations
      const totalDonations = charityTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      const donationCount = charityTransactions.length;

      // Get recent donations (last 10)
      const recentDonations = charityTransactions
        .sort((a, b) => new Date(b.ts || '').getTime() - new Date(a.ts || '').getTime())
        .slice(0, 10)
        .map(tx => ({
          id: tx.id,
          amount: tx.amount,
          date: tx.ts ? new Date(tx.ts).toISOString() : new Date().toISOString(),
          fromPhilanthropist: tx.fromWalletId ? 'Anonymous Donor' : undefined,
          fromAnonymous: true,
        }));

      // Get referrer info if referral code provided
      let referrer = null;
      if (referralCode) {
        const referrerData = await storage.lookupReferralCode(referralCode);
        if (referrerData) {
          // Calculate how much this referrer has donated to this charity
          const referrerDonations = charityTransactions.filter(tx =>
            tx.fromWalletId === referrerData.walletId
          );
          const totalDonated = referrerDonations.reduce((sum, tx) => sum + tx.amount, 0);

          referrer = {
            name: referrerData.type === 'PHILANTHROPIST' ? 'Anonymous Philanthropist' : 'Unknown',
            type: referrerData.type,
            totalDonated,
          };
        }
      }

      res.json({
        organization: {
          id: organization.id,
          name: organization.name,
          description: organization.description,
          website: organization.website,
          facebook: organization.facebook,
          twitter: organization.twitter,
          instagram: organization.instagram,
          linkedin: organization.linkedin,
          logoUrl: organization.logoUrl,
        },
        tag: {
          tagCode: tag.tagCode,
          referralCode: tag.referralCode || '',
        },
        wallet: {
          balanceZAR: Number(wallet.balanceZAR) || 0,
        },
        totalDonations,
        donationCount,
        recentDonations,
        referrer,
      });
    } catch (error) {
      console.error('Get charity credibility error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });


export default router;
