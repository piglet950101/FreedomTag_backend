import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateReferralCode, calculateReferralReward } from "./utils/referral";
import { blockkoinClient } from "./blockkoin";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { passwordResetTokens } from "./shared/schema";
import authRouter from './routes/auth';
import merchantRouter from './routes/merchant';
import donateRouter from './routes/donate';
import beneficiaryRouter from './routes/beneficiary';
import donorRouter from './routes/donor';
import blockkoinRouter from './routes/blockkoin';
import tagRouter from './routes/tag';
import cryptoRouter from './routes/crypto';
import stripeRouter from './routes/stripe';
import organizationsRouter from './routes/organizations';
import philanthropistRouter from './routes/philanthropist';
import disasterCampaignsRouter from './routes/disasterCampaigns';
import leaderboardsRouter from './routes/leaderboards';
import storiesRouter from './routes/stories';
import whatsappRouter from './routes/whatsapp';
import userRouter from './routes/user';
import charityRouter from './routes/charity';
import learnRouter from './routes/learn';


// ========== Crypto Config ==========
// Simulated exchange rates (ZAR per 1 unit of crypto)
const CRYPTO_RATES = {
  BTC: 120000000,  // 1 BTC = R1,200,000 ZAR (in cents)
  ETH: 5500000,    // 1 ETH = R55,000 ZAR (in cents)
  USDT: 1850,      // 1 USDT = R18.50 ZAR (in cents - stablecoin)
  USDC: 1850,      // 1 USDC = R18.50 ZAR (in cents - stablecoin)
  DAI: 1850,       // 1 DAI = R18.50 ZAR (in cents - stablecoin)
  BNB: 1100000,    // 1 BNB = R11,000 ZAR (in cents)
  XRP: 1000,       // 1 XRP = R10 ZAR (in cents)
  ADA: 800,        // 1 ADA = R8 ZAR (in cents)
  SOL: 280000,     // 1 SOL = R2,800 ZAR (in cents)
  DOGE: 150        // 1 DOGE = R1.50 ZAR (in cents)
};

export function convertCryptoToZAR(crypto: string, amount: number): number {
  const rate = CRYPTO_RATES[crypto as keyof typeof CRYPTO_RATES];
  if (!rate) throw new Error('Unknown crypto');
  return Math.floor(amount * rate);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Delegated route modules
  app.use('/api', authRouter);
  app.use('/api', merchantRouter);
  app.use('/api', donateRouter);
  app.use('/api', beneficiaryRouter);
  app.use('/api', donorRouter);
  app.use('/api', blockkoinRouter);
  app.use('/api', tagRouter);
  app.use('/api', cryptoRouter);
  app.use('/api', stripeRouter);
  app.use('/api', organizationsRouter);
  app.use('/api', philanthropistRouter);
  app.use('/api', disasterCampaignsRouter);
  app.use('/api', leaderboardsRouter);
  app.use('/api', storiesRouter);
  app.use('/api', whatsappRouter);
  app.use('/api', userRouter);
  app.use('/api', charityRouter);
  app.use('/api', learnRouter);


  // Debug route - check DB connectivity and sample data
  app.get('/api/debug/db', async (_req, res) => {
    try {
      const { pool } = await import('./db');
      const isPostgres = !!pool;
      const txs = await storage.getAllTransactions();
      res.json({ connected: true, driver: isPostgres ? 'postgres' : 'sqlite', transactionCount: txs.length });
    } catch (err) {
      console.error('DB debug error:', err);
      res.status(500).json({ connected: false, error: String(err) });
    }
  });

  // Webhook endpoint for Sumsub verification status updates
  app.post('/api/sumsub/webhook', async (req, res) => {
    try {
      const { type, applicantId, reviewResult } = req.body || {};

      if (type === 'applicantReviewed') {
        const externalUserId = req.body.externalUserId;
        const reviewAnswer = reviewResult?.reviewAnswer;

        if (externalUserId && reviewAnswer) {
          const tag = await storage.getTag(externalUserId);
          if (tag) {
            const status = reviewAnswer === 'GREEN' ? 'approved' : 'rejected';
            await storage.updateTagVerification(tag.tagCode, applicantId, status);
          }
        }
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('Sumsub webhook error:', error);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
