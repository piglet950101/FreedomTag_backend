import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Unified user authentication system
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  country: text("country"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  isEmailVerified: integer("is_email_verified").default(0),
  blockkoinAccountId: text("blockkoin_account_id"), // Auto-created Blockkoin account
  blockkoinKycStatus: text("blockkoin_kyc_status").default('none').$type<'none' | 'pending' | 'verified' | 'rejected'>(), // KYC for $50+ transactions
  preferredCurrency: text("preferred_currency").default('ZAR'), // Auto-convert target currency
  createdAt: timestamp("created_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

// Role-based access control
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: text("role").notNull().$type<'BENEFICIARY' | 'MERCHANT' | 'PHILANTHROPIST' | 'ORGANIZATION' | 'ADMIN'>(),
  entityId: varchar("entity_id"), // Links to specific tag, merchant, philanthropist, or organization
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  parentId: varchar("parent_id"),
  country: text("country"),
  taxId: text("tax_id"),
  charityRegistrationNumber: text("charity_registration_number"),
  taxExemptStatus: text("tax_exempt_status").default('pending').$type<'approved' | 'pending' | 'rejected'>(),
  smartContractAddress: text("smart_contract_address"), // Fireblocks blockchain smart contract address
  blockchainNetwork: text("blockchain_network"), // e.g., "Ethereum", "Polygon", etc.
  contractDeployedAt: timestamp("contract_deployed_at"),
  referralCode: varchar("referral_code").unique(),
  referredBy: varchar("referred_by"),
  website: text("website"),
  facebook: text("facebook"),
  twitter: text("twitter"),
  instagram: text("instagram"),
  linkedin: text("linkedin"),
  description: text("description"),
  logoUrl: text("logo_url"),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  
  // USDT Auto-Convert fields
  kybStatus: text("kyb_status").default('pending').$type<'pending' | 'verified' | 'rejected'>(), // Know Your Business verification
  fireblocksVaultId: text("fireblocks_vault_id"), // Fireblocks custody vault ID for USDT
  usdtBalanceCents: integer("usdt_balance_cents").default(0), // USDT balance in cents (for tracking)
  payoutPreference: text("payout_preference").default('BANK').$type<'BANK' | 'USDT'>(), // Preferred payout method
  bankAccountRef: text("bank_account_ref"), // Reference to bank account for fiat payouts
});

export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull().$type<'TAG' | 'MERCHANT' | 'PHILANTHROPIST'>(),
  name: text("name").notNull(),
  balanceZAR: integer("balance_zar").notNull().default(0),
});

export const tags = pgTable("tags", {
  tagCode: varchar("tag_code").primaryKey(),
  walletId: varchar("wallet_id").notNull(),
  userId: varchar("user_id"), // Links to unified users table
  pin: varchar("pin", { length: 6 }), // Legacy PIN system (optional with unified auth)
  organizationId: varchar("organization_id"),
  beneficiaryType: text("beneficiary_type"),
  beneficiaryName: text("beneficiary_name"),
  beneficiaryPhone: text("beneficiary_phone"),
  issuedAt: timestamp("issued_at").defaultNow(),
  sumsubApplicantId: varchar("sumsub_applicant_id"),
  verificationStatus: text("verification_status").default('pending').$type<'pending' | 'approved' | 'rejected'>(),
  verifiedAt: timestamp("verified_at"),
  referralCode: varchar("referral_code").unique(),
  referredBy: varchar("referred_by"),
  website: text("website"),
  facebook: text("facebook"),
  twitter: text("twitter"),
  instagram: text("instagram"),
  linkedin: text("linkedin"),
  description: text("description"),
  logoUrl: text("logo_url"),
});

