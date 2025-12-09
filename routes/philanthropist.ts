import express from 'express';
import { storage } from '../storage';
import { convertCryptoToZAR } from '../routes';
import { blockkoinClient } from '../blockkoin';
import bcrypt from 'bcrypt';

const router = express.Router();

  // Philanthropist API
  router.post('/philanthropist/signup', async (req, res) => {
    try {
      const bcrypt = await import('bcrypt');
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
              await storage.updateWalletBalance(referrer.walletId, referrerWallet.balanceZAR + rewardAmount);
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

      // Find philanthropist
      const philanthropist = await storage.getPhilanthropistByEmail(String(email));
      if (!philanthropist) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Verify password
      const isValid = await bcrypt.compare(String(password), philanthropist.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Create session
      req.session.regenerate((err) => {
        if (err) {
          console.error('[Philanthropist/Login] Session regenerate error:', err);
          return res.status(500).json({ error: 'Session error', details: process.env.NODE_ENV === 'development' ? String(err) : undefined });
        }

        req.session.philanthropistAuth = {
          philanthropistId: philanthropist.id,
          email: philanthropist.email,
        };

        console.log('[Philanthropist/Login] Session created for philanthropist:', philanthropist.id, 'SessionID:', req.sessionID);

        req.session.save((err) => {
          if (err) {
            console.error('[Philanthropist/Login] Session save error:', err);
            return res.status(500).json({ error: 'Session save error', details: process.env.NODE_ENV === 'development' ? String(err) : undefined });
          }

          console.log('[Philanthropist/Login] Session saved successfully for philanthropist:', philanthropist.id);
          console.log('[Philanthropist/Login] SessionID after save:', req.sessionID);

          // Check what express-session set (for debugging)
          const existingCookie = res.getHeader('set-cookie');
          if (existingCookie) {
            console.log('[Philanthropist/Login] express-session set cookie:', typeof existingCookie === 'string' ? existingCookie : JSON.stringify(existingCookie));
          }

          // ALWAYS manually set cookie with correct cross-origin settings
          // express-session might set it with wrong SameSite, so we override it
          const cookieName = 'freedomtag.sid';
          const cookieValue = req.sessionID;
          const isProduction = process.env.NODE_ENV === 'production' || 
                              process.env.RAILWAY_ENVIRONMENT === 'production' ||
                              process.env.VERCEL === '1';
          const frontendUrl = process.env.FRONTEND_URL || 'https://freedomtag-client.vercel.app';
          const isCrossOrigin = frontendUrl && 
                               (frontendUrl.startsWith('https://') || frontendUrl.startsWith('http://')) &&
                               !frontendUrl.includes('localhost') &&
                               !frontendUrl.includes('127.0.0.1');
          
          const cookieOptions: any = {
            httpOnly: true,
            maxAge: 3600000,
            path: '/',
            secure: isCrossOrigin ? true : isProduction, // Must be true for SameSite=None
            sameSite: isCrossOrigin ? 'none' : 'lax',
          };
          
          // Override any existing cookie with correct settings
          res.cookie(cookieName, cookieValue, cookieOptions);
          console.log('[Philanthropist/Login] Overrode cookie with sameSite:', cookieOptions.sameSite, 'secure:', cookieOptions.secure, 'isCrossOrigin:', isCrossOrigin);

          // Log the Set-Cookie header that will be sent
          res.on('finish', () => {
            const setCookie = res.getHeader('set-cookie');
            console.log('[Philanthropist/Login] Response Set-Cookie:', setCookie ? JSON.stringify(setCookie) : 'NOT SET!');
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
      console.error('Philanthropist login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/philanthropist/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to logout' });
      }
      res.json({ success: true });
    });
  });

  router.get('/philanthropist/me', async (req, res) => {
    try {
      console.log('[Philanthropist/Me] SessionID:', req.sessionID, 'Has philanthropistAuth:', !!req.session.philanthropistAuth);
      
      if (!req.session.philanthropistAuth) {
        console.warn('[Philanthropist/Me] No philanthropistAuth in session. SessionID:', req.sessionID);
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Get philanthropist by ID
      const philanthropist = await storage.getPhilanthropist(req.session.philanthropistAuth.philanthropistId);
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
        balanceZAR: wallet ? wallet.balanceZar : 0,
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
      const newBalance = wallet.balanceZar + (amountZAR * 100);
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
      const newBalance = wallet.balanceZar + (amount * 100);
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
      if (fromWallet.balanceZAR < amountInCents) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // Transfer funds (amounts in cents)
      await storage.updateWalletBalance(fromWallet.id, fromWallet.balanceZAR - amountInCents);
      await storage.updateWalletBalance(toWallet.id, toWallet.balanceZAR + amountInCents);

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
      if (fromWallet.balanceZAR < amountInCents) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // Transfer funds (amounts in cents)
      await storage.updateWalletBalance(fromWallet.id, fromWallet.balanceZAR - amountInCents);
      await storage.updateWalletBalance(toWallet.id, toWallet.balanceZAR + amountInCents);

      // Create transaction record (amount in cents)
      await storage.createTransaction({
        kind: 'PHILANTHROPIST_SPEND',
        fromWalletId: fromWallet.id,
        toWalletId: toWallet.id,
        amount: amountInCents,
        ref: `Payment to ${outlet.name}`,
      });

      res.json({ success: true, amountZAR: amount });
    } catch (error) {
      console.error('Spend philanthropist error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Recurring Donation API endpoints
  router.post('/philanthropist/recurring-donations', async (req, res) => {
    try {
      if (!req.session.philanthropistAuth) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const philanthropist = await storage.getPhilanthropist(req.session.philanthropistAuth.philanthropistId);
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

  router.get('/philanthropist/recurring-donations', async (req, res) => {
    try {
      if (!req.session.philanthropistAuth) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const philanthropist = await storage.getPhilanthropist(req.session.philanthropistAuth.philanthropistId);
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

  router.patch('/philanthropist/recurring-donations/:id', async (req, res) => {
    try {
      if (!req.session.philanthropistAuth) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const philanthropist = await storage.getPhilanthropist(req.session.philanthropistAuth.philanthropistId);
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
