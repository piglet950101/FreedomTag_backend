import 'dotenv/config';
import { storage } from './storage';

async function listUsers() {
  try {
    console.log('📋 Listing all users in database');
    console.log('================================================\n');

    const users = await storage.getAllUsers();
    
    if (users.length === 0) {
      console.log('❌ No users found in database');
      return;
    }

    console.log(`✅ Found ${users.length} user(s):\n`);
    
    for (const user of users) {
      console.log(`👤 ${user.fullName} (${user.email})`);
      console.log(`   - ID: ${user.id}`);
      console.log(`   - Phone: ${user.phone || 'N/A'}`);
      console.log(`   - Country: ${user.country || 'N/A'}`);
      console.log(`   - Blockkoin Account: ${user.blockkoinAccountId || '❌ NOT SET'}`);
      console.log(`   - KYC Status: ${user.blockkoinKycStatus || 'N/A'}`);
      
      // Get roles
      const roles = await storage.getUserRoles(user.id);
      if (roles.length > 0) {
        console.log(`   - Roles: ${roles.map(r => r.role).join(', ')}`);
      }
      
      // Check for tag if BENEFICIARY
      if (roles.some(r => r.role === 'BENEFICIARY')) {
        const tag = await storage.getTagByUserId(user.id);
        if (tag) {
          console.log(`   - Tag: ${tag.tagCode} (${tag.beneficiaryName})`);
        }
      }
      
      console.log('');
    }
    
    console.log('================================================');
    console.log(`\n💡 To test Blockkoin connection, run:`);
    console.log(`   npx tsx test-blockkoin-connection.ts`);
    console.log(`   (Edit the email in the script first)`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

listUsers();
