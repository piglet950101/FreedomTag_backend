import express from 'express';
import { storage } from '../storage';
import { convertCryptoToZAR } from '../routes';
import { blockkoinClient } from '../blockkoin';
import bcrypt from 'bcryptjs';
import { getCookieOptions } from '../utils/cookie';
import { generateToken } from '../utils/jwt';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

  // Philanthropist API
  router.post('/philanthropist/signup', async (req, res) => {
    try {
      const bcrypt = await import('bcryptjs');
      const { generateReferralCode, calculateReferralReward } = await import('../utils/referral');
      const { email, password, displayName, referredBy } = req.body || {};
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      // Check if email already exists
      const existingPhilanthropist = await storage.getPhilanthropistByEmail(String(email));
      if (existingPhilanthropist) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(String(password), 10);

      // Create wallet for philanthropist
      const wallet = await storage.createWallet({
        type: 'PHILANTHROPIST',
        name: `${email}'s Wallet`,
        balanceZAR: 0,
      });

      // Generate unique referral code
      const referralCode = generateReferralCode('PHILANTHROPIST', wallet.id);

      // Validate referral code before storing
      let validReferredBy = null;
      let referrer = null;
      if (referredBy) {
        referrer = await storage.lookupReferralCode(String(referredBy));
        if (referrer) {
          validReferredBy = String(referredBy);
        }
      }

      // Create or link Blockkoin account
      let blockkoinAccountId = null;
      let blockkoinKycStatus = 'none';
      
      try {
        const account = await blockkoinClient.createAccount(
          String(email),
          displayName ? String(displayName) : String(email),
          undefined
        );
        blockkoinAccountId = account.id;
        blockkoinKycStatus = account.kycStatus;
      } catch (error) {
        console.error('[Philanthropist Signup] Blockkoin account creation failed:', error);
        // Continue with signup even if Blockkoin fails
      }

      // Create philanthropist account
      const philanthropist = await storage.createPhilanthropist({
        email: String(email),
        passwordHash,
        displayName: displayName ? String(displayName) : null,
        walletId: wallet.id,
        isAnonymous: 1,
        country: null,
        referralCode,
        referredBy: validReferredBy,
        blockkoinAccountId: blockkoinAccountId || null,
        blockkoinKycStatus: blockkoinKycStatus || 'none',
      });

      // If referred by someone valid, create referral record and pay reward
      if (referrer && validReferredBy) {
        const rewardAmount = calculateReferralReward(referrer.type, 'PHILANTHROPIST');
        let rewardPaid = 0;
        
        // Award bonus to referrer's wallet (if they have one)
        if (referrer.walletId) {
          try {
            const referrerWallet = await storage.getWallet(referrer.walletId);
            if (referrerWallet) {
              await storage.updateWalletBalance(referrer.walletId, ((referrerWallet as any).balanceZar || referrerWallet.balanceZAR || 0) + rewardAmount);
              rewardPaid = 1; // Mark as paid only if wallet credit succeeded
            }
          } catch (error) {
            console.error('Failed to pay referral reward:', error);
          }
        }

        // Create referral tracking with accurate reward status
        await storage.createReferral({
          referrerCode: validReferredBy,
          referrerType: referrer.type,
          referredCode: referralCode,
          referredType: 'PHILANTHROPIST',
          rewardAmount,
          rewardPaid,
        });
      }

      // Create session
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ error: 'Session error' });
        }

        req.session.philanthropistAuth = {
          philanthropistId: philanthropist.id,
          email: philanthropist.email,
        };

        req.session.save((err) => {
          if (err) {
            return res.status(500).json({ error: 'Session save error' });
          }

          // Set cookie with correct options for localhost vs production
          const cookieOptions = getCookieOptions(req);
          res.cookie('freedomtag.sid', req.sessionID, cookieOptions);
          console.log('[Philanthropist/Signup] Set cookie:', {
            sameSite: cookieOptions.sameSite,
            secure: cookieOptions.secure,
            isLocalhost: cookieOptions.sameSite === 'lax'
          });

          res.json({
            id: philanthropist.id,
            email: philanthropist.email,
            displayName: philanthropist.displayName,
            walletId: philanthropist.walletId,
            referralCode: philanthropist.referralCode,
          });
        });
      });
    } catch (error) {
      console.error('Philanthropist signup error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/philanthropist/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      console.log('[Philanthropist/Login] Attempting login for email:', email);

      // Find philanthropist
      const philanthropist = await storage.getPhilanthropistByEmail(String(email));
      if (!philanthropist) {
        console.warn('[Philanthropist/Login] No philanthropist found for email:', email);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Verify password
      const isValid = await bcrypt.compare(String(password), philanthropist.passwordHash);
      if (!isValid) {
        console.warn('[Philanthropist/Login] Password mismatch for email:', email);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      console.log('[Philanthropist/Login] Password verified for philanthropist:', philanthropist.id);

      // Generate JWT token
      const token = generateToken({ 
        philanthropistId: philanthropist.id, 
        email: philanthropist.email,
        type: 'philanthropist'
      });

      console.log('[Philanthropist/Login] JWT token generated for philanthropist:', philanthropist.id);

      // Set token in cookie (optional, for convenience)
      const cookieOptions = getCookieOptions(req);
      res.cookie('authToken', token, {
        ...cookieOptions,
        httpOnly: false, // Allow client-side access for Authorization header
      });

      res.json({
        token, // Send token in response body (primary method)
        id: philanthropist.id,
        email: philanthropist.email,
        displayName: philanthropist.displayName,
        walletId: philanthropist.walletId,
        referralCode: philanthropist.referralCode,
        expiresIn: '7d', // Match JWT_EXPIRES_IN default
      });
    } catch (error) {
      console.error('[Philanthropist/Login] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/philanthropist/logout', (req, res) => {
    // JWT is stateless, so logout is handled client-side by removing the token
    // Clear the authToken cookie if it exists
    res.clearCookie('authToken', {
      httpOnly: false,
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      sameSite: 'lax',
      path: '/',
    });
    
    console.log('[Philanthropist/Logout] Logout successful');
    res.json({ success: true, message: 'Logged out successfully' });
  });

  router.get('/philanthropist/me', authenticateJWT, async (req, res) => {
    try {
      console.log('[Philanthropist/Me] Request received. User:', req.user);
      
      if (!req.user || !req.user.philanthropistId) {
        console.log('[Philanthropist/Me] Missing user or philanthropistId. User:', req.user);
        return res.status(401).json({ error: 'Not authenticated' });
      }

      console.log('[Philanthropist/Me] Fetching philanthropist with ID:', req.user.philanthropistId);
      // Get philanthropist by ID
      const philanthropist = await storage.getPhilanthropist(req.user.philanthropistId);
      if (!philanthropist) {
        return res.status(404).json({ error: 'Philanthropist not found' });
      }

      const wallet = await storage.getWallet(philanthropist.walletId);
      res.json({
        id: philanthropist.id,
        email: philanthropist.email,
        displayName: philanthropist.displayName,
        bio: philanthropist.bio,
        walletId: philanthropist.walletId,
        // balanceZAR: wallet?.balanceZAR || 0,
        balanceZAR: wallet ? ((wallet as any).balanceZar || wallet.balanceZAR || 0) : 0,
        isAnonymous: philanthropist.isAnonymous,
        referralCode: philanthropist.referralCode,
        country: philanthropist.country,
        blockkoinAccountId: philanthropist.blockkoinAccountId,
        blockkoinKycStatus: philanthropist.blockkoinKycStatus,
      });
    } catch (error) {
      console.error('Get philanthropist error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/philanthropist/fund', async (req, res) => {
    try {
      if (!req.session.philanthropistAuth) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { crypto, amountCrypto } = req.body || {};
      if (!crypto || amountCrypto === undefined || amountCrypto === null || amountCrypto <= 0) {
        return res.status(400).json({ error: 'Crypto type and amount required' });
      }

      const philanthropist = await storage.getPhilanthropist(req.session.philanthropistAuth.philanthropistId);
      if (!philanthropist) {
        return res.status(404).json({ error: 'Philanthropist not found' });
      }

      // Convert crypto to ZAR
      const amountZAR = convertCryptoToZAR(String(crypto), Number(amountCrypto));
      
      const wallet = await storage.getWallet(philanthropist.walletId);
      if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      // Update wallet balance (convert ZAR to cents)
      const newBalance = ((wallet as any).balanceZar || wallet.balanceZAR || 0) + (amountZAR * 100);
      await storage.updateWalletBalance(wallet.id, newBalance);

      // Create transaction record (amount in cents)
      await storage.createTransaction({
        kind: 'CRYPTO_FUND',
        fromWalletId: null,
        toWalletId: wallet.id,
        amount: amountZAR * 100,
        ref: `Crypto funding: ${amountCrypto} ${crypto}`,
      });

      res.json({ success: true, newBalance, amountZAR });
    } catch (error) {
      console.error('Fund philanthropist error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/philanthropist/fund-fiat', async (req, res) => {
    try {
      if (!req.session.philanthropistAuth) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { method, amountZAR } = req.body || {};
      if (!method || amountZAR === undefined || amountZAR === null || amountZAR <= 0) {
        return res.status(400).json({ error: 'Payment method and amount required' });
      }

      const philanthropist = await storage.getPhilanthropist(req.session.philanthropistAuth.philanthropistId);
      if (!philanthropist) {
        return res.status(404).json({ error: 'Philanthropist not found' });
      }

      const wallet = await storage.getWallet(philanthropist.walletId);
      if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      const amount = Number(amountZAR);

      // Update wallet balance (convert ZAR to cents)
      const newBalance = ((wallet as any).balanceZar || wallet.balanceZAR || 0) + (amount * 100);
      await storage.updateWalletBalance(wallet.id, newBalance);

      // Create transaction record (amount in cents)
      const methodLabel = method === 'card' ? 'Instant Card' : 'Bank Transfer (EFT)';
      await storage.createTransaction({
        kind: 'FIAT_FUND',
        fromWalletId: null,
        toWalletId: wallet.id,
        amount: amount * 100,
        ref: `Fiat funding via Blockkoin (${methodLabel})`,
      });

      res.json({ success: true, newBalance, amountZAR: amount });
    } catch (error) {
      console.error('Fiat fund philanthropist error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/philanthropist/organizations', async (req, res) => {
    try {
      if (!req.session.philanthropistAuth) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Get all organization tags
      const tags = await storage.getAllTags();
      
      const organizations = tags
        // .filter(tag => tag.beneficiaryType === 'organization')
        .map(tag => ({
          tagCode: tag.tagCode,
          name: tag.beneficiaryName,
          description: tag.description || '',
          type: tag.beneficiaryType,
        }));

      res.json({ organizations });
    } catch (error) {
      console.error('List organizations error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/philanthropist/give', async (req, res) => {
    try {
      if (!req.session.philanthropistAuth) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { tagCode, amountZAR, donorName } = req.body || {};
      if (!tagCode || !amountZAR) {
        return res.status(400).json({ error: 'Tag code and amount required' });
      }

      const philanthropist = await storage.getPhilanthropist(req.session.philanthropistAuth.philanthropistId);
      if (!philanthropist) {
        return res.status(404).json({ error: 'Philanthropist not found' });
      }

      const tag = await storage.getTag(String(tagCode));
      if (!tag) {
        return res.status(404).json({ error: 'Tag not found' });
      }

      const fromWallet = await storage.getWallet(philanthropist.walletId);
      const toWallet = await storage.getWallet(tag.walletId);

      if (!fromWallet || !toWallet) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      const amount = Number(amountZAR);
      const amountInCents = amount * 100;
      const fromBalance = (fromWallet as any).balanceZar || fromWallet.balanceZAR || 0;
      const toBalance = (toWallet as any).balanceZar || toWallet.balanceZAR || 0;
      
      if (fromBalance < amountInCents) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // Transfer funds (amounts in cents)
      await storage.updateWalletBalance(fromWallet.id, fromBalance - amountInCents);
      await storage.updateWalletBalance(toWallet.id, toBalance + amountInCents);

      // Create transaction record with optional donor name (amount in cents)
      const donationRef = donorName 
        ? `Donation from ${donorName} to ${tag.tagCode}`
        : `Anonymous donation to ${tag.tagCode}`;
      
      const transaction = await storage.createTransaction({
        kind: 'PHILANTHROPIST_DONATION',
        fromWalletId: fromWallet.id,
        toWalletId: toWallet.id,
        amount: amountInCents,
        ref: donationRef,
      });

      res.json({ success: true, amountZAR: amount, transaction });
    } catch (error) {
      console.error('Give philanthropist error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/philanthropist/spend', async (req, res) => {
    try {
      if (!req.session.philanthropistAuth) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { outletId, amountZAR } = req.body || {};
      if (!outletId || !amountZAR) {
        return res.status(400).json({ error: 'Outlet ID and amount required' });
      }

      const philanthropist = await storage.getPhilanthropist(req.session.philanthropistAuth.philanthropistId);
      if (!philanthropist) {
        return res.status(404).json({ error: 'Philanthropist not found' });
      }

      // Try to get by code first, then by ID
      let outlet = await storage.getMerchantOutletByCode(String(outletId));
      if (!outlet) {
        outlet = await storage.getMerchantOutlet(String(outletId));
      }
      if (!outlet) {
        return res.status(404).json({ error: 'Merchant outlet not found' });
      }

      const fromWallet = await storage.getWallet(philanthropist.walletId);
      const toWallet = await storage.getWallet(outlet.walletId);

      if (!fromWallet || !toWallet) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      const amount = Number(amountZAR);
      const amountInCents = amount * 100;
      const fromBalance = (fromWallet as any).balanceZar || fromWallet.balanceZAR || 0;
      const toBalance = (toWallet as any).balanceZar || toWallet.balanceZAR || 0;
      
      if (fromBalance < amountInCents) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // Transfer funds (amounts in cents)
      await storage.updateWalletBalance(fromWallet.id, fromBalance - amountInCents);
      await storage.updateWalletBalance(toWallet.id, toBalance + amountInCents);

      // Create transaction record (amount in cents)
      await storage.createTransaction({
        kind: 'PHILANTHROPIST_SPEND',
        fromWalletId: fromWallet.id,
        toWalletId: toWallet.id,
        amount: amountInCents,
        ref: `Payment to ${outlet.displayName}`,
      });

      res.json({ success: true, amountZAR: amount });
    } catch (error) {
      console.error('Spend philanthropist error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Recurring Donation API endpoints (using JWT)
  router.post('/philanthropist/recurring-donations', authenticateJWT, async (req, res) => {
    try {
      if (!req.user || !req.user.philanthropistId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const philanthropist = await storage.getPhilanthropist(req.user.philanthropistId);
      if (!philanthropist) {
        return res.status(404).json({ error: 'Philanthropist not found' });
      }

      const { recipientType, recipientId, amountUSD, cryptocurrency, donorName, autoDonatesDust, dustThresholdUSD } = req.body || {};
      
      if (!recipientType || !recipientId || !amountUSD || !cryptocurrency) {
        return res.status(400).json({ error: 'Recipient type, recipient ID, amount, and cryptocurrency required' });
      }

      // Verify recipient exists
      if (recipientType === 'TAG') {
        const tag = await storage.getTag(recipientId);
        if (!tag) {
          return res.status(404).json({ error: 'Tag not found' });
        }
      } else if (recipientType === 'ORGANIZATION') {
        const org = await storage.getOrganization(recipientId);
        if (!org) {
          return res.status(404).json({ error: 'Organization not found' });
        }
      }

      // Calculate next processing date (first of next month)
      const nextDate = new Date();
      nextDate.setMonth(nextDate.getMonth() + 1);
      nextDate.setDate(1);
      nextDate.setHours(0, 0, 0, 0);

      const donation = await storage.createRecurringDonation({
        philanthropistId: philanthropist.id,
        recipientType: recipientType as 'TAG' | 'ORGANIZATION',
        recipientId,
        amountCents: Math.round(Number(amountUSD) * 100), // USD cents
        cryptocurrency: cryptocurrency || 'USDT',
        frequency: 'monthly',
        status: 'active',
        autoDonatesDust: autoDonatesDust ? 1 : 0,
        dustThresholdCents: dustThresholdUSD ? Math.round(Number(dustThresholdUSD) * 100) : 100,
        donorName: donorName || null,
        nextProcessingDate: nextDate,
      });

      res.json({ success: true, donation });
    } catch (error) {
      console.error('Create recurring donation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/philanthropist/recurring-donations', authenticateJWT, async (req, res) => {
    try {
      if (!req.user || !req.user.philanthropistId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const philanthropist = await storage.getPhilanthropist(req.user.philanthropistId);
      if (!philanthropist) {
        return res.status(404).json({ error: 'Philanthropist not found' });
      }

      const donations = await storage.getRecurringDonationsByPhilanthropist(philanthropist.id);
      res.json(donations);
    } catch (error) {
      console.error('Get recurring donations error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/philanthropist/recurring-donations/:id', authenticateJWT, async (req, res) => {
    try {
      if (!req.user || !req.user.philanthropistId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const philanthropist = await storage.getPhilanthropist(req.user.philanthropistId);
      if (!philanthropist) {
        return res.status(404).json({ error: 'Philanthropist not found' });
      }

      const donation = await storage.getRecurringDonation(req.params.id);
      if (!donation || donation.philanthropistId !== philanthropist.id) {
        return res.status(404).json({ error: 'Recurring donation not found' });
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
