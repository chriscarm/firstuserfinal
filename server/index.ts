import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupWebSocket } from "./websocket";
import session from "express-session";
import connectPg from "connect-pg-simple";
import path from "path";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { autoSeedIfNeeded } from "./autoSeed";

const app = express();

// Serve uploads from both dist and public directories (dev vs prod)
app.use("/uploads", express.static(path.join(process.cwd(), "dist", "public", "uploads")));
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));
const httpServer = createServer(app);

// Trust proxy for Replit/production environments
app.set('trust proxy', 1);

// Security headers and request correlation IDs
app.use((req, res, next) => {
  const correlationId = (req.headers["x-correlation-id"] as string) || crypto.randomUUID();
  const embeddableRoute = req.path.startsWith("/i/widget/") || req.path.startsWith("/widget/live-chat");
  res.setHeader("x-correlation-id", correlationId);
  res.setHeader("x-content-type-options", "nosniff");
  if (!embeddableRoute) {
    res.setHeader("x-frame-options", "DENY");
  }
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  res.setHeader("x-xss-protection", "0");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains; preload");
  }
  (req as Request & { correlationId?: string }).correlationId = correlationId;
  next();
});

const rateWindowStore = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  rateWindowStore.forEach((entry, key) => {
    if (entry.resetAt <= now) {
      rateWindowStore.delete(key);
    }
  });
}, 60 * 1000).unref();

const scopedRateLimits: Array<{
  key: string;
  pattern: RegExp;
  methods: string[];
  windowMs: number;
  max: number;
}> = [
  { key: "auth", pattern: /^\/api\/auth\/(phone|email)\/(start|verify)/, methods: ["POST"], windowMs: 15 * 60 * 1000, max: 30 },
  { key: "messaging", pattern: /^\/api\/(channels\/\d+\/messages|conversations\/\d+\/messages)/, methods: ["POST"], windowMs: 60 * 1000, max: 80 },
  { key: "writes", pattern: /^\/api\/.+/, methods: ["POST", "PUT", "PATCH", "DELETE"], windowMs: 60 * 1000, max: 200 },
];

app.use((req, res, next) => {
  const ip = req.ip || "unknown";
  const now = Date.now();

  for (const rule of scopedRateLimits) {
    if (!rule.methods.includes(req.method)) continue;
    if (!rule.pattern.test(req.path)) continue;

    const key = `${rule.key}:${ip}`;
    const current = rateWindowStore.get(key);

    if (!current || now > current.resetAt) {
      rateWindowStore.set(key, { count: 1, resetAt: now + rule.windowMs });
      continue;
    }

    current.count += 1;
    rateWindowStore.set(key, current);

    if (current.count > rule.max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("retry-after", String(retryAfter));
      return res.status(429).json({ message: "Too many requests. Please try again shortly." });
    }
  }

  next();
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    pendingUserId?: string;
    pendingAuthMethod?: "phone" | "email";
  }
}

app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Session middleware setup (direct, replacing Replit Auth)
const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
const isProduction = process.env.NODE_ENV === "production";
const pgStore = connectPg(session);
const sessionStore = new pgStore({
  conString: process.env.DATABASE_URL,
  createTableIfMissing: false,
  ttl: sessionTtl,
  tableName: "sessions",
});
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "fallback-secret-for-dev",
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction ? true : "auto",
    maxAge: sessionTtl,
    // Embedded chat widgets in partner iframes require cross-site cookies in production.
    sameSite: isProduction ? "none" : "lax",
  },
});

// Apply session middleware
app.use(sessionMiddleware);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
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
      const correlationId = (req as Request & { correlationId?: string }).correlationId;
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms${correlationId ? ` [${correlationId}]` : ""}`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

app.get("/api/healthz", (_req, res) => {
  return res.json({ ok: true, service: "firstuser", timestamp: new Date().toISOString() });
});

app.get("/api/readyz", async (_req, res) => {
  try {
    await db.execute(sql`select 1`);
    return res.json({ ok: true, database: "ready" });
  } catch (error) {
    return res.status(503).json({ ok: false, database: "unavailable" });
  }
});

(async () => {
  // Auto-seed database if needed (creates FirstUser AppSpace if it doesn't exist)
  await autoSeedIfNeeded();

  // Register routes (phone auth endpoints are now in routes.ts)
  await registerRoutes(httpServer, app);

  // Initialize WebSocket server
  const io = setupWebSocket(httpServer, sessionMiddleware);
  console.log("[WebSocket] Server initialized");

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
