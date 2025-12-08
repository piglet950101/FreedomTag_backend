import express from 'express';
import { storage } from '../storage';
import { blockkoinClient } from "../blockkoin";


const router = express.Router();


  // ========== Blockkoin Crypto API ==========
  
  // Get real-time exchange rates
  router.get('/blockkoin/rates', async (req, res) => {
    try {
      const targetCurrency = (req.query.target as string) || 'ZAR';
      const rates = await blockkoinClient.getExchangeRates(targetCurrency);
      res.json(rates);
    } catch (error) {
      console.error('Exchange rates error:', error);
      res.status(500).json({ error: 'Failed to fetch exchange rates' });
    }
  });

  // Get supported cryptocurrencies
  router.get('/blockkoin/currencies', async (req, res) => {
    try {
      const currencies = await blockkoinClient.getSupportedCurrencies();
      res.json({ currencies });
    } catch (error) {
      console.error('Currencies error:', error);
      res.status(500).json({ error: 'Failed to fetch currencies' });
    }
  });

  // Check KYC requirement for amount
  router.post('/blockkoin/check-kyc', async (req, res) => {
    try {
      const { amountUSD, userId } = req.body;
      
      if (!userId) {
        return res.json({ requiresKYC: amountUSD > 50, kycStatus: 'none' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const requiresKYC = blockkoinClient.requiresKYC(amountUSD, user.blockkoinKycStatus || 'none');
      
      res.json({
        requiresKYC,
        kycStatus: user.blockkoinKycStatus,
        blockkoinAccountId: user.blockkoinAccountId,
      });
    } catch (error) {
      console.error('KYC check error:', error);
      res.status(500).json({ error: 'Failed to check KYC requirement' });
    }
  });

  // Link Blockkoin account to authenticated user
  router.post('/blockkoin/link', async (req, res) => {
    try {
      if (!req.session?.userAuth) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { accountId } = req.body || {};
      const id = String(accountId || '').trim();

      if (!id || id.length < 3) {
        return res.status(400).json({ error: 'Valid Blockkoin account ID is required' });
      }

      // Optionally check KYC status via Blockkoin API (demo returns 'none')
      let kycStatus: 'none' | 'pending' | 'verified' | 'rejected' = 'none';
      try {
        kycStatus = await blockkoinClient.checkKYCStatus(id);
      } catch (e) {
        // In demo mode or API failure, default to 'none'
        kycStatus = 'none';
      }

      // Persist on user
      const userId = req.session.userAuth.userId;
      await storage.updateUser(userId, {
        blockkoinAccountId: id,
        blockkoinKycStatus: kycStatus,
      });

      const user = await storage.getUser(userId);

      res.json({
        success: true,
        blockkoinAccountId: user?.blockkoinAccountId || id,
        blockkoinKycStatus: user?.blockkoinKycStatus || kycStatus,
      });
    } catch (error) {
      console.error('[Blockkoin Link] Error:', error);
      res.status(500).json({ error: 'Failed to link Blockkoin account' });
    }
  });

export default router;
