import "dotenv/config";
import cors from "cors";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupClientProxy, log } from "./vite";
import { createSumsubClient, DemoSumsubClient } from "./sumsub";
import "dotenv/config";


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Allow requests from your frontend origin
// Allow all origins (reflect the request origin)
// Note: when credentials: true, we cannot use origin: '*' (wildcard) in browsers.
// Using origin: true reflects the incoming origin and allows credentials to be sent.
app.use(
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

// Configure session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-secret-' + Math.random().toString(36),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 3600000, // 1 hour
    sameSite: 'lax', // CSRF protection
  }
}));

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

  // importantly only setup vite in development and after
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
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
