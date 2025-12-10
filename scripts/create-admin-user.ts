#!/usr/bin/env tsx
/**
 * Script to create an admin user in the database
 * Usage: tsx scripts/create-admin-user.ts
 */

import 'dotenv/config';
import { db, supabase } from '../db';
import { storage } from '../storage';
import bcrypt from 'bcryptjs';

// Wait for storage to be ready
async function waitForStorage() {
  // Storage initializes automatically, but we need to ensure db is connected
  if (!db && !supabase) {
    throw new Error('Database connection not available. Please check your DATABASE_URL or SUPABASE_URL environment variable.');
  }
}

async function createAdminUser() {
  await waitForStorage();
  try {
    const email = 'admin@freedomtag.com';
    const password = '123456';
    const fullName = 'Admin User';
    const role = 'ADMIN';

    console.log('🔐 Creating admin user...');
    console.log(`   Email: ${email}`);
    console.log(`   Role: ${role}`);

    // Check if user already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      console.log('⚠️  User already exists!');
      
      // Check if user has ADMIN role
      const roles = await storage.getUserRoles(existingUser.id);
      const hasAdminRole = roles.some(r => r.role === 'ADMIN');
      
      if (hasAdminRole) {
        console.log('✅ User already has ADMIN role.');
        console.log('   You can login at: http://localhost:5173/admin-freedomtag');
        return;
      } else {
        console.log('⚠️  User exists but does not have ADMIN role.');
        console.log('   Adding ADMIN role...');
        
        // Add ADMIN role
        await storage.createUserRole({
          userId: existingUser.id,
          role: 'ADMIN',
          entityId: null,
        });
        
        // Update password
        const passwordHash = await bcrypt.hash(password, 10);
        await storage.updateUserPassword(existingUser.id, passwordHash);
        
        console.log('✅ ADMIN role added and password updated!');
        console.log('   You can login at: http://localhost:5173/admin-freedomtag');
        return;
      }
    }

    // Hash password
    console.log('   Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    console.log('   Creating user...');
    const user = await storage.createUser({
      email,
      passwordHash,
      fullName,
      phone: null,
      country: null,
      blockkoinAccountId: null,
      blockkoinKycStatus: 'none',
      preferredCurrency: 'ZAR',
    });

    console.log(`   ✅ User created with ID: ${user.id}`);

    // Create ADMIN role
    console.log('   Creating ADMIN role...');
    await storage.createUserRole({
      userId: user.id,
      role: 'ADMIN',
      entityId: null,
    });

    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('📋 Login Credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log('');
    console.log('🔗 Login URL:');
    console.log('   http://localhost:5173/admin-freedomtag');
    console.log('');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
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

