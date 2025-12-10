import express from 'express';
import { storage } from '../storage';

const router = express.Router();

// Create Stripe Checkout Session (redirects to Stripe hosted page)
router.post('/stripe/create-checkout-session', express.json(), async (req, res) => {
  try {
    const { tagCode, amount, donorEmail, source } = req.body;

    if (!tagCode || !amount) {
      return res.status(400).json({ error: 'Missing tagCode or amount' });
    }

    // Verify tag exists
    const tag = await storage.getTag(tagCode);
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    // Import Stripe
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2024-11-20.acacia' as any,
    });

    // Determine success URL based on source
    const baseUrl = process.env.BACKEND_URL?.replace('3000', '5173') || 'http://localhost:5173';
    let successUrl = `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}&tag=${tagCode}`;
    
    // If source is 'public', redirect to donor/view page after success
    if (source === 'public') {
      successUrl = `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}&tag=${tagCode}&source=public&redirect=/donor/view/${tagCode}?paid=1`;
    } else if (source) {
      successUrl = `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}&tag=${tagCode}&source=${source}&redirect=/tag/${tagCode}?paid=1`;
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'zar',
            product_data: {
              name: `Donation to ${tagCode}`,
              description: `Support ${tag.beneficiaryName || tagCode}`,
            },
            unit_amount: parseInt(amount),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: `${baseUrl}/bank/pay?tagCode=${tagCode}&amountZAR=${amount}&source=${source || ''}&canceled=true`,
      customer_email: donorEmail || undefined,
      metadata: {
        tagCode,
        amountZAR: amount,
        source: source || '',
      },
    });

    res.json({ 
      sessionId: session.id,
      url: session.url 
    });
  } catch (error) {
    console.error('[Stripe] Create checkout session error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Create Payment Intent (for embedded form)
router.post('/stripe/create-payment-intent', express.json(), async (req, res) => {
  try {
    const { tagCode, amount, donorEmail, donorName } = req.body;

    if (!tagCode || !amount) {
      return res.status(400).json({ error: 'Missing tagCode or amount' });
    }

    // Verify tag exists
    const tag = await storage.getTag(tagCode);
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    // Import Stripe
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2024-11-20.acacia' as any,
    });

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: parseInt(amount),
      currency: 'zar',
      metadata: {
        tagCode,
        amountZAR: amount,
        donorEmail: donorEmail || '',
        donorName: donorName || '',
      },
      description: `Donation to ${tagCode}`,
    });

    res.json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id 
    });
  } catch (error) {
    console.error('[Stripe] Create payment intent error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Demo webhook endpoint (with JSON parsing)
router.post('/stripe/webhook-demo', express.json(), async (req, res) => {
  try {
    console.log('[Stripe Webhook Demo] Event received:', req.body.type);
    
    const event = req.body;

    // Handle different event types (same logic as real webhook)
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        console.log('[Stripe] Payment succeeded:', paymentIntent.id);

        // Extract metadata
        const metadata = paymentIntent.metadata || {};
        const tagCode = metadata.tagCode;
        const amountZAR = parseInt(metadata.amountZAR || '0');
        const donorEmail = metadata.donorEmail;
        const donorName = metadata.donorName;

        if (!tagCode || !amountZAR) {
          console.error('[Stripe] Missing required metadata. tagCode:', tagCode, 'amountZAR:', amountZAR);
          return res.status(400).json({ error: 'Missing required metadata' });
        }

        // Get tag and wallet
        const tag = await storage.getTag(tagCode);
        if (!tag) {
          console.error('[Stripe] Tag not found:', tagCode);
          return res.status(404).json({ error: 'Tag not found' });
        }

        const wallet = await storage.getWallet(tag.walletId);
        if (!wallet) {
          console.error('[Stripe] Wallet not found:', tag.walletId);
          return res.status(404).json({ error: 'Wallet not found' });
        }

        // Update wallet balance (handle NULL balance)
        const currentBalance = wallet.balanceZAR ?? 0;
        const newBalance = currentBalance + amountZAR;
        await storage.updateWalletBalance(wallet.id, newBalance);

        // Create transaction record
        await storage.createTransaction({
          kind: 'DONATION',
          fromWalletId: null,
          toWalletId: wallet.id,
          amount: amountZAR,
          ref: `Stripe payment: ${paymentIntent.id}`,
          donorEmail: donorEmail || null,
          donorName: donorName || null,
        });

        console.log('[Stripe] Transaction created for tag:', tagCode, 'Amount:', amountZAR);
        break;
      }

      default:
        console.log('[Stripe] Unhandled event type:', event.type);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook Demo] Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Production Stripe webhook endpoint (with signature verification)
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    // Demo mode: Allow testing without Stripe signature verification
    if (!endpointSecret || endpointSecret === 'whsec_your_webhook_secret_here') {
      console.log('[Stripe Webhook] DEMO MODE - Skipping signature verification');
      // Parse JSON body manually for demo
      const bodyString = Buffer.isBuffer(req.body) 
        ? req.body.toString('utf-8') 
        : JSON.stringify(req.body);
      event = JSON.parse(bodyString);
    } else {
      // Production mode: Verify webhook signature
      const sig = req.headers['stripe-signature'];
      
      if (!sig) {
        console.error('[Stripe Webhook] Missing stripe-signature header');
        return res.status(400).json({ error: 'Missing signature' });
      }

      // Import Stripe dynamically
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2024-11-20.acacia',
      });

      try {
        // Verify webhook signature
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err: any) {
        console.error('[Stripe Webhook] Signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
      }
    }

    console.log('[Stripe Webhook] Event received:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        console.log('[Stripe] Payment succeeded:', paymentIntent.id);
        console.log('[Stripe] Full payment intent:', JSON.stringify(paymentIntent, null, 2));

        // Extract metadata
        const metadata = paymentIntent.metadata || {};
        console.log('[Stripe] Metadata:', metadata);
        
        const tagCode = metadata.tagCode;
        const amountZAR = parseInt(metadata.amountZAR || '0');
        const donorEmail = metadata.donorEmail;
        const donorName = metadata.donorName;

        if (!tagCode || !amountZAR) {
          console.error('[Stripe] Missing required metadata. tagCode:', tagCode, 'amountZAR:', amountZAR);
          return res.status(400).json({ error: 'Missing required metadata' });
        }

        // Get tag and wallet
        const tag = await storage.getTag(tagCode);
        if (!tag) {
          console.error('[Stripe] Tag not found:', tagCode);
          return res.status(404).json({ error: 'Tag not found' });
        }

        const wallet = await storage.getWallet(tag.walletId);
        if (!wallet) {
          console.error('[Stripe] Wallet not found:', tag.walletId);
          return res.status(404).json({ error: 'Wallet not found' });
        }

        // Update wallet balance (handle NULL balance)
        const currentBalance = wallet.balanceZAR ?? 0;
        const newBalance = currentBalance + amountZAR;
        await storage.updateWalletBalance(wallet.id, newBalance);

        // Create transaction record
        await storage.createTransaction({
          kind: 'DONATION',
          fromWalletId: null,
          toWalletId: wallet.id,
          amount: amountZAR,
          ref: `Stripe payment: ${paymentIntent.id}`,
          donorEmail: donorEmail || null,
          donorName: donorName || null,
        });

        console.log('[Stripe] Transaction created for tag:', tagCode, 'Amount:', amountZAR);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.error('[Stripe] Payment failed:', paymentIntent.id, paymentIntent.last_payment_error?.message);

        // Optionally create a failed transaction record
        const metadata = paymentIntent.metadata;
        if (metadata.tagCode) {
          const tag = await storage.getTag(metadata.tagCode);
          if (tag) {
            await storage.createTransaction({
              kind: 'DONATION',
              fromWalletId: null,
              toWalletId: tag.walletId,
              amount: parseInt(metadata.amountZAR || '0'),
              ref: `Failed Stripe payment: ${paymentIntent.id}`,
            });
          }
        }
        break;
      }

      case 'charge.succeeded': {
        const charge = event.data.object;
        console.log('[Stripe] Charge succeeded:', charge.id);
        // Already handled by payment_intent.succeeded
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        console.log('[Stripe] Charge refunded:', charge.id);

        // Handle refund - reverse the transaction
        const metadata = charge.metadata;
        if (metadata.tagCode && metadata.amountZAR) {
          const tag = await storage.getTag(metadata.tagCode);
          if (tag) {
            const wallet = await storage.getWallet(tag.walletId);
            if (wallet) {
              const refundAmount = parseInt(metadata.amountZAR);
              const newBalance = Math.max(0, wallet.balanceZAR - refundAmount);
              await storage.updateWalletBalance(wallet.id, newBalance);

              await storage.createTransaction({
                kind: 'REFUND',
                fromWalletId: wallet.id,
                toWalletId: null,
                amount: refundAmount,
                ref: `Stripe refund: ${charge.id}`,
              });

              console.log('[Stripe] Refund processed for tag:', metadata.tagCode);
            }
          }
        }
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('[Stripe] Checkout session completed:', session.id);
        // Handle checkout session completion if using Stripe Checkout
        break;
      }

      default:
        console.log('[Stripe] Unhandled event type:', event.type);
    }

    // Return 200 to acknowledge receipt
    res.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
