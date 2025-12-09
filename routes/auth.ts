import express from 'express';
import { storage } from '../storage';
import { blockkoinClient } from '../blockkoin';
import { db, supabase } from "../db";
import { Console, log } from 'console';
import bcrypt from 'bcrypt';

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
      const bcrypt = await import('bcrypt');
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

          // Get user roles
          const userRoles = await storage.getUserRoles(user.id);

          res.json({
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
      res.status(500).json({ error: 'Internal server error' });
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
      const bcrypt = await import('bcrypt');
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

      // Create session
      req.session.regenerate((err) => {
        if (err) {
          console.error('[Auth/Login] Session regenerate error:', err);
          return res.status(500).json({ error: 'Session error', details: process.env.NODE_ENV === 'development' ? String(err) : undefined });
        }

        req.session.userAuth = {
          userId: user.id,
          email: user.email,
          fullName: user.fullName,
        };

        console.log('[Auth/Login] Session created for user:', user.id, 'SessionID:', req.sessionID);

        // Save session and send response
          req.session.save((err) => {
            if (err) {
              console.error('[Auth/Login] Session save error:', err);
              return res.status(500).json({ error: 'Session save error', details: process.env.NODE_ENV === 'development' ? String(err) : undefined });
            }

            console.log('[Auth/Login] Session saved successfully for user:', user.id);
            console.log('[Auth/Login] SessionID after save:', req.sessionID);

            // Check what express-session set (for debugging)
            const existingCookie = res.getHeader('set-cookie');
            if (existingCookie) {
              console.log('[Auth/Login] express-session set cookie:', typeof existingCookie === 'string' ? existingCookie : JSON.stringify(existingCookie));
            }

            // ALWAYS manually set cookie with correct cross-origin settings
            // express-session might set it with wrong SameSite, so we override it
            const cookieName = 'freedomtag.sid';
            const cookieValue = req.sessionID;
            const isProduction = process.env.NODE_ENV === 'production' || 
                                process.env.RAILWAY_ENVIRONMENT === 'production' ||
                                process.env.VERCEL === '1';
            const frontendUrl = process.env.FRONTEND_URL || 'https://freedomtag-client.vercel.app';
            const isCrossOrigin = frontendUrl && 
                                 (frontendUrl.startsWith('https://') || frontendUrl.startsWith('http://')) &&
                                 !frontendUrl.includes('localhost') &&
                                 !frontendUrl.includes('127.0.0.1');
            
            const cookieOptions: any = {
              httpOnly: true,
              maxAge: 3600000,
              path: '/',
              secure: isCrossOrigin ? true : isProduction, // Must be true for SameSite=None
              sameSite: isCrossOrigin ? 'none' : 'lax',
              // Explicitly don't set domain for cross-origin cookies
              // The browser will scope it to the domain that set it
            };
            
            // CRITICAL: Set cookie BEFORE sending response
            // Override any existing cookie with correct settings
            // Use res.cookie() which will properly format the Set-Cookie header
            res.cookie(cookieName, cookieValue, cookieOptions);
            console.log('[Auth/Login] Set cookie:', {
              name: cookieName,
              value: cookieValue.substring(0, 10) + '...',
              sameSite: cookieOptions.sameSite,
              secure: cookieOptions.secure,
              httpOnly: cookieOptions.httpOnly,
              path: cookieOptions.path,
              maxAge: cookieOptions.maxAge,
              isCrossOrigin,
              trustProxy: res.app.get('trust proxy')
            });

            // Verify cookie is in response headers BEFORE sending response
            const cookieAfterSet = res.getHeader('set-cookie');
            console.log('[Auth/Login] Cookie in headers after res.cookie():', cookieAfterSet ? 'YES' : 'NO');
            if (cookieAfterSet) {
              const cookieStr = Array.isArray(cookieAfterSet) ? cookieAfterSet[0] : String(cookieAfterSet);
              console.log('[Auth/Login] Cookie string:', cookieStr);
              // Verify SameSite=None is in the cookie
              if (cookieStr.includes('SameSite=None')) {
                console.log('[Auth/Login] ✅ Cookie has SameSite=None');
              } else {
                console.error('[Auth/Login] ❌ Cookie does NOT have SameSite=None!');
              }
              // Verify Secure is in the cookie
              if (cookieStr.includes('Secure')) {
                console.log('[Auth/Login] ✅ Cookie has Secure');
              } else {
                console.error('[Auth/Login] ❌ Cookie does NOT have Secure!');
              }
            } else {
              console.error('[Auth/Login] ❌ CRITICAL: Cookie NOT in response headers!');
            }

            // Log the Set-Cookie header that will be sent
            res.on('finish', () => {
              const setCookie = res.getHeader('set-cookie');
              console.log('[Auth/Login] Final Response Set-Cookie:', setCookie ? JSON.stringify(setCookie) : 'NOT SET!');
            });

          res.json({
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
        });
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get current user
  router.get('/auth/me', async (req, res) => {
    try {
      console.log('[Auth/Me] SessionID:', req.sessionID, 'Has userAuth:', !!req.session.userAuth);
      
      if (!req.session.userAuth) {
        console.warn('[Auth/Me] No userAuth in session. SessionID:', req.sessionID);
        return res.status(401).json({ error: 'Not authenticated' });
      }

      console.log('📋 Session userAuth:', req.session.userAuth);
      
      const user = await storage.getUser(req.session.userAuth.userId);
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
            balanceZAR: wallet ? wallet.balanceZar : 0,
          };

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

  // Change password endpoint
  router.post('/auth/change-password', async (req, res) => {
    try {
      if (!req.session.userAuth) {
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
      const user = await storage.getUser(req.session.userAuth.userId);
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
      const bcrypt = await import('bcrypt');
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


export default router;