export const merchantChains = pgTable("merchant_chains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const merchantOutlets = pgTable("merchant_outlets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  outletCode: varchar("outlet_code").unique(),
  chainId: varchar("chain_id").notNull(),
  walletId: varchar("wallet_id").notNull().unique(),
  userId: varchar("user_id"), // Links to unified users table
  displayName: text("display_name").notNull(),
  town: text("town").notNull(),
  region: text("region"),
  address: text("address"),
  status: text("status").notNull().default('active').$type<'active' | 'inactive'>(),
  referralCode: varchar("referral_code").unique(),
  referredBy: varchar("referred_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ts: timestamp("ts").notNull().defaultNow(),
  kind: text("kind").notNull(),
  fromWalletId: varchar("from_wallet_id"),
  toWalletId: varchar("to_wallet_id"),
  amount: integer("amount").notNull(),
  ref: text("ref"),
  merchantOutletId: varchar("merchant_outlet_id"),
  currency: text("currency").default('ZAR'),
  donorCountry: text("donor_country"),
  taxDeductible: integer("tax_deductible").default(1),
  donorName: text("donor_name"),
  donorEmail: text("donor_email"),
  donorTagCode: varchar("donor_tag_code"), // Freedom Tag code used to make donation (for account-based tracking)
  blockchainTxHash: text("blockchain_tx_hash"),
  blockchainNetwork: text("blockchain_network"),
  cryptoPaymentId: text("crypto_payment_id"), // Blockkoin payment ID for tracking
  status: text("status").default('completed').$type<'pending' | 'completed' | 'failed'>(), // Payment status
});

export const taxReceipts = pgTable("tax_receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").notNull(),
  organizationId: varchar("organization_id").notNull(),
  donorName: text("donor_name"),
  donorEmail: text("donor_email"),
  donorTaxId: text("donor_tax_id"),
  donorCountry: text("donor_country").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  taxYear: integer("tax_year").notNull(),
  receiptNumber: text("receipt_number").notNull().unique(),
  issuedAt: timestamp("issued_at").defaultNow(),
  pdfUrl: text("pdf_url"),
});

export const philanthropists = pgTable("philanthropists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"), // Links to unified users table (replaces email/password)
  email: text("email").notNull().unique(), // Keep for legacy compatibility
  passwordHash: text("password_hash").notNull(), // Keep for legacy compatibility
  displayName: text("display_name"),
  bio: text("bio"),
  walletId: varchar("wallet_id").notNull().unique(),
  isAnonymous: integer("is_anonymous").default(1),
  country: text("country"),
  referralCode: varchar("referral_code").unique(),
  referredBy: varchar("referred_by"),
  blockkoinAccountId: text("blockkoin_account_id"), // Auto-created Blockkoin account
  blockkoinKycStatus: text("blockkoin_kyc_status").default('none').$type<'none' | 'pending' | 'verified' | 'rejected'>(), // KYC for $50+ transactions
  createdAt: timestamp("created_at").defaultNow(),
});

export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerCode: varchar("referrer_code").notNull(),
  referrerType: text("referrer_type").notNull().$type<'PHILANTHROPIST' | 'TAG' | 'MERCHANT' | 'ORGANIZATION'>(),
  referredCode: varchar("referred_code").notNull(),
  referredType: text("referred_type").notNull().$type<'PHILANTHROPIST' | 'TAG' | 'MERCHANT' | 'ORGANIZATION'>(),
  createdAt: timestamp("created_at").defaultNow(),
  rewardAmount: integer("reward_amount").default(0),
  rewardPaid: integer("reward_paid").default(0),
});

export const stories = pgTable("stories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").notNull(),
  authorType: text("author_type").notNull().$type<'GIVER' | 'RECEIVER'>(),
  message: text("message").notNull(),
  photoUrl: text("photo_url"),
  isPublic: integer("is_public").default(1),
  showAmount: integer("show_amount").default(1),
  showGiver: integer("show_giver").default(0),
  showRecipient: integer("show_recipient").default(1),
  sharingPlatforms: text("sharing_platforms").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow(),
});

