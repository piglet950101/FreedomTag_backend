import express from 'express';
import { storage } from '../storage';
import { createSumsubClient } from '../sumsub';

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

      // Regenerate session to prevent fixation attacks
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ error: 'Session error' });
        }
        
        // Create server-side session with donorAuth
        req.session.donorAuth = {
          tagCode: tag.tagCode,
          beneficiaryName: tag.beneficiaryName || '',
        };
        
        // Save session before responding
        req.session.save((err) => {
          if (err) {
            return res.status(500).json({ error: 'Session save error' });
          }
          
          res.json({
            tagCode: tag.tagCode,
            walletId: wallet.id,
            balanceZAR: wallet.balanceZAR,
          });
        });
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
