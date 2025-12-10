#!/usr/bin/env tsx
/**
 * Script to create an admin user via API
 * Usage: tsx scripts/create-admin-user-api.ts
 * 
 * Make sure the server is running on http://localhost:3000
 */

async function createAdminUser() {
  try {
    const email = 'admin@freedomtag.com';
    const password = '123456';
    const fullName = 'Admin User';
    const role = 'ADMIN';

    console.log('🔐 Creating admin user via API...');
    console.log(`   Email: ${email}`);
    console.log(`   Role: ${role}`);
    console.log('   Server: http://localhost:3000');
    console.log('');

    console.log('   Sending request to API...');
    // Try admin-specific endpoint first (bypasses Blockkoin)
    let response = await fetch('http://localhost:3000/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        fullName,
        role,
      }),
    });

    // If admin endpoint doesn't exist (404), fall back to regular signup
    if (response.status === 404) {
      console.log('   Admin endpoint not found, trying regular signup...');
      response = await fetch('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          fullName,
          role,
          country: 'ZA',
        }),
      });
    }
    
    console.log(`   Response status: ${response.status} ${response.statusText}`);

    let data: any;
    let responseText: string = '';
    try {
      responseText = await response.text();
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          // Not JSON, use as text
          data = { error: responseText };
        }
      }
    } catch (e) {
      throw new Error(`Server returned: ${response.status} ${response.statusText}\n${responseText || 'No response body'}`);
    }

    if (!response.ok) {
      if (response.status === 409 && (data.error?.includes('already registered') || data.error?.includes('Email already'))) {
        console.log('⚠️  User already exists!');
        console.log('   The admin user may already be in the database.');
        console.log('   If you need to reset the password, please update it manually.');
        console.log('');
        console.log('✅ You can try logging in at:');
        console.log('   http://localhost:5173/admin-freedomtag');
        return;
      }
      
      console.error('❌ Server Error Details:');
      console.error(`   Status: ${response.status} ${response.statusText}`);
      console.error(`   Error: ${data.error || data.message || JSON.stringify(data)}`);
      if (data.details) {
        console.error(`   Details: ${data.details}`);
      }
      if (data.message) {
        console.error(`   Message: ${data.message}`);
      }
      console.error(`   Full Response: ${responseText}`);
      throw new Error(data.details || data.message || data.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('📋 Login Credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log('');
    console.log('🔗 Login URL:');
    console.log('   http://localhost:5173/admin-freedomtag');
    console.log('');

  } catch (error: any) {
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      console.error('❌ Error: Could not connect to server.');
      console.error('   Make sure the server is running on http://localhost:3000');
      console.error('   Start the server with: npm run dev');
    } else {
      console.error('❌ Error creating admin user:', error.message || error);
      console.error('');
      console.error('💡 Troubleshooting:');
      console.error('   1. Check the SERVER console/terminal for detailed error logs');
      console.error('      Look for "Signup error:" in the server output');
      console.error('   2. Make sure the server is running: npm run dev');
      console.error('   3. Check that DATABASE_URL or SUPABASE_URL is set in server/.env');
      console.error('   4. If user already exists, try logging in at:');
      console.error('      http://localhost:5173/admin-freedomtag');
      console.error('');
      console.error('   Common issues:');
      console.error('   - Database connection not configured');
      console.error('   - Blockkoin API configuration issue (should be non-blocking)');
      console.error('   - Session store not configured properly');
    }
    process.exit(1);
  }
}

// Run the script
createAdminUser()
  .then(() => {
    console.log('✨ Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