export const recurringDonations = pgTable("recurring_donations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  philanthropistId: varchar("philanthropist_id").notNull(),
  recipientType: text("recipient_type").notNull().$type<'TAG' | 'ORGANIZATION'>(),
  recipientId: varchar("recipient_id").notNull(), // tagCode or organizationId
  amountCents: integer("amount_cents").notNull(), // Amount in USD cents for consistency
  cryptocurrency: text("cryptocurrency").notNull().default('USDT'), // USDT, BTC, ETH, USDC, DAI, etc.
  frequency: text("frequency").notNull().default('monthly').$type<'monthly'>(),
  status: text("status").notNull().default('active').$type<'active' | 'paused' | 'cancelled'>(),
  autoDonatesDust: integer("auto_donates_dust").default(1), // Auto-donate dust amounts
  dustThresholdCents: integer("dust_threshold_cents").default(100), // $1 USD threshold
  donorName: text("donor_name"), // Optional attribution
  nextProcessingDate: timestamp("next_processing_date"),
  lastProcessedAt: timestamp("last_processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLoginAt: true,
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  createdAt: true,
}).extend({
  role: z.enum(['BENEFICIARY', 'MERCHANT', 'PHILANTHROPIST', 'ORGANIZATION', 'ADMIN']),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
});

export const insertWalletSchema = createInsertSchema(wallets).omit({
  id: true,
}).extend({
  type: z.enum(['TAG', 'MERCHANT', 'PHILANTHROPIST']),
});

export const insertTagSchema = createInsertSchema(tags).omit({
  issuedAt: true,
});

export const insertMerchantChainSchema = createInsertSchema(merchantChains).omit({
  id: true,
  createdAt: true,
});

export const insertMerchantOutletSchema = createInsertSchema(merchantOutlets).omit({
  id: true,
  createdAt: true,
}).extend({
  status: z.enum(['active', 'inactive']).default('active'),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  ts: true,
});

export const insertTaxReceiptSchema = createInsertSchema(taxReceipts).omit({
  id: true,
  issuedAt: true,
});

export const insertPhilanthropistSchema = createInsertSchema(philanthropists).omit({
  id: true,
  createdAt: true,
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
}).extend({
  referrerType: z.enum(['PHILANTHROPIST', 'TAG', 'MERCHANT', 'ORGANIZATION']),
  referredType: z.enum(['PHILANTHROPIST', 'TAG', 'MERCHANT', 'ORGANIZATION']),
});

export const insertStorySchema = createInsertSchema(stories).omit({
  id: true,
  createdAt: true,
}).extend({
  authorType: z.enum(['GIVER', 'RECEIVER']),
});

export const insertRecurringDonationSchema = createInsertSchema(recurringDonations).omit({
  id: true,
  createdAt: true,
  lastProcessedAt: true,
}).extend({
  recipientType: z.enum(['TAG', 'ORGANIZATION']),
  frequency: z.enum(['monthly']).default('monthly'),
  status: z.enum(['active', 'paused', 'cancelled']).default('active'),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof wallets.$inferSelect;

export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tags.$inferSelect;

export type InsertMerchantChain = z.infer<typeof insertMerchantChainSchema>;
export type MerchantChain = typeof merchantChains.$inferSelect;

export type InsertMerchantOutlet = z.infer<typeof insertMerchantOutletSchema>;
export type MerchantOutlet = typeof merchantOutlets.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertTaxReceipt = z.infer<typeof insertTaxReceiptSchema>;
export type TaxReceipt = typeof taxReceipts.$inferSelect;

export type InsertPhilanthropist = z.infer<typeof insertPhilanthropistSchema>;
export type Philanthropist = typeof philanthropists.$inferSelect;

export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;

export type InsertStory = z.infer<typeof insertStorySchema>;
export type Story = typeof stories.$inferSelect;

export type InsertRecurringDonation = z.infer<typeof insertRecurringDonationSchema>;
export type RecurringDonation = typeof recurringDonations.$inferSelect;

// Disaster relief campaigns (Dusty Bin) - only smart contract verified organizations
export const disasterCampaigns = pgTable("disaster_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  disasterType: text("disaster_type").notNull(), // e.g., "Earthquake", "Flood", "Hurricane"
  location: text("location").notNull(),
  urgencyLevel: text("urgency_level").notNull().$type<'critical' | 'high' | 'moderate'>(),
  status: text("status").notNull().default('active').$type<'active' | 'completed' | 'cancelled'>(),
  totalRaisedCents: integer("total_raised_cents").notNull().default(0), // Amount raised in ZAR cents
  voteCount: integer("vote_count").notNull().default(0),
  monthYear: text("month_year").notNull(), // Format: "2025-01" for grouping by month
  createdAt: timestamp("created_at").defaultNow(),
  distributedAt: timestamp("distributed_at"),
});

// Dusty bin donations - user crypto dust donations
export const dustyBinDonations = pgTable("dusty_bin_donations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  cryptocurrency: text("cryptocurrency").notNull(),
  amountCrypto: text("amount_crypto").notNull(), // Crypto amount as string for precision
  amountUsdCents: integer("amount_usd_cents").notNull(), // USD value in cents
  monthYear: text("month_year").notNull(), // Format: "2025-01"
  createdAt: timestamp("created_at").defaultNow(),
});

