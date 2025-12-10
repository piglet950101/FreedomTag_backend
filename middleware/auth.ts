import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractToken, JWTPayload } from '../utils/jwt';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user info to request
 */
export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);

  console.log('[JWT Auth] Path:', req.path);
  console.log('[JWT Auth] Method:', req.method);
  console.log('[JWT Auth] All headers keys:', Object.keys(req.headers));
  console.log('[JWT Auth] Authorization header:', req.headers.authorization ? `Present (${req.headers.authorization.substring(0, 30)}...)` : 'Missing');
  console.log('[JWT Auth] Token extracted:', token ? `Yes (${token.substring(0, 30)}...)` : 'No');

  if (!token) {
    console.log('[JWT Auth] No token found - returning 401');
    return res.status(401).json({ error: 'No token provided' });
  }

  const payload = verifyToken(token);

  if (!payload) {
    console.log('[JWT Auth] Token verification failed - returning 401');
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  console.log('[JWT Auth] Token verified successfully. Payload:', {
    philanthropistId: payload.philanthropistId,
    userId: payload.userId,
    tagCode: payload.tagCode,
    type: payload.type,
    email: payload.email,
  });

  // Attach user info to request
  req.user = payload;
  next();
}

/**
 * Optional JWT Authentication - doesn't fail if no token
 */
export function optionalJWT(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
}

