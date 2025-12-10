import "dotenv/config";
import cors from "cors";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
// @ts-ignore - connect-pg-simple doesn't have types
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupClientProxy, log } from "./client-proxy";
import { createSumsubClient, DemoSumsubClient } from "./sumsub";
import "dotenv/config";


const app = express();

// CRITICAL: Trust proxy for serverless/proxy environments (Railway, Vercel, etc.)
// This ensures Express correctly handles X-Forwarded-* headers and secure cookies
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Allow requests from your frontend origin
// Configured allowed origins for CORS
const allowedOrigins = [
  'https://freedomtag-client.vercel.app',
  'http://localhost:5173', // Vite dev server
];

app.use(
  // cors({  
  //   origin: (origin, callback) => {
  //     // Allow requests with no origin (like mobile apps or curl requests)
  //     if (!origin) return callback(null, true);
      
  //     if (allowedOrigins.includes(origin)) {
  //       callback(null, true);
  //     } else {
  //       // In development, allow all origins for flexibility
  //       if (process.env.NODE_ENV === 'development') {
  //         callback(null, true);
  //       } else {
  //         callback(new Error('Not allowed by CORS'));
  //       }
  //     }
  //   },
  //   credentials: true,
  // })
  cors({
    origin: true,
    credentials: true,
  })
);

// Initialize Sumsub client and attach to app
const sumsubClient = createSumsubClient();
if (sumsubClient) {
  app.set('sumsubClient', sumsubClient);
  if (sumsubClient instanceof DemoSumsubClient) {
    log('Sumsub client initialized (DEMO mode)');
  } else {
    // Mask for logging
    const mask = (s: string | undefined) => s ? `${s.slice(0,6)}...${s.slice(-6)}` : '<empty>';
    log(`Sumsub client initialized (appToken=${mask(process.env.SUMSUB_APP_TOKEN)})`);
  }
} else {
  log('Sumsub integration not configured (set SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY)');
}

// Validate session secret in production
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required in production');
}

// Configure session store - use PostgreSQL for production (serverless compatibility)
// For Supabase, we can use the connection string from SUPABASE_URL
let sessionStore: any = undefined;

if (process.env.DATABASE_URL) {
  // Use PostgreSQL session store if DATABASE_URL is available
  const PgSession = connectPgSimple(session);
  sessionStore = new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session', // Table name for sessions
    createTableIfMissing: true, // Auto-create table if it doesn't exist
  });
  log('Using PostgreSQL session store');
} else if (process.env.SUPABASE_DB_URL) {
  // Use Supabase direct database connection URL if provided
  // Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
  const PgSession = connectPgSimple(session);
  sessionStore = new PgSession({
    conString: process.env.SUPABASE_DB_URL,
    tableName: 'session',
    createTableIfMissing: true,
  });
  log('Using Supabase PostgreSQL session store');
} else {
  log('WARNING: No database connection found. Using memory session store.');
  log('Sessions will not persist in serverless environments. Set DATABASE_URL or SUPABASE_URL with SUPABASE_DB_PASSWORD.');
}

// Configure session middleware
// Determine if we need cross-origin cookie settings
// Check if we're in production (Railway, Vercel, etc.) - not just NODE_ENV
const isProduction = process.env.NODE_ENV === 'production' || 
                     process.env.RAILWAY_ENVIRONMENT === 'production' ||
                     process.env.VERCEL === '1' ||
                     !process.env.NODE_ENV || // Assume production if not explicitly development
                     (process.env.PORT && process.env.PORT !== '5173' && process.env.PORT !== '3000');

const frontendUrl = process.env.FRONTEND_URL || allowedOrigins[0];
// If frontend URL is HTTPS and not localhost, it's cross-origin
const isCrossOrigin = frontendUrl && 
                     (frontendUrl.startsWith('https://') || frontendUrl.startsWith('http://')) &&
                     !frontendUrl.includes('localhost') &&
                     !frontendUrl.includes('127.0.0.1');

log(`[Session Config] isProduction: ${isProduction}, isCrossOrigin: ${isCrossOrigin}, frontendUrl: ${frontendUrl}`);
log(`[Session Config] Trust Proxy: ${app.get('trust proxy')}`);
log(`[Session Config] Session Store: ${sessionStore ? 'CONFIGURED' : 'NOT CONFIGURED (using memory)'}`);

// Warn if no session store is configured in production
if (isProduction && !sessionStore) {
  console.error('⚠️  CRITICAL: No session store configured in production!');
  console.error('⚠️  Sessions will not persist across serverless invocations.');
  console.error('⚠️  Even if cookies are sent, session data will be lost without a store.');
  console.error('⚠️  Set DATABASE_URL or SUPABASE_DB_URL environment variable.');
  console.error('⚠️  Current env vars: DATABASE_URL=' + (process.env.DATABASE_URL ? 'SET' : 'NOT SET'));
  console.error('⚠️  Current env vars: SUPABASE_DB_URL=' + (process.env.SUPABASE_DB_URL ? 'SET' : 'NOT SET'));
}

