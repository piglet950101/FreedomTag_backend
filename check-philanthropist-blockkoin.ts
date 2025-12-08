import 'dotenv/config';
import { storage } from './storage';

async function checkPhilanthropist() {
  try {
    console.log('🔍 Checking philanthropist accounts...\n');

    const philanthropists = await storage.getAllPhilanthropists();
    
    if (philanthropists.length === 0) {
      console.log('❌ No philanthropists found in database');
      console.log('\n📝 Create one at: http://localhost:5173/philanthropist-signup');
      return;
    }

    console.log(`✅ Found ${philanthropists.length} philanthropist(s):\n`);
    
    for (const p of philanthropists) {
      console.log(`👤 ${p.displayName || p.email}`);
      console.log(`   - ID: ${p.id}`);
      console.log(`   - Email: ${p.email}`);
      console.log(`   - Wallet ID: ${p.walletId}`);
      console.log(`   - Blockkoin Account: ${p.blockkoinAccountId || '❌ NOT SET'}`);
      console.log(`   - KYC Status: ${p.blockkoinKycStatus || 'N/A'}`);
      console.log('');
    }

    const hasBlockkoin = philanthropists.some(p => p.blockkoinAccountId);
    
    if (!hasBlockkoin) {
      console.log('⚠️  No philanthropists have Blockkoin accounts yet');
      console.log('\n💡 Solutions:');
      console.log('   1. Run the database migration first:');
      console.log('      - Open Supabase Dashboard SQL Editor');
      console.log('      - Run: ALTER TABLE philanthropists ADD COLUMN IF NOT EXISTS blockkoin_account_id TEXT, ADD COLUMN IF NOT EXISTS blockkoin_kyc_status TEXT DEFAULT \'none\';');
      console.log('');
      console.log('   2. Then create a NEW philanthropist account');
      console.log('      - Go to: http://localhost:5173/philanthropist-signup');
      console.log('      - Blockkoin account will be auto-created');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkPhilanthropist();