// User votes for disaster campaigns
export const campaignVotes = pgTable("campaign_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  campaignId: varchar("campaign_id").notNull().references(() => disasterCampaigns.id),
  monthYear: text("month_year").notNull(), // Format: "2025-01"
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDisasterCampaignSchema = createInsertSchema(disasterCampaigns).omit({
  id: true,
  totalRaisedCents: true,
  voteCount: true,
  createdAt: true,
  distributedAt: true,
});

export const insertDustyBinDonationSchema = createInsertSchema(dustyBinDonations).omit({
  id: true,
  createdAt: true,
});

export const insertCampaignVoteSchema = createInsertSchema(campaignVotes).omit({
  id: true,
  createdAt: true,
});

export type InsertDisasterCampaign = z.infer<typeof insertDisasterCampaignSchema>;
export type DisasterCampaign = typeof disasterCampaigns.$inferSelect;

export type InsertDustyBinDonation = z.infer<typeof insertDustyBinDonationSchema>;
export type DustyBinDonation = typeof dustyBinDonations.$inferSelect;

export type InsertCampaignVote = z.infer<typeof insertCampaignVoteSchema>;
export type CampaignVote = typeof campaignVotes.$inferSelect;

// WhatsApp Business API Demo Tables
export const whatsappContacts = pgTable("whatsapp_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: text("phone_number").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  source: text("source").default('demo'),
  lastMessageAt: timestamp("last_message_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const whatsappConversations = pgTable("whatsapp_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => whatsappContacts.id),
  status: text("status").notNull().default('active').$type<'active' | 'resolved' | 'archived'>(),
  assignedTo: varchar("assigned_to"),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const whatsappMessages = pgTable("whatsapp_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => whatsappConversations.id),
  direction: text("direction").notNull().$type<'incoming' | 'outgoing'>(),
  messageType: text("message_type").notNull().$type<'text' | 'image' | 'document' | 'template' | 'button' | 'list'>(),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  status: text("status").default('sent').$type<'sent' | 'delivered' | 'read' | 'failed'>(),
  isAiGenerated: integer("is_ai_generated").default(0),
  sentAt: timestamp("sent_at").defaultNow(),
});

export const whatsappTickets = pgTable("whatsapp_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: text("ticket_number").notNull().unique(),
  conversationId: varchar("conversation_id").notNull().references(() => whatsappConversations.id),
  contactId: varchar("contact_id").notNull().references(() => whatsappContacts.id),
  subject: text("subject").notNull(),
  priority: text("priority").notNull().default('medium').$type<'low' | 'medium' | 'high' | 'urgent'>(),
  status: text("status").notNull().default('open').$type<'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'>(),
  assignedTo: varchar("assigned_to"),
  category: text("category"),
  notes: text("notes"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWhatsappContactSchema = createInsertSchema(whatsappContacts).omit({
  id: true,
  createdAt: true,
});

export const insertWhatsappConversationSchema = createInsertSchema(whatsappConversations).omit({
  id: true,
  createdAt: true,
}).extend({
  status: z.enum(['active', 'resolved', 'archived']).default('active'),
});

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({
  id: true,
  sentAt: true,
}).extend({
  direction: z.enum(['incoming', 'outgoing']),
  messageType: z.enum(['text', 'image', 'document', 'template', 'button', 'list']),
  status: z.enum(['sent', 'delivered', 'read', 'failed']).optional(),
});

export const insertWhatsappTicketSchema = createInsertSchema(whatsappTickets).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
}).extend({
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['open', 'in_progress', 'waiting', 'resolved', 'closed']).default('open'),
});

