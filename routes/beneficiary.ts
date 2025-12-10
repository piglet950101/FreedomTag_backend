import express from 'express';
import { storage } from '../storage';
import { createSumsubClient } from '../sumsub';
import { getCookieOptions } from '../utils/cookie';
import { generateToken } from '../utils/jwt';
import { authenticateJWT, optionalJWT } from '../middleware/auth';

const router = express.Router();

  // Beneficiary authentication endpoints
  router.post('/beneficiary/verify-pin', async (req, res) => {
    try {
      const { tagCode, pin } = req.body || {};
      if (!tagCode || !pin) {
        return res.status(400).json({ error: 'tagCode and pin required' });
      }
      
      const tag = await storage.getTag(String(tagCode));
      console.log('PIN login attempt for tag:', tagCode);

      
      console.log('Verifying PIN for tag:', tagCode);
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
          
          // Return beneficiary info and balance
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
  
  router.post('/beneficiary/biometric-login', async (req, res) => {
    try {
      const { tagCode } = req.body || {};
      if (!tagCode) {
        return res.status(400).json({ error: 'tagCode required' });
      }
      
      const tag = await storage.getTag(String(tagCode));
      if (!tag) {
        return res.status(404).json({ error: 'Tag not found' });
      }
      
      // Check if tag has biometric enrollment (Sumsub verification)
      if (!tag.sumsubApplicantId || tag.verificationStatus !== 'approved') {
        return res.status(400).json({ 
          error: 'Biometric login not available. Please complete registration first or use PIN login.' 
        });
      }
      
      // Generate new access token for biometric login
      const sumsubModule = await import('../sumsub');
      const sumsubClient = sumsubModule.createSumsubClient();
      
      const tokenData = await sumsubClient.generateAccessToken(
        tag.sumsubApplicantId,
        String(tagCode)
      );
      
      const verificationUrl = sumsubClient.getSdkUrl(tag.sumsubApplicantId, tokenData.token);
      
      // Append tag code to verification URL for biometric login flow
      const urlWithTag = `${verificationUrl}&tagCode=${tagCode}`;
      
      res.json({
        verificationUrl: urlWithTag,
        accessToken: tokenData.token,
        beneficiaryName: tag.beneficiaryName,
      });
    } catch (error) {
      console.error('[Biometric Login] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Complete biometric login after verification (creates server-side session)
  router.post('/beneficiary/biometric-complete', async (req, res) => {
    try {
      const { tagCode } = req.body || {};
      if (!tagCode) {
        return res.status(400).json({ error: 'tagCode required' });
      }
      
      const tag = await storage.getTag(String(tagCode));
      if (!tag) {
        return res.status(404).json({ error: 'Tag not found' });
      }
      
      // Verify tag has approved biometric verification
      if (!tag.sumsubApplicantId || tag.verificationStatus !== 'approved') {
        return res.status(400).json({ 
          error: 'Biometric verification not approved' 
        });
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
          
          // Return beneficiary info and balance
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
      console.error('[Biometric Complete] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

    // Beneficiary (Tag holder) operations
  // Get current beneficiary (using JWT)
  router.get('/beneficiary/me', optionalJWT, async (req, res) => {
    try {
      console.log('[Beneficiary/Me] JWT payload:', req.user);
      
      let tag = null;
      let user = null;
      let isBeneficiary = false;
      
      // Check JWT token first
      if (req.user) {
        console.log('[Beneficiary/Me] JWT user data:', { 
          hasTagCode: !!req.user.tagCode, 
          hasUserId: !!req.user.userId,
          tagCode: req.user.tagCode,
          userId: req.user.userId 
        });
        
        if (req.user.tagCode) {
          // Tag/PIN login
          console.log('[Beneficiary/Me] Tag/PIN login - looking for tag:', req.user.tagCode);
          tag = await storage.getTag(req.user.tagCode);
          console.log('[Beneficiary/Me] Tag found:', tag ? tag.tagCode : 'NOT FOUND');
        } else if (req.user.userId) {
          // Email/password login
          console.log('[Beneficiary/Me] Email/password login - looking for user:', req.user.userId);
          user = await storage.getUser(req.user.userId);
          if (!user) {
            console.log('[Beneficiary/Me] User not found:', req.user.userId);
            return res.status(404).json({ error: 'User not found' });
          }
          
          console.log('[Beneficiary/Me] User found:', { id: user.id, email: user.email });
          
          // Get user roles
          const roles = await storage.getUserRoles(user.id);
          isBeneficiary = roles.some((r: any) => r.role === 'BENEFICIARY');
          console.log('[Beneficiary/Me] User roles:', roles.map((r: any) => r.role), 'isBeneficiary:', isBeneficiary);
          
          if (!isBeneficiary) {
            return res.status(403).json({ error: 'User does not have BENEFICIARY role' });
          }
          
          // Get user's beneficiary tag (may not exist)
          console.log('[Beneficiary/Me] Looking for tag by userId:', user.id);
          const beneficiaryTag = await storage.getTagByUserId(user.id);
          console.log('[Beneficiary/Me] Tag found by userId:', beneficiaryTag ? beneficiaryTag.tagCode : 'NOT FOUND');
          tag = beneficiaryTag || null;
        }
      }
      
      // If no user and no tag, return 401 (not authenticated)
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // If user exists but no tag, return response indicating no tag
      if (user && isBeneficiary && !tag) {
        return res.json({
          tagCode: null,
          beneficiaryName: user.fullName || user.email || '',
          walletId: null,
          balanceZAR: 0,
          blockkoinAccountId: user.blockkoinAccountId || null,
          blockkoinKycStatus: user.blockkoinKycStatus || 'none',
          hasTag: false,
        });
      }

      // If no tag at this point, return 401
      if (!tag) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const wallet = await storage.getWallet(tag.walletId);
      if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      // Get user info if tag is linked to a user (for Blockkoin account)
      let blockkoinAccountId = null;
      let blockkoinKycStatus = 'none';
      if (tag.userId) {
        const tagUser = await storage.getUser(tag.userId);
        if (tagUser) {
          blockkoinAccountId = tagUser.blockkoinAccountId || null;
          blockkoinKycStatus = tagUser.blockkoinKycStatus || 'none';
        }
      }

      res.json({
        tagCode: tag.tagCode || null,
        beneficiaryName: tag.beneficiaryName || '',
        walletId: wallet.id,
        balanceZAR: (wallet as any).balanceZar || wallet.balanceZAR || 0,
        blockkoinAccountId,
        blockkoinKycStatus,
        hasTag: true,
      });
    } catch (error) {
      console.error('Get beneficiary error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/beneficiary/logout', (req, res) => {
    // JWT is stateless, so logout is handled client-side by removing the token
    // Clear the authToken cookie if it exists with proper options
    const cookieOptions = getCookieOptions(req);
    res.clearCookie('authToken', {
      httpOnly: false, // Must match how cookie was set
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite as any,
      path: '/',
    });
    console.log('[Beneficiary/Logout] Logout successful');
    res.json({ success: true, message: 'Logged out successfully' });
  });

  router.post('/beneficiary/login', async (req, res) => {
    try {
      const { tagCode, pin } = req.body || {};
      if (!tagCode || !pin) {
        return res.status(400).json({ error: 'tagCode and pin required' });
      }

      const tag = await storage.getTag(String(tagCode));
      if (!tag) {
        return res.status(404).json({ error: 'tag not found' });
      }

      if (tag.pin !== String(pin)) {
        return res.status(401).json({ error: 'invalid pin' });
      }

      const wallet = await storage.getWallet(tag.walletId);
      if (!wallet) {
        return res.status(404).json({ error: 'wallet not found' });
      }

      // Generate JWT token
      const token = generateToken({
        tagCode: tag.tagCode,
        email: tag.beneficiaryName || tag.tagCode,
        type: 'beneficiary',
      });

      console.log('[Beneficiary/Login] JWT token generated for tag:', tag.tagCode);

      // Set token in cookie and send in response
      const cookieOptions = getCookieOptions(req);
      res.cookie('authToken', token, {
        ...cookieOptions,
        httpOnly: false, // Allow client-side access
      });

      res.json({
        token, // Also send token in response body
        tagCode: tag.tagCode,
        walletId: wallet.id,
        balanceZAR: (wallet as any).balanceZar || wallet.balanceZAR || 0,
      });
    } catch (error) {
      res.status(500).json({ error: 'internal server error' });
    }
  });

  router.post('/beneficiary/transfer', async (req, res) => {
    try {
      const { fromTagCode, toTagCode, amountZAR } = req.body || {};
      
      const fromTag = await storage.getTag(String(fromTagCode));
      const toTag = await storage.getTag(String(toTagCode));
      
      if (!fromTag || !toTag) {
        return res.status(404).json({ error: 'tag not found' });
      }
      
      const fromWallet = await storage.getWallet(fromTag.walletId);
      const toWallet = await storage.getWallet(toTag.walletId);
      
      if (!fromWallet || !toWallet) {
        return res.status(404).json({ error: 'wallet not found' });
      }
      
      const amount = Number(amountZAR);
      const amountInCents = amount * 100;
      
      if (fromWallet.balanceZAR < amountInCents) {
        return res.status(400).json({ error: 'insufficient balance' });
      }
      
      // Update balances (amounts in cents)
      await storage.updateWalletBalance(fromWallet.id, fromWallet.balanceZAR - amountInCents);
      await storage.updateWalletBalance(toWallet.id, toWallet.balanceZAR + amountInCents);
      
      // Record transaction (amount in cents)
      await storage.createTransaction({
        kind: 'P2P',
        fromWalletId: fromWallet.id,
        toWalletId: toWallet.id,
        amount: amountInCents,
      });
      
      res.json({
        ok: true,
        newBalance: fromWallet.balanceZAR - amountInCents,
      });
    } catch (error) {
      res.status(500).json({ error: 'internal server error' });
    }
  });

    // Change PIN endpoint (beneficiary must be authenticated)
  router.post('/beneficiary/change-pin', async (req, res) => {
    try {
      const { currentPin, newPin } = req.body || {};
      
      if (!currentPin || !newPin) {
        return res.status(400).json({ error: 'Current PIN and new PIN required' });
      }

      // Check beneficiary auth session
      if (!req.session.beneficiary?.tagCode) {
        return res.status(401).json({ error: 'Not authenticated. Please login first.' });
      }

      const tagCode = req.session.beneficiary.tagCode;
      const tag = await storage.getTag(tagCode);
      
      if (!tag) {
        return res.status(404).json({ error: 'Tag not found' });
      }

      // Verify current PIN
      if (tag.pin !== String(currentPin)) {
        return res.status(401).json({ error: 'Current PIN is incorrect' });
      }

      // Update to new PIN
      await storage.updateTagPin(tagCode, String(newPin));

      res.json({ success: true, message: 'PIN changed successfully' });
    } catch (error) {
      console.error('Change PIN error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

export default router;
