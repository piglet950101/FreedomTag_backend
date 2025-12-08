import express from 'express';
import { storage } from '../storage';
import { blockkoinClient } from "../blockkoin";
import { log } from 'console';
import crypto from 'crypto';

const router = express.Router();

// ========== Crypto Balance APIs ==========
// Get crypto balances for authenticated user
router.get('/crypto/balances', async (req, res) => {
  try {
    // Check both user and philanthropist sessions
    const userId = req.session?.userAuth?.userId;
    const philanthropistId = req.session?.philanthropistAuth?.philanthropistId;

    if (!userId && !philanthropistId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    let blockkoinAccountId = null;

    // Get user or philanthropist and check if they have a Blockkoin account
    if (userId) {
      const user = await storage.getUser(userId);
      if (!user || !user.blockkoinAccountId) {
        return res.status(404).json({
          error: 'No Blockkoin account found',
          message: 'Please complete signup to get a Blockkoin wallet'
        });
      }
      blockkoinAccountId = user.blockkoinAccountId;
    } else if (philanthropistId) {
      const philanthropist = await storage.getPhilanthropist(philanthropistId);
      if (!philanthropist || !philanthropist.blockkoinAccountId) {
        return res.status(404).json({
          error: 'No Blockkoin account found',
          message: 'Please complete signup to get a Blockkoin wallet'
        });
      }
      blockkoinAccountId = philanthropist.blockkoinAccountId;
    }

    // In demo mode, return simulated balances
    // In production, this would call blockkoinClient.getAccountBalances(blockkoinAccountId)
    const balances = {
      BTC: 0.00000000,
      ETH: 0.00000000,
      USDT: 0.00,
    };

    res.json(balances);
  } catch (error) {
    console.error('[Crypto Balances] Error:', error);
    res.status(500).json({ error: 'Failed to fetch crypto balances' });
  }
});

// ========== Crypto Payment APIs ==========
// PUBLIC crypto donation with real Blockkoin integration
router.post('/crypto/donate', async (req, res) => {
  try {
    const { tagCode, amountZAR, cryptoCurrency = 'USDT' } = req.body || {};

    if (!tagCode || !amountZAR) {
      return res.status(400).json({ error: 'tagCode and amountZAR required' });
    }

    // Get tag and validate
    const tag = await storage.getTag(String(tagCode));
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    // Get beneficiary user
    if (!tag.userId) {
      return res.status(400).json({ error: 'Tag not linked to a user account' });
    }

    const beneficiary = await storage.getUser(tag.userId);
    if (!beneficiary) {
      return res.status(404).json({ error: 'Beneficiary not found' });
    }

    // Check KYC requirement for $50+ transactions
    const preferredCurrency = beneficiary.preferredCurrency || 'ZAR';
    const USD_TO_ZAR_RATE = 18.5; // Update with real-time rate if needed
    const amountUSD = (amountZAR / 100) / USD_TO_ZAR_RATE;

    if (amountUSD >= 50 && beneficiary.blockkoinKycStatus !== 'verified') {
      return res.status(400).json({
        error: 'KYC_REQUIRED',
        message: 'Transactions over $50 USD require identity verification',
        kycUrl: beneficiary.blockkoinAccountId
          ? `https://kyc.blockkoin.com/${beneficiary.blockkoinAccountId}`
          : 'https://bkr.blockkoin.io/register',
        currentStatus: beneficiary.blockkoinKycStatus,
        amountUSD: amountUSD.toFixed(2),
      });
    }

    // Get real-time exchange rates from Blockkoin
    const exchangeRates = await blockkoinClient.getExchangeRates(preferredCurrency);
    const cryptoRate = exchangeRates.find(r => r.from === cryptoCurrency);

    if (!cryptoRate) {
      return res.status(400).json({
        error: `Unsupported cryptocurrency: ${cryptoCurrency}`,
        supportedCurrencies: exchangeRates.map(r => r.from),
      });
    }

    // Calculate crypto amount needed (both amounts in cents)
    const cryptoAmount = amountZAR / cryptoRate.rate;

    // Get or create Blockkoin account for beneficiary if needed
    let blockkoinAccountId = beneficiary.blockkoinAccountId;

    if (!blockkoinAccountId) {
      try {
        const account = await blockkoinClient.createAccount(
          beneficiary.email,
          beneficiary.fullName,
          beneficiary.country
        );
        blockkoinAccountId = account.id;

        // Update user with Blockkoin account
        await storage.updateUser(beneficiary.id, {
          blockkoinAccountId: account.id,
          blockkoinKycStatus: account.kycStatus,
        });
      } catch (error) {
        console.error('[Blockkoin] Failed to create account:', error);
        return res.status(500).json({ error: 'Failed to create payment account' });
      }
    }

    // Create payment request
    const payment = await blockkoinClient.createPayment({
      amount: cryptoAmount,
      currency: cryptoCurrency,
      toAddress: blockkoinAccountId, // Simplified - in production would be wallet address
      autoConvert: true,
      targetCurrency: preferredCurrency,
    });

    // Create pending transaction record
    await storage.createTransaction({
      kind: 'DONATION',
      toWalletId: tag.walletId,
      amount: 0, // Will be updated when payment confirms
      ref: `CRYPTO_${cryptoCurrency}_${payment.id}`,
      cryptoPaymentId: payment.id,
      status: 'pending',
    });

    // Return payment info
    res.json({
      success: true,
      paymentId: payment.id,
      cryptoAmount: cryptoAmount,
      cryptoCurrency: cryptoCurrency,
      estimatedZAR: amountZAR,
      exchangeRate: cryptoRate.rate,
      rateTimestamp: cryptoRate.timestamp,
      // In demo mode, return simulation URL; in production, return Blockkoin payment page
      paymentUrl: `/crypto/pay?paymentId=${payment.id}&tagCode=${tagCode}&amount=${cryptoAmount}&currency=${cryptoCurrency}`,
      qrCodeData: JSON.stringify({
        paymentId: payment.id,
        amount: cryptoAmount,
        currency: cryptoCurrency,
        recipient: blockkoinAccountId,
      }),
    });

  } catch (error) {
    console.error('Crypto donation error:', error);
    res.status(500).json({ error: 'Failed to process crypto donation' });
  }
});

// Webhook endpoint for Blockkoin payment confirmations
router.post('/crypto/webhook/blockkoin', async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-blockkoin-signature'] as string;
    const webhookSecret = process.env.BLOCKKOIN_WEBHOOK_SECRET;

    if (webhookSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('[Blockkoin Webhook] Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    } else {
      console.warn('[Blockkoin Webhook] No BLOCKKOIN_WEBHOOK_SECRET set, skipping verification');
    }

    const { event, payment } = req.body;
    console.log(`[Blockkoin Webhook] Received event: ${event}`, payment);

    if (event === 'payment.completed') {
      // Find transaction by crypto payment ID
      const transactions = await storage.getAllTransactions();
      const transaction = transactions.find(t => t.cryptoPaymentId === payment.id);

      if (!transaction) {
        console.error(`[Blockkoin Webhook] Transaction not found for payment: ${payment.id}`);
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Get converted amount from Blockkoin (in cents)
      const convertedAmountZAR = payment.convertedAmount || payment.amount;

      // Update transaction
      await storage.updateTransactionAmount(transaction.id, convertedAmountZAR);

      // Update beneficiary wallet balance
      const wallet = await storage.getWallet(transaction.toWalletId);
      if (wallet) {
        await storage.updateWalletBalance(
          wallet.id,
          wallet.balanceZAR + convertedAmountZAR
        );
        console.log(`[Blockkoin Webhook] ✅ Payment completed: ${payment.id}, amount: R${convertedAmountZAR / 100}`);
      }
    } else if (event === 'payment.failed') {
      console.log(`[Blockkoin Webhook] ⚠️ Payment failed: ${payment.id}`);
      // Could update transaction status to 'failed' if you track that
    }

    res.json({ received: true });

  } catch (error) {
    console.error('[Blockkoin Webhook] Processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// PUBLIC crypto donation (legacy - for backward compatibility)
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


    console.log("@=========> source", source);


    // Redirect based on source
    if (source === 'public') {
      res.redirect(`/donor/view/${encodeURIComponent(String(tagCode))}?paid=1&crypto=${crypto}`);
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