export type InsertWhatsappContact = z.infer<typeof insertWhatsappContactSchema>;
export type WhatsappContact = typeof whatsappContacts.$inferSelect;

export type InsertWhatsappConversation = z.infer<typeof insertWhatsappConversationSchema>;
export type WhatsappConversation = typeof whatsappConversations.$inferSelect;

export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;

export type InsertWhatsappTicket = z.infer<typeof insertWhatsappTicketSchema>;
export type WhatsappTicket = typeof whatsappTickets.$inferSelect;

// ========== USDT Auto-Convert System ==========

// Unified Donation Records - canonical record for all donations (fiat or crypto → USDT)
export const udr = pgTable("udr", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  
  // Channel and allocation
  channel: text("channel").notNull().$type<'FIAT' | 'CRYPTO'>(),
  charityId: varchar("charity_id").references(() => organizations.id),
  campaignId: varchar("campaign_id"),
  tagId: varchar("tag_id").references(() => tags.tagCode),
  
  // Source donation details
  amountSource: text("amount_source").notNull(), // Numeric string for precision
  currencySource: text("currency_source").notNull(), // ZAR, USD, ETH, BTC, etc.
  
  // Bank/PSP references (for fiat)
  bankRef: text("bank_ref"),
  pspRef: text("psp_ref"),
  
  // On-chain inbound (for crypto)
  onchainTxHashIn: text("onchain_tx_hash_in"),
  networkIn: text("network_in"), // Ethereum, Polygon, TRON, etc.
  
  // Conversion to USDT
  convertedAsset: text("converted_asset").notNull().default('USDT'),
  convertedAmount: text("converted_amount"), // Numeric string for precision
  fxRate: text("fx_rate"), // Exchange rate used
  conversionFee: text("conversion_fee"), // Fee in USDT
  
  // Fireblocks custody (transfer to charity vault)
  fireblocksVaultId: text("fireblocks_vault_id"),
  fireblocksTxIdToVault: text("fireblocks_tx_id_to_vault"),
  onchainTxHashToVault: text("onchain_tx_hash_to_vault"),
  networkToVault: text("network_to_vault"), // TRON, Polygon, Ethereum
  
  // Status tracking
  status: text("status").notNull().default('RECEIVED').$type<
    'RECEIVED' | 'CONVERTING' | 'CONVERTED' | 'ANCHORING' | 'ONCHAIN_CONFIRMED' | 'ALLOCATED' | 'SETTLED' | 'FAILED'
  >(),
  
  // Evidence and metadata
  evidence: text("evidence"), // JSON string with PSP receipts, exchange fills, etc.
  failureReason: text("failure_reason"),
});

// Payouts - charity withdrawals (USDT on-chain or fiat)
export const payouts = pgTable("payouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  charityId: varchar("charity_id").notNull().references(() => organizations.id),
  
  // Payout details
  type: text("type").notNull().$type<'FIAT' | 'USDT'>(),
  amount: text("amount").notNull(), // Numeric string for precision
  currency: text("currency").notNull(), // USDT, ZAR, USD, EUR, etc.
  
  // Status and execution
  status: text("status").notNull().default('QUEUED').$type<
    'QUEUED' | 'PROCESSING' | 'SENT' | 'SETTLED' | 'FAILED' | 'CANCELLED'
  >(),
  
  // On-chain details (for USDT withdrawals)
  recipientAddress: text("recipient_address"),
  network: text("network"), // TRON, Polygon, Ethereum
  txHash: text("tx_hash"),
  fireblocksTransferId: text("fireblocks_transfer_id"),
  
  // Bank details (for fiat payouts)
  bankAccountRef: text("bank_account_ref"),
  bankTransferRef: text("bank_transfer_ref"),
  
  // Conversion (if USDT → fiat)
  usdtSold: text("usdt_sold"), // Amount of USDT converted
  fxRate: text("fx_rate"),
  conversionFee: text("conversion_fee"),
  
  // Evidence and tracking
  evidence: text("evidence"), // JSON string with receipts, proofs
  failureReason: text("failure_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Insert schemas for USDT Auto-Convert tables
export const insertUdrSchema = createInsertSchema(udr).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  channel: z.enum(['FIAT', 'CRYPTO']),
  status: z.enum(['RECEIVED', 'CONVERTING', 'CONVERTED', 'ANCHORING', 'ONCHAIN_CONFIRMED', 'ALLOCATED', 'SETTLED', 'FAILED']).default('RECEIVED'),
});