// CRITICAL: Use a fixed secret in development to ensure sessions persist
// Random secret on each restart would invalidate all sessions
const sessionSecret = process.env.SESSION_SECRET || (process.env.NODE_ENV === 'development' 
  ? 'dev-fixed-secret-do-not-change-in-development' 
  : 'dev-only-secret-' + Math.random().toString(36));

const sessionConfig: session.SessionOptions = {
  secret: sessionSecret,
  resave: false, // Changed to false - only save if session was modified
  saveUninitialized: false, // Don't save uninitialized sessions
  store: sessionStore,
  name: 'freedomtag.sid', // Custom session name
  rolling: true, // Reset expiration on every request
  cookie: {
    // For cross-origin, secure MUST be true (HTTPS only)
    // For same-origin, secure can be false in development
    secure: isCrossOrigin ? true : (isProduction ? true : false),
    httpOnly: true,
    maxAge: 3600000, // 1 hour
    sameSite: isCrossOrigin ? ('none' as const) : ('lax' as const), // 'none' for cross-site, 'lax' for same-site
    // Don't set domain - allows cross-origin cookies
    path: '/', // Ensure cookie is available for all paths
  }
};

log(`[Session Config] Cookie settings: secure=${sessionConfig.cookie!.secure}, sameSite=${sessionConfig.cookie!.sameSite}, httpOnly=${sessionConfig.cookie!.httpOnly}`);

if (isCrossOrigin) {
  log('✅ Configured session cookies for cross-origin (sameSite: none, secure: true)');
  log(`   Frontend: ${frontendUrl}`);
} else {
  log('✅ Configured session cookies for same-origin (sameSite: lax)');
}

app.use(session(sessionConfig));

// Cookie and session debugging middleware (only if DEBUG_SESSIONS is enabled)
app.use((req, res, next) => {
  if (req.path.startsWith('/api') && process.env.DEBUG_SESSIONS === 'true') {
    const cookieHeader = req.headers.cookie;
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const authHeader = req.headers.authorization;
    
    // Extract session ID from cookie
    let cookieSessionId = null;
    if (cookieHeader) {
      const match = cookieHeader.match(/freedomtag\.sid=([^;]+)/);
      cookieSessionId = match ? match[1] : null;
    }
    
    // Extract JWT token
    let jwtToken = null;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      jwtToken = authHeader.substring(7).trim();
    } else if (cookieHeader) {
      const match = cookieHeader.match(/authToken=([^;]+)/);
      jwtToken = match ? match[1] : null;
    }
    
    log(`[Auth Debug] ${req.method} ${req.path}`);
    log(`  Origin: ${origin || 'none'}`);
    log(`  Referer: ${referer || 'none'}`);
    
    // Log JWT token status (primary auth method now)
    if (jwtToken) {
      log(`  JWT Token: Present (${jwtToken.substring(0, 20)}...)`);
    } else {
      log(`  JWT Token: Not found`);
    }
    
    // Only log session info if DEBUG_SESSIONS is enabled (legacy session support)
    log(`  Session Cookie: ${cookieSessionId ? 'Present' : 'Not found'}`);
    log(`  Request SessionID: ${req.sessionID}`);
    log(`  Has userAuth: ${!!req.session.userAuth}`);
    log(`  Has philanthropistAuth: ${!!req.session.philanthropistAuth}`);
    log(`  Has donorAuth: ${!!req.session.donorAuth}`);
    
    // Log cookie in response for login endpoints
    if (req.path.includes('/login') || req.path.includes('/signup')) {
      res.on('finish', () => {
        const setCookie = res.getHeader('set-cookie');
        if (setCookie) {
          log(`[Login Response] Set-Cookie header present`);
        }
      });
    }
  }
  next();
});

// Extend express session type
declare module 'express-session' {
  interface SessionData {
    donorAuth?: {
      tagCode: string;
      beneficiaryName: string;
    };
    userAuth?: {
      userId: string;
      email: string;
      fullName: string;
    };
    philanthropistAuth?: {
      philanthropistId: string;
      email: string;
    };
    beneficiary?: {
      tagCode: string;
    };
  }
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {


    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup client proxy in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  // In development the client is intended to be run separately and the server will
  // proxy non-API requests to the dev client (or you can run the client dev server independently).
  await setupClientProxy(app, server);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '3000', 10);
  server.listen({
    port:3000,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
