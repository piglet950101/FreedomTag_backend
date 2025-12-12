import express from 'express';
import { storage } from '../storage';
import { blockkoinClient } from '../blockkoin';
import { db, supabase } from "../db";
import { Console, log } from 'console';
import bcrypt from 'bcryptjs';
import { getCookieOptions } from '../utils/cookie';
import { generateToken } from '../utils/jwt';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

  // Unified signup endpoint - creates user with role
  router.post('/auth/signup', async (req, res) => {
    try {
      const { email, password, fullName, phone, country, role } = req.body || {};
      if (!email || !password || !fullName || !role) {
        return res.status(400).json({ error: 'email, password, fullName, and role are required' });
      }

      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Hash password
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 10);

      // Auto-create or link Blockkoin account
      let blockkoinAccountId = null;
      let blockkoinKycStatus: 'none' | 'pending' | 'verified' | 'rejected' = 'none';
      
      try {
        // Check if user already has a Blockkoin account
        const existingBlockkoinAccount = await blockkoinClient.findExistingAccount(email);
        
        if (existingBlockkoinAccount) {
          // Link existing account
          blockkoinAccountId = existingBlockkoinAccount.id;
          blockkoinKycStatus = existingBlockkoinAccount.kycStatus;
          console.log(`[Blockkoin] Linked existing account for ${email}`);
        } else {
          // Auto-create new Blockkoin account
          const newBlockkoinAccount = await blockkoinClient.createAccount(email, fullName, country);
          blockkoinAccountId = newBlockkoinAccount.id;
          blockkoinKycStatus = newBlockkoinAccount.kycStatus;
          console.log(`[Blockkoin] Created new account for ${email}: ${blockkoinAccountId}`);
        }
      } catch (error) {
        console.error('[Blockkoin] Account creation/linking failed:', error);
        // Continue signup even if Blockkoin fails (non-blocking)
      }

      // Create user with Blockkoin integration
      const user = await storage.createUser({
        email,
        passwordHash,
        fullName,
        phone: phone || null,
        country: country || null,
        blockkoinAccountId,
        blockkoinKycStatus,
        preferredCurrency: country === 'ZA' ? 'ZAR' : 'USD',
      });

      // Create user role (ensure uppercase)
      await storage.createUserRole({
        userId: user.id,
        role: role.toUpperCase(),
        entityId: null, // Will be set when entity is created
        isActive: 1,
      });

      // Create session
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ error: 'Session error' });
        }

        req.session.userAuth = {
          userId: user.id,
          email: user.email,
          fullName: user.fullName,
        };

        req.session.save(async (err) => {
          if (err) {
            return res.status(500).json({ error: 'Session save error' });
          }

          // Set cookie with correct options for localhost vs production
          const cookieOptions = getCookieOptions(req);
          res.cookie('freedomtag.sid', req.sessionID, cookieOptions);
          console.log('[Auth/Signup] Set cookie:', {
            sameSite: cookieOptions.sameSite,
            secure: cookieOptions.secure,
            isLocalhost: cookieOptions.sameSite === 'lax'
          });

          // Get user roles
          const userRoles = await storage.getUserRoles(user.id);

          // Generate JWT token for the new user
          const token = generateToken({
            userId: user.id,
            email: user.email,
            type: 'user',
          });

          // Set token in cookie (reuse cookieOptions from above)
          res.cookie('authToken', token, {
            ...cookieOptions,
            httpOnly: false, // Allow client-side access for Authorization header
          });

          console.log('[Auth/Signup] JWT token generated for user:', user.id);

          res.json({
            token, // Send token in response body
            user: {
              id: user.id,
              email: user.email,
              fullName: user.fullName,
            },
            roles: userRoles.map(r => r.role),
          });
        });
      });
    } catch (error) {
      console.error('Signup error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('Signup error details:', { errorMessage, errorStack });
      res.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        message: errorMessage
      });
    }
  });

  // Unified login endpoint
  router.post('/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      
      if (!email || !password) {
        return res.status(400).json({ error: 'email and password required' });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        console.warn('[Auth/Login] No user found for email:', email);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Verify password
      const bcrypt = await import('bcryptjs');
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        console.warn('[Auth/Login] Password mismatch for email:', email);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Get user roles
      const roles = await storage.getUserRoles(user.id);

      // Update last login
      await storage.updateUserLastLogin(user.id); 

      // Check if user is an organization (charity)
      let organizationInfo = null;
      const org = await storage.getOrganizationByEmail(user.email);
      if (org) {
        // Find the organization's primary tag
        const tags = await storage.getTagsByOrganization(org.id);
        const primaryTag = tags.find((t: any) => t.beneficiaryType === 'charity' || t.beneficiaryType === 'organization');
        
        organizationInfo = {
          organizationId: org.id,
          organizationName: org.name,
          tagCode: primaryTag?.tagCode || null,
        };
        console.log('[Auth/Login] Organization found for email:', email, 'orgId:', org.id, 'tagCode:', organizationInfo.tagCode);
      } else {
        console.log('[Auth/Login] No organization linked for email:', email);
      }

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        type: 'user',
      });

      console.log('[Auth/Login] JWT token generated for user:', user.id);

      // Set token in cookie and send in response
      const cookieOptions = getCookieOptions(req);
      res.cookie('authToken', token, {
        ...cookieOptions,
        httpOnly: false, // Allow client-side access for Authorization header
      });

      res.json({
        token, // Also send token in response body
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          country: user.country,
          avatarUrl: user.avatarUrl,
        },
        roles: roles.map(r => r.role),
        organization: organizationInfo,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get current user (using JWT)
  router.get('/auth/me', authenticateJWT, async (req, res) => {
    try {
      console.log('[Auth/Me] JWT payload:', req.user);
      
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      console.log('👤 User from DB:', { id: user.id, email: user.email, fullName: user.fullName });

      const roles = await storage.getUserRoles(user.id);

      // Get beneficiary tag if user has BENEFICIARY role
      let beneficiaryTag = null;
      if (roles.some(r => r.role === 'BENEFICIARY')) {
        console.log('🔍 Looking for tag for userId:', user.id);
        const tag = await storage.getTagByUserId(user.id);
        console.log('🏷️ Tag found:', tag);
        if (tag) {
          const wallet = await storage.getWallet(tag.walletId);
          beneficiaryTag = {
            tagCode: tag.tagCode,
            beneficiaryName: tag.beneficiaryName,
            balanceZAR: wallet ? ((wallet as any).balanceZar || wallet.balanceZAR || 0) : 0,
          };

        }
      }

      // Get organization info if user has ORGANIZATION role
      let organization = null;
      if (roles.some(r => r.role === 'ORGANIZATION')) {
        const org = await storage.getOrganizationByEmail(user.email);
        if (org) {
          // Find the organization's primary tag
          const tags = await storage.getTagsByOrganization(org.id);
          const primaryTag = tags.find((t: any) => t.beneficiaryType === 'charity' || t.beneficiaryType === 'organization');
          
          organization = {
            organizationId: org.id,
            organizationName: org.name,
            tagCode: primaryTag?.tagCode || null,
          };
          console.log('[Auth/Me] Organization found for user:', user.email, 'orgId:', org.id, 'tagCode:', organization.tagCode);
        }
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          country: user.country,
          avatarUrl: user.avatarUrl,
          blockkoinAccountId: user.blockkoinAccountId,
          blockkoinKycStatus: user.blockkoinKycStatus,
        },
        roles: roles.map(r => r.role),
        beneficiaryTag,
        organization,
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Unified logout endpoint
  router.post('/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to logout' });
      }
      res.json({ success: true });
    });
  });

  // Change password endpoint (using JWT)
  router.post('/auth/change-password', authenticateJWT, async (req, res) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }

      // Get user
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Update password
      await storage.updateUserPassword(user.id, newPasswordHash);

      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ========== Password Recovery (Biometric KYC) ==========
  
  // Step 1: Initiate password reset with email - creates Sumsub applicant
  router.post('/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body || {};
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Check if user exists in either users or philanthropists table
      let user: any = await storage.getUserByEmail(email);
      let userType: 'user' | 'philanthropist' = 'user';
      
      if (!user) {
        // Check philanthropists table
        const philanthropist = await storage.getPhilanthropistByEmail(email);
        if (philanthropist) {
          user = philanthropist;
          userType = 'philanthropist';
        }
      }
      
      if (!user) {
        // Return success even if user doesn't exist (security best practice)
        return res.json({ 
          message: 'If this email is registered, you will receive password reset instructions',
          requiresBiometric: true 
        });
      }

      // Generate secure random token (32 bytes hex)
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      
      // Token expires in 1 hour
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      // Create Sumsub applicant for biometric verification
      const sumsubClient = req.app.get('sumsubClient');
      if (!sumsubClient) {
        return res.status(500).json({ error: 'Verification service not available' });
      }

      // Parse full name for Sumsub (handle both user types)
      const fullName = user.fullName || user.displayName || 'User';
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || 'Account';

      const applicant = await sumsubClient.createApplicant({
        externalUserId: `pwd-reset-${user.id}-${Date.now()}`,
        firstName,
        lastName,
        email: user.email,
        phone: user.phone || '',
      });

      // Generate access token for Sumsub SDK
      const sumsubToken = await sumsubClient.generateAccessToken(
        applicant.id,
        applicant.externalUserId
      );

      // Create password reset token record with userType
      await storage.createPasswordResetToken({
        userId: user.id,
        userType,
        email: user.email,
        token,
        sumsubApplicantId: applicant.id,
        sumsubAccessToken: sumsubToken.token,
        verificationStatus: 'pending',
        expiresAt,
      });

      // Get Sumsub SDK URL
      const verificationUrl = sumsubClient.getSdkUrl(applicant.id, sumsubToken.token);

      res.json({
        message: 'Biometric verification required for password reset',
        requiresBiometric: true,
        resetToken: token,
        verificationUrl,
        sumsubToken: sumsubToken.token,
        sumsubApplicantId: applicant.id,
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Failed to initiate password reset' });
    }
  });

  // Step 2: Check password reset token validity
  router.get('/auth/reset-token/:token', async (req, res) => {
    try {
      const { token } = req.params;
      
      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(404).json({ error: 'Invalid or expired reset token' });
      }

      if (resetToken.usedAt) {
        return res.status(400).json({ error: 'Reset token already used' });
      }

      if (new Date() > new Date(resetToken.expiresAt)) {
        return res.status(400).json({ error: 'Reset token expired' });
      }

      res.json({
        valid: true,
        email: resetToken.email,
        verificationStatus: resetToken.verificationStatus,
        sumsubApplicantId: resetToken.sumsubApplicantId,
      });
    } catch (error) {
      console.error('Reset token check error:', error);
      res.status(500).json({ error: 'Failed to validate reset token' });
    }
  });

  // Step 3: Complete password reset after biometric verification
  router.post('/auth/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body || {};
      
      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      // Get reset token
      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(404).json({ error: 'Invalid or expired reset token' });
      }

      if (resetToken.usedAt) {
        return res.status(400).json({ error: 'Reset token already used' });
      }

      if (new Date() > new Date(resetToken.expiresAt)) {
        return res.status(400).json({ error: 'Reset token expired' });
      }

      // Verify biometric KYC completion
      if (resetToken.verificationStatus !== 'verified') {
        return res.status(403).json({ 
          error: 'Biometric verification required',
          verificationStatus: resetToken.verificationStatus,
          message: 'Complete biometric verification to reset your password'
        });
      }

      // Hash new password
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Update user password (with userType to update correct table)
      await storage.updateUserPassword(resetToken.userId, passwordHash, resetToken.userType);

      // Mark token as used
      await storage.markPasswordResetTokenUsed(resetToken.id);

      res.json({
        success: true,
        message: 'Password reset successful. You can now login with your new password.',
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  // Sumsub webhook for password reset verification status
  router.post('/auth/password-reset-verification-webhook', async (req, res) => {
    try {
      const { applicantId, reviewStatus, reviewResult } = req.body || {};
      
      console.log('[Password Reset] Sumsub verification webhook:', { applicantId, reviewStatus, reviewResult });

      if (!applicantId) {
        return res.status(400).json({ error: 'Applicant ID required' });
      }

        // Find password reset token by Sumsub applicant ID using Supabase
        if (!supabase) {
          console.error('[Password Reset] Supabase client is not initialized');
          return res.status(500).json({ error: 'Database client not available' });
        }
        const { data: allTokens, error } = await supabase
          .from('password_reset_tokens')
          .select('*')
          .eq('sumsub_applicant_id', applicantId);

        if (error) {
          console.error('[Password Reset] Supabase error:', error);
          return res.status(500).json({ error: 'Database error' });
        }

        const resetToken = allTokens && allTokens[0];
      
      if (!resetToken) {
        console.log('[Password Reset] No reset token found for applicant:', applicantId);
        return res.status(404).json({ error: 'Reset token not found' });
      }

      // Update verification status based on Sumsub result
      if (reviewStatus === 'completed' && reviewResult?.reviewAnswer === 'GREEN') {
        await storage.updatePasswordResetVerification(resetToken.id, 'verified', applicantId);
        console.log('[Password Reset] Verification successful for:', resetToken.email);
      } else if (reviewStatus === 'completed' && reviewResult?.reviewAnswer === 'RED') {
        await storage.updatePasswordResetVerification(resetToken.id, 'rejected', applicantId);
        console.log('[Password Reset] Verification rejected for:', resetToken.email);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Password reset verification webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });


  // Admin user creation endpoint (bypasses Blockkoin for simplicity)
  router.post('/admin/create-user', async (req, res) => {
    try {
      const { email, password, fullName, role } = req.body || {};
      if (!email || !password || !fullName || !role) {
        return res.status(400).json({ error: 'email, password, fullName, and role are required' });
      }

      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user WITHOUT Blockkoin (for admin users)
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

      // Create user role (ensure uppercase)
      await storage.createUserRole({
        userId: user.id,
        role: role.toUpperCase(),
        entityId: null,
        isActive: 1,
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
        role: role.toUpperCase(),
        message: 'User created successfully',
      });
    } catch (error) {
      console.error('Admin user creation error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('Admin user creation error details:', { errorMessage, errorStack });
      res.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        message: errorMessage
      });
    }
  });

  // Get all users (admin only)
  router.get('/admin/users', authenticateJWT, async (req, res) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      // Check if user is admin
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        console.log(`[Admin] User not found: ${req.user.userId}`);
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const roles = await storage.getUserRoles(user.id);
      console.log(`[Admin] User ${user.email} has roles:`, roles.map(r => r.role));
      const isAdmin = roles.some(r => r.role === 'ADMIN');
      if (!isAdmin) {
        console.log(`[Admin] Access denied for user ${user.email}. Roles: ${roles.map(r => r.role).join(', ') || 'none'}`);
        return res.status(403).json({ 
          error: 'Forbidden: Admin access required',
          message: `User has roles: ${roles.map(r => r.role).join(', ') || 'none'}. ADMIN role required.`
        });
      }

      const users = await storage.getAllUsers();
      console.log(`[Admin] Found ${users.length} users in database`);
      
      const usersWithRoles = await Promise.all(
        users.map(async (u) => {
          const userRoles = await storage.getUserRoles(u.id);
          return {
            ...u,
            roles: userRoles.map(r => r.role),
          };
        })
      );

      console.log(`[Admin] Returning ${usersWithRoles.length} users with roles`);
      res.json({ users: usersWithRoles });
    } catch (error) {
      console.error('Get users error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Internal server error', message: errorMessage });
    }
  });

  // Get single user with roles
  router.get('/admin/users/:id', authenticateJWT, async (req, res) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      // Check if user is admin
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const roles = await storage.getUserRoles(user.id);
      const isAdmin = roles.some(r => r.role === 'ADMIN');
      if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      const targetUser = await storage.getUserWithRoles(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        user: targetUser.user,
        roles: targetUser.roles.map(r => r.role),
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update user
  router.patch('/admin/users/:id', authenticateJWT, async (req, res) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      // Check if user is admin
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const roles = await storage.getUserRoles(user.id);
      const isAdmin = roles.some(r => r.role === 'ADMIN');
      if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      const { fullName, email, phone, country } = req.body;
      const updates: any = {};
      if (fullName !== undefined) updates.fullName = fullName;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (country !== undefined) updates.country = country;

      const updatedUser = await storage.updateUser(req.params.id, updates);
      res.json({ user: updatedUser });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Delete user
  router.delete('/admin/users/:id', authenticateJWT, async (req, res) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      // Check if user is admin
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const roles = await storage.getUserRoles(user.id);
      const isAdmin = roles.some(r => r.role === 'ADMIN');
      if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      // Prevent deleting yourself
      if (req.params.id === req.user.userId) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      await storage.deleteUser(req.params.id);
      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Add role to user
  router.post('/admin/users/:id/roles', authenticateJWT, async (req, res) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      // Check if user is admin
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const roles = await storage.getUserRoles(user.id);
      const isAdmin = roles.some(r => r.role === 'ADMIN');
      if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      const { role } = req.body;
      if (!role) {
        return res.status(400).json({ error: 'Role is required' });
      }

      await storage.createUserRole({
        userId: req.params.id,
        role: role.toUpperCase(),
        entityId: null,
        isActive: 1,
      });

      res.json({ success: true, message: 'Role added successfully' });
    } catch (error) {
      console.error('Add role error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Remove role from user
  router.delete('/admin/users/:id/roles/:role', authenticateJWT, async (req, res) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      // Check if user is admin
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const roles = await storage.getUserRoles(user.id);
      const isAdmin = roles.some(r => r.role === 'ADMIN');
      if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      // Prevent removing ADMIN role from yourself
      if (req.params.id === req.user.userId && req.params.role.toUpperCase() === 'ADMIN') {
        return res.status(400).json({ error: 'Cannot remove ADMIN role from your own account' });
      }

      await storage.deleteUserRole(req.params.id, req.params.role);
      res.json({ success: true, message: 'Role removed successfully' });
    } catch (error) {
      console.error('Remove role error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

export default router;
