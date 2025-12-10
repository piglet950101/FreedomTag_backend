import jwt, { SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'dev-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // 7 days default

export interface JWTPayload {
  userId?: string;
  philanthropistId?: string;
  tagCode?: string;
  email: string;
  type: 'user' | 'philanthropist' | 'beneficiary';
}

/**
 * Generate a JWT token
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload as object, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as SignOptions);
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('[JWT] Token verification failed:', error);
    return null;
  }
}

/**
 * Extract token from Authorization header or cookie
 */
export function extractToken(req: any): string | null {
  // Check Authorization header first (Bearer token)
  // Express lowercases headers, but check both cases for safety
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    console.log('[JWT Extract] Token found in Authorization header, length:', token.length);
    return token;
  }

  // Check cookie as fallback
  const cookies = req.headers.cookie;
  if (cookies) {
    const match = cookies.match(/authToken=([^;]+)/);
    if (match && match[1]) {
      const token = match[1].trim();
      console.log('[JWT Extract] Token found in cookie, length:', token.length);
      return token;
    }
  }

  console.log('[JWT Extract] No token found. Headers:', {
    hasAuthorization: !!req.headers.authorization,
    hasCookie: !!req.headers.cookie,
    authorizationValue: req.headers.authorization ? req.headers.authorization.substring(0, 20) + '...' : 'none',
  });

  return null;
}

