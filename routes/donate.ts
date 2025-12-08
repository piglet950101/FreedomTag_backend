import express from 'express';
import { storage } from '../storage';

const router = express.Router();

// PUBLIC donation endpoints (no auth required)
router.post('/donate/public', async (req, res) => {
    try {
        const { tagCode, amountZAR, currency, country, needTaxReceipt, donorEmail, donorName } = req.body || {};
        if (!tagCode || !amountZAR) {
            return res.status(400).json({ error: 'tagCode and amountZAR required' });
        }

        // Validate tag exists (no auth required)
        const tag = await storage.getTag(String(tagCode));
        if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        const bankRef = `DONOR:${tagCode}:${Date.now()}`;
        let bankSimUrl = `/bank/pay?bankRef=${encodeURIComponent(bankRef)}&tagCode=${encodeURIComponent(tagCode)}&amountZAR=${amountZAR}&source=public`;

        // Add tax receipt info to URL if requested
        if (needTaxReceipt && donorEmail) {
            bankSimUrl += `&taxReceipt=1&donorEmail=${encodeURIComponent(donorEmail)}`;
            if (donorName) {
                bankSimUrl += `&donorName=${encodeURIComponent(donorName)}`;
            }
        }

        // Add currency and country info
        if (currency) {
            bankSimUrl += `&currency=${encodeURIComponent(currency)}`;
        }
        if (country) {
            bankSimUrl += `&country=${encodeURIComponent(country)}`;
        }

        res.json({
            bankSimUrl,
            bankRef,
        });
    } catch (error) {
        res.status(500).json({ error: 'internal server error' });
    }
});

router.post('/donate/start', async (req, res) => {
    try {
        const { tagCode, amountZAR } = req.body || {};
        if (!tagCode || !amountZAR) {
            return res.status(400).json({ error: 'tagCode and amountZAR required' });
        }
        // Verify authentication for the tag
        if (!req.session.donorAuth || req.session.donorAuth.tagCode !== tagCode) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const bankRef = `TAG:${tagCode}:${Date.now()}`;
        res.json({
            bankSimUrl: `/bank/pay?bankRef=${encodeURIComponent(bankRef)}&tagCode=${encodeURIComponent(tagCode)}&amountZAR=${amountZAR}`,
            bankRef,
        });
    } catch (error) {
        res.status(500).json({ error: 'internal server error' });
    }
});

