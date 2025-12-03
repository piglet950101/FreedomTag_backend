import { storage } from "./storage";

// Seed Learn entries for key user-action pages
export async function seedLearnEntries() {
  const learnEntries = [
    {
      route: "/donate",
      title: "Donate — How to use this page",
      howSteps: [
        "Choose a beneficiary by scanning their QR code or browsing the list",
        "Enter your donation amount in ZAR or USDT",
        "Select your payment method (Wallet Balance, USDT Crypto, or Card)",
        "Review fees and total, then tap 'Donate'",
        "Wait for the success confirmation and view your receipt"
      ],
      whatHappensNext: [
        "Receipt appears in your donation History tab",
        "Beneficiary's live total updates within 10 seconds",
        "You can share your blockchain proof link",
        "You'll receive an email confirmation"
      ],
      requirements: [
        "Minimum donation: ZAR 10 or 1 USDT",
        "Supported networks: TRON, Ethereum",
        "KYC required for donations over $50 (auto-triggered)"
      ],
      commonErrors: JSON.stringify([
        { code: "INSUFFICIENT_FUNDS", fix: "Top up your wallet balance first" },
        { code: "NETWORK_FEE_CHANGED", fix: "Recheck the total amount and confirm again" },
        { code: "KYC_REQUIRED", fix: "Complete quick verification to proceed with larger donations" }
      ]),
      privacyNote: "Card details are processed securely by our PSP and never stored on our servers.",
      status: "published" as const,
      publishedBy: "system",
    },
    {
      route: "/quick-tag-setup",
      title: "Quick Tag Setup — Create a Freedom Tag in 30 seconds",
      howSteps: [
        "Enter beneficiary's name and phone number",
        "Select the charity/organization (if applicable)",
        "Choose a 6-digit PIN for the tag",
        "Tap 'Create Freedom Tag' to generate instantly",
        "Download the QR code for the beneficiary"
      ],
      whatHappensNext: [
        "Tag is created and ready to receive donations immediately",
        "Beneficiary can use the tag code and PIN to access funds",
        "QR code can be printed or shared digitally",
        "Tag appears in the organization's tag list"
      ],
      requirements: [
        "Valid beneficiary name (2-50 characters)",
        "Phone number (optional but recommended)",
        "6-digit PIN (easy to remember for beneficiary)"
      ],
      commonErrors: JSON.stringify([
        { code: "TAG_CODE_EXISTS", fix: "Try again - the system will generate a new unique code" },
        { code: "INVALID_PIN", fix: "PIN must be exactly 6 digits" },
        { code: "MISSING_ORGANIZATION", fix: "Select a valid charity organization from the list" }
      ]),
      privacyNote: "Beneficiary information is encrypted and only accessible by authorized charity staff.",
      status: "published" as const,
      publishedBy: "system",
    },
    {
      route: "/user-dashboard",
      title: "User Dashboard — Manage your Freedom Tag",
      howSteps: [
        "View your current balance and total donations received",
        "Check your complete donation history with blockchain links",
        "Buy or sell USDT crypto for instant ZAR conversion",
        "Manage recurring donations you've set up",
        "Update privacy settings to show/hide amounts"
      ],
      whatHappensNext: [
        "All transactions are recorded on blockchain for transparency",
        "Balance updates appear within seconds",
        "Crypto purchases settle instantly via Blockkoin",
        "Recurring donations process automatically each month"
      ],
      requirements: [
        "Active Freedom Tag with valid PIN",
        "Verified phone number for security",
        "Minimum R50 balance for crypto purchases"
      ],
      commonErrors: JSON.stringify([
        { code: "SESSION_EXPIRED", fix: "Log in again with your tag code and PIN" },
        { code: "INSUFFICIENT_BALANCE", fix: "Wait for donations or contact your organization" },
        { code: "CRYPTO_LIMIT_EXCEEDED", fix: "Daily crypto buy/sell limit is R10,000 - try again tomorrow" }
      ]),
      privacyNote: "Your financial activity is visible only to you and can be hidden from public view.",
      status: "published" as const,
      publishedBy: "system",
    },
    {
      route: "/philanthropist/signup",
      title: "Philanthropist Signup — Create your donor account",
      howSteps: [
        "Enter your full name and email address",
        "Create a secure password (min 8 characters)",
        "Select your country and preferred currency",
        "Agree to terms and tap 'Create Account'",
        "Share your referral code on social media (auto-popup)"
      ],
      whatHappensNext: [
        "Blockkoin crypto wallet is auto-created for you",
        "You can start donating immediately",
        "KYC verification triggers for donations over $50",
        "Referral rewards credited when friends join"
      ],
      requirements: [
        "Valid email address",
        "Password with at least 8 characters",
        "Must be 18 years or older"
      ],
      commonErrors: JSON.stringify([
        { code: "EMAIL_EXISTS", fix: "This email is already registered - try logging in or use password recovery" },
        { code: "WEAK_PASSWORD", fix: "Use a stronger password with letters, numbers, and symbols" },
        { code: "INVALID_COUNTRY", fix: "Select a valid country from the dropdown list" }
      ]),
      privacyNote: "Your personal information is encrypted and never shared with third parties.",
      status: "published" as const,
      publishedBy: "system",
    },
  ];

  console.log("🌱 Seeding Learn entries...");
  
  for (const entry of learnEntries) {
    try {
      const existing = await storage.getLearnEntry(entry.route);
      if (!existing) {
        await storage.createLearnEntry(entry);
        console.log(`✅ Created Learn entry for ${entry.route}`);
      } else {
        console.log(`ℹ️  Learn entry already exists for ${entry.route}`);
      }
    } catch (error) {
      console.error(`❌ Error creating Learn entry for ${entry.route}:`, error);
    }
  }
  
  console.log("✨ Learn entries seeding complete!");
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedLearnEntries()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Seed error:", error);
      process.exit(1);
    });
}