export const insertPayoutSchema = createInsertSchema(payouts).omit({
  id: true,
  createdAt: true,
  completedAt: true,
}).extend({
  type: z.enum(['FIAT', 'USDT']),
  status: z.enum(['QUEUED', 'PROCESSING', 'SENT', 'SETTLED', 'FAILED', 'CANCELLED']).default('QUEUED'),
});

export type InsertUdr = z.infer<typeof insertUdrSchema>;
export type Udr = typeof udr.$inferSelect;

export type InsertPayout = z.infer<typeof insertPayoutSchema>;
export type Payout = typeof payouts.$inferSelect;

// Password Reset with Biometric KYC Verification (Sumsub)
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Can reference users.id or philanthropists.id
  userType: text("user_type").notNull().$type<'user' | 'philanthropist'>(), // Track which table the user is in
  email: text("email").notNull(),
  token: text("token").notNull().unique(), // Secure random token
  sumsubApplicantId: text("sumsub_applicant_id"), // Sumsub verification applicant ID
  sumsubAccessToken: text("sumsub_access_token"), // Temporary Sumsub SDK token
  verificationStatus: text("verification_status").notNull().default('pending').$type<'pending' | 'verified' | 'rejected'>(),
  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
}).extend({
  userType: z.enum(['user', 'philanthropist']),
  verificationStatus: z.enum(['pending', 'verified', 'rejected']).default('pending'),
});

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Enriched story type for public feed with transaction details
export type StoryFeedItem = {
  id: string;
  transactionId: string;
  authorType: 'GIVER' | 'RECEIVER';
  message: string;
  photoUrl: string | null;
  isPublic: number;
  showAmount: number;
  showGiver: number;
  showRecipient: number;
  sharingPlatforms: string[];
  createdAt: string; // ISO string (serialized from Date by Express)
  // Enriched fields from transaction and entities
  amountZAR: number | null;
  giverName: string | null;
  recipientName: string | null;
};

// Page-scoped Learn system - contextual help for user-action pages
export const learnEntries = pgTable("learn_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  route: text("route").notNull().unique(), // Page route, e.g., "/donate", "/tags/create"
  title: text("title").notNull(), // e.g., "Donate — How to use this page"
  howSteps: text("how_steps").array().notNull(), // Step-by-step instructions
  whatHappensNext: text("what_happens_next").array().notNull(), // Post-action outcomes
  requirements: text("requirements").array().notNull(), // Prerequisites for this page
  commonErrors: text("common_errors").notNull(), // JSON string of {code, fix}[]
  privacyNote: text("privacy_note"), // Optional privacy/trust message
  status: text("status").notNull().default('draft').$type<'draft' | 'needs_review' | 'published'>(),
  gitRef: text("git_ref"), // Short git commit hash when generated/updated
  createdAt: timestamp("created_at").defaultNow(),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow(),
  publishedAt: timestamp("published_at"),
  publishedBy: varchar("published_by"), // User ID who published
});

export const insertLearnEntrySchema = createInsertSchema(learnEntries).omit({
  id: true,
  createdAt: true,
  lastUpdatedAt: true,
}).extend({
  status: z.enum(['draft', 'needs_review', 'published']).default('draft'),
});

export type InsertLearnEntry = z.infer<typeof insertLearnEntrySchema>;
export type LearnEntry = typeof learnEntries.$inferSelect;