router.post('/bank/settle', async (req, res) => {
    try {
        const { bankRef, tagCode, amountZAR, source, taxReceipt, donorEmail, donorName, currency, country } = req.body || {};
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

        // Record transaction with tax and currency info (amount in cents)
        await storage.createTransaction({
            kind: 'DONATION',
            toWalletId: wallet.id,
            amount: Number(amountZAR) * 100,
            ref: String(bankRef),
            currency: currency || 'ZAR',
            donorCountry: country || undefined,
            taxDeductible: taxReceipt === '1' ? 1 : 0,
        });

        // Redirect based on source
        let redirectUrl;
        if (source === 'kiosk') {
            redirectUrl = `/kiosk/donate/${encodeURIComponent(String(tagCode))}?paid=1`;
        } else if (source === 'public') {
            redirectUrl = `/donor/view/${encodeURIComponent(String(tagCode))}?paid=1`;
            // Only add tax receipt flag, NOT donor email (PII security)
            if (taxReceipt === '1') {
                redirectUrl += `&taxReceipt=1`;
            }
        } else {
            redirectUrl = `/tag/${encodeURIComponent(String(tagCode))}?paid=1`;
        }

        res.redirect(redirectUrl);
    } catch (error) {
      console.log("/bank/settle", error);
        res.status(500).send('internal server error');
    }
});

  // Process recurring donations (called by cron/scheduler)
  router.post('/recurring-donations/process', async (req, res) => {
    try {
      // This endpoint should be protected with an API key in production
      const duedonations = await storage.getActiveRecurringDonationsDueForProcessing();
      const results = [];

      for (const donation of duedonations) {
        try {
          // Get philanthropist and wallet
          const philanthropist = await storage.getPhilanthropist(donation.philanthropistId);
          if (!philanthropist) {
            results.push({ donationId: donation.id, status: 'error', error: 'Philanthropist not found' });
            continue;
          }

          const fromWallet = await storage.getWallet(philanthropist.walletId);
          if (!fromWallet) {
            results.push({ donationId: donation.id, status: 'error', error: 'Wallet not found' });
            continue;
          }

          // Get recipient wallet
          let toWallet;
          if (donation.recipientType === 'TAG') {
            const tag = await storage.getTag(donation.recipientId);
            if (!tag) {
              results.push({ donationId: donation.id, status: 'error', error: 'Tag not found' });
              continue;
            }
            toWallet = await storage.getWallet(tag.walletId);
          } else {
            // Organization
            const tags = await storage.getAllTags();
            const orgTag = tags.find(t => t.organizationId === donation.recipientId && t.beneficiaryType === 'organization');
            if (!orgTag) {
              results.push({ donationId: donation.id, status: 'error', error: 'Organization tag not found' });
              continue;
            }
            toWallet = await storage.getWallet(orgTag.walletId);
          }

          if (!toWallet) {
            results.push({ donationId: donation.id, status: 'error', error: 'Recipient wallet not found' });
            continue;
          }

          // Convert donation amount from USD to ZAR (for now, simplified - in production would use Blockkoin API)
          // USD cents to ZAR cents conversion (using rough 18.5 exchange rate)
          const amountZARCents = Math.round(donation.amountCents * 18.5);

          // Check if philanthropist has sufficient balance
          if (fromWallet.balanceZAR < amountZARCents) {
            results.push({
              donationId: donation.id,
              status: 'insufficient_funds',
              required: amountZARCents,
              available: fromWallet.balanceZAR
            });
            continue;
          }

          // Process donation
          await storage.updateWalletBalance(fromWallet.id, fromWallet.balanceZAR - amountZARCents);
          await storage.updateWalletBalance(toWallet.id, toWallet.balanceZAR + amountZARCents);

          // Create transaction
          const donationRef = donation.donorName
            ? `Recurring donation from ${donation.donorName} (${donation.cryptocurrency})`
            : `Recurring anonymous donation (${donation.cryptocurrency})`;

          await storage.createTransaction({
            kind: 'RECURRING_DONATION',
            fromWalletId: fromWallet.id,
            toWalletId: toWallet.id,
            amount: amountZARCents,
            ref: donationRef,
            currency: 'ZAR',
          });

          // Handle dust auto-donation if enabled
          const updatedWallet = await storage.getWallet(fromWallet.id);
          if (updatedWallet && donation.autoDonatesDust === 1) {
            // Convert dust threshold from USD cents to ZAR cents
            const dustThresholdZAR = Math.round(donation.dustThresholdCents * 18.5);

            if (updatedWallet.balanceZAR > 0 && updatedWallet.balanceZAR < dustThresholdZAR) {
              // Auto-donate the dust
              await storage.updateWalletBalance(fromWallet.id, 0);
              await storage.updateWalletBalance(toWallet.id, toWallet.balanceZAR + updatedWallet.balanceZAR);

              await storage.createTransaction({
                kind: 'DUST_DONATION',
                fromWalletId: fromWallet.id,
                toWalletId: toWallet.id,
                amount: updatedWallet.balanceZAR,
                ref: `Auto-donated crypto dust (${donation.cryptocurrency})`,
                currency: 'ZAR',
              });

              results.push({
                donationId: donation.id,
                status: 'success_with_dust',
                amount: amountZARCents,
                dustAmount: updatedWallet.balanceZAR
              });
            } else {
              results.push({ donationId: donation.id, status: 'success', amount: amountZARCents });
            }
          } else {
            results.push({ donationId: donation.id, status: 'success', amount: amountZARCents });
          }

          // Update next processing date (first of next month)
          const nextDate = new Date(donation.nextProcessingDate || new Date());
          nextDate.setMonth(nextDate.getMonth() + 1);
          await storage.updateRecurringDonationProcessing(donation.id, nextDate);

        } catch (error) {
          console.error(`Error processing recurring donation ${donation.id}:`, error);
          results.push({
            donationId: donation.id,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      res.json({
        success: true,
        processed: results.length,
        results
      });
    } catch (error) {
      console.error('Process recurring donations error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Recent donations feed for ticker
  router.get('/donations/recent', async (_req, res) => {
    try {
      const allTransactions = await storage.getAllTransactions();

      // Get recent donations (GIVE or DONOR kind)
      const recentDonations = allTransactions
        .filter(t => (t.kind === 'GIVE' || t.kind === 'DONOR') && t.toWalletId)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 50); // Last 50 donations

      // Enrich with organization/tag info
      const enriched = await Promise.all(
        recentDonations.map(async (txn) => {
          // Find the tag by wallet ID
          const allTags = await storage.getAllTags();
          const tag = allTags.find(t => t.walletId === txn.toWalletId);

          let organizationName = 'Anonymous Charity';
          if (tag?.organizationId) {
            const org = await storage.getOrganization(tag.organizationId);
            if (org) {
              organizationName = org.name;
            }
          } else if (tag?.beneficiaryName) {
            organizationName = tag.beneficiaryName;
          }

          return {
            id: txn.id,
            amount: txn.amount,
            organizationName,
            timestamp: txn.createdAt,
          };
        })
      );

      res.json({ donations: enriched });
    } catch (error) {
      console.error('Recent donations feed error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ========== Donation Terms & Conditions ==========
  router.get('/terms', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Donation Terms - Freedom Tag</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
          }
          h2 {
            color: #0aa968;
            border-bottom: 2px solid #0aa968;
            padding-bottom: 10px;
          }
          p {
            margin: 16px 0;
          }
          strong {
            color: #000;
          }
          em {
            font-style: italic;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <h2>Donation Terms</h2>
        <p><strong>Reallocation, Stewardship & No-Refund Policy.</strong></p>
        <p>(a) <em>Stewardship.</em> All donations are received by the Organization in its capacity as trustee/steward to be applied toward its mission and program purposes. Donors acknowledge and agree that the Organization retains full and final discretion over the use and application of donated funds to ensure they are used effectively and for charitable purposes.</p>
        <p>(b) <em>Specific Beneficiaries & Overfunding.</em> Where a donation is made in reference to a specific beneficiary (e.g., an individual animal or case) or campaign, Donor directs the Organization to first apply funds to that purpose. If the beneficiary dies, recovers, becomes ineligible, the need is satisfied, or the campaign is fully funded/overfunded, Donor authorizes the Organization to reallocate the remaining funds to substantially similar purposes within the same program or, if not practicable, to other urgent needs within the Organization's mission.</p>
        <p>(c) <em>No Refunds.</em> All donations are final, irrevocable, and non-refundable, except where required by applicable law or in cases of proven unauthorized or fraudulent payment.</p>
        <p>(d) <em>Transparency.</em> The Organization will maintain appropriate records and may publish aggregated reports on the use of funds; personal donor data will only be disclosed per the Organization's privacy policy and donor consents.</p>
      </body>
      </html>
    `);
  });

export default router;
