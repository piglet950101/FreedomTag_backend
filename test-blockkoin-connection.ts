import 'dotenv/config';
import { storage } from './storage';
import { blockkoinClient } from './blockkoin';

async function testBlockkoinConnection() {
  try {
    const beneficiaryEmail = 'noyannoodle7@gmail.com';
    
    console.log('🔍 Testing Blockkoin Connection for:', beneficiaryEmail);
    console.log('================================================\n');

    // 1. Get user from database using storage layer
    const user = await storage.getUserByEmail(beneficiaryEmail);
    
    if (!user) {
      console.log('❌ User not found in database');
      console.log('');
      console.log('📝 Create a beneficiary account first:');
      console.log('   1. Go to: http://localhost:5173/beneficiary-signup');
      console.log('   2. Sign up with email:', beneficiaryEmail);
      return;
    }

    console.log('👤 User Information:');
    console.log('   - ID:', user.id);
    console.log('   - Email:', user.email);
    console.log('   - Name:', user.fullName);
    console.log('   - Blockkoin Account ID:', user.blockkoinAccountId || '❌ NOT SET');
    console.log('   - Blockkoin KYC Status:', user.blockkoinKycStatus || '❌ NOT SET');
    console.log('');

    // 2. Check if user has Blockkoin account
    if (!user.blockkoinAccountId) {
      console.log('⚠️  No Blockkoin account linked to this user');
      console.log('');
      console.log('🔧 Creating Blockkoin account now...');
      try {
        const account = await blockkoinClient.createAccount(user.email, user.fullName, user.country || undefined);
        console.log('✅ Blockkoin account created successfully!');
        console.log('   - Account ID:', account.id);
        console.log('   - Email:', account.email);
        console.log('   - KYC Status:', account.kycStatus);
        console.log('   - Wallets:', account.wallets.length);
        
        // Update user in database
        await storage.updateUserLastLogin(user.id);
        console.log('⚠️  Note: updateUserBlockkoinAccount not yet implemented in storage');
        console.log('   You can manually update with SQL:');
        console.log(`   UPDATE users SET blockkoin_account_id = '${account.id}', blockkoin_kyc_status = '${account.kycStatus}' WHERE id = '${user.id}';`);
        
        user.blockkoinAccountId = account.id;
        user.blockkoinKycStatus = account.kycStatus;
      } catch (createError: any) {
        console.log('❌ Failed to create account:', createError.message);
        return;
      }
    } else {
      console.log('✅ Blockkoin account is linked');
    }

    console.log('');

    // 3. Test KYC status
    console.log('🔐 Checking KYC Status...');
    try {
      const kycStatus = await blockkoinClient.checkKYCStatus(user.blockkoinAccountId!);
      console.log('✅ KYC Status:', kycStatus);
      
      if (kycStatus !== user.blockkoinKycStatus) {
        console.log('   ℹ️  KYC status changed:',user.blockkoinKycStatus, '→', kycStatus);
        console.log('   Update manually if needed');
      }
    } catch (kycError: any) {
      console.log('❌ Failed to check KYC:', kycError.message);
    }

    console.log('');

    // 4. Test exchange rates
    console.log('💱 Fetching Exchange Rates...');
    try {
      const rates = await blockkoinClient.getExchangeRates('ZAR');
      console.log('✅ Exchange rates (ZAR):');
      rates.forEach(rate => {
        const zarAmount = rate.rate / 100;
        console.log(`   - 1 ${rate.from} = R${zarAmount.toFixed(2)}`);
      });
    } catch (rateError: any) {
      console.log('❌ Failed to fetch rates:', rateError.message);
    }

    console.log('');

    // 5. Get user's tag if they have one
    console.log('🏷️  Checking for Freedom Tag...');
    const tag = await storage.getTagByUserId(user.id);
    if (tag) {
      console.log('✅ Tag found:');
      console.log('   - Tag Code:', tag.tagCode);
      console.log('   - Beneficiary Name:', tag.beneficiaryName);
      const wallet = await storage.getWallet(tag.walletId);
      if (wallet) {
        console.log('   - Balance: R', (wallet.balanceZAR / 100).toFixed(2));
      }
    } else {
      console.log('⚠️  No tag found. Create one at: http://localhost:5173/quick-tag-setup');
    }

    console.log('');
    console.log('================================================');
    console.log('✅ Blockkoin connection test complete!');
    console.log('');
    console.log('📋 Testing Steps:');
    console.log('   1. Start the server: npm run dev');
    console.log('   2. Login as:', beneficiaryEmail);
    console.log('   3. Go to Dashboard: http://localhost:5173/dashboard');
    console.log('');
    if (user.blockkoinAccountId) {
      console.log('   4. You should see "Crypto Wallet" card');
      console.log('      (Note: Frontend needs to call /api/crypto/balances)');
    } else {
      console.log('   4. No crypto wallet will show until account is linked');
    }
    console.log('');
    if (tag) {
      console.log('   5. Test crypto donation:');
      console.log(`      - Visit: http://localhost:5173/tag/${tag.tagCode}`);
      console.log('      - Click "Pay with Crypto"');
      console.log('      - Select currency (BTC/ETH/USDT)');
      console.log('      - Complete payment simulation');
    }

  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    process.exit(0);
  }
}

testBlockkoinConnection();
