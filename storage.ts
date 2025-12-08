// @ts-nocheck - Temporary: mixed Drizzle versions between shared & server cause type issues; will migrate to Supabase and fix typings
import { 
  type Wallet, 
  type InsertWallet, 
  type Tag, 
  type InsertTag, 
  type Transaction, 
  type InsertTransaction, 
  type Organization, 
  type InsertOrganization,
  type MerchantChain,
  type InsertMerchantChain,
  type MerchantOutlet,
  type InsertMerchantOutlet,
  type Philanthropist,
  type InsertPhilanthropist,
  type Referral,
  type InsertReferral,
  type Story,
  type InsertStory,
  type StoryFeedItem,
  type User,
  type InsertUser,
  type UserRole,
  type InsertUserRole,
  type RecurringDonation,
  type InsertRecurringDonation,
  type DisasterCampaign,
  type InsertDisasterCampaign,
  type CampaignVote,
  type InsertCampaignVote,
  type DustyBinDonation,
  type InsertDustyBinDonation,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type LearnEntry,
  type InsertLearnEntry,
  wallets, 
  tags, 
  transactions, 
  organizations,
  merchantChains,
  merchantOutlets,
  philanthropists,
  referrals,
  stories,
  users,
  userRoles,
  recurringDonations,
  disasterCampaigns,
  campaignVotes,
  dustyBinDonations,
  passwordResetTokens,
  learnEntries
} from "./shared/schema";
import { db, supabase } from "./db";
import { camelizeRow, camelizeRows, snakeifyRow } from "./supabase";
import { eq, desc, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export interface IStorage {
  // User operations (unified authentication)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  updateUserLastLogin(id: string): Promise<User>;
  updateUserPassword(id: string, passwordHash: string): Promise<User>;
  getUserRoles(userId: string): Promise<UserRole[]>;
  createUserRole(userRole: InsertUserRole): Promise<UserRole>;
  getUserWithRoles(userId: string): Promise<{ user: User; roles: UserRole[] } | undefined>;
  
  // Organization operations
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationByEmail(email: string): Promise<Organization | undefined>;
  getAllOrganizations(): Promise<Organization[]>;
  getOrganizationsByParent(parentId: string | null): Promise<Organization[]>;
  createOrganization(organization: InsertOrganization): Promise<Organization>;
  
  // Wallet operations
  getWallet(id: string): Promise<Wallet | undefined>;
  getAllWallets(): Promise<Wallet[]>;
  getMerchantWallets(): Promise<Wallet[]>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  updateWalletBalance(id: string, newBalance: number): Promise<Wallet>;
  
  // Tag operations
  getTag(tagCode: string): Promise<Tag | undefined>;
  getTagByUserId(userId: string): Promise<Tag | undefined>;
  getAllTags(): Promise<Tag[]>;
  getTagsByOrganization(organizationId: string): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTagVerification(tagCode: string, sumsubApplicantId: string, status: 'pending' | 'approved' | 'rejected'): Promise<Tag>;
  updateTagPin(tagCode: string, newPin: string): Promise<Tag>;
  
  // Merchant Chain operations
  getMerchantChain(id: string): Promise<MerchantChain | undefined>;
  getAllMerchantChains(): Promise<MerchantChain[]>;
  createMerchantChain(chain: InsertMerchantChain): Promise<MerchantChain>;
  
  // Merchant Outlet operations
  getMerchantOutlet(id: string): Promise<MerchantOutlet | undefined>;
  getMerchantOutletByCode(outletCode: string): Promise<MerchantOutlet | undefined>;
  getMerchantOutletsByChain(chainId: string): Promise<MerchantOutlet[]>;
  getAllMerchantOutlets(): Promise<MerchantOutlet[]>;
  createMerchantOutlet(outlet: InsertMerchantOutlet): Promise<MerchantOutlet>;
  
  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getAllTransactions(): Promise<Transaction[]>;
  updateTransactionAmount(id: string, amount: number): Promise<Transaction>;
  updateTransactionStatus(id: string, status: 'pending' | 'completed' | 'failed'): Promise<Transaction>;
  
  // Philanthropist operations
  getPhilanthropist(id: string): Promise<Philanthropist | undefined>;
  getPhilanthropistByEmail(email: string): Promise<Philanthropist | undefined>;
  getPhilanthropistByUserId(userId: string): Promise<Philanthropist | undefined>;
  createPhilanthropist(philanthropist: InsertPhilanthropist): Promise<Philanthropist>;
  getAllPhilanthropists(): Promise<Philanthropist[]>;
  
  // Referral operations
  createReferral(referral: InsertReferral): Promise<Referral>;
  getReferralsByReferrer(referrerCode: string): Promise<Referral[]>;
  getReferralsByReferred(referredCode: string): Promise<Referral[]>;
  lookupReferralCode(code: string): Promise<{ type: 'PHILANTHROPIST' | 'TAG' | 'MERCHANT' | 'ORGANIZATION', id: string, walletId?: string } | null>;
  
  // Story operations
  createStory(story: InsertStory): Promise<Story>;
  getStoryByTransaction(transactionId: string): Promise<Story | undefined>;
  getAllPublicStories(): Promise<StoryFeedItem[]>;
  getStoriesByAuthor(authorType: 'GIVER' | 'RECEIVER'): Promise<Story[]>;
  
  // Recurring donation operations
  createRecurringDonation(donation: InsertRecurringDonation): Promise<RecurringDonation>;
  getRecurringDonation(id: string): Promise<RecurringDonation | undefined>;
  getRecurringDonationsByPhilanthropist(philanthropistId: string): Promise<RecurringDonation[]>;
  updateRecurringDonationStatus(id: string, status: 'active' | 'paused' | 'cancelled'): Promise<RecurringDonation>;
  updateRecurringDonationProcessing(id: string, nextDate: Date): Promise<RecurringDonation>;
  getActiveRecurringDonationsDueForProcessing(): Promise<RecurringDonation[]>;
  
  // WhatsApp Business API Demo operations
  createWhatsappContact(contact: any): Promise<any>;
  getWhatsappContact(id: string): Promise<any | undefined>;
  getAllWhatsappContacts(): Promise<any[]>;
  updateWhatsappContact(id: string, updates: any): Promise<any>;
  
  createWhatsappConversation(conversation: any): Promise<any>;
  getWhatsappConversation(id: string): Promise<any | undefined>;
  getWhatsappConversationsByContact(contactId: string): Promise<any[]>;
  getAllWhatsappConversations(): Promise<any[]>;
  updateWhatsappConversation(id: string, updates: any): Promise<any>;
  
  createWhatsappMessage(message: any): Promise<any>;
  getWhatsappMessage(id: string): Promise<any | undefined>;
  getWhatsappMessagesByConversation(conversationId: string): Promise<any[]>;
  
  createWhatsappTicket(ticket: any): Promise<any>;
  getWhatsappTicket(id: string): Promise<any | undefined>;
  getAllWhatsappTickets(): Promise<any[]>;
  updateWhatsappTicket(id: string, updates: any): Promise<any>;
  
  // Password Reset operations (Biometric KYC)
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  getPasswordResetTokenById(id: string): Promise<PasswordResetToken | undefined>;
  updatePasswordResetVerification(id: string, status: 'verified' | 'rejected', sumsubApplicantId?: string): Promise<PasswordResetToken>;
  markPasswordResetTokenUsed(id: string): Promise<PasswordResetToken>;
  deleteExpiredPasswordResetTokens(): Promise<void>;
  updateUserPassword(userId: string, newPasswordHash: string, userType?: 'user' | 'philanthropist'): Promise<User | any>;
  
  // Learn System operations (Page-scoped help guides)
  getLearnEntry(route: string): Promise<LearnEntry | undefined>;
  getAllLearnEntries(): Promise<LearnEntry[]>;
  getPublishedLearnEntry(route: string): Promise<LearnEntry | undefined>;
  createLearnEntry(entry: InsertLearnEntry): Promise<LearnEntry>;
  updateLearnEntry(id: string, entry: Partial<InsertLearnEntry>): Promise<LearnEntry>;
  publishLearnEntry(id: string, publishedBy: string): Promise<LearnEntry>;
}

export class DatabaseStorage implements IStorage {
  private seedPromise: Promise<void>;

  constructor() {
    // Start seeding in background. Ensure we catch and log any seed errors
    // so the server process doesn't crash from an unhandled rejection.
    this.seedPromise = this.seedData().catch((err) => {
      console.error('Seeding failed:', err instanceof Error ? err.message : err);
      // swallow the error to allow the server to continue running in development
    });
  }

  private async ensureSeeded() {
    await this.seedPromise;
  }

  private async seedMerchantChainsOnly() {
    // Create merchant chains
    let pickNPayChain: any;
    let havenShelterChain: any;
    if (supabase) {
      const { data: pnpData, error: pnpErr } = await supabase.from('merchant_chains').insert(snakeifyRow({
        name: 'Pick n Pay',
        description: 'Leading South African supermarket chain',
      })).select().maybeSingle();
      if (pnpErr) throw pnpErr;
      pickNPayChain = camelizeRow(pnpData as any);

      const { data: hsData, error: hsErr } = await supabase.from('merchant_chains').insert(snakeifyRow({
        name: 'Haven Shelter',
        description: 'Shelter and support services for the homeless',
      })).select().maybeSingle();
      if (hsErr) throw hsErr;
      havenShelterChain = camelizeRow(hsData as any);
    } else if (db) {
      const [pnpRow] = await db.insert(merchantChains).values({
        name: 'Pick n Pay',
        description: 'Leading South African supermarket chain',
      }).returning();
      pickNPayChain = pnpRow;

      const [hsRow] = await db.insert(merchantChains).values({
        name: 'Haven Shelter',
        description: 'Shelter and support services for the homeless',
      }).returning();
      havenShelterChain = hsRow;
    } else {
      throw new Error("Neither Supabase nor Drizzle DB is configured. Cannot seed merchant chains.");
    }

    // Create Pick n Pay outlets across different towns (20+ locations)
    const pickNPayOutlets = [
      { town: 'Cape Town CBD', region: 'Western Cape' },
      { town: 'Johannesburg Sandton', region: 'Gauteng' },
      { town: 'Durban Central', region: 'KwaZulu-Natal' },
      { town: 'Pretoria Menlyn', region: 'Gauteng' },
      { town: 'Port Elizabeth', region: 'Eastern Cape' },
      { town: 'Bloemfontein', region: 'Free State' },
      { town: 'East London', region: 'Eastern Cape' },
      { town: 'Polokwane', region: 'Limpopo' },
      { town: 'Nelspruit', region: 'Mpumalanga' },
      { town: 'Kimberley', region: 'Northern Cape' },
      { town: 'Rustenburg', region: 'North West' },
      { town: 'Cape Town Claremont', region: 'Western Cape' },
      { town: 'Johannesburg Rosebank', region: 'Gauteng' },
      { town: 'Durban Umhlanga', region: 'KwaZulu-Natal' },
      { town: 'Stellenbosch', region: 'Western Cape' },
      { town: 'Pietermaritzburg', region: 'KwaZulu-Natal' },
      { town: 'George', region: 'Western Cape' },
      { town: 'Midrand', region: 'Gauteng' },
      { town: 'Somerset West', region: 'Western Cape' },
      { town: 'Centurion', region: 'Gauteng' },
      { town: 'Ballito', region: 'KwaZulu-Natal' },
      { town: 'Randburg', region: 'Gauteng' },
    ];

      for (const { town, region } of pickNPayOutlets) {
        let wallet: any;
        if (supabase) {
          const { data, error } = await supabase.from('wallets').insert(snakeifyRow({
            type: 'MERCHANT',
            name: `Pick n Pay - ${town}`,
            balanceZar: 0,
          })).select().maybeSingle();
          if (error) throw error;
          wallet = camelizeRow(data as any);
        } else if (db) {
          const [row] = await db.insert(wallets).values({
            type: 'MERCHANT',
            name: `Pick n Pay - ${town}`,
            balanceZAR: 0,
          }).returning();
          wallet = row;
        } else {
          throw new Error("Neither Supabase nor Drizzle DB is configured. Cannot seed merchant outlets.");
        }

        if (supabase) {
          const { error } = await supabase.from('merchant_outlets').insert(snakeifyRow({
            chainId: pickNPayChain.id,
            walletId: wallet.id,
            displayName: `Pick n Pay - ${town}`,
            town,
            region,
            status: 'active',
          }));
          if (error) throw error;
        } else if (db) {
          await db.insert(merchantOutlets).values({
            chainId: pickNPayChain.id,
            walletId: wallet.id,
            displayName: `Pick n Pay - ${town}`,
            town,
            region,
            status: 'active',
          });
        }
      }

    // Create Haven Shelter outlet
    let havenWallet: any;
    if (supabase) {
      const { data, error } = await supabase.from('wallets').insert(snakeifyRow({
        type: 'MERCHANT',
        name: 'Haven Shelter - Cape Town',
        balanceZar: 0,
      })).select().maybeSingle();
      if (error) throw error;
      havenWallet = camelizeRow(data as any);
    } else if (db) {
      const [row] = await db.insert(wallets).values({
        type: 'MERCHANT',
        name: 'Haven Shelter - Cape Town',
        balanceZAR: 0,
      }).returning();
      havenWallet = row;
    } else {
      throw new Error("Neither Supabase nor Drizzle DB is configured. Cannot seed haven shelter outlet.");
    }

    if (supabase) {
      const { error } = await supabase.from('merchant_outlets').insert(snakeifyRow({
        chainId: havenShelterChain.id,
        walletId: havenWallet.id,
        displayName: 'Haven Shelter - Cape Town',
        town: 'Cape Town',
        region: 'Western Cape',
        status: 'active',
      }));
      if (error) throw error;
    } else if (db) {
      await db.insert(merchantOutlets).values({
        chainId: havenShelterChain.id,
        walletId: havenWallet.id,
        displayName: 'Haven Shelter - Cape Town',
        town: 'Cape Town',
        region: 'Western Cape',
        status: 'active',
      });
    }
  }

  private async seedData() {
    try {
      // Organizations must sign up themselves - no hardcoded charities
      
      // Check if merchant chains exist - if they do, skip main seeding
      let existingChains: any[] = [];
      if (supabase) {
        const { data, error } = await supabase.from('merchant_chains').select('*');
        if (error) {
          console.error('Supabase seed merchant chains check error:', error.message || error);
          existingChains = [];
        } else {
          existingChains = data as any[];
        }
      } else {
        existingChains = await db!.select().from(merchantChains);
      }
      if (existingChains.length > 0) {
        return; // Main data already seeded
      }
      
      // Check if any data exists at all (use Supabase when present)
      let existingOrgs: any[] = [];
      let existingTags: any[] = [];
      if (supabase) {
        const [orgsRes, tagsRes] = await Promise.all([
          supabase.from('organizations').select('*'),
          supabase.from('tags').select('*'),
        ]);
        if (orgsRes.error) {
          console.error('Supabase seed organizations check error:', orgsRes.error.message || orgsRes.error);
          existingOrgs = [];
        } else {
          existingOrgs = (orgsRes.data || []) as any[];
        }
        if (tagsRes.error) {
          console.error('Supabase seed tags check error:', tagsRes.error.message || tagsRes.error);
          existingTags = [];
        } else {
          existingTags = (tagsRes.data || []) as any[];
        }
      } else {
        // @ts-ignore - fallback to Drizzle
        existingOrgs = await db!.select().from(organizations as any);
        // @ts-ignore - fallback to Drizzle
        existingTags = await db!.select().from(tags as any);
      }

      // If tags/orgs exist but chains don't, we just need to create chains/outlets
      if (existingOrgs.length > 0 && existingTags.length > 0) {
        await this.seedMerchantChainsOnly();
        return;
      }

      // Create organizations
      let havenShelter: any;
      if (supabase) {
        const { data, error } = await supabase.from('organizations').insert(snakeifyRow({
          name: 'Haven Shelter',
          type: 'Shelter for Homeless',
          parentId: null,
        })).select().maybeSingle();
        if (error) throw error;
        havenShelter = camelizeRow<Organization>(data as any);
      } else {
        const [row] = await db!.insert(organizations).values({
          name: 'Haven Shelter',
          type: 'Shelter for Homeless',
          parentId: null,
        }).returning();
        havenShelter = row;
      }

      let pickNPayFoundation: any;
      if (supabase) {
        const { data, error } = await supabase.from('organizations').insert(snakeifyRow({
          name: 'Pick n Pay Foundation',
          type: 'Corporate Foundation',
          parentId: null,
        })).select().maybeSingle();
        if (error) throw error;
        pickNPayFoundation = camelizeRow<Organization>(data as any);
      } else {
        const [row] = await db!.insert(organizations).values({
          name: 'Pick n Pay Foundation',
          type: 'Corporate Foundation',
          parentId: null,
        }).returning();
        pickNPayFoundation = row;
      }

      let studentAid: any;
      if (supabase) {
        const { data, error } = await supabase.from('organizations').insert(snakeifyRow({
          name: 'Student Aid Program',
          type: 'Educational Support',
          parentId: pickNPayFoundation.id,
        })).select().maybeSingle();
        if (error) throw error;
        studentAid = camelizeRow<Organization>(data as any);
      } else {
        const [row] = await db!.insert(organizations).values({
          name: 'Student Aid Program',
          type: 'Educational Support',
          parentId: pickNPayFoundation.id,
        }).returning();
        studentAid = row;
      }

      // Create 50 diverse beneficiaries with tags
      const tagData = [
        // Haven Shelter - Homeless beneficiaries
        { code: 'CT001', pin: '1234', orgId: havenShelter.id, type: 'Homeless', name: 'John Doe' },
        { code: 'CT002', pin: '5678', orgId: havenShelter.id, type: 'Homeless', name: 'Sarah Williams' },
        { code: 'CT003', pin: '4321', orgId: havenShelter.id, type: 'Homeless', name: 'Michael Brown' },
        { code: 'CT004', pin: '8765', orgId: havenShelter.id, type: 'Homeless', name: 'Patricia Jones' },
        { code: 'CT005', pin: '2468', orgId: havenShelter.id, type: 'Homeless', name: 'David Miller' },
        { code: 'CT006', pin: '1357', orgId: havenShelter.id, type: 'Homeless', name: 'Maria Garcia' },
        { code: 'CT007', pin: '9876', orgId: havenShelter.id, type: 'Homeless', name: 'James Wilson' },
        { code: 'CT008', pin: '5432', orgId: havenShelter.id, type: 'Homeless', name: 'Linda Martinez' },
        { code: 'CT009', pin: '7890', orgId: havenShelter.id, type: 'Homeless', name: 'Robert Anderson' },
        { code: 'CT010', pin: '3456', orgId: havenShelter.id, type: 'Homeless', name: 'Barbara Thomas' },
        
        // Haven Shelter - Unbanked beneficiaries
        { code: 'CT011', pin: '6789', orgId: havenShelter.id, type: 'Unbanked', name: 'Jane Smith' },
        { code: 'CT012', pin: '2345', orgId: havenShelter.id, type: 'Unbanked', name: 'William Taylor' },
        { code: 'CT013', pin: '8901', orgId: havenShelter.id, type: 'Unbanked', name: 'Elizabeth Moore' },
        { code: 'CT014', pin: '4567', orgId: havenShelter.id, type: 'Unbanked', name: 'Charles Jackson' },
        { code: 'CT015', pin: '0123', orgId: havenShelter.id, type: 'Unbanked', name: 'Mary White' },
        { code: 'CT016', pin: '9012', orgId: havenShelter.id, type: 'Unbanked', name: 'Joseph Harris' },
        { code: 'CT017', pin: '5670', orgId: havenShelter.id, type: 'Unbanked', name: 'Susan Martin' },
        { code: 'CT018', pin: '1238', orgId: havenShelter.id, type: 'Unbanked', name: 'Thomas Thompson' },
        { code: 'CT019', pin: '7891', orgId: havenShelter.id, type: 'Unbanked', name: 'Nancy Garcia' },
        { code: 'CT020', pin: '3457', orgId: havenShelter.id, type: 'Unbanked', name: 'Christopher Lee' },
        
        // Haven Shelter - Migrant Workers
        { code: 'CT021', pin: '9013', orgId: havenShelter.id, type: 'Migrant Worker', name: 'Daniel Rodriguez' },
        { code: 'CT022', pin: '5671', orgId: havenShelter.id, type: 'Migrant Worker', name: 'Jennifer Lopez' },
        { code: 'CT023', pin: '1239', orgId: havenShelter.id, type: 'Migrant Worker', name: 'Matthew Gonzalez' },
        { code: 'CT024', pin: '7892', orgId: havenShelter.id, type: 'Migrant Worker', name: 'Karen Wilson' },
        { code: 'CT025', pin: '3458', orgId: havenShelter.id, type: 'Migrant Worker', name: 'Anthony Perez' },
        { code: 'CT026', pin: '9014', orgId: havenShelter.id, type: 'Migrant Worker', name: 'Lisa Sanchez' },
        { code: 'CT027', pin: '5672', orgId: havenShelter.id, type: 'Migrant Worker', name: 'Mark Ramirez' },
        { code: 'CT028', pin: '1230', orgId: havenShelter.id, type: 'Migrant Worker', name: 'Betty Torres' },
        { code: 'CT029', pin: '7893', orgId: havenShelter.id, type: 'Migrant Worker', name: 'Donald Flores' },
        { code: 'CT030', pin: '3459', orgId: havenShelter.id, type: 'Migrant Worker', name: 'Sandra Rivera' },
        
        // Student Aid Program - Students
        { code: 'CT031', pin: '9999', orgId: studentAid.id, type: 'Student', name: 'Mike Johnson' },
        { code: 'CT032', pin: '1111', orgId: studentAid.id, type: 'Student', name: 'Emily Chen' },
        { code: 'CT033', pin: '2222', orgId: studentAid.id, type: 'Student', name: 'Jacob Nguyen' },
        { code: 'CT034', pin: '3333', orgId: studentAid.id, type: 'Student', name: 'Olivia Patel' },
        { code: 'CT035', pin: '4444', orgId: studentAid.id, type: 'Student', name: 'Noah Kim' },
        { code: 'CT036', pin: '5555', orgId: studentAid.id, type: 'Student', name: 'Emma Ahmed' },
        { code: 'CT037', pin: '6666', orgId: studentAid.id, type: 'Student', name: 'Liam Singh' },
        { code: 'CT038', pin: '7777', orgId: studentAid.id, type: 'Student', name: 'Sophia Mbeki' },
        { code: 'CT039', pin: '8888', orgId: studentAid.id, type: 'Student', name: 'William Dlamini' },
        { code: 'CT040', pin: '0000', orgId: studentAid.id, type: 'Student', name: 'Ava Naidoo' },
        { code: 'CT041', pin: '1212', orgId: studentAid.id, type: 'Student', name: 'James Khumalo' },
        { code: 'CT042', pin: '2323', orgId: studentAid.id, type: 'Student', name: 'Isabella van der Merwe' },
        { code: 'CT043', pin: '3434', orgId: studentAid.id, type: 'Student', name: 'Benjamin Botha' },
        { code: 'CT044', pin: '4545', orgId: studentAid.id, type: 'Student', name: 'Mia Mthembu' },
        { code: 'CT045', pin: '5656', orgId: studentAid.id, type: 'Student', name: 'Lucas Nel' },
        { code: 'CT046', pin: '6767', orgId: studentAid.id, type: 'Student', name: 'Charlotte Mokoena' },
        { code: 'CT047', pin: '7878', orgId: studentAid.id, type: 'Student', name: 'Henry Zulu' },
        { code: 'CT048', pin: '8989', orgId: studentAid.id, type: 'Student', name: 'Amelia Ndlovu' },
        { code: 'CT049', pin: '9090', orgId: studentAid.id, type: 'Student', name: 'Alexander De Villiers' },
        { code: 'CT050', pin: '0101', orgId: studentAid.id, type: 'Student', name: 'Harper Maluleke' },
      ];

      for (const { code, pin, orgId, type, name } of tagData) {
        let wallet;
        if (supabase) {
          const { data, error } = await supabase.from('wallets').insert(snakeifyRow({
            type: 'TAG',
            name: `Tag ${code}`,
            balanceZar: 0,
          })).select().maybeSingle();
          if (error) throw error;
          wallet = camelizeRow(data);
        } else if (db) {
          const [row] = await db
            .insert(wallets)
            .values({
              type: 'TAG',
              name: `Tag ${code}`,
              balanceZar: 0,
            })
            .returning();
          wallet = row;
        } else {
          throw new Error("Neither Supabase nor Drizzle DB is configured. Cannot seed demo data.");
        }

        // Add biometric verification for CT001 for testing
        const tagValues: any = {
          tagCode: code,
          walletId: wallet.id,
          pin,
          organizationId: orgId,
          beneficiaryType: type,
          beneficiaryName: name,
        };

        if (code === 'CT001') {
          tagValues.sumsubApplicantId = 'demo_biometric_CT001';
          tagValues.verificationStatus = 'approved';
          tagValues.verifiedAt = new Date();
        }

        if (supabase) {
          const { error } = await supabase.from('tags').insert(snakeifyRow(tagValues));
          if (error) throw error;
        } else if (db) {
          await db.insert(tags).values(tagValues);
        } else {
          throw new Error("Neither Supabase nor Drizzle DB is configured. Cannot seed demo data.");
        }
      }

      // Create merchant chains
      let pickNPayChain: any;
      let havenShelterChain: any;
      if (supabase) {
        const { data: pnpData, error: pnpErr } = await supabase.from('merchant_chains').insert(snakeifyRow({
          name: 'Pick n Pay',
          description: 'Leading South African supermarket chain',
        })).select().maybeSingle();
        if (pnpErr) throw pnpErr;
        pickNPayChain = camelizeRow(pnpData as any);

        const { data: hsData, error: hsErr } = await supabase.from('merchant_chains').insert(snakeifyRow({
          name: 'Haven Shelter',
          description: 'Shelter and support services for the homeless',
        })).select().maybeSingle();
        if (hsErr) throw hsErr;
        havenShelterChain = camelizeRow(hsData as any);
      } else if (db) {
        const [pnpRow] = await db.insert(merchantChains).values({
          name: 'Pick n Pay',
          description: 'Leading South African supermarket chain',
        }).returning();
        pickNPayChain = pnpRow;

        const [hsRow] = await db.insert(merchantChains).values({
          name: 'Haven Shelter',
          description: 'Shelter and support services for the homeless',
        }).returning();
        havenShelterChain = hsRow;
      } else {
        throw new Error("Neither Supabase nor Drizzle DB is configured. Cannot seed merchant chains.");
      }

      // Create Pick n Pay outlets across different towns (20+ locations)
      const pickNPayOutlets = [
        { town: 'Cape Town CBD', region: 'Western Cape' },
        { town: 'Johannesburg Sandton', region: 'Gauteng' },
        { town: 'Durban Central', region: 'KwaZulu-Natal' },
        { town: 'Pretoria Menlyn', region: 'Gauteng' },
        { town: 'Port Elizabeth', region: 'Eastern Cape' },
        { town: 'Bloemfontein', region: 'Free State' },
        { town: 'East London', region: 'Eastern Cape' },
        { town: 'Polokwane', region: 'Limpopo' },
        { town: 'Nelspruit', region: 'Mpumalanga' },
        { town: 'Kimberley', region: 'Northern Cape' },
        { town: 'Rustenburg', region: 'North West' },
        { town: 'Cape Town Claremont', region: 'Western Cape' },
        { town: 'Johannesburg Rosebank', region: 'Gauteng' },
        { town: 'Durban Umhlanga', region: 'KwaZulu-Natal' },
        { town: 'Stellenbosch', region: 'Western Cape' },
        { town: 'Pietermaritzburg', region: 'KwaZulu-Natal' },
        { town: 'George', region: 'Western Cape' },
        { town: 'Midrand', region: 'Gauteng' },
        { town: 'Somerset West', region: 'Western Cape' },
        { town: 'Centurion', region: 'Gauteng' },
        { town: 'Ballito', region: 'KwaZulu-Natal' },
        { town: 'Randburg', region: 'Gauteng' },
      ];

      for (const { town, region } of pickNPayOutlets) {
        let wallet: any;
        if (supabase) {
          const { data, error } = await supabase.from('wallets').insert(snakeifyRow({
            type: 'MERCHANT',
            name: `Pick n Pay - ${town}`,
            balanceZar: 0,
          })).select().maybeSingle();
          if (error) throw error;
          wallet = camelizeRow(data as any);
        } else if (db) {
          const [row] = await db.insert(wallets).values({
            type: 'MERCHANT',
            name: `Pick n Pay - ${town}`,
            balanceZAR: 0,
          }).returning();
          wallet = row;
        } else {
          throw new Error("Neither Supabase nor Drizzle DB is configured. Cannot seed merchant outlets.");
        }

        if (supabase) {
          const { error } = await supabase.from('merchant_outlets').insert(snakeifyRow({
            chainId: pickNPayChain.id,
            walletId: wallet.id,
            displayName: `Pick n Pay - ${town}`,
            town,
            region,
            status: 'active',
          }));
          if (error) throw error;
        } else if (db) {
          await db.insert(merchantOutlets).values({
            chainId: pickNPayChain.id,
            walletId: wallet.id,
            displayName: `Pick n Pay - ${town}`,
            town,
            region,
            status: 'active',
          });
        }
      }

      // Create Haven Shelter outlet
      let havenWallet: any;
      if (supabase) {
        const { data, error } = await supabase.from('wallets').insert(snakeifyRow({
          type: 'MERCHANT',
          name: 'Haven Shelter - Cape Town',
          balanceZar: 0,
        })).select().maybeSingle();
        if (error) throw error;
        havenWallet = camelizeRow(data as any);
      } else if (db) {
        const [row] = await db.insert(wallets).values({
          type: 'MERCHANT',
          name: 'Haven Shelter - Cape Town',
          balanceZAR: 0,
        }).returning();
        havenWallet = row;
      } else {
        throw new Error("Neither Supabase nor Drizzle DB is configured. Cannot seed haven shelter outlet.");
      }

      if (supabase) {
        const { error } = await supabase.from('merchant_outlets').insert(snakeifyRow({
          chainId: havenShelterChain.id,
          walletId: havenWallet.id,
          displayName: 'Haven Shelter - Cape Town',
          town: 'Cape Town',
          region: 'Western Cape',
          status: 'active',
        }));
        if (error) throw error;
      } else if (db) {
        await db.insert(merchantOutlets).values({
          chainId: havenShelterChain.id,
          walletId: havenWallet.id,
          displayName: 'Haven Shelter - Cape Town',
          town: 'Cape Town',
          region: 'Western Cape',
          status: 'active',
        });
      }
    } catch (error) {
      console.error('Seeding failed:', error);
      throw error;
    }
  }

  // User operations (unified authentication)
  async getUser(id: string): Promise<User | undefined> {
    if (supabase) {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
      if (error) {
        console.error('Supabase getUser error:', error.message || error);
      }
      return data ? camelizeRow<User>(data) : undefined;
    }

    // @ts-ignore - bypass mixed-drizzle typing between shared and server
    const [user] = (await db!.select().from(users as any).where(eq((users as any).id, id))) as any;
    return (user as User) || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (supabase) {
      const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
      if (error) {
        console.error('Supabase getUserByEmail error:', error.message || error);
      }
      return data ? camelizeRow<User>(data) : undefined;
    }

    // @ts-ignore - bypass mixed-drizzle typing between shared and server
    const [user] = (await db!.select().from(users as any).where(eq((users as any).email, email))) as any;
    return (user as User) || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (supabase) {
      // Convert camelCase property names (JS) to snake_case (Postgres/PostgREST)
      const { data, error } = await supabase.from('users').insert(snakeifyRow(insertUser)).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<User>(data as any);
    }

    // @ts-ignore - bypass mixed-drizzle typing between shared and server
    const [user] = (await db!.insert(users as any).values(insertUser).returning()) as any;
    return user as User;
  }

  async updateUserLastLogin(id: string): Promise<User> {
    if (supabase) {
      const { data, error } = await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', id).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<User>(data as any);
    }

    // @ts-ignore - bypass mixed-drizzle typing between shared and server
    const [user] = (await db!.update(users as any).set({ lastLoginAt: new Date() }).where(eq((users as any).id, id)).returning()) as any;
    return user as User;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    if (supabase) {
      const { data, error } = await supabase.from('users').update(snakeifyRow(updates)).eq('id', id).select().maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('User not found');
      return camelizeRow<User>(data as any);
    }

    // @ts-ignore - bypass mixed-drizzle typing between shared and server
    const [user] = (await db!.update(users as any).set(updates).where(eq((users as any).id, id)).returning()) as any;
    if (!user) throw new Error('User not found');
    return user as User;
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<User> {
    if (supabase) {
      const { data, error } = await supabase.from('users').update({ password_hash: passwordHash }).eq('id', id).select().maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('User not found');
      return camelizeRow<User>(data as any);
    }

    // @ts-ignore - bypass mixed-drizzle typing between shared and server
    const [user] = (await db!.update(users as any).set({ passwordHash }).where(eq((users as any).id, id)).returning()) as any;
    if (!user) throw new Error('User not found');
    return user as User;
  }

  async getUserRoles(userId: string): Promise<UserRole[]> {
    if (supabase) {
      const { data, error } = await supabase.from('user_roles').select('*').eq('user_id', userId);
      if (error) {
        console.error('Supabase getUserRoles error:', error.message || error);
        return [];
      }
      return camelizeRows<UserRole>(data as any);
    }

    // @ts-ignore - bypass mixed-drizzle typing between shared and server
    return (await db!.select().from(userRoles as any).where(eq((userRoles as any).userId, userId))) as any as UserRole[];
  }

  async createUserRole(insertUserRole: InsertUserRole): Promise<UserRole> {
    if (supabase) {
      const { data, error } = await supabase.from('user_roles').insert(snakeifyRow(insertUserRole)).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<UserRole>(data as any);
    }

    // @ts-ignore - bypass mixed-drizzle typing between shared and server
    const [role] = (await db!.insert(userRoles as any).values(insertUserRole).returning()) as any;
    return role as UserRole;
  }

  async getUserWithRoles(userId: string): Promise<{ user: User; roles: UserRole[] } | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    const roles = await this.getUserRoles(userId);
    return { user, roles };
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('organizations').select('*').eq('id', id).maybeSingle();
      
      if (error) {
        console.error('Supabase getOrganization error:', error.message || error);
      }
      return data ? camelizeRow<Organization>(data) : undefined;
    }

    // @ts-ignore - bypass mixed Drizzle typing
    const [org] = await db!.select().from(organizations as any).where(eq((organizations as any).id, id));
    return org || undefined;
  }

  async getOrganizationByEmail(email: string): Promise<Organization | undefined> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('organizations').select('*').eq('email', email).maybeSingle();
      if (error) {
        console.error('Supabase getOrganizationByEmail error:', error.message || error);
      }
      return data ? camelizeRow<Organization>(data) : undefined;
    }

    // @ts-ignore - bypass mixed Drizzle typing
    const [org] = await db!.select().from(organizations as any).where(eq((organizations as any).email, email));
    return org || undefined;
  }

  async getAllOrganizations(): Promise<Organization[]> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('organizations').select('*');
      if (error) {
        console.error('Supabase getAllOrganizations error:', error.message || error);
        return [];
      }
      return camelizeRows<Organization>(data as any);
    }

    // @ts-ignore - bypass mixed Drizzle typing
    return (await db!.select().from(organizations as any)) as any as Organization[];
  }

  async getOrganizationsByParent(parentId: string | null): Promise<Organization[]> {
    await this.ensureSeeded();
    if (supabase) {
      if (parentId === null) {
        const { data, error } = await supabase.from('organizations').select('*').is('parent_id', null);
        if (error) {
          console.error('Supabase getOrganizationsByParent error:', error.message || error);
          return [];
        }
        return camelizeRows<Organization>(data as any);
      }
      const { data, error } = await supabase.from('organizations').select('*').eq('parent_id', parentId);
      if (error) {
        console.error('Supabase getOrganizationsByParent error:', error.message || error);
        return [];
      }
      return camelizeRows<Organization>(data as any);
    }
    if (parentId === null) {
      // @ts-ignore - bypass mixed Drizzle typing
      return (await db!.select().from(organizations as any).where(isNull((organizations as any).parentId))) as any as Organization[];
    }
    // @ts-ignore - bypass mixed Drizzle typing
    return (await db!.select().from(organizations as any).where(eq((organizations as any).parentId, parentId))) as any as Organization[];
  }

  async createOrganization(insertOrganization: InsertOrganization): Promise<Organization> {
    if (supabase) {
      const { data, error } = await supabase.from('organizations').insert(snakeifyRow(insertOrganization)).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<Organization>(data as any);
    }
    // @ts-ignore - fallback for mixed-drizzle types
    const [org] = (await db!.insert(organizations as any).values(insertOrganization).returning()) as any;
    return org as Organization;
  }

  async getWallet(id: string): Promise<Wallet | undefined> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('wallets').select('*').eq('id', id).maybeSingle();
      if (error) {
        console.error('Supabase getWallet error:', error.message || error);
        return undefined;
      }
      return data ? camelizeRow<Wallet>(data) : undefined;
    }

    // @ts-ignore - bypass mixed Drizzle typing
    const [wallet] = await db!.select().from(wallets as any).where(eq((wallets as any).id, id));
    return wallet || undefined;
  }

  async getAllWallets(): Promise<Wallet[]> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('wallets').select('*');
      if (error) {
        console.error('Supabase getAllWallets error:', error.message || error);
        return [];
      }
      return camelizeRows<Wallet>(data as any);
    }
    // @ts-ignore - bypass mixed Drizzle typing
    return (await db!.select().from(wallets as any)) as any as Wallet[];
  }

  async getMerchantWallets(): Promise<Wallet[]> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('wallets').select('*').eq('type', 'MERCHANT');
      if (error) {
        console.error('Supabase getMerchantWallets error:', error.message || error);
        return [];
      }
      return camelizeRows<Wallet>(data as any);
    }
    // @ts-ignore - bypass mixed Drizzle typing
    return (await db!.select().from(wallets as any).where(eq((wallets as any).type, 'MERCHANT'))) as any as Wallet[];
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    if (supabase) {
      const { data, error } = await supabase.from('wallets').insert(snakeifyRow(insertWallet)).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<Wallet>(data as any);
    }
    // @ts-ignore - fallback for mixed-drizzle types
    const [wallet] = (await db!.insert(wallets as any).values(insertWallet).returning()) as any;
    return wallet as Wallet;
  }

  async updateWalletBalance(id: string, newBalance: number): Promise<Wallet> {
    if (supabase) {
      const { data, error } = await supabase.from('wallets').update({ balance_zar: newBalance }).eq('id', id).select().maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Wallet not found');
      return camelizeRow<Wallet>(data as any);
    }
    // @ts-ignore - fallback for mixed-drizzle types
    const [wallet] = (await db!.update(wallets as any).set({ balanceZAR: newBalance }).where(eq((wallets as any).id, id)).returning()) as any;
    if (!wallet) throw new Error('Wallet not found');
    return wallet as Wallet;
  }

  async getTag(tagCode: string): Promise<Tag | undefined> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('tags').select('*').eq('tag_code', tagCode).maybeSingle();
      if (error) {
        console.error('Supabase getTag error:', error.message || error);
        return undefined;
      }
      return data ? camelizeRow<Tag>(data as any) : undefined;
    }
    // @ts-ignore - bypass mixed Drizzle typing
    const [tag] = await db.select().from(tags as any).where(eq((tags as any).tagCode, tagCode));
    return tag || undefined;
  }

  async getTagByUserId(userId: string): Promise<Tag | undefined> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('tags').select('*').eq('user_id', userId).maybeSingle();
      if (error) {
        console.error('Supabase getTagByUserId error:', error.message || error);
        return undefined;
      }
      return data ? camelizeRow<Tag>(data as any) : undefined;
    }
    // @ts-ignore - bypass mixed Drizzle typing
    const [tag] = await db.select().from(tags as any).where(eq((tags as any).userId, userId));
    return tag || undefined;
  }

  async getAllTags(): Promise<Tag[]> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('tags').select('*');
      if (error) {
        console.error('Supabase getAllTags error:', error.message || error);
        return [];
      }
      return camelizeRows<Tag>(data as any);
    }
    // @ts-ignore - bypass mixed Drizzle typing
    return (await db.select().from(tags as any)) as any as Tag[];
  }

  async getTagsByOrganization(organizationId: string): Promise<Tag[]> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('tags').select('*').eq('organization_id', organizationId);
      if (error) {
        console.error('Supabase getTagsByOrganization error:', error.message || error);
        return [];
      }
      return camelizeRows<Tag>(data as any);
    }
    // @ts-ignore - bypass mixed Drizzle typing
    return (await db.select().from(tags as any).where(eq((tags as any).organizationId, organizationId))) as any as Tag[];
  }

  async createTag(insertTag: InsertTag): Promise<Tag> {
    console.log('💾 createTag called with:', insertTag);
    if (supabase) {
      const snakified = snakeifyRow(insertTag);
      console.log('🐍 Snakified data for Supabase:', snakified);
      const { data, error } = await supabase.from('tags').insert(snakified).select().maybeSingle();
      if (error) {
        console.error('❌ Supabase insert error:', error);
        throw error;
      }
      const result = data ? camelizeRow<Tag>(data as any) : undefined;
      console.log('✅ Tag created in Supabase, result:', result);
      return result as Tag;
    }
    // @ts-ignore - fallback for mixed-drizzle types
    const [tag] = (await db.insert(tags as any).values(insertTag).returning()) as any;
    console.log('✅ Tag created in Drizzle, result:', tag);
    return tag as Tag;
  }

  async updateTagVerification(tagCode: string, sumsubApplicantId: string, status: 'pending' | 'approved' | 'rejected'): Promise<Tag> {
    const updates: any = {
      sumsubApplicantId,
      verificationStatus: status,
    };
    
    if (status === 'approved') {
      updates.verifiedAt = new Date();
    }
    
    // @ts-ignore - bypass mixed Drizzle typing
    const [tag] = (await db
      .update(tags as any)
      .set(updates)
      .where(eq((tags as any).tagCode, tagCode))
      .returning()) as any;
    
    if (!tag) {
      throw new Error('Tag not found');
    }
    return tag;
  }

  async updateTagPin(tagCode: string, newPin: string): Promise<Tag> {
    // @ts-ignore - bypass mixed Drizzle typing
    const [tag] = (await db
      .update(tags as any)
      .set({ pin: newPin })
      .where(eq((tags as any).tagCode, tagCode))
      .returning()) as any;
    
    if (!tag) {
      throw new Error('Tag not found');
    }
    return tag;
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    if (supabase) {
      const { data, error } = await supabase.from('transactions').insert(snakeifyRow(insertTransaction)).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<Transaction>(data as any);
    }

    // @ts-ignore - fallback for mixed-drizzle types
    const [transaction] = (await db!.insert(transactions as any).values(insertTransaction).returning()) as any;
    return transaction as Transaction;
  }

  async getAllTransactions(): Promise<Transaction[]> {
    if (supabase) {
      const { data, error } = await supabase.from('transactions').select('*').order('ts', { ascending: false });
      if (error) {
        console.error('Supabase getAllTransactions error:', error.message || error);
        return [];
      }
      return camelizeRows<Transaction>(data as any);
    }

    // @ts-ignore - fallback for mixed-drizzle types
    return (await db!.select().from(transactions as any).orderBy(desc((transactions as any).ts))) as any as Transaction[];
  }

  async updateTransactionAmount(id: string, amount: number): Promise<Transaction> {
    if (supabase) {
      const { data, error} = await supabase.from('transactions')
        .update({ amount, status: 'completed' })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Transaction not found');
      return camelizeRow<Transaction>(data as any);
    }

    // @ts-ignore - fallback for mixed-drizzle types
    const [transaction] = (await db!.update(transactions as any)
      .set({ amount, status: 'completed' })
      .where(eq((transactions as any).id, id))
      .returning()) as any;
    if (!transaction) throw new Error('Transaction not found');
    return transaction as Transaction;
  }

  async updateTransactionStatus(id: string, status: 'pending' | 'completed' | 'failed'): Promise<Transaction> {
    if (supabase) {
      const { data, error } = await supabase.from('transactions')
        .update({ status })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Transaction not found');
      return camelizeRow<Transaction>(data as any);
    }

    // @ts-ignore - fallback for mixed-drizzle types
    const [transaction] = (await db!.update(transactions as any)
      .set({ status })
      .where(eq((transactions as any).id, id))
      .returning()) as any;
    if (!transaction) throw new Error('Transaction not found');
    return transaction as Transaction;
  }

  async getMerchantChain(id: string): Promise<MerchantChain | undefined> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('merchant_chains').select('*').eq('id', id).maybeSingle();
      if (error) {
        console.error('Supabase getMerchantChain error:', error.message || error);
        return undefined;
      }
      return data ? camelizeRow<MerchantChain>(data as any) : undefined;
    }

    const [chain] = await db!.select().from(merchantChains).where(eq(merchantChains.id, id));
    return chain || undefined;
  }

  async getAllMerchantChains(): Promise<MerchantChain[]> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('merchant_chains').select('*');
      if (error) {
        console.error('Supabase getAllMerchantChains error:', error.message || error);
        return [];
      }
      return camelizeRows<MerchantChain>(data as any);
    }

    return db!.select().from(merchantChains);
  }

  async createMerchantChain(insertChain: InsertMerchantChain): Promise<MerchantChain> {
    if (supabase) {
      const { data, error } = await supabase.from('merchant_chains').insert(snakeifyRow(insertChain)).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<MerchantChain>(data as any);
    }

    const [chain] = await db!.insert(merchantChains).values(insertChain).returning();
    return chain;
  }

  async getMerchantOutlet(id: string): Promise<MerchantOutlet | undefined> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('merchant_outlets').select('*').eq('id', id).maybeSingle();
      if (error) {
        console.error('Supabase getMerchantOutlet error:', error.message || error);
      }
      return data ? camelizeRow<MerchantOutlet>(data as any) : undefined;
    }
    // @ts-ignore - fallback for mixed-drizzle types
    const [outlet] = await db.select().from(merchantOutlets as any).where(eq((merchantOutlets as any).id, id));
    return outlet || undefined;
  }

  async getMerchantOutletByCode(outletCode: string): Promise<MerchantOutlet | undefined> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('merchant_outlets').select('*').eq('outlet_code', outletCode).maybeSingle();
      if (error) console.error('Supabase getMerchantOutletByCode error:', error.message || error);
      return data ? camelizeRow<MerchantOutlet>(data as any) : undefined;
    }
    // @ts-ignore - fallback for mixed-drizzle types
    const [outlet] = await db.select().from(merchantOutlets as any).where(eq((merchantOutlets as any).outletCode, outletCode));
    return outlet || undefined;
  }

  async getMerchantOutletsByChain(chainId: string): Promise<MerchantOutlet[]> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('merchant_outlets').select('*').eq('chain_id', chainId);
      if (error) {
        console.error('Supabase getMerchantOutletsByChain error:', error.message || error);
        return [];
      }
      return camelizeRows<MerchantOutlet>(data as any);
    }
    // @ts-ignore - fallback
    return (await db.select().from(merchantOutlets as any).where(eq((merchantOutlets as any).chainId, chainId))) as any as MerchantOutlet[];
  }

  async getAllMerchantOutlets(): Promise<MerchantOutlet[]> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('merchant_outlets').select('*');
      if (error) {
        console.error('Supabase getAllMerchantOutlets error:', error.message || error);
        return [];
      }
      return camelizeRows<MerchantOutlet>(data as any);
    }
    // @ts-ignore - fallback
    return (await db.select().from(merchantOutlets as any)) as any as MerchantOutlet[];
  }

  async createMerchantOutlet(insertOutlet: InsertMerchantOutlet): Promise<MerchantOutlet> {
    if (supabase) {
      const { data, error } = await supabase.from('merchant_outlets').insert(snakeifyRow(insertOutlet)).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<MerchantOutlet>(data as any);
    }
    // @ts-ignore - fallback
    const [outlet] = (await db.insert(merchantOutlets as any).values(insertOutlet).returning()) as any;
    return outlet as MerchantOutlet;
  }

  async getPhilanthropist(id: string): Promise<Philanthropist | undefined> {
    if (supabase) {
      const { data, error } = await supabase.from('philanthropists').select('*').eq('id', id).maybeSingle();
      if (error) console.error('Supabase getPhilanthropist error:', error.message || error);
      return data ? camelizeRow<Philanthropist>(data as any) : undefined;
    }
    // @ts-ignore - fallback
    const [philanthropist] = await db.select().from(philanthropists as any).where(eq((philanthropists as any).id, id));
    return philanthropist || undefined;
  }

  async getPhilanthropistByEmail(email: string): Promise<Philanthropist | undefined> {
    if (supabase) {
      const { data, error } = await supabase.from('philanthropists').select('*').eq('email', email).maybeSingle();
      if (error) console.error('Supabase getPhilanthropistByEmail error:', error.message || error);
      return data ? camelizeRow<Philanthropist>(data as any) : undefined;
    }
    // @ts-ignore - fallback
    const [philanthropist] = await db.select().from(philanthropists as any).where(eq((philanthropists as any).email, email));
    return philanthropist || undefined;
  }

  async getPhilanthropistByUserId(userId: string): Promise<Philanthropist | undefined> {
    if (supabase) {
      const { data, error } = await supabase.from('philanthropists').select('*').eq('user_id', userId).maybeSingle();
      if (error) console.error('Supabase getPhilanthropistByUserId error:', error.message || error);
      return data ? camelizeRow<Philanthropist>(data as any) : undefined;
    }
    // @ts-ignore - fallback
    const [philanthropist] = await db.select().from(philanthropists as any).where(eq((philanthropists as any).userId, userId));
    return philanthropist || undefined;
  }

  async createPhilanthropist(insertPhilanthropist: InsertPhilanthropist): Promise<Philanthropist> {
    if (supabase) {
      const { data, error } = await supabase.from('philanthropists').insert(snakeifyRow(insertPhilanthropist)).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<Philanthropist>(data as any);
    }
    // @ts-ignore - fallback
    const [philanthropist] = (await db.insert(philanthropists as any).values(insertPhilanthropist).returning()) as any;
    return philanthropist as Philanthropist;
  }
  
  async getAllPhilanthropists(): Promise<Philanthropist[]> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('philanthropists').select('*');
      if (error) {
        console.error('Supabase getAllPhilanthropists error:', error.message || error);
        return [];
      }
      return camelizeRows<Philanthropist>(data as any);
    }
    // @ts-ignore - fallback
    return (await db.select().from(philanthropists as any)) as any as Philanthropist[];
  }

  async createReferral(insertReferral: InsertReferral): Promise<Referral> {
    if (supabase) {
      const { data, error } = await supabase.from('referrals').insert(snakeifyRow(insertReferral)).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<Referral>(data as any);
    }
    // @ts-ignore - fallback
    const [referral] = (await db.insert(referrals as any).values(insertReferral).returning()) as any;
    return referral as Referral;
  }

  async getReferralsByReferrer(referrerCode: string): Promise<Referral[]> {
    if (supabase) {
      const { data, error } = await supabase.from('referrals').select('*').eq('referrer_code', referrerCode);
      if (error) {
        console.error('Supabase getReferralsByReferrer error:', error.message || error);
        return [];
      }
      return camelizeRows<Referral>(data as any);
    }
    // @ts-ignore - fallback
    return (await db.select().from(referrals as any).where(eq((referrals as any).referrerCode, referrerCode))) as any as Referral[];
  }

  async getReferralsByReferred(referredCode: string): Promise<Referral[]> {
    if (supabase) {
      const { data, error } = await supabase.from('referrals').select('*').eq('referred_code', referredCode);
      if (error) {
        console.error('Supabase getReferralsByReferred error:', error.message || error);
        return [];
      }
      return camelizeRows<Referral>(data as any);
    }
    // @ts-ignore - fallback
    return (await db.select().from(referrals as any).where(eq((referrals as any).referredCode, referredCode))) as any as Referral[];
  }

  async createStory(insertStory: InsertStory): Promise<Story> {
    if (supabase) {
      const { data, error } = await supabase.from('stories').insert(snakeifyRow(insertStory)).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<Story>(data as any);
    }
    // @ts-ignore - fallback
    const [story] = (await db.insert(stories as any).values(insertStory).returning()) as any;
    return story as Story;
  }

  async getStoryByTransaction(transactionId: string): Promise<Story | undefined> {
    const [story] = await db.select().from(stories).where(eq(stories.transactionId, transactionId));
    return story || undefined;
  }

  async getAllPublicStories(): Promise<StoryFeedItem[]> {
    // Create alias for the "to" wallet
    const toWallet = alias(wallets, 'toWallet');
    
    // Join stories with transactions and related entities to get enriched data
    const results = await db
      .select({
        // Story fields
        id: stories.id,
        transactionId: stories.transactionId,
        authorType: stories.authorType,
        message: stories.message,
        photoUrl: stories.photoUrl,
        isPublic: stories.isPublic,
        showAmount: stories.showAmount,
        showGiver: stories.showGiver,
        showRecipient: stories.showRecipient,
        sharingPlatforms: stories.sharingPlatforms,
        createdAt: stories.createdAt,
        // Transaction fields
        amount: transactions.amount,
        // Wallet fields
        fromWalletName: wallets.name,
        toWalletName: toWallet.name,
        // Entity names
        philanthropistName: philanthropists.displayName,
        tagName: tags.beneficiaryName,
        outletName: merchantOutlets.name,
      })
      .from(stories)
      .innerJoin(transactions, eq(stories.transactionId, transactions.id))
      .innerJoin(wallets, eq(transactions.fromWalletId, wallets.id))
      .innerJoin(toWallet, eq(transactions.toWalletId, toWallet.id))
      .leftJoin(philanthropists, eq(wallets.id, philanthropists.walletId))
      .leftJoin(tags, eq(toWallet.id, tags.walletId))
      .leftJoin(merchantOutlets, eq(toWallet.id, merchantOutlets.walletId))
      .where(eq(stories.isPublic, 1))
      .orderBy(desc(stories.createdAt));

    // Map to StoryFeedItem with privacy-aware fields
    return results.map((row) => ({
      id: row.id,
      transactionId: row.transactionId,
      authorType: row.authorType as 'GIVER' | 'RECEIVER',
      message: row.message,
      photoUrl: row.photoUrl,
      isPublic: row.isPublic,
      showAmount: row.showAmount,
      showGiver: row.showGiver,
      showRecipient: row.showRecipient,
      sharingPlatforms: row.sharingPlatforms,
      createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
      amountZAR: row.showAmount === 1 ? row.amount : null,
      giverName: row.showGiver === 1 ? (row.philanthropistName || row.fromWalletName || 'Anonymous') : null,
      recipientName: row.showRecipient === 1 ? (row.tagName || row.outletName || row.toWalletName || 'Recipient') : null,
    }));
  }

  async getStoriesByAuthor(authorType: 'GIVER' | 'RECEIVER'): Promise<Story[]> {
    if (supabase) {
      const { data, error } = await supabase.from('stories').select('*').eq('author_type', authorType).order('created_at', { ascending: false });
      if (error) {
        console.error('Supabase getStoriesByAuthor error:', error.message || error);
        return [];
      }
      return camelizeRows<Story>(data as any);
    }
    return db.select().from(stories).where(eq(stories.authorType, authorType)).orderBy(desc(stories.createdAt));
  }

  async lookupReferralCode(code: string): Promise<{ type: 'PHILANTHROPIST' | 'TAG' | 'MERCHANT' | 'ORGANIZATION', id: string, walletId?: string } | null> {
    if (supabase) {
      // Check philanthropists
      const { data: philanthropistData, error: philError } = await supabase.from('philanthropists').select('*').eq('referral_code', code).maybeSingle();
      if (!philError && philanthropistData) {
        const phil = camelizeRow<any>(philanthropistData as any);
        return { type: 'PHILANTHROPIST', id: phil.id, walletId: phil.walletId };
      }

      // Check tags
      const { data: tagData, error: tagError } = await supabase.from('tags').select('*').eq('referral_code', code).maybeSingle();
      if (!tagError && tagData) {
        const tag = camelizeRow<any>(tagData as any);
        return { type: 'TAG', id: tag.tagCode, walletId: tag.walletId };
      }

      // Check merchant outlets
      const { data: outletData, error: outletError } = await supabase.from('merchant_outlets').select('*').eq('referral_code', code).maybeSingle();
      if (!outletError && outletData) {
        const outlet = camelizeRow<any>(outletData as any);
        return { type: 'MERCHANT', id: outlet.id, walletId: outlet.walletId };
      }

      // Check organizations
      const { data: orgData, error: orgError } = await supabase.from('organizations').select('*').eq('referral_code', code).maybeSingle();
      if (!orgError && orgData) {
        const org = camelizeRow<any>(orgData as any);
        return { type: 'ORGANIZATION', id: org.id };
      }

      return null;
    }

    // Drizzle fallback
    // Check philanthropists
    const [philanthropist] = await db.select().from(philanthropists).where(eq(philanthropists.referralCode, code));
    if (philanthropist) {
      return { type: 'PHILANTHROPIST', id: philanthropist.id, walletId: philanthropist.walletId };
    }

    // Check tags
    const [tag] = await db.select().from(tags).where(eq(tags.referralCode, code));
    if (tag) {
      return { type: 'TAG', id: tag.tagCode, walletId: tag.walletId };
    }

    // Check merchant outlets
    const [outlet] = await db.select().from(merchantOutlets).where(eq(merchantOutlets.referralCode, code));
    if (outlet) {
      return { type: 'MERCHANT', id: outlet.id, walletId: outlet.walletId };
    }

    // Check organizations
    const [org] = await db.select().from(organizations).where(eq(organizations.referralCode, code));
    if (org) {
      return { type: 'ORGANIZATION', id: org.id };
    }

    return null;
  }

  async createRecurringDonation(insertDonation: InsertRecurringDonation): Promise<RecurringDonation> {
    if (supabase) {
      const { data, error } = await supabase.from('recurring_donations').insert(snakeifyRow(insertDonation)).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<RecurringDonation>(data as any);
    }
    const [donation] = await db
      .insert(recurringDonations)
      .values(insertDonation)
      .returning();
    return donation;
  }

  async getRecurringDonation(id: string): Promise<RecurringDonation | undefined> {
    if (supabase) {
      const { data, error } = await supabase.from('recurring_donations').select('*').eq('id', id).maybeSingle();
      if (error) {
        console.error('Supabase getRecurringDonation error:', error.message || error);
        return undefined;
      }
      return data ? camelizeRow<RecurringDonation>(data as any) : undefined;
    }
    const [donation] = await db.select().from(recurringDonations).where(eq(recurringDonations.id, id));
    return donation || undefined;
  }

  async getRecurringDonationsByPhilanthropist(philanthropistId: string): Promise<RecurringDonation[]> {
    if (supabase) {
      const { data, error } = await supabase.from('recurring_donations').select('*').eq('philanthropist_id', philanthropistId).order('created_at', { ascending: false });
      if (error) {
        console.error('Supabase getRecurringDonationsByPhilanthropist error:', error.message || error);
        return [];
      }
      return camelizeRows<RecurringDonation>(data as any);
    }
    return db.select().from(recurringDonations).where(eq(recurringDonations.philanthropistId, philanthropistId)).orderBy(desc(recurringDonations.createdAt));
  }

  async updateRecurringDonationStatus(id: string, status: 'active' | 'paused' | 'cancelled'): Promise<RecurringDonation> {
    if (supabase) {
      const { data, error } = await supabase.from('recurring_donations').update({ status }).eq('id', id).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<RecurringDonation>(data as any);
    }
    const [donation] = await db
      .update(recurringDonations)
      .set({ status })
      .where(eq(recurringDonations.id, id))
      .returning();
    return donation;
  }

  async updateRecurringDonationProcessing(id: string, nextDate: Date): Promise<RecurringDonation> {
    if (supabase) {
      const { data, error } = await supabase.from('recurring_donations').update({ 
        last_processed_at: new Date().toISOString(),
        next_processing_date: nextDate.toISOString()
      }).eq('id', id).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<RecurringDonation>(data as any);
    }
    const [donation] = await db
      .update(recurringDonations)
      .set({ 
        lastProcessedAt: new Date(),
        nextProcessingDate: nextDate 
      })
      .where(eq(recurringDonations.id, id))
      .returning();
    return donation;
  }

  async getActiveRecurringDonationsDueForProcessing(): Promise<RecurringDonation[]> {
    if (supabase) {
      const now = new Date().toISOString();
      const { data, error } = await supabase.from('recurring_donations').select('*')
        .eq('status', 'active')
        .or(`next_processing_date.is.null,next_processing_date.lte.${now}`);
      if (error) {
        console.error('Supabase getActiveRecurringDonationsDueForProcessing error:', error.message || error);
        return [];
      }
      return camelizeRows<RecurringDonation>(data as any);
    }
    const now = new Date();
    return db
      .select()
      .from(recurringDonations)
      .where(
        sql`${recurringDonations.status} = 'active' 
        AND (${recurringDonations.nextProcessingDate} IS NULL 
        OR ${recurringDonations.nextProcessingDate} <= ${now})`
      );
  }

  // Disaster Relief Campaigns (Dusty Bin)
  async createDisasterCampaign(insertCampaign: InsertDisasterCampaign): Promise<DisasterCampaign> {
    if (supabase) {
      const { data, error } = await supabase.from('disaster_campaigns').insert(snakeifyRow(insertCampaign)).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<DisasterCampaign>(data as any);
    }
    const [campaign] = await db
      .insert(disasterCampaigns)
      .values(insertCampaign)
      .returning();
    return campaign;
  }

  async getDisasterCampaignById(id: string): Promise<DisasterCampaign | undefined> {
    if (supabase) {
      const { data, error } = await supabase.from('disaster_campaigns').select('*').eq('id', id).maybeSingle();
      if (error) {
        console.error('Supabase getDisasterCampaignById error:', error.message || error);
        return undefined;
      }
      return data ? camelizeRow<DisasterCampaign>(data as any) : undefined;
    }
    const [campaign] = await db.select().from(disasterCampaigns).where(eq(disasterCampaigns.id, id));
    return campaign || undefined;
  }

  async getDisasterCampaignsByMonth(monthYear: string): Promise<DisasterCampaign[]> {
    if (supabase) {
      const { data, error } = await supabase.from('disaster_campaigns').select('*').eq('month_year', monthYear).order('vote_count', { ascending: false });
      if (error) {
        console.error('Supabase getDisasterCampaignsByMonth error:', error.message || error);
        return [];
      }
      return camelizeRows<DisasterCampaign>(data as any);
    }
    return db
      .select()
      .from(disasterCampaigns)
      .where(eq(disasterCampaigns.monthYear, monthYear))
      .orderBy(desc(disasterCampaigns.voteCount));
  }

  async createCampaignVote(insertVote: InsertCampaignVote): Promise<CampaignVote> {
    if (supabase) {
      const { data, error } = await supabase.from('campaign_votes').insert(snakeifyRow(insertVote)).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<CampaignVote>(data as any);
    }
    const [vote] = await db
      .insert(campaignVotes)
      .values(insertVote)
      .returning();
    return vote;
  }

  async hasUserVotedForCampaign(userId: string, campaignId: string): Promise<boolean> {
    if (supabase) {
      const { data, error } = await supabase.from('campaign_votes').select('*').eq('user_id', userId).eq('campaign_id', campaignId).maybeSingle();
      if (error) {
        console.error('Supabase hasUserVotedForCampaign error:', error.message || error);
        return false;
      }
      return !!data;
    }
    const [vote] = await db
      .select()
      .from(campaignVotes)
      .where(
        sql`${campaignVotes.userId} = ${userId} AND ${campaignVotes.campaignId} = ${campaignId}`
      );
    return !!vote;
  }

  async incrementCampaignVotes(campaignId: string): Promise<void> {
    if (supabase) {
      const { data, error } = await supabase.rpc('increment_campaign_votes', { campaign_id: campaignId });
      if (error) {
        console.error('Supabase incrementCampaignVotes error:', error.message || error);
      }
      return;
    }
    await db
      .update(disasterCampaigns)
      .set({ voteCount: sql`${disasterCampaigns.voteCount} + 1` })
      .where(eq(disasterCampaigns.id, campaignId));
  }

  async getTotalDustyBinForMonth(monthYear: string): Promise<number> {
    if (supabase) {
      const { data, error } = await supabase.rpc('get_total_dusty_bin_for_month', { month_year: monthYear });
      if (error) {
        console.error('Supabase getTotalDustyBinForMonth error:', error.message || error);
        return 0;
      }
      return data?.total || 0;
    }
    const result = await db
      .select({ total: sql<number>`SUM(${dustyBinDonations.amountUsdCents})` })
      .from(dustyBinDonations)
      .where(eq(dustyBinDonations.monthYear, monthYear));
    return result[0]?.total || 0;
  }

  async getOrganizationById(id: string): Promise<Organization | undefined> {
    if (supabase) {
      const { data, error } = await supabase.from('organizations').select('*').eq('id', id).maybeSingle();
      if (error) {
        console.error('Supabase getOrganizationById error:', error.message || error);
        return undefined;
      }
      return data ? camelizeRow<Organization>(data as any) : undefined;
    }
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org || undefined;
  }

  async getUserRoleByUserId(userId: string, role: string): Promise<typeof userRoles.$inferSelect | undefined> {
    if (supabase) {
      const { data, error } = await supabase.from('user_roles').select('*').eq('user_id', userId).eq('role', role).maybeSingle();
      if (error) {
        console.error('Supabase getUserRoleByUserId error:', error.message || error);
        return undefined;
      }
      return data ? camelizeRow<any>(data as any) : undefined;
    }
    const [userRole] = await db
      .select()
      .from(userRoles)
      .where(
        sql`${userRoles.userId} = ${userId} AND ${userRoles.role} = ${role}`
      );
    return userRole || undefined;
  }

  // WhatsApp Business API Demo - In-Memory Implementation
  private whatsappContacts: Map<string, any> = new Map();
  private whatsappConversations: Map<string, any> = new Map();
  private whatsappMessages: Map<string, any> = new Map();
  private whatsappTickets: Map<string, any> = new Map();
  private whatsappDemoSeeded: boolean = false;

  private async seedWhatsappDemoData() {
    if (this.whatsappDemoSeeded) return;
    
    const now = new Date();
    const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60000);
    const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3600000);
    const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000);

    // Create realistic contacts with diverse names and companies
    const contacts = [
      {
        id: crypto.randomUUID(),
        name: 'Aisha Okonkwo',
        phone: '+27821234567',
        email: 'aisha.o@investcorp.co.za',
        tags: ['donor', 'crypto', 'regular'],
        notes: 'Tech entrepreneur, monthly ETH donor, passionate about education',
        createdAt: daysAgo(45)
      },
      {
        id: crypto.randomUUID(),
        name: 'Thabo Nkosi',
        phone: '+27829876543',
        email: 'thabo.nkosi@gmail.com',
        tags: ['beneficiary', 'freedom-tag'],
        notes: 'Freedom Tag recipient, fruit vendor in Johannesburg CBD',
        createdAt: daysAgo(30)
      },
      {
        id: crypto.randomUUID(),
        name: 'UNICEF South Africa',
        phone: '+27823456789',
        email: 'digital@unicef.org.za',
        tags: ['charity', 'verified', 'international'],
        notes: 'Global organization with smart contract, children and education focus',
        createdAt: daysAgo(120)
      },
      {
        id: crypto.randomUUID(),
        name: 'Chen Wei',
        phone: '+27824567890',
        email: 'chen.wei@blockventures.com',
        tags: ['donor', 'crypto', 'whale'],
        notes: 'BTC whale investor, disaster relief advocate, Dusty Bin supporter',
        createdAt: daysAgo(15)
      },
      {
        id: crypto.randomUUID(),
        name: 'Fatima Al-Rashid',
        phone: '+27825678901',
        email: 'fatima@empowerafrica.org',
        tags: ['beneficiary', 'active'],
        notes: 'Active Freedom Tag user, craft market seller at V&A Waterfront',
        createdAt: daysAgo(60)
      },
      {
        id: crypto.randomUUID(),
        name: 'Red Cross Red Crescent',
        phone: '+27826789012',
        email: 'blockchain@redcross.org.za',
        tags: ['charity', 'verified', 'disaster-relief'],
        notes: 'International humanitarian org with ERC-20F vault, disaster response',
        createdAt: daysAgo(90)
      },
      {
        id: crypto.randomUUID(),
        name: 'Isabella Rodriguez',
        phone: '+27827890123',
        email: 'isabella.r@gmail.com',
        tags: ['donor', 'recurring'],
        notes: 'Corporate donor from Stellenbosch, monthly fiat contributor',
        createdAt: daysAgo(25)
      },
      {
        id: crypto.randomUUID(),
        name: 'Doctors Without Borders',
        phone: '+27828901234',
        email: 'crypto@msf.org.za',
        tags: ['charity', 'verified', 'medical'],
        notes: 'Medical humanitarian organization, blockchain verified since 2023',
        createdAt: daysAgo(150)
      }
    ];

    contacts.forEach(contact => {
      this.whatsappContacts.set(contact.id, contact);
    });

    // Create conversations with realistic message histories using new diverse contacts
    const aishaId = contacts[0].id;  // Aisha Okonkwo - Tech entrepreneur
    const thaboId = contacts[1].id;  // Thabo Nkosi - Beneficiary
    const unicefId = contacts[2].id;  // UNICEF South Africa
    const chenId = contacts[3].id;   // Chen Wei - BTC whale
    const fatimaId = contacts[4].id; // Fatima Al-Rashid - Beneficiary
    const redCrossId = contacts[5].id; // Red Cross
    const isabellaId = contacts[6].id; // Isabella Rodriguez
    const msfId = contacts[7].id;    // Doctors Without Borders

    // Conversation 1: Aisha Okonkwo (Tech entrepreneur, ETH donor)
    const conv1Id = crypto.randomUUID();
    this.whatsappConversations.set(conv1Id, {
      id: conv1Id,
      contactId: aishaId,
      status: 'active',
      lastMessageAt: minutesAgo(15),
      createdAt: daysAgo(45)
    });

    const aishaMessages = [
      { id: crypto.randomUUID(), conversationId: conv1Id, sender: 'contact', content: 'Hi, I want to set up monthly ETH donations for education programs. Can I target specific schools?', sentAt: hoursAgo(2) },
      { id: crypto.randomUUID(), conversationId: conv1Id, sender: 'agent', content: 'Absolutely! Thanks for supporting education, Aisha. You can set up recurring crypto donations with USD-pegged amounts that convert to ETH monthly. You can donate to verified organizations like UNICEF or specific Freedom Tags for individual beneficiaries.', sentAt: new Date(hoursAgo(2).getTime() + 120000) },
      { id: crypto.randomUUID(), conversationId: conv1Id, sender: 'contact', content: 'Perfect! I also have some crypto dust left over from trading. What is this Dusty Bin I heard about?', sentAt: new Date(hoursAgo(1).getTime() + 900000) },
      { id: crypto.randomUUID(), conversationId: conv1Id, sender: 'agent', content: 'The Dusty Bin is brilliant for that! Donate your leftover crypto to a community fund. Each month, users vote on which disaster relief campaign gets the pooled funds. Only smart contract-verified organizations can create campaigns, so everything is transparent on-chain.', sentAt: new Date(hoursAgo(1).getTime() + 960000) },
      { id: crypto.randomUUID(), conversationId: conv1Id, sender: 'contact', content: 'Love it! Setting up R5000/month ETH donations now. Can I get tax receipts?', sentAt: minutesAgo(15) }
    ];

    aishaMessages.forEach(msg => {
      this.whatsappMessages.set(msg.id, msg);
    });

    // Conversation 2: Thabo Nkosi (Fruit vendor beneficiary)
    const conv2Id = crypto.randomUUID();
    this.whatsappConversations.set(conv2Id, {
      id: conv2Id,
      contactId: thaboId,
      status: 'active',
      lastMessageAt: minutesAgo(45),
      createdAt: daysAgo(30)
    });

    const thaboMessages = [
      { id: crypto.randomUUID(), conversationId: conv2Id, sender: 'contact', content: 'Hello, a charity worker gave me a Freedom Tag. How does it work?', sentAt: hoursAgo(4) },
      { id: crypto.randomUUID(), conversationId: conv2Id, sender: 'agent', content: 'Welcome Thabo! Your Freedom Tag lets you receive donations instantly via QR code. Set it up in 30 seconds - do you have your tag code?', sentAt: new Date(hoursAgo(4).getTime() + 90000) },
      { id: crypto.randomUUID(), conversationId: conv2Id, sender: 'contact', content: 'Yes: FT-2025-JHB-8821', sentAt: new Date(hoursAgo(4).getTime() + 300000) },
      { id: crypto.randomUUID(), conversationId: conv2Id, sender: 'agent', content: 'Perfect! Tag verified. Donors can now scan your QR code to give - they stay anonymous, but the blockchain shows where funds go. You control your tag with a PIN. Check your balance anytime at /donor', sentAt: new Date(hoursAgo(3).getTime() + 480000) },
      { id: crypto.randomUUID(), conversationId: conv2Id, sender: 'contact', content: 'Just received my first donation - R50! This is amazing, thank you!', sentAt: minutesAgo(45) }
    ];

    thaboMessages.forEach(msg => {
      this.whatsappMessages.set(msg.id, msg);
    });

    // Conversation 3: UNICEF (International org joining platform)
    const conv3Id = crypto.randomUUID();
    this.whatsappConversations.set(conv3Id, {
      id: conv3Id,
      contactId: unicefId,
      status: 'active',
      lastMessageAt: hoursAgo(8),
      createdAt: daysAgo(120)
    });

    const unicefMessages = [
      { id: crypto.randomUUID(), conversationId: conv3Id, sender: 'contact', content: 'UNICEF is interested in blockchain-verified donations for our South African education programs. What is required?', sentAt: daysAgo(5) },
      { id: crypto.randomUUID(), conversationId: conv3Id, sender: 'agent', content: 'Excellent! Smart contract verification provides ultimate transparency. Requirements: 1) Sumsub KYC, 2) Fireblocks ERC-20F vault deployment, 3) Organization registration. Your Etherscan contract link will be public for donor verification.', sentAt: new Date(daysAgo(5).getTime() + 600000) },
      { id: crypto.randomUUID(), conversationId: conv3Id, sender: 'contact', content: 'We already have Fireblocks infrastructure. Can we integrate existing vaults?', sentAt: daysAgo(4) },
      { id: crypto.randomUUID(), conversationId: conv3Id, sender: 'agent', content: 'Yes! Existing Fireblocks vaults can be integrated. You will also qualify for Dusty Bin disaster campaigns. With smart contracts, donors trust you because the world can verify fund movements on-chain.', sentAt: new Date(daysAgo(4).getTime() + 300000) },
      { id: crypto.randomUUID(), conversationId: conv3Id, sender: 'contact', content: 'Perfect. Our compliance team will send documents tomorrow. Expected timeline?', sentAt: hoursAgo(8) }
    ];

    unicefMessages.forEach(msg => {
      this.whatsappMessages.set(msg.id, msg);
    });

    // Conversation 4: Chen Wei (BTC whale, disaster relief advocate)
    const conv4Id = crypto.randomUUID();
    this.whatsappConversations.set(conv4Id, {
      id: conv4Id,
      contactId: chenId,
      status: 'active',
      lastMessageAt: minutesAgo(30),
      createdAt: daysAgo(15)
    });

    const chenMessages = [
      { id: crypto.randomUUID(), conversationId: conv4Id, sender: 'contact', content: 'I hold significant BTC and want to support disaster relief. Tell me about Dusty Bin voting.', sentAt: hoursAgo(3) },
      { id: crypto.randomUUID(), conversationId: conv4Id, sender: 'agent', content: 'Dusty Bin is perfect for crypto advocates! Donate any crypto (including dust amounts) to a monthly pool. Community votes decide which verified disaster campaign wins. Only smart contract orgs can participate - fully transparent.', sentAt: new Date(hoursAgo(3).getTime() + 180000) },
      { id: crypto.randomUUID(), conversationId: conv4Id, sender: 'contact', content: 'How is voting integrity maintained? Can whales dominate?', sentAt: hoursAgo(2) },
      { id: crypto.randomUUID(), conversationId: conv4Id, sender: 'agent', content: 'One vote per user per campaign - prevents whale dominance. Real-time vote counts visible. All campaigns show Etherscan links and blockchain verification badges. Donors stay anonymous but fund distribution is 100% transparent on-chain.', sentAt: new Date(hoursAgo(2).getTime() + 240000) },
      { id: crypto.randomUUID(), conversationId: conv4Id, sender: 'contact', content: 'Brilliant design! Just donated 0.05 BTC to this month\'s pool. Which campaign is winning?', sentAt: minutesAgo(30) }
    ];

    chenMessages.forEach(msg => {
      this.whatsappMessages.set(msg.id, msg);
    });

    // Conversation 5: Red Cross (Disaster relief organization)
    const conv5Id = crypto.randomUUID();
    this.whatsappConversations.set(conv5Id, {
      id: conv5Id,
      contactId: redCrossId,
      status: 'active',
      lastMessageAt: hoursAgo(2),
      createdAt: daysAgo(90)
    });

    const redCrossMessages = [
      { id: crypto.randomUUID(), conversationId: conv5Id, sender: 'contact', content: 'Red Cross wants to create a Dusty Bin campaign for flood relief in KZN. How do we start?', sentAt: hoursAgo(6) },
      { id: crypto.randomUUID(), conversationId: conv5Id, sender: 'agent', content: 'Your smart contract is already verified! You can create disaster campaigns at /dusty-bin. Community votes monthly - winning campaign gets pooled crypto donations. Perfect for urgent relief efforts.', sentAt: new Date(hoursAgo(6).getTime() + 300000) },
      { id: crypto.randomUUID(), conversationId: conv5Id, sender: 'contact', content: 'Excellent. Our ERC-20F vault is live at 0x742d...A3f9. Campaign launching today.', sentAt: hoursAgo(2) }
    ];

    redCrossMessages.forEach(msg => {
      this.whatsappMessages.set(msg.id, msg);
    });

    // Create realistic support tickets with diverse contacts
    const tickets = [
      {
        id: crypto.randomUUID(),
        ticketNumber: `TKT-${Date.now()}-A1B2`,
        contactId: aishaId,
        subject: 'ETH recurring donation - tax receipt setup',
        description: 'Need to configure automatic tax receipts for R5000/month ETH donations to education programs',
        status: 'in_progress',
        priority: 'high',
        assignedTo: 'Compliance Team',
        createdAt: hoursAgo(6),
        updatedAt: hoursAgo(2)
      },
      {
        id: crypto.randomUUID(),
        ticketNumber: `TKT-${Date.now() - 50000}-B3C4`,
        contactId: thaboId,
        subject: 'QR code printed cards request',
        description: 'Freedom Tag working great! Can I get physical QR code cards to display at my fruit stand?',
        status: 'open',
        priority: 'medium',
        assignedTo: 'Operations Team',
        createdAt: hoursAgo(4),
        updatedAt: hoursAgo(4)
      },
      {
        id: crypto.randomUUID(),
        ticketNumber: `TKT-${Date.now() - 100000}-D5E6`,
        contactId: unicefId,
        subject: 'Fireblocks vault integration timeline',
        description: 'UNICEF compliance docs submitted. What is expected integration timeline for ERC-20F vault?',
        status: 'in_progress',
        priority: 'high',
        assignedTo: 'Blockchain Team',
        createdAt: hoursAgo(10),
        updatedAt: hoursAgo(8)
      },
      {
        id: crypto.randomUUID(),
        ticketNumber: `TKT-${Date.now() - 150000}-F7G8`,
        contactId: chenId,
        subject: 'BTC donation confirmation on Etherscan',
        description: 'Just donated 0.05 BTC to Dusty Bin. Where can I verify the transaction on blockchain?',
        status: 'resolved',
        priority: 'low',
        assignedTo: 'Support Team',
        createdAt: hoursAgo(2),
        updatedAt: minutesAgo(90),
        resolvedAt: minutesAgo(90)
      },
      {
        id: crypto.randomUUID(),
        ticketNumber: `TKT-${Date.now() - 200000}-H9I0`,
        contactId: fatimaId,
        subject: 'Multiple donations received - balance update',
        description: 'Received 3 donations today (R120 total) but balance shows R100. Missing R20?',
        status: 'open',
        priority: 'high',
        assignedTo: 'Finance Team',
        createdAt: hoursAgo(3),
        updatedAt: hoursAgo(3)
      },
      {
        id: crypto.randomUUID(),
        ticketNumber: `TKT-${Date.now() - 250000}-J1K2`,
        contactId: redCrossId,
        subject: 'Disaster campaign - KZN flood relief setup',
        description: 'Red Cross launching urgent flood relief campaign. Need Dusty Bin campaign creation assistance.',
        status: 'resolved',
        priority: 'high',
        assignedTo: 'Campaign Team',
        createdAt: hoursAgo(8),
        updatedAt: hoursAgo(2),
        resolvedAt: hoursAgo(2)
      },
      {
        id: crypto.randomUUID(),
        ticketNumber: `TKT-${Date.now() - 300000}-L3M4`,
        contactId: isabellaId,
        subject: 'Corporate matching program integration',
        description: 'Can our company match employee donations? Need API documentation for corporate integration.',
        status: 'open',
        priority: 'medium',
        assignedTo: 'Business Development',
        createdAt: hoursAgo(12),
        updatedAt: hoursAgo(12)
      },
      {
        id: crypto.randomUUID(),
        ticketNumber: `TKT-${Date.now() - 350000}-N5O6`,
        contactId: msfId,
        subject: 'Smart contract audit report request',
        description: 'Doctors Without Borders needs audit report for our deployed ERC-20F vault for compliance',
        status: 'resolved',
        priority: 'medium',
        assignedTo: 'Compliance Team',
        createdAt: daysAgo(2),
        updatedAt: daysAgo(1),
        resolvedAt: daysAgo(1)
      }
    ];

    tickets.forEach(ticket => {
      this.whatsappTickets.set(ticket.id, ticket);
    });

    this.whatsappDemoSeeded = true;
  }

  async createWhatsappContact(contact: any): Promise<any> {
    const id = crypto.randomUUID();
    const newContact = { id, ...contact, createdAt: new Date() };
    this.whatsappContacts.set(id, newContact);
    return newContact;
  }

  async getWhatsappContact(id: string): Promise<any | undefined> {
    return this.whatsappContacts.get(id);
  }

  async getAllWhatsappContacts(): Promise<any[]> {
    await this.seedWhatsappDemoData();
    return Array.from(this.whatsappContacts.values());
  }

  async updateWhatsappContact(id: string, updates: any): Promise<any> {
    const contact = this.whatsappContacts.get(id);
    if (!contact) throw new Error('Contact not found');
    const updated = { ...contact, ...updates };
    this.whatsappContacts.set(id, updated);
    return updated;
  }

  async createWhatsappConversation(conversation: any): Promise<any> {
    const id = crypto.randomUUID();
    const newConvo = { id, ...conversation, createdAt: new Date() };
    this.whatsappConversations.set(id, newConvo);
    return newConvo;
  }

  async getWhatsappConversation(id: string): Promise<any | undefined> {
    return this.whatsappConversations.get(id);
  }

  async getWhatsappConversationsByContact(contactId: string): Promise<any[]> {
    return Array.from(this.whatsappConversations.values()).filter(c => c.contactId === contactId);
  }

  async getAllWhatsappConversations(): Promise<any[]> {
    await this.seedWhatsappDemoData();
    return Array.from(this.whatsappConversations.values());
  }

  async updateWhatsappConversation(id: string, updates: any): Promise<any> {
    const convo = this.whatsappConversations.get(id);
    if (!convo) throw new Error('Conversation not found');
    const updated = { ...convo, ...updates };
    this.whatsappConversations.set(id, updated);
    return updated;
  }

  async createWhatsappMessage(message: any): Promise<any> {
    const id = crypto.randomUUID();
    const newMessage = { id, ...message, sentAt: new Date() };
    this.whatsappMessages.set(id, newMessage);
    return newMessage;
  }

  async getWhatsappMessage(id: string): Promise<any | undefined> {
    return this.whatsappMessages.get(id);
  }

  async getWhatsappMessagesByConversation(conversationId: string): Promise<any[]> {
    return Array.from(this.whatsappMessages.values())
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  }

  async createWhatsappTicket(ticket: any): Promise<any> {
    const id = crypto.randomUUID();
    const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const newTicket = { id, ticketNumber, ...ticket, createdAt: new Date() };
    this.whatsappTickets.set(id, newTicket);
    return newTicket;
  }

  async getWhatsappTicket(id: string): Promise<any | undefined> {
    return this.whatsappTickets.get(id);
  }

  async getAllWhatsappTickets(): Promise<any[]> {
    await this.seedWhatsappDemoData();
    return Array.from(this.whatsappTickets.values());
  }

  async updateWhatsappTicket(id: string, updates: any): Promise<any> {
    const ticket = this.whatsappTickets.get(id);
    if (!ticket) throw new Error('Ticket not found');
    const updated = { ...ticket, ...updates };
    if (updates.status === 'resolved' || updates.status === 'closed') {
      updated.resolvedAt = new Date();
    }
    this.whatsappTickets.set(id, updated);
    return updated;
  }

  // Password Reset operations (Biometric KYC)
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    await this.ensureSeeded();
    if (supabase) {
      // Convert camelCase property names to snake_case for Supabase/PostgREST
      const { data, error } = await supabase.from('password_reset_tokens').insert(snakeifyRow(token)).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<PasswordResetToken>(data as any);
    }
    throw new Error('Supabase client not initialized');
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('password_reset_tokens').select('*').eq('token', token).maybeSingle();
      if (error) throw error;
      return data ? camelizeRow<PasswordResetToken>(data) : undefined;
    }
    throw new Error('Supabase client not initialized');
  }

  async getPasswordResetTokenById(id: string): Promise<PasswordResetToken | undefined> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('password_reset_tokens').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? camelizeRow<PasswordResetToken>(data) : undefined;
    }
    throw new Error('Supabase client not initialized');
  }

  async updatePasswordResetVerification(id: string, status: 'verified' | 'rejected', sumsubApplicantId?: string): Promise<PasswordResetToken> {
    await this.ensureSeeded();
    if (supabase) {
      const updates: any = { verification_status: status };
      if (status === 'verified') {
        updates.verified_at = new Date().toISOString();
      }
      if (sumsubApplicantId) {
        updates.sumsub_applicant_id = sumsubApplicantId;
      }
      const { data, error } = await supabase.from('password_reset_tokens').update(updates).eq('id', id).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<PasswordResetToken>(data as any);
    }
    throw new Error('Supabase client not initialized');
  }

  async markPasswordResetTokenUsed(id: string): Promise<PasswordResetToken> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('id', id).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<PasswordResetToken>(data as any);
    }
    throw new Error('Supabase client not initialized');
  }

  async deleteExpiredPasswordResetTokens(): Promise<void> {
    await this.ensureSeeded();
    if (supabase) {
      const now = new Date().toISOString();
      const { error } = await supabase.from('password_reset_tokens').delete().lt('expires_at', now);
      if (error) throw error;
      return;
    }
    throw new Error('Supabase client not initialized');
  }

  async updateUserPassword(userId: string, newPasswordHash: string, userType?: 'user' | 'philanthropist'): Promise<User | any> {
    await this.ensureSeeded();
    if (supabase) {
      if (userType === 'philanthropist') {
        const { data, error } = await supabase.from('philanthropists').update({ password_hash: newPasswordHash }).eq('id', userId).select().maybeSingle();
        if (error) throw error;
        return camelizeRow<any>(data as any);
      } else {
        const { data, error } = await supabase.from('users').update({ password_hash: newPasswordHash }).eq('id', userId).select().maybeSingle();
        if (error) throw error;
        return camelizeRow<User>(data as any);
      }
    }
    throw new Error('Supabase client not initialized');
  }

  // Learn System operations
  async getLearnEntry(route: string): Promise<LearnEntry | undefined> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('learn_entries').select('*').eq('route', route).maybeSingle();
      if (error) throw error;
      return data ? camelizeRow<LearnEntry>(data) : undefined;
    }
    throw new Error('Supabase client not initialized');
  }

  async getAllLearnEntries(): Promise<LearnEntry[]> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('learn_entries').select('*').order('last_updated_at', { ascending: false });
      if (error) throw error;
      return camelizeRows<LearnEntry>(data as any);
    }
    throw new Error('Supabase client not initialized');
  }

  async getPublishedLearnEntry(route: string): Promise<LearnEntry | undefined> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('learn_entries').select('*').eq('route', route).eq('status', 'published').maybeSingle();
      if (error) throw error;
      return data ? camelizeRow<LearnEntry>(data) : undefined;
    }
    throw new Error('Supabase client not initialized');
  }

  async createLearnEntry(entry: InsertLearnEntry): Promise<LearnEntry> {
    await this.ensureSeeded();
    if (supabase) {
      const { data, error } = await supabase.from('learn_entries').insert(snakeifyRow(entry)).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<LearnEntry>(data as any);
    }
    throw new Error('Supabase client not initialized');
  }

  async updateLearnEntry(id: string, entry: Partial<InsertLearnEntry>): Promise<LearnEntry> {
    await this.ensureSeeded();
    if (supabase) {
      const updates = { ...snakeifyRow(entry), last_updated_at: new Date().toISOString() };
      const { data, error } = await supabase.from('learn_entries').update(updates).eq('id', id).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<LearnEntry>(data as any);
    }
    throw new Error('Supabase client not initialized');
  }

  async publishLearnEntry(id: string, publishedBy: string): Promise<LearnEntry> {
    await this.ensureSeeded();
    if (supabase) {
      const updates = {
        status: 'published',
        published_at: new Date().toISOString(),
        published_by: publishedBy,
        last_updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from('learn_entries').update(updates).eq('id', id).select().maybeSingle();
      if (error) throw error;
      return camelizeRow<LearnEntry>(data as any);
    }
    throw new Error('Supabase client not initialized');
  }
}

export const storage = new DatabaseStorage();
