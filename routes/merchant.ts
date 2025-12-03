import express from 'express';
import { storage } from '../storage';

const router = express.Router();

  // Merchant operations
  router.post('/merchant/redeem', async (req, res) => {
    try {
      const { merchantOutletId, tagCode, amountZAR } = req.body || {};
      const tag = await storage.getTag(String(tagCode));
      if (!tag) {
        return res.status(404).json({ error: 'unknown tag' });
      }
      
      const outlet = await storage.getMerchantOutlet(String(merchantOutletId));
      if (!outlet) {
        return res.status(404).json({ error: 'outlet not found' });
      }
      
      const tagWallet = await storage.getWallet(tag.walletId);
      const merchantWallet = await storage.getWallet(outlet.walletId);
      
      if (!tagWallet || !merchantWallet) {
        return res.status(404).json({ error: 'wallet not found' });
      }
      
      // Merchant UI sends cents directly (not ZAR), so no conversion needed
      const amountInCents = Number(amountZAR);
      
      if (tagWallet.balanceZAR < amountInCents) {
        return res.status(400).json({ error: 'insufficient tag balance' });
      }
      
      // Update balances (amounts in cents)
      await storage.updateWalletBalance(tagWallet.id, tagWallet.balanceZAR - amountInCents);
      await storage.updateWalletBalance(merchantWallet.id, merchantWallet.balanceZAR + amountInCents);
      
      // Record transaction with outlet tracking (amount in cents)
      await storage.createTransaction({
        kind: 'REDEMPTION',
        fromWalletId: tagWallet.id,
        toWalletId: merchantWallet.id,
        amount: amountInCents,
        merchantOutletId: outlet.id,
      });
      
      res.json({
        ok: true,
        merchantBalanceZAR: merchantWallet.balanceZAR + amountInCents,
      });
    } catch (error) {
      res.status(500).json({ error: 'internal server error' });
    }
  });

  router.post('/merchant/spend', async (req, res) => {
    try {
      const { fromMerchantOutletId, toMerchantOutletId, amountZAR } = req.body || {};
      const fromOutlet = await storage.getMerchantOutlet(String(fromMerchantOutletId));
      const toOutlet = await storage.getMerchantOutlet(String(toMerchantOutletId));
      
      if (!fromOutlet || !toOutlet) {
        return res.status(404).json({ error: 'outlet not found' });
      }
      
      const fromWallet = await storage.getWallet(fromOutlet.walletId);
      const toWallet = await storage.getWallet(toOutlet.walletId);
      
      if (!fromWallet || !toWallet) {
        return res.status(404).json({ error: 'wallet not found' });
      }
      
      // Merchant UI sends cents directly (not ZAR), so no conversion needed
      const amountInCents = Number(amountZAR);
      
      if (fromWallet.balanceZAR < amountInCents) {
        return res.status(400).json({ error: 'insufficient balance' });
      }
      
      // Update balances (amounts in cents)
      await storage.updateWalletBalance(fromWallet.id, fromWallet.balanceZAR - amountInCents);
      await storage.updateWalletBalance(toWallet.id, toWallet.balanceZAR + amountInCents);
      
      // Record transaction (amount in cents)
      await storage.createTransaction({
        kind: 'P2M',
        fromWalletId: fromWallet.id,
        toWalletId: toWallet.id,
        amount: amountInCents,
        merchantOutletId: fromOutlet.id,
      });
      
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: 'internal server error' });
    }
  });

  router.post('/merchant/withdraw', async (req, res) => {
    try {
      const { merchantOutletId, amountZAR } = req.body || {};
      const outlet = await storage.getMerchantOutlet(String(merchantOutletId));
      
      if (!outlet) {
        return res.status(404).json({ error: 'outlet not found' });
      }
      
      const wallet = await storage.getWallet(outlet.walletId);
      
      if (!wallet) {
        return res.status(404).json({ error: 'wallet not found' });
      }
      
      // Merchant UI sends cents directly (not ZAR), so no conversion needed
      const amountInCents = Number(amountZAR);
      
      if (wallet.balanceZAR < amountInCents) {
        return res.status(400).json({ error: 'insufficient balance' });
      }
      
      // Update balance (amounts in cents)
      await storage.updateWalletBalance(wallet.id, wallet.balanceZAR - amountInCents);
      
      // Record transaction (amount in cents)
      await storage.createTransaction({
        kind: 'WITHDRAW',
        fromWalletId: wallet.id,
        amount: amountInCents,
        ref: 'LOCAL:SIM',
        merchantOutletId: outlet.id,
      });
      
      res.json({ ok: true, status: 'SETTLED' });
    } catch (error) {
      res.status(500).json({ error: 'internal server error' });
    }
  });

  
  // Merchant Chain APIs
  router.get('/merchant/chains', async (_req, res) => {
    try {
      const chains = await storage.getAllMerchantChains();
      res.json({ chains });
    } catch (error) {
      res.status(500).json({ error: 'internal server error' });
    }
  });

  router.get('/merchant/chains/:chainId', async (req, res) => {
    try {
      const chain = await storage.getMerchantChain(String(req.params.chainId));
      if (!chain) {
        return res.status(404).json({ error: 'chain not found' });
      }
      res.json(chain);
    } catch (error) {
      res.status(500).json({ error: 'internal server error' });
    }
  });

  router.get('/merchant/chains/:chainId/outlets', async (req, res) => {
    try {
      const outlets = await storage.getMerchantOutletsByChain(String(req.params.chainId));
      const outletsWithBalance = await Promise.all(
        outlets.map(async (outlet) => {
          const wallet = await storage.getWallet(outlet.walletId);
          return {
            id: outlet.id,
            chainId: outlet.chainId,
            walletId: outlet.walletId,
            displayName: outlet.displayName,
            town: outlet.town,
            region: outlet.region,
            address: outlet.address,
            status: outlet.status,
            balanceZAR: wallet?.balanceZAR || 0,
          };
        })
      );
      res.json({ outlets: outletsWithBalance });
    } catch (error) {
      res.status(500).json({ error: 'internal server error' });
    }
  });

  router.get('/merchant/outlets/:outletId', async (req, res) => {
    try {
      const outletIdOrCode = String(req.params.outletId);
      
      // Try to get by code first (if it looks like a code, e.g., OUT001)
      let outlet = await storage.getMerchantOutletByCode(outletIdOrCode);
      
      // If not found by code, try by ID (UUID)
      if (!outlet) {
        outlet = await storage.getMerchantOutlet(outletIdOrCode);
      }
      
      if (!outlet) {
        return res.status(404).json({ error: 'outlet not found' });
      }
      
      const chain = await storage.getMerchantChain(outlet.chainId);
      const wallet = await storage.getWallet(outlet.walletId);
      res.json({
        id: outlet.id,
        name: outlet.displayName,
        chainName: chain?.name || 'Unknown Chain',
        location: `${outlet.town}${outlet.region ? ', ' + outlet.region : ''}`,
        chainId: outlet.chainId,
        walletId: outlet.walletId,
        displayName: outlet.displayName,
        town: outlet.town,
        region: outlet.region,
        address: outlet.address,
        status: outlet.status,
        balanceZAR: wallet?.balanceZAR || 0,
      });
    } catch (error) {
      res.status(500).json({ error: 'internal server error' });
    }
  });

export default router;
