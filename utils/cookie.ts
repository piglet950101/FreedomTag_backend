import type { Request } from 'express';

/**
 * Detects if the request is from localhost/local development
 * Checks multiple sources: origin header, referer header, hostname, and protocol
 */
export function isLocalhostRequest(req: Request): boolean {
  // Check origin header (most reliable for CORS requests)
  const origin = req.headers.origin || '';
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return true;
  }

  // Check referer header (fallback for same-origin requests)
  const referer = req.headers.referer || '';
  if (referer.includes('localhost') || referer.includes('127.0.0.1')) {
    return true;
  }

  // Check hostname (direct connection)
  const hostname = req.hostname || req.get('host') || '';
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return true;
  }

  // Check if protocol is HTTP (localhost typically uses HTTP, not HTTPS)
  // Note: In production behind a proxy, req.protocol might be 'http' even if frontend is HTTPS
  // So we use this as a secondary check only
  const protocol = req.protocol || '';
  if (protocol === 'http' && (hostname.includes('localhost') || hostname.includes('127.0.0.1'))) {
    return true;
  }

  // Check NODE_ENV as final fallback
  // If explicitly development, assume localhost
  if (process.env.NODE_ENV === 'development' && !origin && !referer) {
    // Only if we have no origin/referer (same-origin request), assume localhost
    return true;
  }

  return false;
}

/**
 * Gets cookie options based on request environment
 * Returns options suitable for localhost (SameSite=Lax, Secure=false) or production (SameSite=None, Secure=true)
 */
export function getCookieOptions(req: Request): {
  httpOnly: boolean;
  maxAge: number;
  path: string;
  secure: boolean;
  sameSite: 'lax' | 'none' | 'strict';
} {
  const isLocalhost = isLocalhostRequest(req);
  
  return {
    httpOnly: true,
    maxAge: 3600000, // 1 hour
    path: '/',
    secure: isLocalhost ? false : true, // Localhost doesn't use HTTPS
    sameSite: isLocalhost ? 'lax' : 'none', // Lax for same-origin, None for cross-origin
  };
}

