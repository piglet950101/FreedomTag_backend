import { db, supabase } from "./db";
import { camelizeRow } from "./supabase";
import {
  users,
  userRoles,
  wallets,
  tags,
  organizations,
  philanthropists,
  transactions,
  merchantChains,
  merchantOutlets,
  referrals,
  recurringDonations,
  stories
} from "./shared/schema";
// removed duplicate incorrect imports which were added mistakenly
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

// Generate realistic blockchain transaction hash
function generateTxHash(): string {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

// Generate realistic block number (recent blocks)
function generateBlockNumber(): number {
  return Math.floor(18500000 + Math.random() * 500000);
}

// Generate Etherscan-style URL
function generateEtherscanUrl(txHash: string): string {
  return `https://etherscan.io/tx/${txHash}`;
}

// Generate realistic timestamp (within last 30 days)
function generateRecentTimestamp(): Date {
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  const randomTime = thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo);
  return new Date(randomTime);
}

export async function seedDemoData() {
  console.log('\n🌱 Starting comprehensive demo data seeding...\n');
  
  try {
    // Check if demo data already exists (look for specific demo philanthropist email)
    const existingDemo = await db.select().from(philanthropists).where(eq(philanthropists.email, 'demo.donor@freedomtag.org'));
    if (existingDemo.length > 0) {
      console.log('✅ Demo data already exists. Skipping seed.\n');
      return;
    }

    const passwordHash = await bcrypt.hash('demo1234', 10);

    console.log('📊 Creating demo organizations (charities)...');
    
    // Create verified charities with blockchain smart contracts
    let sancob: any;
    if (supabase) {
      const { data, error } = await supabase.from('organizations').insert({
        name: 'SANCOB - Southern African Foundation for the Conservation of Coastal Birds',
        type: 'Wildlife Conservation',
        country: 'South Africa',
        charityRegistrationNumber: 'NPO-001-234',
        taxExemptStatus: 'approved',
        kybStatus: 'verified',
        smartContractAddress: '0x' + '1'.repeat(40),
        blockchainNetwork: 'Polygon',
        contractDeployedAt: new Date('2024-01-15'),
        fireblocksVaultId: 'vault_sancob_001',
        payoutPreference: 'BANK',
        bankAccountRef: 'FNB-SANCOB-001',
        description: 'Dedicated to the rescue, rehabilitation and release of seabirds',
        website: 'https://www.sanccob.co.za',
        email: 'contact@sancob.org',
        passwordHash,
        referralCode: 'SANCOB2024',
      }).select().maybeSingle();
      if (error) throw error;
      sancob = camelizeRow( data as any );
    } else {
      const [row] = await db.insert(organizations).values({
        name: 'SANCOB - Southern African Foundation for the Conservation of Coastal Birds',
        type: 'Wildlife Conservation',
        country: 'South Africa',
        charityRegistrationNumber: 'NPO-001-234',
        taxExemptStatus: 'approved',
        kybStatus: 'verified',
        smartContractAddress: '0x' + '1'.repeat(40),
        blockchainNetwork: 'Polygon',
        contractDeployedAt: new Date('2024-01-15'),
        fireblocksVaultId: 'vault_sancob_001',
        payoutPreference: 'BANK',
        bankAccountRef: 'FNB-SANCOB-001',
        description: 'Dedicated to the rescue, rehabilitation and release of seabirds',
        website: 'https://www.sanccob.co.za',
        email: 'contact@sancob.org',
        passwordHash,
        referralCode: 'SANCOB2024',
      }).returning();
      sancob = row;
    }
      name: 'SANCOB - Southern African Foundation for the Conservation of Coastal Birds',
      type: 'Wildlife Conservation',
      country: 'South Africa',
      charityRegistrationNumber: 'NPO-001-234',
      taxExemptStatus: 'approved',
      kybStatus: 'verified',
      smartContractAddress: '0x' + '1'.repeat(40),
      blockchainNetwork: 'Polygon',
      contractDeployedAt: new Date('2024-01-15'),
      fireblocksVaultId: 'vault_sancob_001',
      payoutPreference: 'BANK',
      bankAccountRef: 'FNB-SANCOB-001',
      description: 'Dedicated to the rescue, rehabilitation and release of seabirds',
      website: 'https://www.sanccob.co.za',
      email: 'contact@sancob.org',
      passwordHash,
      referralCode: 'SANCOB2024',
    }).returning();

    let breadline: any;
    if (supabase) {
      const { data, error } = await supabase.from('organizations').insert({
        name: 'Breadline Africa',
        type: 'Food Security & Education',
        country: 'South Africa',
        charityRegistrationNumber: 'NPO-002-567',
        taxExemptStatus: 'approved',
        kybStatus: 'verified',
        smartContractAddress: '0x' + '2'.repeat(40),
        blockchainNetwork: 'Ethereum',
        contractDeployedAt: new Date('2024-02-10'),
        fireblocksVaultId: 'vault_breadline_001',
        payoutPreference: 'USDT',
        description: 'Fighting poverty through food security and education programs',
        website: 'https://www.breadlineafrica.org',
        email: 'info@breadlineafrica.org',
        passwordHash,
        referralCode: 'BREAD2024',
      }).select().maybeSingle();
      if (error) throw error;
      breadline = camelizeRow(data as any);
    } else {
      const [row] = await db.insert(organizations).values({
        name: 'Breadline Africa',
        type: 'Food Security & Education',
        country: 'South Africa',
        charityRegistrationNumber: 'NPO-002-567',
        taxExemptStatus: 'approved',
        kybStatus: 'verified',
        smartContractAddress: '0x' + '2'.repeat(40),
        blockchainNetwork: 'Ethereum',
        contractDeployedAt: new Date('2024-02-10'),
        fireblocksVaultId: 'vault_breadline_001',
        payoutPreference: 'USDT',
        description: 'Fighting poverty through food security and education programs',
        website: 'https://www.breadlineafrica.org',
        email: 'info@breadlineafrica.org',
        passwordHash,
        referralCode: 'BREAD2024',
      }).returning();
      breadline = row;
    }

    let mensaSA: any;
    if (supabase) {
      const { data, error } = await supabase.from('organizations').insert({
        name: 'Mensa South Africa Education Fund',
        type: 'Educational Support',
        country: 'South Africa',
        charityRegistrationNumber: 'NPO-003-890',
        taxExemptStatus: 'pending',
        kybStatus: 'pending',
        description: 'Supporting gifted students with scholarships and mentorship',
        website: 'https://www.mensa.org.za',
        email: 'education@mensa.org.za',
        passwordHash,
        referralCode: 'MENSA2024',
      }).select().maybeSingle();
      if (error) throw error;
      mensaSA = camelizeRow(data as any);
    } else {
      const [row] = await db.insert(organizations).values({
        name: 'Mensa South Africa Education Fund',
        type: 'Educational Support',
        country: 'South Africa',
        charityRegistrationNumber: 'NPO-003-890',
        taxExemptStatus: 'pending',
        kybStatus: 'pending',
        description: 'Supporting gifted students with scholarships and mentorship',
        website: 'https://www.mensa.org.za',
        email: 'education@mensa.org.za',
        passwordHash,
        referralCode: 'MENSA2024',
      }).returning();
      mensaSA = row;
    }

    console.log(`✅ Created ${3} demo charities (SANCOB, Breadline Africa, Mensa SA)\n`);

    console.log('🏷️  Creating Freedom Tag beneficiaries...');

    // Create demo Freedom Tag beneficiaries with wallets
    const beneficiaryData = [
      { name: 'Thabo Molefe', phone: '+27823456789', type: 'Homeless', code: 'DEMO001', pin: '123456', orgId: breadline.id },
      { name: 'Lindiwe Khumalo', phone: '+27834567890', type: 'Student', code: 'DEMO002', pin: '234567', orgId: mensaSA.id },
      { name: 'Sipho Dlamini', phone: '+27845678901', type: 'Unbanked', code: 'DEMO003', pin: '345678', orgId: breadline.id },
      { name: 'Nomsa Ndlovu', phone: '+27856789012', type: 'Migrant Worker', code: 'DEMO004', pin: '456789', orgId: sancob.id },
      { name: 'Jabu Mthembu', phone: '+27867890123', type: 'Student', code: 'DEMO005', pin: '567890', orgId: mensaSA.id },
    ];

    const demoTags = [];
    for (const beneficiary of beneficiaryData) {
      // Create wallet for tag
      let wallet: any;
      if (supabase) {
        const { data, error } = await supabase.from('wallets').insert(snakeifyRow({
          type: 'TAG',
          name: `Tag ${beneficiary.code}`,
          balanceZAR: 0,
        })).select().maybeSingle();
        if (error) throw error;
        wallet = camelizeRow(data as any);
      } else {
        const [row] = await db.insert(wallets).values({
          type: 'TAG',
          name: `Tag ${beneficiary.code}`,
          balanceZAR: 0,
        }).returning();
        wallet = row;
      }

      // Create tag
      let tag: any;
      if (supabase) {
        const { data, error } = await supabase.from('tags').insert(snakeifyRow({
          tagCode: beneficiary.code,
          walletId: wallet.id,
          pin: beneficiary.pin,
          organizationId: beneficiary.orgId,
          beneficiaryType: beneficiary.type,
          beneficiaryName: beneficiary.name,
          beneficiaryPhone: beneficiary.phone,
          verificationStatus: beneficiary.code === 'DEMO001' ? 'approved' : 'pending',
          verifiedAt: beneficiary.code === 'DEMO001' ? new Date() : null,
          sumsubApplicantId: beneficiary.code === 'DEMO001' ? 'sumsub_demo_001' : null,
          referralCode: `TAG_${beneficiary.code}`,
        })).select().maybeSingle();
        if (error) throw error;
        tag = camelizeRow<Tag>(data as any);
      } else {
        const [row] = await db.insert(tags).values({
          tagCode: beneficiary.code,
          walletId: wallet.id,
          pin: beneficiary.pin,
          organizationId: beneficiary.orgId,
          beneficiaryType: beneficiary.type,
          beneficiaryName: beneficiary.name,
          beneficiaryPhone: beneficiary.phone,
          verificationStatus: beneficiary.code === 'DEMO001' ? 'approved' : 'pending',
          verifiedAt: beneficiary.code === 'DEMO001' ? new Date() : null,
          sumsubApplicantId: beneficiary.code === 'DEMO001' ? 'sumsub_demo_001' : null,
          referralCode: `TAG_${beneficiary.code}`,
        }).returning();
        tag = row;
      }

      demoTags.push({ tag, wallet, beneficiary });
    }

    console.log(`✅ Created ${demoTags.length} Freedom Tag beneficiaries\n`);

    console.log('💰 Creating demo philanthropists (donors)...');

    // Create philanthropist wallets and accounts
    const philanthropistData = [
      { 
        email: 'demo.donor@freedomtag.org',
        displayName: 'Sarah van der Merwe',
        bio: 'Tech entrepreneur passionate about social impact',
        country: 'South Africa',
        isAnonymous: 0,
        initialBalance: 50000000, // R500,000 in cents
        referralCode: 'DONOR_SARAH'
      },
      { 
        email: 'crypto.phil@freedomtag.org',
        displayName: 'Michael Chen',
        bio: 'Cryptocurrency investor supporting local communities',
        country: 'Singapore',
        isAnonymous: 0,
        initialBalance: 100000000, // R1,000,000 in cents
        referralCode: 'DONOR_MICHAEL'
      },
      { 
        email: 'anonymous.giving@freedomtag.org',
        displayName: 'Anonymous Donor',
        bio: 'Prefer to give without recognition',
        country: 'South Africa',
        isAnonymous: 1,
        initialBalance: 25000000, // R250,000 in cents
        referralCode: 'DONOR_ANON'
      },
    ];

    const demoPhilanthropists = [];
    for (const phil of philanthropistData) {
      // Create wallet
      let wallet: any;
      if (supabase) {
        const { data, error } = await supabase.from('wallets').insert({
          type: 'PHILANTHROPIST',
          name: phil.displayName,
          balance_zar: phil.initialBalance,
        }).select().maybeSingle();
        if (error) throw error;
        wallet = camelizeRow(data as any);
      } else {
        const [row] = await db.insert(wallets).values({
          type: 'PHILANTHROPIST',
          name: phil.displayName,
          balanceZAR: phil.initialBalance,
        }).returning();
        wallet = row;
      }

      // Create philanthropist
      let philanthropist: any;
      if (supabase) {
        const { data, error } = await supabase.from('philanthropists').insert({
          email: phil.email,
          password_hash: passwordHash,
          display_name: phil.displayName,
          bio: phil.bio,
          wallet_id: wallet.id,
          is_anonymous: phil.isAnonymous,
          country: phil.country,
          referral_code: phil.referralCode,
        }).select().maybeSingle();
        if (error) throw error;
        philanthropist = camelizeRow(data as any);
      } else {
        const [row] = await db.insert(philanthropists).values({
          email: phil.email,
          passwordHash,
          displayName: phil.displayName,
          bio: phil.bio,
          walletId: wallet.id,
          isAnonymous: phil.isAnonymous,
          country: phil.country,
          referralCode: phil.referralCode,
        }).returning();
        philanthropist = row;
      }
        email: phil.email,
        passwordHash,
        displayName: phil.displayName,
        bio: phil.bio,
        walletId: wallet.id,
        isAnonymous: phil.isAnonymous,
        country: phil.country,
        referralCode: phil.referralCode,
      }).returning();

      demoPhilanthropists.push({ philanthropist, wallet, data: phil });
    }

    console.log(`✅ Created ${demoPhilanthropists.length} demo philanthropists\n`);

    console.log('🏪 Creating demo merchant chains and outlets...');

    // Create merchant chain
      let shoprite: any;
      if (supabase) {
        const { data, error } = await supabase.from('merchant_chains').insert(snakeifyRow({
          name: 'Shoprite',
          description: 'Pan-African supermarket chain',
        })).select().maybeSingle();
        if (error) throw error;
        shoprite = camelizeRow(data as any);
      } else {
        const [row] = await db.insert(merchantChains).values({
          name: 'Shoprite',
          description: 'Pan-African supermarket chain',
        }).returning();
        shoprite = row;
      }

    
      let woolworths: any;
      if (supabase) {
        const { data, error } = await supabase.from('merchant_chains').insert(snakeifyRow({
          name: 'Woolworths',
          description: 'Premium retail chain focused on food and clothing',
        })).select().maybeSingle();
        if (error) throw error;
        woolworths = camelizeRow(data as any);
      } else {
        const [row] = await db.insert(merchantChains).values({
          name: 'Woolworths',
          description: 'Premium retail chain focused on food and clothing',
        }).returning();
        woolworths = row;
      }

    // Create merchant outlets
    const outletData = [
      { chain: shoprite.id, town: 'Cape Town CBD', region: 'Western Cape', balance: 15000000 },
      { chain: shoprite.id, town: 'Johannesburg', region: 'Gauteng', balance: 20000000 },
      { chain: shoprite.id, town: 'Durban', region: 'KwaZulu-Natal', balance: 12000000 },
      { chain: woolworths.id, town: 'Sandton', region: 'Gauteng', balance: 8000000 },
      { chain: woolworths.id, town: 'Cape Town V&A', region: 'Western Cape', balance: 10000000 },
    ];

    const demoOutlets = [];
    for (const outlet of outletData) {
      let wallet: any;
      if (supabase) {
        const { data, error } = await supabase.from('wallets').insert({
          type: 'MERCHANT',
          name: `${outlet.chain === shoprite.id ? 'Shoprite' : 'Woolworths'} - ${outlet.town}`,
          balance_zar: outlet.balance,
        }).select().maybeSingle();
        if (error) throw error;
        wallet = camelizeRow(data as any);
      } else {
        const [row] = await db.insert(wallets).values({
          type: 'MERCHANT',
          name: `${outlet.chain === shoprite.id ? 'Shoprite' : 'Woolworths'} - ${outlet.town}`,
          balanceZAR: outlet.balance,
        }).returning();
        wallet = row;
      }

      let merchantOutlet: any;
      if (supabase) {
        const { data, error } = await supabase.from('merchant_outlets').insert({
          chain_id: outlet.chain,
          wallet_id: wallet.id,
          display_name: `${outlet.chain === shoprite.id ? 'Shoprite' : 'Woolworths'} - ${outlet.town}`,
          town: outlet.town,
          region: outlet.region,
          status: 'active',
          referral_code: `MERCHANT_${outlet.town.replace(/\s+/g, '_').toUpperCase()}`,
        }).select().maybeSingle();
        if (error) throw error;
        merchantOutlet = camelizeRow(data as any);
      } else {
        const [row] = await db.insert(merchantOutlets).values({
          chainId: outlet.chain,
          walletId: wallet.id,
          displayName: `${outlet.chain === shoprite.id ? 'Shoprite' : 'Woolworths'} - ${outlet.town}`,
          town: outlet.town,
          region: outlet.region,
          status: 'active',
          referralCode: `MERCHANT_${outlet.town.replace(/\s+/g, '_').toUpperCase()}`,
        }).returning();
        merchantOutlet = row;
      }

      demoOutlets.push({ outlet: merchantOutlet, wallet });
    }

    console.log(`✅ Created ${demoOutlets.length} merchant outlets across 2 chains\n`);

    console.log('💸 Creating realistic transaction history...');

    const demoTransactions = [];

    // 1. FIAT DONATIONS from philanthropists to tags
    const fiatDonations = [
      { from: demoPhilanthropists[0].wallet, to: demoTags[0].wallet, amount: 50000, donor: demoPhilanthropists[0], tag: demoTags[0] },
      { from: demoPhilanthropists[0].wallet, to: demoTags[1].wallet, amount: 100000, donor: demoPhilanthropists[0], tag: demoTags[1] },
      { from: demoPhilanthropists[1].wallet, to: demoTags[2].wallet, amount: 200000, donor: demoPhilanthropists[1], tag: demoTags[2] },
      { from: demoPhilanthropists[2].wallet, to: demoTags[0].wallet, amount: 75000, donor: demoPhilanthropists[2], tag: demoTags[0] },
      { from: demoPhilanthropists[1].wallet, to: demoTags[3].wallet, amount: 150000, donor: demoPhilanthropists[1], tag: demoTags[3] },
    ];

    for (const donation of fiatDonations) {
      const txHash = generateTxHash();
      const [tx] = await db.insert(transactions).values({
        ts: generateRecentTimestamp(),
        kind: 'DONATION',
        fromWalletId: donation.from.id,
        toWalletId: donation.to.id,
        amount: donation.amount,
        currency: 'ZAR',
        donorCountry: donation.donor.data.country,
        taxDeductible: 1,
        donorName: donation.donor.data.isAnonymous ? 'Anonymous' : donation.donor.data.displayName,
        donorEmail: donation.donor.philanthropist.email,
        donorTagCode: donation.tag.tag.tagCode,
        blockchainTxHash: txHash,
        blockchainNetwork: 'Polygon',
        ref: `FIAT_DONATION_${generateEtherscanUrl(txHash)}`,
      }).returning();

      // Update balances
      await db.update(wallets).set({ 
        balanceZAR: donation.from.balanceZAR - donation.amount 
      }).where(eq(wallets.id, donation.from.id));
      
      await db.update(wallets).set({ 
        balanceZAR: donation.to.balanceZAR + donation.amount 
      }).where(eq(wallets.id, donation.to.id));

      demoTransactions.push(tx);

      // Create a story for some donations
      if (Math.random() > 0.5) {
        await db.insert(stories).values({
          transactionId: tx.id,
          authorType: Math.random() > 0.5 ? 'GIVER' : 'RECEIVER',
          message: Math.random() > 0.5 
            ? `So grateful for this support! It means everything to me. 🙏`
            : `Happy to help make a difference in someone's life today!`,
          isPublic: 1,
          showAmount: 1,
          showGiver: donation.donor.data.isAnonymous ? 0 : 1,
          showRecipient: 1,
          sharingPlatforms: ['twitter', 'facebook'],
        });
      }
    }

    // 2. CRYPTO DONATIONS (USDT, BTC, ETH)
    const cryptoDonations = [
      { from: demoPhilanthropists[1].wallet, to: demoTags[1].wallet, crypto: 'USDT', amount: 100, donor: demoPhilanthropists[1], tag: demoTags[1] }, // 100 USDT
      { from: demoPhilanthropists[1].wallet, to: demoTags[4].wallet, crypto: 'ETH', amount: 0.05, donor: demoPhilanthropists[1], tag: demoTags[4] }, // 0.05 ETH
      { from: demoPhilanthropists[0].wallet, to: demoTags[2].wallet, crypto: 'BTC', amount: 0.001, donor: demoPhilanthropists[0], tag: demoTags[2] }, // 0.001 BTC
    ];

    for (const donation of cryptoDonations) {
      const txHash = generateTxHash();
      const zarAmount = Math.floor(donation.amount * (
        donation.crypto === 'USDT' ? 1850 :
        donation.crypto === 'ETH' ? 5500000 :
        120000000 // BTC
      ));
      
      const [tx] = await db.insert(transactions).values({
        ts: generateRecentTimestamp(),
        kind: 'CRYPTO_DONATION',
        fromWalletId: donation.from.id,
        toWalletId: donation.to.id,
        amount: zarAmount,
        currency: donation.crypto,
        donorCountry: donation.donor.data.country,
        taxDeductible: 1,
        donorName: donation.donor.data.displayName,
        donorEmail: donation.donor.philanthropist.email,
        donorTagCode: donation.tag.tag.tagCode,
        blockchainTxHash: txHash,
        blockchainNetwork: donation.crypto === 'USDT' ? 'TRON' : 'Ethereum',
        ref: `${donation.crypto}_${donation.amount}_${generateEtherscanUrl(txHash)}`,
      }).returning();

      // Update balances (crypto converted to ZAR)
      await db.update(wallets).set({ 
        balanceZAR: donation.from.balanceZAR - zarAmount
      }).where(eq(wallets.id, donation.from.id));
      
      await db.update(wallets).set({ 
        balanceZAR: donation.to.balanceZAR + zarAmount 
      }).where(eq(wallets.id, donation.to.id));

      demoTransactions.push(tx);
    }

    // 3. TAG-TO-TAG TRANSFERS
    const tagTransfers = [
      { from: demoTags[0], to: demoTags[1], amount: 5000 },
      { from: demoTags[2], to: demoTags[3], amount: 10000 },
    ];

    for (const transfer of tagTransfers) {
      const txHash = generateTxHash();
      const [tx] = await db.insert(transactions).values({
        ts: generateRecentTimestamp(),
        kind: 'TAG_TRANSFER',
        fromWalletId: transfer.from.wallet.id,
        toWalletId: transfer.to.wallet.id,
        amount: transfer.amount,
        currency: 'ZAR',
        blockchainTxHash: txHash,
        blockchainNetwork: 'Polygon',
        ref: `P2P_${generateEtherscanUrl(txHash)}`,
      }).returning();

      // Update balances
      await db.update(wallets).set({ 
        balanceZAR: transfer.from.wallet.balanceZAR - transfer.amount 
      }).where(eq(wallets.id, transfer.from.wallet.id));
      
      await db.update(wallets).set({ 
        balanceZAR: transfer.to.wallet.balanceZAR + transfer.amount 
      }).where(eq(wallets.id, transfer.to.wallet.id));

      demoTransactions.push(tx);
    }

    // 4. MERCHANT REDEMPTIONS
    const merchantRedemptions = [
      { tag: demoTags[0], merchant: demoOutlets[0], amount: 25000 }, // Groceries
      { tag: demoTags[1], merchant: demoOutlets[3], amount: 15000 }, // Clothing
      { tag: demoTags[2], merchant: demoOutlets[1], amount: 30000 }, // Food
      { tag: demoTags[3], merchant: demoOutlets[2], amount: 20000 }, // Essentials
    ];

    for (const redemption of merchantRedemptions) {
      const txHash = generateTxHash();
      const [tx] = await db.insert(transactions).values({
        ts: generateRecentTimestamp(),
        kind: 'REDEMPTION',
        fromWalletId: redemption.tag.wallet.id,
        toWalletId: redemption.merchant.wallet.id,
        amount: redemption.amount,
        merchantOutletId: redemption.merchant.outlet.id,
        currency: 'ZAR',
        blockchainTxHash: txHash,
        blockchainNetwork: 'Polygon',
        ref: `MERCHANT_${generateEtherscanUrl(txHash)}`,
      }).returning();

      // Update balances
      await db.update(wallets).set({ 
        balanceZAR: redemption.tag.wallet.balanceZAR - redemption.amount 
      }).where(eq(wallets.id, redemption.tag.wallet.id));
      
      await db.update(wallets).set({ 
        balanceZAR: redemption.merchant.wallet.balanceZAR + redemption.amount 
      }).where(eq(wallets.id, redemption.merchant.wallet.id));

      demoTransactions.push(tx);
    }

    console.log(`✅ Created ${demoTransactions.length} realistic transactions\n`);

    console.log('🔄 Setting up recurring donations...');

    // Create recurring donations (active and paused)
    const recurringDonationData = [
      {
        philanthropist: demoPhilanthropists[0].philanthropist,
        recipientType: 'TAG' as const,
        recipientId: demoTags[0].tag.tagCode,
        amountCents: 10000, // $100 USD
        cryptocurrency: 'USDT',
        status: 'active' as const,
        donorName: demoPhilanthropists[0].data.displayName,
      },
      {
        philanthropist: demoPhilanthropists[1].philanthropist,
        recipientType: 'ORGANIZATION' as const,
        recipientId: sancob.id,
        amountCents: 50000, // $500 USD
        cryptocurrency: 'USDT',
        status: 'active' as const,
        donorName: demoPhilanthropists[1].data.displayName,
      },
      {
        philanthropist: demoPhilanthropists[0].philanthropist,
        recipientType: 'ORGANIZATION' as const,
        recipientId: breadline.id,
        amountCents: 25000, // $250 USD
        cryptocurrency: 'ETH',
        status: 'paused' as const,
        donorName: demoPhilanthropists[0].data.displayName,
      },
    ];

    for (const recurring of recurringDonationData) {
      await db.insert(recurringDonations).values({
        philanthropistId: recurring.philanthropist.id,
        recipientType: recurring.recipientType,
        recipientId: recurring.recipientId,
        amountCents: recurring.amountCents,
        cryptocurrency: recurring.cryptocurrency,
        frequency: 'monthly',
        status: recurring.status,
        autoDonatesDust: 1,
        dustThresholdCents: 100,
        donorName: recurring.donorName,
        nextProcessingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      });
    }

    console.log(`✅ Created ${recurringDonationData.length} recurring donations\n`);

    console.log('🔗 Creating referral relationships...');

    // Create referral relationships
    const referralData = [
      {
        referrerCode: demoPhilanthropists[0].data.referralCode,
        referrerType: 'PHILANTHROPIST' as const,
        referredCode: demoTags[1].tag.referralCode!,
        referredType: 'TAG' as const,
        rewardAmount: 10000, // R100 bonus
        rewardPaid: 1,
      },
      {
        referrerCode: 'SANCOB2024',
        referrerType: 'ORGANIZATION' as const,
        referredCode: demoPhilanthropists[2].data.referralCode,
        referredType: 'PHILANTHROPIST' as const,
        rewardAmount: 50000, // R500 bonus
        rewardPaid: 1,
      },
      {
        referrerCode: demoTags[0].tag.referralCode!,
        referrerType: 'TAG' as const,
        referredCode: demoTags[4].tag.referralCode!,
        referredType: 'TAG' as const,
        rewardAmount: 5000, // R50 bonus
        rewardPaid: 0, // Pending
      },
    ];

    for (const referral of referralData) {
      await db.insert(referrals).values(referral);
    }

    console.log(`✅ Created ${referralData.length} referral relationships\n`);

    console.log('📊 Demo Data Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  🏢 Organizations: ${3} (SANCOB, Breadline Africa, Mensa SA)`);
    console.log(`  🏷️  Freedom Tags: ${demoTags.length} beneficiaries`);
    console.log(`  💰 Philanthropists: ${demoPhilanthropists.length} donors`);
    console.log(`  🏪 Merchant Outlets: ${demoOutlets.length} across 2 chains`);
    console.log(`  💸 Transactions: ${demoTransactions.length} (donations, transfers, redemptions)`);
    console.log(`  🔄 Recurring Donations: ${recurringDonationData.length} (${recurringDonationData.filter(r => r.status === 'active').length} active)`);
    console.log(`  🔗 Referrals: ${referralData.length} relationships`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ Demo data seeding completed successfully!\n');
    console.log('🔑 Demo Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Philanthropist 1:');
    console.log('    Email: demo.donor@freedomtag.org');
    console.log('    Password: demo1234');
    console.log('    Balance: R500,000');
    console.log('');
    console.log('  Philanthropist 2:');
    console.log('    Email: crypto.phil@freedomtag.org');
    console.log('    Password: demo1234');
    console.log('    Balance: R1,000,000');
    console.log('');
    console.log('  Freedom Tag (Thabo):');
    console.log('    Tag Code: DEMO001');
    console.log('    PIN: 123456');
    console.log('    Status: Verified');
    console.log('');
    console.log('  Freedom Tag (Lindiwe):');
    console.log('    Tag Code: DEMO002');
    console.log('    PIN: 234567');
    console.log('    Status: Pending');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    throw error;
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
