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

export default router;
