import express from 'express';
import { storage } from '../storage';
import { blockkoinClient } from "../blockkoin";
import { log } from 'console';

const router = express.Router();

// ========== Crypto Payment APIs ==========
// PUBLIC crypto donation (no auth required)
router.post('/crypto/public', async (req, res) => {
  try {
    const { tagCode, amountZAR } = req.body || {};
    if (!tagCode || !amountZAR) {
      return res.status(400).json({ error: 'tagCode and amountZAR required' });
    }

    // Validate tag exists (no auth required)
    const tag = await storage.getTag(String(tagCode));
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    const cryptoRef = `DONOR-CRYPTO:${tagCode}:${Date.now()}`;
    res.json({
      cryptoSimUrl: `/crypto/pay?cryptoRef=${encodeURIComponent(cryptoRef)}&tagCode=${encodeURIComponent(tagCode)}&amountZAR=${amountZAR}&source=public`,
      cryptoRef,
    });
  } catch (error) {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/crypto/start', async (req, res) => {
  try {
    const { tagCode, amountZAR } = req.body || {};
    if (!tagCode || !amountZAR) {
      return res.status(400).json({ error: 'tagCode and amountZAR required' });
    }

    // Verify authentication for the tag
    if (!req.session.donorAuth || req.session.donorAuth.tagCode !== tagCode) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate tag exists
    const tag = await storage.getTag(String(tagCode));
    if (!tag) {
      return res.status(404).json({ error: 'unknown tag' });
    }

    const cryptoRef = `CRYPTO:${tagCode}:${Date.now()}`;
    res.json({
      cryptoSimUrl: `/crypto/pay?cryptoRef=${encodeURIComponent(cryptoRef)}&tagCode=${encodeURIComponent(tagCode)}&amountZAR=${amountZAR}`,
      cryptoRef,
    });
  } catch (error) {
    res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/crypto/settle', async (req, res) => {
  try {
    const { cryptoRef, tagCode, amountZAR, crypto, source } = req.body || {};
    const tag = await storage.getTag(String(tagCode));
    if (!tag) {
      return res.status(404).send('unknown tag');
    }
    const wallet = await storage.getWallet(tag.walletId);

    if (!wallet) {
      return res.status(404).send('wallet not found');
    }

    // Update balance (convert ZAR to cents)

    await storage.updateWalletBalance(wallet.id, wallet.balanceZar + (Number(amountZAR) * 100));

    // Record transaction with crypto details (amount in cents)
    await storage.createTransaction({
      kind: 'DONATION',
      toWalletId: wallet.id,
      amount: Number(amountZAR) * 100,
      ref: `${cryptoRef} [${crypto}]`,
    });

    // Redirect based on source
    if (source === 'public') {
      res.redirect(`/donor?paid=1&tagCode=${encodeURIComponent(String(tagCode))}&crypto=${crypto}`);
    } else {
      res.redirect(`/tag/${encodeURIComponent(String(tagCode))}?paid=1&crypto=${crypto}`);
    }
  } catch (error) {
    console.log('Crypto settle error:', error);
    res.status(500).send('internal server error');
  }
});



// ========== Crypto Buy/Sell via Blockkoin ==========

router.post('/crypto/buy', async (req, res) => {
  try {
    const { amountZAR } = req.body || {};

    if (!amountZAR || amountZAR < 100) {
      return res.status(400).json({ error: 'Minimum purchase is R 1.00' });
    }

    // Check authentication - supports both philanthropist and tag/donor
    const auth = req.session.philanthropistAuth || req.session.donorAuth;
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get wallet based on user type
    let wallet;
    if (req.session.philanthropistAuth) {
      const philanthropist = await storage.getPhilanthropist(req.session.philanthropistAuth.philanthropistId);
      if (!philanthropist) {
        return res.status(404).json({ error: 'User not found' });
      }
      wallet = await storage.getWallet(philanthropist.walletId);
    } else if (req.session.donorAuth) {
      const tag = await storage.getTag(req.session.donorAuth.tagCode);
      if (!tag) {
        return res.status(404).json({ error: 'Tag not found' });
      }
      wallet = await storage.getWallet(tag.walletId);
    }

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Check balance
    if (wallet.balanceZAR < amountZAR) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Execute buy via Blockkoin client (includes real-time rates and settlement)
    const buyResult = await blockkoinClient.buyCrypto({
      accountId: wallet.id.toString(),
      amount: amountZAR, // Amount in cents
      currency: 'USDT',
      fiatCurrency: 'ZAR',
    });

    // Calculate total deduction (amount + fee)
    const totalDeduction = amountZAR + buyResult.fee;

    // Check if sufficient balance including fees
    if (wallet.balanceZAR < totalDeduction) {
      return res.status(400).json({ error: 'Insufficient balance including fees' });
    }

    // Deduct ZAR from wallet (amount + fee)
    await storage.updateWalletBalance(wallet.id, wallet.balanceZAR - totalDeduction);

    // Create transaction record with blockchain proof and complete fee transparency
    await storage.createTransaction({
      fromWalletId: wallet.id,
      toWalletId: wallet.id, // Same wallet, crypto purchase
      amount: totalDeduction, // Store full deduction (amount + fee) to match wallet debit
      kind: 'CRYPTO_BUY',
      ref: `BUY_USDT_${buyResult.transactionId} (Amount: R${(amountZAR / 100).toFixed(2)}, Fee: R${(buyResult.fee / 100).toFixed(2)}, Total: R${(totalDeduction / 100).toFixed(2)})`,
      blockchainTxHash: buyResult.blockchainHash,
      blockchainNetwork: 'Ethereum',
    });

    res.json({
      success: true,
      usdtPurchased: buyResult.cryptoAmount,
      zarSpent: amountZAR / 100, // Convert cents to rands for display
      fee: buyResult.fee / 100,
      totalCost: totalDeduction / 100,
      blockchainTxHash: buyResult.blockchainHash,
    });
  } catch (error) {
    console.error('Buy crypto error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/crypto/sell', async (req, res) => {
  try {
    const { amountUSDT } = req.body || {};

    if (!amountUSDT || amountUSDT < 1) {
      return res.status(400).json({ error: 'Minimum sale is 1 USDT' });
    }

    // Check authentication - supports both philanthropist and tag/donor
    const auth = req.session.philanthropistAuth || req.session.donorAuth;
    if (!auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get wallet based on user type
    let wallet;
    if (req.session.philanthropistAuth) {
      const philanthropist = await storage.getPhilanthropist(req.session.philanthropistAuth.philanthropistId);
      if (!philanthropist) {
        return res.status(404).json({ error: 'User not found' });
      }
      wallet = await storage.getWallet(philanthropist.walletId);
    } else if (req.session.donorAuth) {
      const tag = await storage.getTag(req.session.donorAuth.tagCode);
      if (!tag) {
        return res.status(404).json({ error: 'Tag not found' });
      }
      wallet = await storage.getWallet(tag.walletId);
    }

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Execute sell via Blockkoin client (includes real-time rates and settlement)
    const sellResult = await blockkoinClient.sellCrypto({
      accountId: wallet.id.toString(),
      cryptoAmount: amountUSDT,
      currency: 'USDT',
      fiatCurrency: 'ZAR',
    });

    // sellResult.fiatAmount is GROSS (before fees), calculate net
    const grossAmount = sellResult.fiatAmount; // Gross from Blockkoin
    const netAmount = grossAmount - sellResult.fee; // Net after fee deduction

    // Add ZAR to wallet (net amount after fees)
    await storage.updateWalletBalance(wallet.id, wallet.balanceZAR + netAmount);

    // Create transaction record with blockchain proof and fee transparency
    // Store NET amount to match wallet credit, with gross/fee breakdown in ref for transparency
    await storage.createTransaction({
      fromWalletId: wallet.id,
      toWalletId: wallet.id, // Same wallet, crypto sale
      amount: netAmount, // Store net amount to match wallet credit
      kind: 'CRYPTO_SELL',
      ref: `SELL_USDT_${sellResult.transactionId} (Gross: R${(grossAmount / 100).toFixed(2)}, Fee: R${(sellResult.fee / 100).toFixed(2)}, Net: R${(netAmount / 100).toFixed(2)})`,
      blockchainTxHash: sellResult.blockchainHash,
      blockchainNetwork: 'Ethereum',
    });

    res.json({
      success: true,
      usdtSold: amountUSDT,
      zarGross: grossAmount / 100, // Gross amount before fee
      fee: sellResult.fee / 100, // Fee amount
      zarReceived: netAmount / 100, // Net amount after fee
      blockchainTxHash: sellResult.blockchainHash,
    });
  } catch (error) {
    console.error('Sell crypto error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


export default router;
