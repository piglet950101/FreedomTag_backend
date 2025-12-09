import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { type Server } from "http";
import { createProxyMiddleware } from "http-proxy-middleware";

// Logging helper for Express server
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupClientProxy(app: Express, server: Server) {
  // Client proxy setup:
  // - In development: proxy non-API routes to the client dev server (default: http://localhost:5173)
  // - In production: serve static files from client/dist
  const DEV_CLIENT_PORT = parseInt(process.env.CLIENT_DEV_PORT || "5173", 10);
  const DEV_TARGET = `http://localhost:${DEV_CLIENT_PORT}`;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  // In development proxy non-API routes to the client dev server.
  if (app.get("env") === "development") {
    // only proxy non-API routes
    app.use(
      createProxyMiddleware(
        (pathname, _req) => {
          // only proxy non-API routes (skip everything that starts with /api)
          return !pathname.startsWith("/api");
        },
        {
          target: DEV_TARGET,
          changeOrigin: true,
          ws: true, // proxy websockets (HMR)
          logLevel: "warn",
          onError: (err, _req, res) => {
            console.warn(`Client proxy error: ${err?.message || err}`);
            if (res && !res.headersSent) {
              res.status(502).end("Client dev server not running (start client dev server separately)");
            }
          },
        },
      ),
    );
    return;
  }

  // In production, serve static files from client/dist
  const distPath = path.resolve(__dirname, "..", "client", "dist");

  if (!fs.existsSync(distPath)) {
    console.warn("⚠️ Frontend not found. Running backend in API-only mode.");
    return; // ✅ THIS STOPS THE CRASH
  }

  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

