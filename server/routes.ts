import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, type WaitlistMode } from "./storage";
import { insertAppSpaceSchema, insertWaitlistMemberSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import sharp from "sharp";
import { sendVerificationEmail } from "./email";
import { emitNotificationToUser } from "./websocket";
import { getHomepageOwnerPhone, getHomepageSlug, isHomepageOwnerUser, isHomepageSlug } from "./homepageOwnership";
import { sendOpsAlert } from "./opsAlerts";
import { buildIntegrationSetupPack, isIntegrationStack, SUPPORTED_INTEGRATION_STACKS } from "./integrationSetupPack";
// TextBelt SMS configuration
const TEXTBELT_API_KEY = process.env.TEXTBELT_API_KEY || "textbelt";

async function sendTextBeltSMS(phone: string, message: string): Promise<{ success: boolean; textId?: string; error?: string }> {
  const response = await fetch("https://textbelt.com/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone,
      message,
      key: TEXTBELT_API_KEY,
    }),
  });
  return response.json();
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashOTP(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "unknown";
}

async function enforceOtpThrottle(options: {
  req: Request;
  method: "phone" | "email";
  target: string;
  userId?: string | null;
}): Promise<{ allowed: boolean; reason?: string }> {
  const ipAddress = getClientIp(options.req);
  const perIp = await storage.countRecentAuthVerificationsByIp(ipAddress, 15);
  const perTarget = await storage.countRecentAuthVerificationsByTarget(options.target, 15);

  if (perIp >= 20) {
    await storage.createAuthRiskEvent({
      userId: options.userId ?? null,
      method: options.method,
      target: options.target,
      eventType: "rate_limited_ip",
      severity: "high",
      ipAddress,
      metadata: JSON.stringify({ perIp, perTarget }),
    });
    return { allowed: false, reason: "Too many attempts from this network. Please wait and try again." };
  }

  if (perTarget >= 8) {
    await storage.createAuthRiskEvent({
      userId: options.userId ?? null,
      method: options.method,
      target: options.target,
      eventType: "rate_limited_target",
      severity: "medium",
      ipAddress,
      metadata: JSON.stringify({ perIp, perTarget }),
    });
    return { allowed: false, reason: "Too many code requests. Please wait before trying again." };
  }

  return { allowed: true };
}

// Configure multer for file uploads - use memory storage for sharp processing
const uploadsDir = path.join(process.cwd(), "dist", "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Use memory storage to allow sharp processing before saving
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit - server will resize
  fileFilter: (req, file, cb) => {
    // Accept any image type - sharp will handle conversion
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed."));
    }
  },
});

function getBadgeTier(position: number): string {
  if (position === 1) return "1st";
  if (position <= 10) return "10^1";
  if (position <= 100) return "10^2";
  if (position <= 1000) return "10^3";
  return "10^4";
}

const WAITLIST_MODE_VALUES = ["forum-waitlist", "chat-waitlist"] as const;

function resolveWaitlistModeFromChannels(channelsList: Array<{ name: string; type: string; isWaitlistersOnly: boolean }>): WaitlistMode {
  const waitlistChannels = channelsList.filter((channel) => channel.isWaitlistersOnly);
  if (waitlistChannels.length === 0) return "forum-waitlist";

  const explicitModeChannel = waitlistChannels.find((channel) =>
    WAITLIST_MODE_VALUES.includes(channel.name as WaitlistMode),
  );
  if (explicitModeChannel?.name === "chat-waitlist") return "chat-waitlist";
  if (explicitModeChannel?.name === "forum-waitlist") return "forum-waitlist";

  const firstWaitlistChannel = waitlistChannels[0];
  if (firstWaitlistChannel.type === "forum") return "forum-waitlist";
  return "chat-waitlist";
}

// Helper to get user ID from session (phone auth only)
function getUserId(req: Request): string | null {
  if (req.session?.userId) {
    return req.session.userId;
  }
  return null;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  // Set session.userId for compatibility with existing code
  req.session.userId = userId;
  next();
}

// Middleware to check if user has founder access (global founder access)
async function requireFounder(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  req.session.userId = userId;
  const user = await storage.getUser(userId);
  if (!user?.hasFounderAccess) {
    return res.status(403).json({ message: "Founder access required" });
  }
  next();
}

async function hasFounderManagementAccess(userId: string, appSpace: { slug: string; founderId: string }) {
  const user = await storage.getUser(userId);
  if (!user) {
    return false;
  }

  if (isHomepageSlug(appSpace.slug) && getHomepageOwnerPhone()) {
    return appSpace.founderId === userId && isHomepageOwnerUser(user);
  }

  return appSpace.founderId === userId || !!user.hasFounderAccess;
}

async function ensureFounderManagementAccess(options: {
  req: Request;
  res: Response;
  appSpace: { slug: string; founderId: string };
  message: string;
}) {
  const userId = getUserId(options.req);
  if (!userId) {
    options.res.status(401).json({ message: "Not authenticated" });
    return false;
  }

  const allowed = await hasFounderManagementAccess(userId, options.appSpace);
  if (!allowed) {
    options.res.status(403).json({ message: options.message });
    return false;
  }

  return true;
}

// Factory: Require user to be a member of an appspace (any status)
function requireMember(appSpaceIdParam: string = "id") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    req.session.userId = userId;
    const appSpaceId = parseInt(req.params[appSpaceIdParam] as string);
    if (isNaN(appSpaceId)) {
      return res.status(400).json({ message: "Invalid appspace ID" });
    }
    const member = await storage.getWaitlistMember(appSpaceId, userId);
    if (!member) {
      return res.status(403).json({ message: "You must be a member of this community" });
    }
    (req as any).member = member;
    next();
  };
}

// Factory: Require user to be an approved member
function requireApprovedMember(appSpaceIdParam: string = "id") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    req.session.userId = userId;
    const appSpaceId = parseInt(req.params[appSpaceIdParam] as string);
    if (isNaN(appSpaceId)) {
      return res.status(400).json({ message: "Invalid appspace ID" });
    }
    const member = await storage.getWaitlistMember(appSpaceId, userId);
    if (!member || member.status !== "approved") {
      return res.status(403).json({ message: "Approved membership required" });
    }
    (req as any).member = member;
    next();
  };
}

// Factory: Require user to be the founder of an appspace
function requireAppSpaceFounder(appSpaceIdParam: string = "id") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    req.session.userId = userId;
    const appSpaceId = parseInt(req.params[appSpaceIdParam] as string);
    if (isNaN(appSpaceId)) {
      return res.status(400).json({ message: "Invalid appspace ID" });
    }
    const appSpace = await storage.getAppSpace(appSpaceId);
    if (!appSpace) {
      return res.status(404).json({ message: "AppSpace not found" });
    }
    const canManage = await hasFounderManagementAccess(userId, appSpace);
    if (!canManage) {
      return res.status(403).json({ message: "Founder access required for this appspace" });
    }
    (req as any).appSpace = appSpace;
    next();
  };
}

async function createAndEmitNotification(input: {
  userId: string;
  type: "mention" | "dm" | "channel_message" | "waitlist_approved" | "waitlist_rejected" | "golden_ticket";
  data: Record<string, unknown>;
}) {
  const notification = await storage.createNotification({
    userId: input.userId,
    type: input.type,
    data: JSON.stringify(input.data),
  });
  emitNotificationToUser(input.userId, notification);
  return notification;
}

const INTEGRATION_ACCESS_CODE_TTL_MS = 10 * 60 * 1000;
const INTEGRATION_WIDGET_TOKEN_TTL_MS = 15 * 60 * 1000;
const INTEGRATION_WAITLIST_INTENT_TTL_MS = 30 * 60 * 1000;
const INTEGRATION_WEBHOOK_SIGNING_FALLBACK = process.env.INTEGRATION_WEBHOOK_SIGNING_SECRET || process.env.SESSION_SECRET || "dev-integration-secret";
const INTEGRATION_WIDGET_SIGNING_SECRET = process.env.INTEGRATION_WIDGET_SIGNING_SECRET || process.env.SESSION_SECRET || "dev-widget-secret";

function hashSecret(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeTimingEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function getBaseUrl(req: Request): string {
  if (process.env.PUBLIC_APP_URL) {
    return process.env.PUBLIC_APP_URL.replace(/\/+$/, "");
  }
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const host = req.get("host") || "localhost:5000";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function parseAllowedOrigins(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return Array.from(new Set(input.map((item) => String(item).trim()).filter(Boolean)));
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return Array.from(new Set(parsed.map((item) => String(item).trim()).filter(Boolean)));
        }
      } catch {
        // Fall through to comma parsing.
      }
    }
    return Array.from(new Set(input.split(",").map((item) => item.trim()).filter(Boolean)));
  }
  return [];
}

function parseIntegrationApiCredential(req: Request): { keyId: string; secret: string } | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    const parts = token.split(".");
    if (parts.length >= 2) {
      const keyId = parts[0].trim();
      const secret = parts.slice(1).join(".").trim();
      if (keyId && secret) return { keyId, secret };
    }
  }

  const keyIdHeader = req.headers["x-firstuser-key-id"];
  const secretHeader = req.headers["x-firstuser-secret"];
  const keyId = typeof keyIdHeader === "string" ? keyIdHeader.trim() : "";
  const secret = typeof secretHeader === "string" ? secretHeader.trim() : "";
  if (keyId && secret) {
    return { keyId, secret };
  }
  return null;
}

async function authenticateIntegrationRequest(req: Request): Promise<{
  integrationAppId: number;
  appSpaceId: number;
  publicAppId: string;
}> {
  const creds = parseIntegrationApiCredential(req);
  if (!creds) {
    throw Object.assign(new Error("Missing integration API credentials"), { status: 401 });
  }

  const key = await storage.getActiveIntegrationApiKeyByKeyId(creds.keyId);
  if (!key) {
    throw Object.assign(new Error("Invalid integration key"), { status: 401 });
  }

  const receivedHash = hashSecret(creds.secret);
  if (!safeTimingEqual(receivedHash, key.secretHash)) {
    throw Object.assign(new Error("Invalid integration secret"), { status: 401 });
  }

  const integrationApp = await storage.getIntegrationAppById(key.integrationAppId);
  if (!integrationApp) {
    throw Object.assign(new Error("Integration app not found"), { status: 404 });
  }

  return {
    integrationAppId: integrationApp.id,
    appSpaceId: integrationApp.appSpaceId,
    publicAppId: integrationApp.publicAppId,
  };
}

function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function createWidgetToken(payload: {
  integrationAppId: number;
  firstuserUserId: string;
  appSpaceId: number;
  exp: number;
}): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", INTEGRATION_WIDGET_SIGNING_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyWidgetToken(token: string): {
  integrationAppId: number;
  firstuserUserId: string;
  appSpaceId: number;
  exp: number;
} | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", INTEGRATION_WIDGET_SIGNING_SECRET).update(body).digest("base64url");
  if (!safeTimingEqual(sig, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      integrationAppId: number;
      firstuserUserId: string;
      appSpaceId: number;
      exp: number;
    };
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function buildUrl(base: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function issueIntegrationAccessCode(options: {
  integrationAppId: number;
  appSpaceId: number;
  firstuserUserId: string;
}): Promise<{ code: string; expiresAt: Date }> {
  const code = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INTEGRATION_ACCESS_CODE_TTL_MS);
  await storage.createIntegrationAccessCode({
    integrationAppId: options.integrationAppId,
    firstuserUserId: options.firstuserUserId,
    appSpaceId: options.appSpaceId,
    codeHash: hashSecret(code),
    status: "issued",
    expiresAt,
  });
  return { code, expiresAt };
}

async function issueIntegrationWaitlistIntent(options: {
  integrationAppId: number;
  externalUserId?: string;
  email?: string;
  phone?: string;
  returnTo?: string;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INTEGRATION_WAITLIST_INTENT_TTL_MS);
  await storage.createIntegrationWaitlistIntent({
    integrationAppId: options.integrationAppId,
    tokenHash: hashSecret(token),
    externalUserId: options.externalUserId ?? null,
    email: options.email ?? null,
    phone: options.phone ?? null,
    returnTo: options.returnTo ?? null,
    expiresAt,
  });
  return { token, expiresAt };
}

async function sendIntegrationWebhookFailureAlert(input: {
  integrationAppId: number;
  deliveryId: number;
  eventType: string;
  attempt: number;
  webhookUrl: string | null;
  statusCode?: number;
  terminal: boolean;
  reason: string;
}) {
  await sendOpsAlert({
    severity: input.terminal ? "error" : "warning",
    title: input.terminal ? "Integration Webhook Delivery Exhausted Retries" : "Integration Webhook Delivery Failed",
    message: input.reason,
    source: "integration.webhooks",
    dedupeKey: `integration-webhook-failure-${input.deliveryId}-${input.attempt}`,
    metadata: {
      integrationAppId: input.integrationAppId,
      deliveryId: input.deliveryId,
      eventType: input.eventType,
      attempt: input.attempt,
      statusCode: input.statusCode ?? null,
      webhookUrl: input.webhookUrl,
      terminal: input.terminal,
    },
  });
}

async function sendIntegrationWebhook(options: {
  integrationAppId: number;
  webhookUrl: string | null;
  eventType: string;
  payload: Record<string, unknown>;
}) {
  const integrationApp = await storage.getIntegrationAppById(options.integrationAppId);
  const webhookUrl = options.webhookUrl || integrationApp?.webhookUrl || null;
  if (!integrationApp) return;
  if (!webhookUrl) {
    await sendOpsAlert({
      severity: "warning",
      title: "Integration Webhook URL Missing",
      message: `Skipping webhook delivery for event ${options.eventType} because webhookUrl is not configured.`,
      source: "integration.webhooks",
      dedupeKey: `integration-webhook-missing-url-${options.integrationAppId}`,
      metadata: {
        integrationAppId: options.integrationAppId,
        eventType: options.eventType,
      },
    });
    return;
  }

  const webhookSecret = integrationApp.webhookSecret || INTEGRATION_WEBHOOK_SIGNING_FALLBACK;

  const body = JSON.stringify({
    type: options.eventType,
    timestamp: new Date().toISOString(),
    data: options.payload,
  });
  const signature = signWebhookPayload(body, webhookSecret);

  const delivery = await storage.createIntegrationWebhookDelivery({
    integrationAppId: options.integrationAppId,
    eventType: options.eventType,
    payload: body,
    signature,
    attempt: 1,
    status: "pending",
    nextRetryAt: null,
  });

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-firstuser-signature": signature,
        "x-firstuser-signature-sha256": signature,
      },
      body,
    });

    if (response.ok) {
      await storage.updateIntegrationWebhookDeliveryStatus(delivery.id, {
        status: "delivered",
        attempt: 1,
        nextRetryAt: null,
      });
      return;
    }

    await storage.updateIntegrationWebhookDeliveryStatus(delivery.id, {
      status: "failed",
      attempt: 1,
      nextRetryAt: new Date(Date.now() + 60_000),
    });
    await sendIntegrationWebhookFailureAlert({
      integrationAppId: options.integrationAppId,
      deliveryId: delivery.id,
      eventType: options.eventType,
      attempt: 1,
      webhookUrl,
      statusCode: response.status,
      terminal: false,
      reason: `Webhook delivery failed with status ${response.status}.`,
    });
  } catch {
    await storage.updateIntegrationWebhookDeliveryStatus(delivery.id, {
      status: "failed",
      attempt: 1,
      nextRetryAt: new Date(Date.now() + 60_000),
    });
    await sendIntegrationWebhookFailureAlert({
      integrationAppId: options.integrationAppId,
      deliveryId: delivery.id,
      eventType: options.eventType,
      attempt: 1,
      webhookUrl,
      terminal: false,
      reason: "Webhook delivery failed due to network or runtime error.",
    });
  }
}

async function retrySingleIntegrationWebhookDelivery(delivery: {
  id: number;
  integrationAppId: number;
  payload: string;
  eventType: string;
  attempt: number;
}) {
  const maxAttempts = 5;
  const nextAttempt = delivery.attempt + 1;
  const integrationApp = await storage.getIntegrationAppById(delivery.integrationAppId);
  if (!integrationApp?.webhookUrl) {
    const terminal = nextAttempt >= maxAttempts;
    await storage.updateIntegrationWebhookDeliveryStatus(delivery.id, {
      status: "failed",
      attempt: nextAttempt,
      nextRetryAt: terminal ? null : new Date(Date.now() + 15 * 60_000),
    });
    await sendIntegrationWebhookFailureAlert({
      integrationAppId: delivery.integrationAppId,
      deliveryId: delivery.id,
      eventType: delivery.eventType,
      attempt: nextAttempt,
      webhookUrl: null,
      terminal,
      reason: "Webhook retry skipped because integration webhook URL is missing.",
    });
    return;
  }

  const webhookSecret = integrationApp.webhookSecret || INTEGRATION_WEBHOOK_SIGNING_FALLBACK;
  const signature = signWebhookPayload(delivery.payload, webhookSecret);

  try {
    const response = await fetch(integrationApp.webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-firstuser-signature": signature,
        "x-firstuser-signature-sha256": signature,
      },
      body: delivery.payload,
    });

    if (response.ok) {
      await storage.updateIntegrationWebhookDeliveryStatus(delivery.id, {
        status: "delivered",
        attempt: nextAttempt,
        nextRetryAt: null,
      });
      return;
    }

    const terminal = nextAttempt >= maxAttempts;
    const retryDelayMs = Math.min(30 * 60_000, Math.pow(2, nextAttempt) * 60_000);
    await storage.updateIntegrationWebhookDeliveryStatus(delivery.id, {
      status: "failed",
      attempt: nextAttempt,
      nextRetryAt: terminal ? null : new Date(Date.now() + retryDelayMs),
    });
    await sendIntegrationWebhookFailureAlert({
      integrationAppId: delivery.integrationAppId,
      deliveryId: delivery.id,
      eventType: delivery.eventType,
      attempt: nextAttempt,
      webhookUrl: integrationApp.webhookUrl,
      statusCode: response.status,
      terminal,
      reason: `Webhook retry failed with status ${response.status}.`,
    });
  } catch {
    const terminal = nextAttempt >= maxAttempts;
    const retryDelayMs = Math.min(30 * 60_000, Math.pow(2, nextAttempt) * 60_000);
    await storage.updateIntegrationWebhookDeliveryStatus(delivery.id, {
      status: "failed",
      attempt: nextAttempt,
      nextRetryAt: terminal ? null : new Date(Date.now() + retryDelayMs),
    });
    await sendIntegrationWebhookFailureAlert({
      integrationAppId: delivery.integrationAppId,
      deliveryId: delivery.id,
      eventType: delivery.eventType,
      attempt: nextAttempt,
      webhookUrl: integrationApp.webhookUrl,
      terminal,
      reason: "Webhook retry failed due to network or runtime error.",
    });
  }
}

async function handleIntegrationMembershipEvent(options: {
  req: Request;
  appSpaceId: number;
  appSpaceSlug: string;
  appSpaceName: string;
  userId: string;
  status: "approved" | "rejected";
}) {
  const integrationApp = await storage.getIntegrationAppByAppSpaceId(options.appSpaceId);
  if (!integrationApp) {
    return {
      browserAccessUrl: null as string | null,
      mobileAccessUrl: null as string | null,
      expiresAt: null as Date | null,
    };
  }

  const baseUrl = getBaseUrl(options.req);
  const member = await storage.getUser(options.userId);
  const safeUser = {
    id: member?.id ?? options.userId,
    username: member?.username ?? null,
    displayName: member?.displayName ?? null,
    avatarUrl: member?.avatarUrl ?? null,
  };

  if (options.status === "rejected") {
    await storage.expireIssuedIntegrationAccessCodes(integrationApp.id, options.userId);
    await sendIntegrationWebhook({
      integrationAppId: integrationApp.id,
      webhookUrl: integrationApp.webhookUrl,
      eventType: "waitlist.member.rejected",
      payload: {
        appSpaceId: options.appSpaceId,
        appSpaceSlug: options.appSpaceSlug,
        appSpaceName: options.appSpaceName,
        user: safeUser,
      },
    });

    return {
      browserAccessUrl: null,
      mobileAccessUrl: null,
      expiresAt: null,
    };
  }

  const issued = await issueIntegrationAccessCode({
    integrationAppId: integrationApp.id,
    appSpaceId: options.appSpaceId,
    firstuserUserId: options.userId,
  });

  const browserAccessUrl = buildUrl(`${baseUrl}/i/access/${issued.code}`, {
    platform: "web",
    publicAppId: integrationApp.publicAppId,
  });
  const mobileAccessUrl = buildUrl(`${baseUrl}/i/access/${issued.code}`, {
    platform: "mobile",
    publicAppId: integrationApp.publicAppId,
  });

  await sendIntegrationWebhook({
    integrationAppId: integrationApp.id,
    webhookUrl: integrationApp.webhookUrl,
    eventType: "waitlist.member.approved",
    payload: {
      appSpaceId: options.appSpaceId,
      appSpaceSlug: options.appSpaceSlug,
      appSpaceName: options.appSpaceName,
      user: safeUser,
      access: {
        browserAccessUrl,
        mobileAccessUrl,
        expiresAt: issued.expiresAt.toISOString(),
      },
    },
  });

  await sendIntegrationWebhook({
    integrationAppId: integrationApp.id,
    webhookUrl: integrationApp.webhookUrl,
    eventType: "integration.access_code.issued",
    payload: {
      appSpaceId: options.appSpaceId,
      appSpaceSlug: options.appSpaceSlug,
      appSpaceName: options.appSpaceName,
      user: safeUser,
      access: {
        browserAccessUrl,
        mobileAccessUrl,
        expiresAt: issued.expiresAt.toISOString(),
      },
    },
  });

  return {
    browserAccessUrl,
    mobileAccessUrl,
    expiresAt: issued.expiresAt,
  };
}

let integrationWebhookRetryLoopStarted = false;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const requireIntegrationApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = await authenticateIntegrationRequest(req);
      (req as Request & {
        integrationAuth?: {
          integrationAppId: number;
          appSpaceId: number;
          publicAppId: string;
        };
      }).integrationAuth = auth;
      next();
    } catch (error: any) {
      const status = typeof error?.status === "number" ? error.status : 401;
      return res.status(status).json({ message: error?.message || "Integration auth failed" });
    }
  };

  if (!integrationWebhookRetryLoopStarted) {
    integrationWebhookRetryLoopStarted = true;
    setInterval(async () => {
      try {
        const pending = await storage.getPendingIntegrationWebhookDeliveries({
          now: new Date(),
          limit: 50,
        });
        await Promise.all(pending.map((delivery) => retrySingleIntegrationWebhookDelivery(delivery)));
      } catch (error) {
        console.error("[IntegrationWebhookRetry] Error processing retries:", error);
        await sendOpsAlert({
          severity: "error",
          title: "Integration Webhook Retry Loop Error",
          message: "Unexpected error while processing webhook retries.",
          source: "integration.webhooks.retry-loop",
          dedupeKey: "integration-webhook-retry-loop-error",
          metadata: {
            error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
          },
        });
      }
    }, 60_000).unref();
  }

  app.get("/api/stats/public", async (req, res) => {
    try {
      const totalMembers = await storage.getTotalWaitlistMembers();
      const recentAnnouncements = await storage.getRecentAnnouncements(3);
      return res.json({ totalMembers, recentAnnouncements });
    } catch (error) {
      throw error;
    }
  });

  // Founder: Update AppSpace content
  app.patch("/api/founder/appspaces/:slug", requireAuth, async (req, res) => {
    try {
      const slug = req.params.slug as string;
      const updates = req.body;

      const appSpace = await storage.getAppSpaceBySlug(slug);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized to edit this appspace",
      });
      if (!canManage) return;

      const updatedAppSpace = await storage.updateAppSpace(appSpace.id, updates);
      return res.json(updatedAppSpace);
    } catch (error) {
      throw error;
    }
  });

  // Founder: Get all users for member management
  app.get("/api/founder/users", requireFounder, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      return res.json({ users: allUsers.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        hasFounderAccess: u.hasFounderAccess,
        createdAt: u.createdAt
      }))});
    } catch (error) {
      throw error;
    }
  });

  // Founder: Award badge to user
  app.post("/api/founder/users/:userId/award-badge", requireAuth, async (req, res) => {
    try {
      const userId = req.params.userId as string;
      const { badgeTier, appSpaceId } = req.body;
      const parsedAppSpaceId = Number(appSpaceId);

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!Number.isInteger(parsedAppSpaceId)) {
        return res.status(400).json({ message: "Valid appSpaceId is required" });
      }

      const appSpace = await storage.getAppSpace(parsedAppSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized to award badges for this appspace",
      });
      if (!canManage) return;

      // Check if user is already a member
      let member = await storage.getWaitlistMember(parsedAppSpaceId, userId);

      if (!member) {
        // Add user to waitlist with the specified badge tier
        const position = await storage.getNextPosition(parsedAppSpaceId);
        member = await storage.joinWaitlist({
          appSpaceId: parsedAppSpaceId,
          userId,
          position,
          badgeTier: badgeTier || getBadgeTier(position),
          isActive: true,
        });
      } else {
        // Update badge tier
        member = await storage.updateWaitlistMemberBadge(parsedAppSpaceId, userId, badgeTier);
      }

      return res.json({ success: true, member });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already registered" });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ email, password: hashedPassword });

      req.session.userId = user.id;

      // Explicitly save session before responding to ensure it's persisted
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log("[register] Session saved - ID:", req.sessionID, "userId:", req.session.userId);

      return res.status(201).json({
        id: user.id,
        username: user.username,
        email: user.email,
        hasFounderAccess: user.hasFounderAccess,
        phoneVerified: user.phoneVerified
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      throw error;
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      const validPassword = user.password ? await bcrypt.compare(password, user.password) : false;
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.userId = user.id;

      // Explicitly save session before responding to ensure it's persisted
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      return res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        hasFounderAccess: user.hasFounderAccess,
        phoneVerified: user.phoneVerified
      });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(404).json({ message: "User not found" });
      }
      return res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        hasFounderAccess: user.hasFounderAccess,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
        emailVerified: user.emailVerified,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        title: user.title,
        linkedInUrl: user.linkedInUrl
      });
    } catch (error) {
      throw error;
    }
  });

  // Phone auth flow - Step 1: Send OTP (unauthenticated - for new users joining waitlist)
  app.post("/api/auth/phone/start", async (req, res) => {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      const cleanPhone = phone.replace(/\D/g, "");
      const formattedPhone = cleanPhone.startsWith("1") ? `+${cleanPhone}` : `+1${cleanPhone}`;

      // Check if user exists by phone
      let user = await storage.getUserByPhone(cleanPhone);
      const isNewUser = !user;

      if (!user) {
        // Create new user with phone
        user = await storage.createUserFromPhone(cleanPhone);
      }

      const phoneCollisionCount = await storage.countUsersByPhone(cleanPhone);
      if (phoneCollisionCount > 1) {
        await storage.createAuthRiskEvent({
          userId: user.id,
          method: "phone",
          target: cleanPhone,
          eventType: "phone_collision",
          severity: "high",
          ipAddress: getClientIp(req),
          metadata: JSON.stringify({ phoneCollisionCount }),
        });
      }

      const throttle = await enforceOtpThrottle({
        req,
        method: "phone",
        target: cleanPhone,
        userId: user.id,
      });
      if (!throttle.allowed) {
        return res.status(429).json({ message: throttle.reason });
      }

      // Store pending user ID and auth method in session for verification step
      req.session.pendingUserId = user.id;
      req.session.pendingAuthMethod = "phone";

      // Generate OTP and persist it
      const otp = generateOTP();
      await storage.createAuthVerification({
        userId: user.id,
        method: "phone",
        target: cleanPhone,
        codeHash: hashOTP(otp),
        ipAddress: getClientIp(req),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      // Send OTP via TextBelt
      console.log("[SMS OTP] Sending to:", formattedPhone);
      const result = await sendTextBeltSMS(formattedPhone, `Your FirstUser verification code is: ${otp}`);
      console.log("[SMS OTP] TextBelt full response:", JSON.stringify(result));
      
      if (!result.success) {
        console.error("TextBelt error:", result.error);
        return res.status(500).json({ message: result.error || "Failed to send SMS" });
      }

      console.log("[SMS OTP] TextBelt success - textId:", result.textId);

      // Explicitly save session before responding
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      return res.json({ success: true, isNewUser });
    } catch (error: any) {
      console.error("Phone start error:", error);
      return res.status(500).json({ message: error.message || "Failed to send verification code" });
    }
  });

  // Phone auth flow - Step 2: Verify OTP (unauthenticated)
  app.post("/api/auth/phone/verify", async (req, res) => {
    try {
      const { code } = req.body;
      const pendingUserId = req.session.pendingUserId;
      const pendingAuthMethod = req.session.pendingAuthMethod;

      if (!code) {
        return res.status(400).json({ message: "Code is required" });
      }

      if (!pendingUserId) {
        return res.status(400).json({ message: "No pending verification. Please request a new code." });
      }

      // Validate that this verification attempt matches the auth method used
      if (pendingAuthMethod !== "phone") {
        return res.status(400).json({ message: "Invalid verification method. Please request a new phone code." });
      }

      const verification = await storage.getActiveAuthVerification(pendingUserId, "phone");
      if (!verification) {
        return res.status(400).json({ message: "Invalid or expired code" });
      }

      if (verification.lockedUntil && verification.lockedUntil.getTime() > Date.now()) {
        return res.status(429).json({ message: "Too many attempts. Please wait before trying again." });
      }

      if (verification.expiresAt.getTime() <= Date.now()) {
        await storage.consumeAuthVerification(verification.id);
        return res.status(400).json({ message: "Invalid or expired code" });
      }

      const isValidOtp = verification.codeHash === hashOTP(String(code).trim());

      if (isValidOtp) {
        await storage.consumeAuthVerification(verification.id);
        const user = await storage.getUser(pendingUserId);
        if (!user) {
          return res.status(400).json({ message: "User not found" });
        }

        const cleanPhone = user.phone?.replace(/\D/g, "") || "";
        // Check against env variable for founder phones (comma-separated list)
        const founderPhones = (process.env.FOUNDER_PHONES || "").split(",").map(p => p.trim()).filter(Boolean);
        const isFounderPhone = founderPhones.some(p => cleanPhone === p || cleanPhone === p.replace(/\D/g, ""));

        // Mark phone as verified
        await storage.verifyUserPhone(pendingUserId, isFounderPhone);
        const updatedUser = await storage.getUser(pendingUserId);
        if (!updatedUser) {
          return res.status(400).json({ message: "User not found" });
        }

        if (isHomepageOwnerUser(updatedUser)) {
          const transferred = await storage.transferAppSpaceFounderBySlug(getHomepageSlug(), pendingUserId);
          if (transferred) {
            console.log(`[HomepageOwnership] Homepage ownership transferred to user ${pendingUserId}.`);
          }
        }

        // Establish full session
        req.session.userId = pendingUserId;
        delete req.session.pendingUserId;
        delete req.session.pendingAuthMethod;

        // Explicitly save session
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        return res.json({
          success: true,
          user: {
            id: updatedUser!.id,
            username: updatedUser!.username,
            email: updatedUser!.email,
            phone: updatedUser!.phone,
            phoneVerified: updatedUser!.phoneVerified,
            hasFounderAccess: updatedUser!.hasFounderAccess,
            firstName: updatedUser!.firstName,
            lastName: updatedUser!.lastName,
            displayName: updatedUser!.displayName,
            avatarUrl: updatedUser!.avatarUrl,
          }
        });
      } else {
        const nextAttempts = (verification.attempts ?? 0) + 1;
        const shouldLock = nextAttempts >= (verification.maxAttempts ?? 5);
        await storage.incrementAuthVerificationAttempt(
          verification.id,
          shouldLock ? new Date(Date.now() + 10 * 60 * 1000) : undefined
        );
        await storage.createAuthRiskEvent({
          userId: pendingUserId,
          method: "phone",
          target: verification.target,
          eventType: shouldLock ? "otp_lockout" : "otp_invalid_code",
          severity: shouldLock ? "high" : "medium",
          ipAddress: getClientIp(req),
          metadata: JSON.stringify({ attempts: nextAttempts }),
        });
        return res.status(400).json({ message: "Invalid or expired code" });
      }
    } catch (error) {
      console.error("Phone verify error:", error);
      return res.status(500).json({ message: "Failed to verify code" });
    }
  });

  // Legacy phone send endpoint (for already authenticated users)
  app.post("/api/auth/phone/send", requireAuth, async (req, res) => {
    try {
      const { phone } = req.body;
      const userId = req.session.userId!;

      if (!phone) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      const response = await fetch("https://textbelt.com/otp/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone,
          userid: userId,
          key: process.env.TEXTBELT_API_KEY,
          message: "Your FirstUser verification code is $OTP",
          lifetime: 300,
          length: 6
        })
      });

      const result = await response.json();
      if (result.success) {
        await storage.updateUserPhone(userId, phone);
        return res.json({ success: true });
      } else {
        return res.status(400).json({ message: result.error || "Failed to send code" });
      }
    } catch (error) {
      console.error("Phone send error:", error);
      return res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  // Legacy phone verify endpoint (for already authenticated users)
  app.post("/api/auth/phone/verify-legacy", requireAuth, async (req, res) => {
    try {
      const { phone, code } = req.body;
      const userId = req.session.userId!;

      if (!phone || !code) {
        return res.status(400).json({ message: "Phone and code are required" });
      }

      const response = await fetch(`https://textbelt.com/otp/verify?otp=${code}&userid=${userId}&key=${process.env.TEXTBELT_API_KEY}`);
      const result = await response.json();

      if (result.success && result.isValidOtp) {
        const cleanPhone = phone.replace(/\D/g, "");
        // Check against env variable for founder phones (comma-separated list)
        const founderPhones = (process.env.FOUNDER_PHONES || "").split(",").map(p => p.trim()).filter(Boolean);
        const isFounderPhone = founderPhones.some(p => cleanPhone === p || cleanPhone === p.replace(/\D/g, ""));

        await storage.verifyUserPhone(userId, isFounderPhone);

        const user = await storage.getUser(userId);
        if (isHomepageOwnerUser(user)) {
          const transferred = await storage.transferAppSpaceFounderBySlug(getHomepageSlug(), userId);
          if (transferred) {
            console.log(`[HomepageOwnership] Homepage ownership transferred to user ${userId}.`);
          }
        }

        return res.json({
          success: true,
          hasFounderAccess: user?.hasFounderAccess || false,
          phoneVerified: true
        });
      } else {
        return res.status(400).json({ message: "Invalid or expired code" });
      }
    } catch (error) {
      console.error("Phone verify error:", error);
      return res.status(500).json({ message: "Failed to verify code" });
    }
  });

  // Email authentication - Start (send OTP via email)
  app.post("/api/auth/email/start", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email address" });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check if user exists by email
      let user = await storage.getUserByEmail(normalizedEmail);
      const isNewUser = !user;

      if (!user) {
        // Create new user with email
        user = await storage.createUser({ email: normalizedEmail, password: "" });
      }

      const emailCollisionCount = await storage.countUsersByEmail(normalizedEmail);
      if (emailCollisionCount > 1) {
        await storage.createAuthRiskEvent({
          userId: user.id,
          method: "email",
          target: normalizedEmail,
          eventType: "email_collision",
          severity: "high",
          ipAddress: getClientIp(req),
          metadata: JSON.stringify({ emailCollisionCount }),
        });
      }

      const throttle = await enforceOtpThrottle({
        req,
        method: "email",
        target: normalizedEmail,
        userId: user.id,
      });
      if (!throttle.allowed) {
        return res.status(429).json({ message: throttle.reason });
      }

      // Store pending user ID in session for verification step
      req.session.pendingUserId = user.id;
      req.session.pendingAuthMethod = "email";

      // Generate OTP and persist it
      const otp = generateOTP();
      await storage.createAuthVerification({
        userId: user.id,
        method: "email",
        target: normalizedEmail,
        codeHash: hashOTP(otp),
        ipAddress: getClientIp(req),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      // Send OTP via email
      console.log("[EMAIL OTP] Sending to:", normalizedEmail);
      const result = await sendVerificationEmail(normalizedEmail, otp);

      if (!result.success) {
        console.error("Email send error:", result.error);
        const providerRejected = result.providerStatus === 401 || result.providerStatus === 403;
        return res.status(providerRejected ? 503 : 500).json({
          message: result.error || "Failed to send email",
          code: providerRejected ? "EMAIL_PROVIDER_REJECTED" : "EMAIL_SEND_FAILED",
        });
      }

      console.log("[EMAIL OTP] Send success - ID:", result.id);

      // Explicitly save session before responding
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      return res.json({ success: true, isNewUser });
    } catch (error) {
      console.error("Email start error:", error);
      return res.status(500).json({ message: "Failed to send verification email" });
    }
  });

  // Email authentication - Verify OTP
  app.post("/api/auth/email/verify", async (req, res) => {
    try {
      const { code } = req.body;
      const pendingUserId = req.session.pendingUserId;
      const pendingAuthMethod = req.session.pendingAuthMethod;

      if (!code) {
        return res.status(400).json({ message: "Code is required" });
      }

      if (!pendingUserId) {
        return res.status(400).json({ message: "No pending verification. Please request a new code." });
      }

      // Validate that this verification attempt matches the auth method used
      if (pendingAuthMethod !== "email") {
        return res.status(400).json({ message: "Invalid verification method. Please request a new email code." });
      }

      const verification = await storage.getActiveAuthVerification(pendingUserId, "email");
      if (!verification) {
        return res.status(400).json({ message: "Invalid or expired code" });
      }

      if (verification.lockedUntil && verification.lockedUntil.getTime() > Date.now()) {
        return res.status(429).json({ message: "Too many attempts. Please wait before trying again." });
      }

      if (verification.expiresAt.getTime() <= Date.now()) {
        await storage.consumeAuthVerification(verification.id);
        return res.status(400).json({ message: "Invalid or expired code" });
      }

      const isValidOtp = verification.codeHash === hashOTP(String(code).trim());

      if (isValidOtp) {
        await storage.consumeAuthVerification(verification.id);
        const user = await storage.getUser(pendingUserId);
        if (!user) {
          return res.status(400).json({ message: "User not found" });
        }

        // Mark email as verified (update user)
        await storage.updateUser(pendingUserId, { emailVerified: true });

        // Establish full session
        req.session.userId = pendingUserId;
        delete req.session.pendingUserId;
        delete req.session.pendingAuthMethod;

        // Explicitly save session
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        const updatedUser = await storage.getUser(pendingUserId);

        return res.json({
          success: true,
          user: {
            id: updatedUser!.id,
            email: updatedUser!.email,
            phone: updatedUser!.phone,
            phoneVerified: updatedUser!.phoneVerified,
            emailVerified: true,
            firstName: updatedUser!.firstName,
            lastName: updatedUser!.lastName,
            displayName: updatedUser!.displayName,
            avatarUrl: updatedUser!.avatarUrl,
            username: updatedUser!.username,
            hasFounderAccess: updatedUser!.hasFounderAccess,
          },
        });
      } else {
        const nextAttempts = (verification.attempts ?? 0) + 1;
        const shouldLock = nextAttempts >= (verification.maxAttempts ?? 5);
        await storage.incrementAuthVerificationAttempt(
          verification.id,
          shouldLock ? new Date(Date.now() + 10 * 60 * 1000) : undefined
        );
        await storage.createAuthRiskEvent({
          userId: pendingUserId,
          method: "email",
          target: verification.target,
          eventType: shouldLock ? "otp_lockout" : "otp_invalid_code",
          severity: shouldLock ? "high" : "medium",
          ipAddress: getClientIp(req),
          metadata: JSON.stringify({ attempts: nextAttempts }),
        });
        return res.status(400).json({ message: "Invalid or expired code" });
      }
    } catch (error) {
      console.error("Email verify error:", error);
      return res.status(500).json({ message: "Failed to verify code" });
    }
  });

  app.get("/api/auth/username/check", async (req, res) => {
    try {
      const username = req.query.username as string;
      if (!username) {
        return res.status(400).json({ message: "Username is required" });
      }

      if (username.length < 3 || username.length > 20) {
        return res.json({ available: false, reason: "Username must be 3-20 characters" });
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.json({ available: false, reason: "Only letters, numbers, and underscores allowed" });
      }

      const existing = await storage.getUserByUsername(username);
      return res.json({ available: !existing });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/auth/username", requireAuth, async (req, res) => {
    try {
      const { username } = req.body;
      const userId = req.session.userId!;

      if (!username || typeof username !== "string") {
        return res.status(400).json({ message: "Username is required" });
      }

      const normalizedUsername = username.trim().replace(/^@+/, "").toLowerCase();
      if (!normalizedUsername) {
        return res.status(400).json({ message: "Username is required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // No-op for unchanged username
      if (user.username === normalizedUsername) {
        return res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            hasFounderAccess: user.hasFounderAccess,
            phoneVerified: user.phoneVerified
          }
        });
      }

      if (normalizedUsername.length < 3 || normalizedUsername.length > 20) {
        return res.status(400).json({ message: "Username must be 3-20 characters" });
      }

      if (!/^[a-z0-9_]+$/.test(normalizedUsername)) {
        return res.status(400).json({ message: "Only letters, numbers, and underscores allowed" });
      }

      const existing = await storage.getUserByUsername(normalizedUsername);
      if (existing && existing.id !== userId) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const updated = await storage.setUsername(userId, normalizedUsername);
      return res.json({ 
        success: true, 
        user: {
          id: updated.id,
          username: updated.username,
          email: updated.email,
          hasFounderAccess: updated.hasFounderAccess,
          phoneVerified: updated.phoneVerified
        }
      });
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/appspaces", async (req, res) => {
    try {
      const appSpaces = await storage.getAllAppSpaces();
      return res.json(appSpaces);
    } catch (error) {
      throw error;
    }
  });

  // Discover payload (single-call app card data with counts)
  app.get("/api/appspaces/discover", async (req, res) => {
    try {
      const appSpaces = await storage.getAllAppSpaces();
      const discoverData = await Promise.all(
        appSpaces.map(async (appSpace) => {
          const members = await storage.getWaitlistMembers(appSpace.id);
          const approvedCount = members.filter((member) => member.status === "approved").length;
          const pendingCount = members.filter((member) => member.status === "pending").length;
          const goldenTicket = await storage.getGoldenTicketPublicSummary(appSpace.id);
          return {
            ...appSpace,
            memberCount: members.length,
            approvedCount,
            pendingCount,
            goldenTicketStatus: goldenTicket.status,
            goldenTicketSelected: goldenTicket.selected,
          };
        })
      );

      return res.json({ appSpaces: discoverData });
    } catch (error) {
      throw error;
    }
  });

  // Get current user's owned AppSpaces
  app.get("/api/users/me/appspaces", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const allAppSpaces = await storage.getAllAppSpaces();
      const userAppSpaces = allAppSpaces.filter(space => space.founderId === userId);
      return res.json({ appSpaces: userAppSpaces });
    } catch (error) {
      throw error;
    }
  });

  // Get current user's waitlist memberships with appspace metadata
  app.get("/api/users/me/memberships", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const memberships = await storage.getUserWaitlistMemberships(userId);
      const enrichedMemberships = await Promise.all(
        memberships.map(async (membership) => {
          if (membership.status !== "pending" && membership.status !== "approved") {
            return null;
          }

          const appSpace = await storage.getAppSpace(membership.appSpaceId);
          return {
            id: membership.id,
            appSpaceId: membership.appSpaceId,
            position: membership.position,
            status: membership.status,
            joinedAt: membership.joinedAt,
            appSpace: appSpace ? {
              id: appSpace.id,
              slug: appSpace.slug,
              name: appSpace.name,
              tagline: appSpace.tagline,
              logoUrl: appSpace.logoUrl,
            } : null,
          };
        })
      );

      return res.json({
        memberships: enrichedMemberships.filter((membership): membership is NonNullable<typeof membership> => {
          return !!membership && !!membership.appSpace;
        }),
      });
    } catch (error) {
      throw error;
    }
  });

  // File upload endpoint with image processing
  app.post("/api/upload", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Generate unique filename with webp extension
      const uniqueId = crypto.randomUUID();
      const filename = `${uniqueId}.webp`;
      const filepath = path.join(uploadsDir, filename);

      // Process image with sharp: resize to 256x256 and convert to WebP
      await sharp(req.file.buffer)
        .resize(256, 256, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: 85 })
        .toFile(filepath);

      const fileUrl = `/uploads/${filename}`;
      return res.json({ url: fileUrl });
    } catch (error) {
      console.error("Image processing error:", error);
      return res.status(500).json({ message: "Failed to process image" });
    }
  });

  app.get("/api/appspaces/:slug", async (req, res) => {
    try {
      const slug = req.params.slug as string;
      const appSpace = await storage.getAppSpaceBySlug(slug);
      
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }
      
      const members = await storage.getWaitlistMembers(appSpace.id);
      return res.json({ ...appSpace, memberCount: members.length });
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/appspaces/:slug/public", async (req, res) => {
    try {
      const slug = req.params.slug as string;
      const appSpace = await storage.getAppSpaceBySlug(slug);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }
      
      const activeUsers = await storage.getActiveUsers(appSpace.id, 20);
      const waitlistUsers = await storage.getWaitlistUsers(appSpace.id, 20);
      const stats = {
        activeCount: await storage.getActiveCount(appSpace.id),
        waitlistCount: await storage.getWaitlistCount(appSpace.id),
      };
      const currentUserId = req.session?.userId;
      const goldenTicket = await storage.getGoldenTicketPublicSummary(appSpace.id, currentUserId);

      return res.json({ appSpace, activeUsers, waitlistUsers, stats, goldenTicket });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/appspaces", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const data = insertAppSpaceSchema.parse({
        ...req.body,
        founderId: req.session.userId
      });

      if (isHomepageSlug(data.slug) && getHomepageOwnerPhone() && !isHomepageOwnerUser(currentUser)) {
        return res.status(403).json({ message: "Only the homepage owner account can create this AppSpace" });
      }
      
      const existingSlug = await storage.getAppSpaceBySlug(data.slug);
      if (existingSlug) {
        return res.status(400).json({ message: "Slug already taken" });
      }
      
      const appSpace = await storage.createAppSpace(data);
      return res.status(201).json(appSpace);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      throw error;
    }
  });

  app.get("/api/appspaces/:id/waitlist", async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      const members = await storage.getWaitlistMembers(id);
      return res.json(members);
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/appspaces/:id/join", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const userId = req.session.userId!;
      
      const existing = await storage.getWaitlistMember(appSpaceId, userId);
      if (existing) {
        return res.status(400).json({ message: "Already joined this waitlist" });
      }
      
      const position = await storage.getNextPosition(appSpaceId);
      const badgeTier = getBadgeTier(position);
      
      const member = await storage.joinWaitlist({
        appSpaceId,
        userId,
        position,
        badgeTier,
        isActive: false,
      });
      
      const surveyQuestions = await storage.getSurveyQuestions(appSpaceId);
      
      return res.status(201).json({
        member: {
          id: member.id,
          position: member.position,
          badgeTier: member.badgeTier,
        },
        hasSurvey: Array.isArray(surveyQuestions) && surveyQuestions.length > 0,
      });
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/appspaces/:id/survey", async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const questions = await storage.getSurveyQuestions(appSpaceId);
      return res.json({ questions });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/appspaces/:id/survey/respond", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const userId = req.session.userId!;
      const { responses } = req.body;
      
      if (!responses || !Array.isArray(responses)) {
        return res.status(400).json({ message: "Invalid responses" });
      }
      
      const validQuestions = await storage.getSurveyQuestions(appSpaceId);
      const validQuestionIds = new Set(validQuestions.map(q => q.id));
      
      const validResponses = responses.filter((r: { questionId: number }) => 
        validQuestionIds.has(r.questionId)
      );
      
      if (validResponses.length === 0 && responses.length > 0) {
        return res.status(400).json({ message: "No valid questions found" });
      }
      
      const responseData = validResponses.map((r: { questionId: number; responseText: string }) => ({
        appSpaceId,
        userId,
        questionId: r.questionId,
        responseText: r.responseText,
      }));
      
      await storage.saveSurveyResponses(responseData);
      return res.json({ success: true });
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/appspaces/:id/next-position", async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const nextPosition = await storage.getNextPosition(appSpaceId);
      return res.json({ nextPosition });
    } catch (error) {
      throw error;
    }
  });

  app.patch("/api/users/me/settings", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const {
        emailNotifications,
        smsNotifications,
        pollReminders,
        dmNotifications,
        badgeAlerts,
        showOnlineStatus,
        allowDmsFromAnyone,
      } = req.body;

      const settings = await storage.saveUserSettings(userId, {
        emailNotifications,
        smsNotifications,
        pollReminders,
        dmNotifications,
        badgeAlerts,
        showOnlineStatus,
        allowDmsFromAnyone,
      });

      return res.json({ success: true, settings });
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/users/me/settings", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const settings = await storage.getUserSettings(userId);

      return res.json(settings || {
        emailNotifications: true,
        smsNotifications: true,
        pollReminders: true,
        dmNotifications: true,
        badgeAlerts: true,
        showOnlineStatus: true,
        allowDmsFromAnyone: false,
      });
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/users/me/live-visibility", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const preference = await storage.getUserLivePreference(userId);
      return res.json({
        showLiveToFounders: preference?.showLiveToFounders ?? true,
      });
    } catch (error) {
      throw error;
    }
  });

  app.patch("/api/users/me/live-visibility", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const parsed = z.object({
        showLiveToFounders: z.boolean(),
      }).safeParse(req.body || {});

      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid live visibility payload" });
      }

      const preference = await storage.upsertUserLivePreference(userId, parsed.data.showLiveToFounders);
      return res.json({
        success: true,
        showLiveToFounders: preference.showLiveToFounders,
      });
    } catch (error) {
      throw error;
    }
  });

  app.delete("/api/users/me", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      await storage.deleteUserAccount(userId);

      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ message: "Account deleted but failed to end session" });
        }
        return res.json({ success: true });
      });
    } catch (error) {
      throw error;
    }
  });

  // Update user profile (firstName, lastName, displayName, title, linkedInUrl, avatarUrl)
  app.patch("/api/users/me/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { firstName, lastName, displayName, title, linkedInUrl, avatarUrl } = req.body;

      const user = await storage.updateUserProfile(userId, {
        firstName: firstName !== undefined ? firstName : undefined,
        lastName: lastName !== undefined ? lastName : undefined,
        displayName: displayName !== undefined ? displayName : undefined,
        title: title !== undefined ? title : undefined,
        linkedInUrl: linkedInUrl !== undefined ? linkedInUrl : undefined,
        avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
      });

      return res.json({ success: true, user });
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/users/me/uncelebrated-badges", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const badges = await storage.getUncelebratedBadges(userId);
      return res.json({ badges });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/users/me/badges/:badgeId/celebrated", requireAuth, async (req, res) => {
    try {
      const badgeId = parseInt(req.params.badgeId as string);
      const userId = req.session.userId!;
      
      const badges = await storage.getUncelebratedBadges(userId);
      const badge = badges.find(b => b.id === badgeId);
      if (!badge) {
        return res.status(404).json({ message: "Badge not found or already celebrated" });
      }
      
      await storage.markBadgeCelebrated(badgeId);
      return res.json({ success: true });
    } catch (error) {
      throw error;
    }
  });

  const VALID_STATUSES = ["pending", "approved", "rejected", "banned"];

  app.patch("/api/appspaces/:id/waitlist/:userId", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const targetUserId = String(req.params.userId);
      const { status } = req.body as { status?: string };
      
      if (status && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be one of: pending, approved, rejected, banned" });
      }
      
      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }
      
      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized to manage members",
      });
      if (!canManage) return;
      
      const existingMember = await storage.getWaitlistMember(appSpaceId, targetUserId);
      if (!existingMember) {
        return res.status(404).json({ message: "Waitlist member not found" });
      }
      
      if (status) {
        await storage.updateWaitlistMemberStatus(appSpaceId, targetUserId, status);
        
        if (status === "approved") {
          const integrationAccess = await handleIntegrationMembershipEvent({
            req,
            appSpaceId,
            appSpaceSlug: appSpace.slug,
            appSpaceName: appSpace.name,
            userId: targetUserId,
            status: "approved",
          });

          await storage.setWaitlistMemberActive(appSpaceId, targetUserId, true);

          if (appSpace.slug === "firstuser") {
            await storage.grantFounderAccess(targetUserId);
          }

          // Create in-app notification
          await createAndEmitNotification({
            userId: targetUserId,
            type: "waitlist_approved",
            data: {
              appSpaceId,
              appSpaceName: appSpace.name,
              appSpaceSlug: appSpace.slug,
              integrationAccess: integrationAccess.browserAccessUrl ? {
                browserAccessUrl: integrationAccess.browserAccessUrl,
                mobileAccessUrl: integrationAccess.mobileAccessUrl,
                expiresAt: integrationAccess.expiresAt?.toISOString() ?? null,
              } : null,
            },
          });

          const user = await storage.getUser(targetUserId);
          if (user?.phoneVerified && user?.phone) {
            const { sendSMS } = await import("./sms");
            const message = appSpace.slug === "firstuser"
              ? `You've been approved to create on FirstUser! 🎉 Start building your waitlist now.`
              : `🎉 You've been approved to ${appSpace.name}! You now have full access.`;
            const withAccess = integrationAccess.browserAccessUrl
              ? `${message} Access now: ${integrationAccess.browserAccessUrl}`
              : message;
            await sendSMS(user.phone, withAccess);
          }
        }

        if (status === "rejected") {
          await handleIntegrationMembershipEvent({
            req,
            appSpaceId,
            appSpaceSlug: appSpace.slug,
            appSpaceName: appSpace.name,
            userId: targetUserId,
            status: "rejected",
          });

          // Create in-app notification for rejection
          await createAndEmitNotification({
            userId: targetUserId,
            type: "waitlist_rejected",
            data: {
              appSpaceId,
              appSpaceName: appSpace.name,
              appSpaceSlug: appSpace.slug,
            },
          });
        }

        if (status === "banned") {
          await storage.setWaitlistMemberActive(appSpaceId, targetUserId, false);
        }
      } else {
        if (existingMember.status === "banned") {
          return res.status(400).json({ message: "Cannot activate a banned member. Change status first." });
        }
        await storage.setWaitlistMemberActive(appSpaceId, targetUserId, true);
        if (appSpace.slug === "firstuser") {
          await storage.grantFounderAccess(targetUserId);
        }
      }
      
      const member = await storage.getWaitlistMember(appSpaceId, targetUserId);
      return res.json(member);
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/appspaces/:id/waitlist/bulk", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const { userIds, status } = req.body as { userIds: string[]; status: string };
      
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }
      
      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized to manage members",
      });
      if (!canManage) return;
      
      const results: Array<{ userId: string; success: boolean; error?: string }> = [];
      
      for (const userId of userIds) {
        try {
          const existingMember = await storage.getWaitlistMember(appSpaceId, userId);
          if (!existingMember) {
            results.push({ userId, success: false, error: "Member not found" });
            continue;
          }
          
          await storage.updateWaitlistMemberStatus(appSpaceId, userId, status);
          
          if (status === "approved") {
            const integrationAccess = await handleIntegrationMembershipEvent({
              req,
              appSpaceId,
              appSpaceSlug: appSpace.slug,
              appSpaceName: appSpace.name,
              userId,
              status: "approved",
            });

            await storage.setWaitlistMemberActive(appSpaceId, userId, true);

            if (appSpace.slug === "firstuser") {
              await storage.grantFounderAccess(userId);
            }

            // Create in-app notification
            await createAndEmitNotification({
              userId,
              type: "waitlist_approved",
              data: {
                appSpaceId,
                appSpaceName: appSpace.name,
                appSpaceSlug: appSpace.slug,
                integrationAccess: integrationAccess.browserAccessUrl ? {
                  browserAccessUrl: integrationAccess.browserAccessUrl,
                  mobileAccessUrl: integrationAccess.mobileAccessUrl,
                  expiresAt: integrationAccess.expiresAt?.toISOString() ?? null,
                } : null,
              },
            });

            const user = await storage.getUser(userId);
            if (user?.phoneVerified && user?.phone) {
              const { sendSMS } = await import("./sms");
              const message = appSpace.slug === "firstuser"
                ? `You've been approved to create on FirstUser! 🎉`
                : `🎉 You've been approved to ${appSpace.name}!`;
              const withAccess = integrationAccess.browserAccessUrl
                ? `${message} Access now: ${integrationAccess.browserAccessUrl}`
                : message;
              await sendSMS(user.phone, withAccess);
            }
          }

          if (status === "rejected") {
            await handleIntegrationMembershipEvent({
              req,
              appSpaceId,
              appSpaceSlug: appSpace.slug,
              appSpaceName: appSpace.name,
              userId,
              status: "rejected",
            });

            // Create in-app notification for rejection
            await createAndEmitNotification({
              userId,
              type: "waitlist_rejected",
              data: {
                appSpaceId,
                appSpaceName: appSpace.name,
                appSpaceSlug: appSpace.slug,
              },
            });
          }

          results.push({ userId, success: true });
        } catch (error) {
          results.push({ userId, success: false, error: String(error) });
        }
      }
      
      return res.json({ 
        results, 
        successCount: results.filter(r => r.success).length 
      });
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/appspaces/:id/waitlist/members", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      
      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }
      
      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized to view members",
      });
      if (!canManage) return;
      
      const members = await storage.getWaitlistMembersWithUsers(appSpaceId);
      return res.json({ members });
    } catch (error) {
      throw error;
    }
  });

  // Announcements endpoints
  app.get("/api/appspaces/:id/announcements", async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }
      const announcementsList = await storage.getAnnouncements(appSpaceId);
      return res.json({ announcements: announcementsList });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/appspaces/:id/announcements", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const { title, body, isPinned, sendSms } = req.body as { 
        title: string; 
        body: string; 
        isPinned?: boolean;
        sendSms?: boolean;
      };
      
      if (!title || title.length > 100) {
        return res.status(400).json({ message: "Title is required and must be 100 characters or less" });
      }
      if (!body || body.length > 1000) {
        return res.status(400).json({ message: "Body is required and must be 1000 characters or less" });
      }
      
      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }
      
      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Only founders can create announcements",
      });
      if (!canManage) return;
      
      const announcement = await storage.createAnnouncement({
        appSpaceId,
        authorId: req.session.userId!,
        title,
        body,
        isPinned: isPinned ?? false,
      });
      
      if (sendSms) {
        const members = await storage.getWaitlistMembersWithUsers(appSpaceId);
        const verifiedUsers = members.filter(m => m.phoneVerified);
        const { sendSMS } = await import("./sms");
        
        await Promise.all(
          verifiedUsers.map(async (member) => {
            try {
              const user = await storage.getUser(member.userId);
              if (user?.phone && user.phoneVerified) {
                await sendSMS(user.phone, `📢 ${appSpace.name}: ${title}`);
              }
            } catch (err) {
              console.error(`Failed to send SMS to ${member.userId}:`, err);
            }
          })
        ).catch(console.error);
      }
      
      return res.json(announcement);
    } catch (error) {
      throw error;
    }
  });

  app.delete("/api/appspaces/:id/announcements/:announcementId", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const announcementId = parseInt(req.params.announcementId as string);
      
      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }
      
      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Only founders can delete announcements",
      });
      if (!canManage) return;
      
      const deleted = await storage.deleteAnnouncement(announcementId, appSpaceId);
      if (!deleted) {
        return res.status(404).json({ message: "Announcement not found" });
      }
      
      return res.json({ success: true });
    } catch (error) {
      throw error;
    }
  });

  // Polls endpoints
  app.get("/api/appspaces/:id/polls", async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }
      const pollsList = await storage.getPolls(appSpaceId);
      return res.json({ polls: pollsList });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/appspaces/:id/polls", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const { question, options, duration, showResultsBeforeVoting, allowMultipleVotes } = req.body as {
        question: string;
        options: string[];
        duration: string;
        showResultsBeforeVoting?: boolean;
        allowMultipleVotes?: boolean;
      };
      
      if (!question) {
        return res.status(400).json({ message: "Question is required" });
      }
      if (!options || options.length < 2 || options.length > 6) {
        return res.status(400).json({ message: "Must have 2-6 options" });
      }
      
      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }
      
      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Only founders can create polls",
      });
      if (!canManage) return;
      
      const durationMs: Record<string, number> = {
        "1h": 60 * 60 * 1000,
        "6h": 6 * 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "3d": 3 * 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
      };
      const endsAt = new Date(Date.now() + (durationMs[duration] || durationMs["24h"]));
      
      const poll = await storage.createPoll({
        appSpaceId,
        authorId: req.session.userId!,
        question,
        options: JSON.stringify(options),
        endsAt,
        showResultsBeforeVoting: showResultsBeforeVoting ?? false,
        allowMultipleVotes: allowMultipleVotes ?? false,
      });
      
      return res.json(poll);
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/appspaces/:id/polls/:pollId/vote", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const pollId = parseInt(req.params.pollId as string);
      const { optionIndex } = req.body as { optionIndex: number };
      
      const poll = await storage.getPoll(pollId);
      if (!poll) {
        return res.status(404).json({ message: "Poll not found" });
      }
      
      if (poll.appSpaceId !== appSpaceId) {
        return res.status(400).json({ message: "Poll does not belong to this AppSpace" });
      }
      
      const member = await storage.getWaitlistMember(appSpaceId, req.session.userId!);
      if (!member) {
        return res.status(403).json({ message: "You must be a member of this AppSpace to vote" });
      }
      
      if (new Date() > poll.endsAt) {
        return res.status(400).json({ message: "Poll has ended" });
      }
      
      const existingVotes = await storage.getUserPollVotes(pollId, req.session.userId!);
      if (existingVotes.length > 0 && !poll.allowMultipleVotes) {
        return res.status(400).json({ message: "You have already voted on this poll" });
      }
      
      const options = JSON.parse(poll.options);
      if (optionIndex < 0 || optionIndex >= options.length) {
        return res.status(400).json({ message: "Invalid option" });
      }
      
      const vote = await storage.createPollVote({
        pollId,
        userId: req.session.userId!,
        optionIndex,
      });
      
      return res.json(vote);
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/appspaces/:id/polls/:pollId/results", async (req, res) => {
    try {
      const pollId = parseInt(req.params.pollId as string);
      
      const poll = await storage.getPoll(pollId);
      if (!poll) {
        return res.status(404).json({ message: "Poll not found" });
      }
      
      const votes = await storage.getPollVotes(pollId);
      const options = JSON.parse(poll.options);
      
      const results = options.map((option: string, index: number) => ({
        option,
        votes: votes.filter(v => v.optionIndex === index).length,
      }));
      
      return res.json({ 
        poll, 
        results, 
        totalVotes: votes.length,
        hasEnded: new Date() > poll.endsAt
      });
    } catch (error) {
      throw error;
    }
  });

  // Custom Badges endpoints
  app.get("/api/appspaces/:id/custom-badges", async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }
      
      const badges = await storage.getCustomBadges(appSpaceId);
      const badgesWithCounts = await Promise.all(
        badges.map(async (badge) => ({
          ...badge,
          awardCount: await storage.getCustomBadgeAwardCount(badge.id),
        }))
      );
      
      return res.json({ badges: badgesWithCounts });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/appspaces/:id/custom-badges/:badgeId/award", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const badgeId = parseInt(req.params.badgeId as string);
      const { userId, reason } = req.body as { userId: string; reason?: string };
      
      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }
      
      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Only founders can award badges",
      });
      if (!canManage) return;
      
      const member = await storage.getWaitlistMember(appSpaceId, userId);
      if (!member) {
        return res.status(400).json({ message: "User must be a waitlist member of this AppSpace" });
      }
      
      const award = await storage.awardBadge({
        customBadgeId: badgeId,
        userId,
        awardedBy: req.session.userId!,
        reason: reason || null,
      });
      
      return res.json(award);
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/appspaces/:id/users/:userId/badges", async (req, res) => {
    try {
      const userId = req.params.userId;
      const badges = await storage.getUserBadgeAwards(userId);
      return res.json({ badges });
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/users/:userId/profile", async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const badges = await storage.getUserBadgeAwards(userId);
      const waitlistMemberships = await storage.getUserWaitlistMemberships(userId);
      const goldenTicketStatus = await Promise.all(
        waitlistMemberships.map(async (membership) => {
          const summary = await storage.getGoldenTicketPublicSummary(membership.appSpaceId, userId);
          return {
            appSpaceId: membership.appSpaceId,
            appSpaceName: membership.appSpaceName,
            appSpaceSlug: membership.appSpaceSlug,
            membershipStatus: membership.status,
            status: summary.status,
            selected: summary.selected,
            selectedAt: summary.selectedAt,
            isWinner: summary.isWinner,
          };
        })
      );

      return res.json({ 
        user: { 
          id: user.id, 
          username: user.username, 
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          hasFounderAccess: user.hasFounderAccess,
          createdAt: user.createdAt
        },
        badges,
        memberships: waitlistMemberships,
        goldenTicketStatus,
      });
    } catch (error) {
      throw error;
    }
  });

  const goldenTicketPolicySchema = z.object({
    serviceContingent: z.boolean().optional(),
    nonTransferable: z.boolean().optional(),
    rateLimitedByPolicy: z.boolean().optional(),
    winnerVisibility: z.literal("status_only").optional(),
  });

  const goldenTicketTierSchema = z.object({
    rank: z.number().int().min(1).max(1000),
    label: z.string().min(1).max(60),
    reward: z.string().min(1).max(240),
    isLifetime: z.boolean(),
    benefits: z.array(z.string().min(1).max(240)).optional(),
  });

  const selectGoldenTicketWinnerSchema = z.object({
    winnerUserId: z.string().min(1),
    reason: z.string().max(500).optional(),
  });

  const reportGoldenTicketSchema = z.object({
    category: z.enum(["policy_breach", "fraud"]),
    description: z.string().min(10).max(2000),
  });

  const resolvePolicyEventSchema = z.object({
    status: z.enum(["investigating", "resolved", "rejected"]),
    resolution: z.string().max(2000).optional(),
  });

  // Golden Ticket public status (winner identity remains private)
  app.get("/api/appspaces/:id/golden-ticket/public", async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      if (Number.isNaN(appSpaceId)) {
        return res.status(400).json({ message: "Invalid appspace ID" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const ticket = await storage.getOrCreateGoldenTicket(appSpaceId);
      const tiers = await storage.getTicketTiers(ticket.id);
      const summary = await storage.getGoldenTicketPublicSummary(appSpaceId, req.session?.userId);

      return res.json({
        appSpaceId,
        status: summary.status,
        selected: summary.selected,
        selectedAt: summary.selectedAt,
        isWinner: summary.isWinner,
        serviceContingent: summary.serviceContingent,
        winnerVisibility: ticket.winnerVisibility,
        tiers: tiers.map((tier) => ({
          id: tier.id,
          rank: tier.rank,
          label: tier.label,
          reward: tier.reward,
          isLifetime: tier.isLifetime,
          benefits: tier.benefits ? JSON.parse(tier.benefits) : [tier.reward],
        })),
      });
    } catch (error) {
      throw error;
    }
  });

  // Golden Ticket founder view (includes winner identity + audit data)
  app.get("/api/appspaces/:id/golden-ticket/founder", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      if (Number.isNaN(appSpaceId)) {
        return res.status(400).json({ message: "Invalid appspace ID" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized",
      });
      if (!canManage) return;

      const ticket = await storage.getOrCreateGoldenTicket(appSpaceId);
      const tiers = await storage.getTicketTiers(ticket.id);
      const audits = await storage.getTicketAuditEvents(appSpaceId);
      const policyEvents = await storage.getTicketPolicyEvents(appSpaceId);
      const winner = ticket.winnerUserId ? await storage.getUser(ticket.winnerUserId) : null;

      return res.json({
        ticket,
        tiers: tiers.map((tier) => ({
          ...tier,
          benefits: tier.benefits ? JSON.parse(tier.benefits) : [tier.reward],
        })),
        winner: winner
          ? {
              id: winner.id,
              username: winner.username,
              displayName: winner.displayName,
              email: winner.email,
              phone: winner.phone,
            }
          : null,
        audits,
        policyEvents,
      });
    } catch (error) {
      throw error;
    }
  });

  app.put("/api/appspaces/:id/golden-ticket/policy", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      if (Number.isNaN(appSpaceId)) {
        return res.status(400).json({ message: "Invalid appspace ID" });
      }

      const parsed = goldenTicketPolicySchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid policy payload" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized",
      });
      if (!canManage) return;

      const ticket = await storage.updateGoldenTicketPolicy(appSpaceId, parsed.data);
      await storage.createTicketAuditEvent({
        appSpaceId,
        goldenTicketId: ticket.id,
        actorUserId: req.session.userId,
        eventType: "policy_updated",
        eventData: JSON.stringify(parsed.data),
      });

      return res.json({ ticket });
    } catch (error) {
      throw error;
    }
  });

  app.put("/api/appspaces/:id/golden-ticket/tiers", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      if (Number.isNaN(appSpaceId)) {
        return res.status(400).json({ message: "Invalid appspace ID" });
      }

      const parsed = z.object({ tiers: z.array(goldenTicketTierSchema).min(3) }).safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid tiers payload" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized",
      });
      if (!canManage) return;

      const ticket = await storage.getOrCreateGoldenTicket(appSpaceId);
      const existingTiers = await storage.getTicketTiers(ticket.id);
      const incomingTiers = [...parsed.data.tiers].sort((a, b) => a.rank - b.rank);

      const rankOne = incomingTiers.find((tier) => tier.rank === 1);
      if (!rankOne || !rankOne.isLifetime) {
        return res.status(400).json({ message: "Tier 1 lifetime benefit is mandatory" });
      }

      // Additive-only rule: do not remove existing tier ranks or existing tier benefits.
      for (const existing of existingTiers) {
        const next = incomingTiers.find((tier) => tier.rank === existing.rank);
        if (!next) {
          return res.status(400).json({ message: "Cannot remove existing tier rank " + existing.rank });
        }
        const existingBenefits = new Set<string>(existing.benefits ? JSON.parse(existing.benefits) : [existing.reward]);
        const nextBenefits = new Set<string>(next.benefits && next.benefits.length > 0 ? next.benefits : [next.reward]);
        for (const benefit of Array.from(existingBenefits)) {
          if (!nextBenefits.has(benefit)) {
            return res.status(400).json({ message: "Tier " + existing.rank + " benefits can be added but not removed" });
          }
        }
      }

      const tiers = await storage.replaceTicketTiers(ticket.id, incomingTiers.map((tier) => ({
        rank: tier.rank,
        label: tier.label,
        reward: tier.reward,
        isLifetime: tier.isLifetime,
        benefits: tier.benefits,
      })));

      await storage.createTicketAuditEvent({
        appSpaceId,
        goldenTicketId: ticket.id,
        actorUserId: req.session.userId,
        eventType: "tiers_updated",
        eventData: JSON.stringify({ count: tiers.length }),
      });

      return res.json({
        tiers: tiers.map((tier) => ({
          ...tier,
          benefits: tier.benefits ? JSON.parse(tier.benefits) : [tier.reward],
        })),
      });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/appspaces/:id/golden-ticket/select-winner", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      if (Number.isNaN(appSpaceId)) {
        return res.status(400).json({ message: "Invalid appspace ID" });
      }

      const parsed = selectGoldenTicketWinnerSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid selection payload" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized",
      });
      if (!canManage) return;

      const ticket = await storage.getOrCreateGoldenTicket(appSpaceId);
      if (ticket.winnerUserId || ticket.status === "selected") {
        return res.status(409).json({ message: "Winner already selected" });
      }

      const winner = await storage.getUser(parsed.data.winnerUserId);
      if (!winner) {
        return res.status(404).json({ message: "Winner user not found" });
      }

      // Team-edge rule: cannot select an existing team member.
      if (winner.id === appSpace.founderId || winner.hasFounderAccess) {
        return res.status(400).json({ message: "Winner cannot already be part of the team at selection time" });
      }

      const updated = await storage.selectGoldenTicketWinner(
        appSpaceId,
        winner.id,
        req.session.userId!,
        parsed.data.reason
      );

      await storage.createTicketAuditEvent({
        appSpaceId,
        goldenTicketId: ticket.id,
        actorUserId: req.session.userId,
        eventType: "winner_selected",
        eventData: JSON.stringify({ winnerUserId: winner.id }),
      });

      await createAndEmitNotification({
        userId: winner.id,
        type: "golden_ticket",
        data: {
          message: "You were selected for " + appSpace.name + "'s Golden Ticket.",
          appSpaceId,
          appSpaceName: appSpace.name,
          appSpaceSlug: appSpace.slug,
        },
      });

      return res.json({
        status: updated.status,
        selectedAt: updated.selectedAt,
      });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/appspaces/:id/golden-ticket/report", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      if (Number.isNaN(appSpaceId)) {
        return res.status(400).json({ message: "Invalid appspace ID" });
      }

      const parsed = reportGoldenTicketSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid report payload" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const ticket = await storage.getOrCreateGoldenTicket(appSpaceId);
      const event = await storage.createTicketPolicyEvent({
        appSpaceId,
        goldenTicketId: ticket.id,
        reporterUserId: req.session.userId!,
        category: parsed.data.category,
        description: parsed.data.description,
      });

      await storage.createTicketAuditEvent({
        appSpaceId,
        goldenTicketId: ticket.id,
        actorUserId: req.session.userId,
        eventType: "policy_reported",
        eventData: JSON.stringify({ policyEventId: event.id, category: event.category }),
      });

      return res.status(201).json({ event });
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/appspaces/:id/golden-ticket/audit", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      if (Number.isNaN(appSpaceId)) {
        return res.status(400).json({ message: "Invalid appspace ID" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized",
      });
      if (!canManage) return;

      const audits = await storage.getTicketAuditEvents(appSpaceId);
      const policyEvents = await storage.getTicketPolicyEvents(appSpaceId);
      return res.json({ audits, policyEvents });
    } catch (error) {
      throw error;
    }
  });

  app.patch("/api/admin/policy-events/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid policy event ID" });
      }

      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser?.hasFounderAccess) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const existing = await storage.getTicketPolicyEventById(id);
      if (!existing) {
        return res.status(404).json({ message: "Policy event not found" });
      }

      const parsed = resolvePolicyEventSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid resolution payload" });
      }

      const resolvedAt = parsed.data.status === "resolved" || parsed.data.status === "rejected" ? new Date() : null;

      const event = await storage.updateTicketPolicyEvent(id, {
        status: parsed.data.status,
        resolution: parsed.data.resolution ?? null,
        resolvedByUserId: req.session.userId!,
        resolvedAt,
      });

      await storage.createTicketAuditEvent({
        appSpaceId: existing.appSpaceId,
        goldenTicketId: existing.goldenTicketId,
        actorUserId: req.session.userId,
        eventType: "policy_resolved",
        eventData: JSON.stringify({ policyEventId: id, status: parsed.data.status }),
      });

      await createAndEmitNotification({
        userId: existing.reporterUserId,
        type: "golden_ticket",
        data: {
          message: "Your Golden Ticket report was updated: " + parsed.data.status + ".",
          appSpaceId: existing.appSpaceId,
        },
      });

      return res.json({ event });
    } catch (error) {
      throw error;
    }
  });

  // Founder tools stats
  app.get("/api/appspaces/:id/founder-stats", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      
      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }
      
      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized",
      });
      if (!canManage) return;
      
      const announcementsList = await storage.getAnnouncements(appSpaceId);
      const pollsList = await storage.getPolls(appSpaceId);
      const badges = await storage.getCustomBadges(appSpaceId);
      const verifiedPhoneCount = await storage.getVerifiedPhoneUsersCount(appSpaceId);
      
      const activePollsCount = pollsList.filter(p => new Date() < p.endsAt).length;
      
      return res.json({
        totalAnnouncements: announcementsList.length,
        activePolls: activePollsCount,
        totalBadges: badges.length,
        verifiedPhoneUsers: verifiedPhoneCount,
      });
    } catch (error) {
      throw error;
    }
  });

  // ============ NO-CODE INTEGRATION SETUP (FOUNDER AUTH) ============

  app.get("/api/integrations/apps/:id/setup", requireAuth, async (req, res) => {
    try {
      const appSpaceId = Number(req.params.id);
      if (!Number.isInteger(appSpaceId)) {
        return res.status(400).json({ message: "Invalid app ID" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized to manage integration setup",
      });
      if (!canManage) return;

      const integration = await storage.getIntegrationAppByAppSpaceId(appSpaceId)
        || await storage.createOrUpdateIntegrationApp({ appSpaceId });
      const activeKey = await storage.getActiveIntegrationApiKeyForApp(integration.id);
      const health = await storage.getIntegrationHealth(integration.id);
      const baseUrl = getBaseUrl(req);

      return res.json({
        setup: {
          id: integration.id,
          appSpaceId: integration.appSpaceId,
          publicAppId: integration.publicAppId,
          redirectEnabled: integration.redirectEnabled,
          embeddedEnabled: integration.embeddedEnabled,
          webRedirectUrl: integration.webRedirectUrl,
          mobileDeepLinkUrl: integration.mobileDeepLinkUrl,
          webhookUrl: integration.webhookUrl,
          webhookSecretLastFour: integration.webhookSecretLastFour,
          allowedOrigins: parseAllowedOrigins(integration.allowedOrigins),
          createdAt: integration.createdAt,
          updatedAt: integration.updatedAt,
        },
        hostedJoinUrl: `${baseUrl}/i/${integration.publicAppId}/join`,
        activeApiKey: activeKey ? {
          keyId: activeKey.keyId,
          lastFour: activeKey.lastFour,
          createdAt: activeKey.createdAt,
        } : null,
        health,
      });
    } catch (error) {
      throw error;
    }
  });

  app.patch("/api/integrations/apps/:id/setup", requireAuth, async (req, res) => {
    try {
      const appSpaceId = Number(req.params.id);
      if (!Number.isInteger(appSpaceId)) {
        return res.status(400).json({ message: "Invalid app ID" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized to update integration setup",
      });
      if (!canManage) return;

      const parsed = z.object({
        publicAppId: z.string().min(3).max(80).regex(/^[a-zA-Z0-9_-]+$/).optional(),
        redirectEnabled: z.boolean().optional(),
        embeddedEnabled: z.boolean().optional(),
        webRedirectUrl: z.string().url().nullable().optional(),
        mobileDeepLinkUrl: z.string().max(512).nullable().optional(),
        webhookUrl: z.string().url().nullable().optional(),
        allowedOrigins: z.union([z.array(z.string()), z.string()]).optional(),
      }).safeParse(req.body || {});

      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid setup payload" });
      }

      const integration = await storage.createOrUpdateIntegrationApp({
        appSpaceId,
        publicAppId: parsed.data.publicAppId,
        redirectEnabled: parsed.data.redirectEnabled,
        embeddedEnabled: parsed.data.embeddedEnabled,
        webRedirectUrl: parsed.data.webRedirectUrl,
        mobileDeepLinkUrl: parsed.data.mobileDeepLinkUrl,
        webhookUrl: parsed.data.webhookUrl,
        allowedOrigins: parseAllowedOrigins(parsed.data.allowedOrigins),
      });
      const health = await storage.getIntegrationHealth(integration.id);
      const baseUrl = getBaseUrl(req);

      return res.json({
        setup: {
          id: integration.id,
          appSpaceId: integration.appSpaceId,
          publicAppId: integration.publicAppId,
          redirectEnabled: integration.redirectEnabled,
          embeddedEnabled: integration.embeddedEnabled,
          webRedirectUrl: integration.webRedirectUrl,
          mobileDeepLinkUrl: integration.mobileDeepLinkUrl,
          webhookUrl: integration.webhookUrl,
          webhookSecretLastFour: integration.webhookSecretLastFour,
          allowedOrigins: parseAllowedOrigins(integration.allowedOrigins),
          createdAt: integration.createdAt,
          updatedAt: integration.updatedAt,
        },
        hostedJoinUrl: `${baseUrl}/i/${integration.publicAppId}/join`,
        health,
      });
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/integrations/apps/:id/setup-pack", requireAuth, async (req, res) => {
    try {
      const appSpaceId = Number(req.params.id);
      if (!Number.isInteger(appSpaceId)) {
        return res.status(400).json({ message: "Invalid app ID" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized to view setup pack",
      });
      if (!canManage) return;

      const requestedStack = typeof req.query.stack === "string" ? req.query.stack.trim() : "";
      const stack = requestedStack ? requestedStack : "web";
      if (!isIntegrationStack(stack)) {
        return res.status(400).json({
          message: `Invalid stack. Supported stacks: ${SUPPORTED_INTEGRATION_STACKS.join(", ")}`,
        });
      }
      const integration = await storage.getIntegrationAppByAppSpaceId(appSpaceId)
        || await storage.createOrUpdateIntegrationApp({ appSpaceId });
      const activeKey = await storage.getActiveIntegrationApiKeyForApp(integration.id);
      const baseUrl = getBaseUrl(req);

      const setupPack = buildIntegrationSetupPack({
        appName: appSpace.name,
        appSpaceSlug: appSpace.slug,
        publicAppId: integration.publicAppId,
        stack,
        baseUrl,
        webRedirectUrl: integration.webRedirectUrl,
        mobileDeepLinkUrl: integration.mobileDeepLinkUrl,
        redirectEnabled: integration.redirectEnabled,
        embeddedEnabled: integration.embeddedEnabled,
        webhookUrl: integration.webhookUrl,
        webhookSecretLastFour: integration.webhookSecretLastFour,
        hasApiKey: !!activeKey,
        keyId: activeKey?.keyId,
      });

      return res.json({
        stack,
        setupPack,
        setup: {
          id: integration.id,
          publicAppId: integration.publicAppId,
          redirectEnabled: integration.redirectEnabled,
          embeddedEnabled: integration.embeddedEnabled,
          webRedirectUrl: integration.webRedirectUrl,
          mobileDeepLinkUrl: integration.mobileDeepLinkUrl,
          webhookUrl: integration.webhookUrl,
          webhookSecretLastFour: integration.webhookSecretLastFour,
          allowedOrigins: parseAllowedOrigins(integration.allowedOrigins),
        },
        hostedJoinUrl: `${baseUrl}/i/${integration.publicAppId}/join`,
      });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/integrations/apps/:id/api-keys/rotate", requireAuth, async (req, res) => {
    try {
      const appSpaceId = Number(req.params.id);
      if (!Number.isInteger(appSpaceId)) {
        return res.status(400).json({ message: "Invalid app ID" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized to rotate API keys",
      });
      if (!canManage) return;

      const integration = await storage.getIntegrationAppByAppSpaceId(appSpaceId)
        || await storage.createOrUpdateIntegrationApp({ appSpaceId });
      const keyId = `fuk_${crypto.randomBytes(8).toString("hex")}`;
      const secret = `fus_${crypto.randomBytes(24).toString("hex")}`;
      const secretHash = hashSecret(secret);
      const lastFour = secret.slice(-4);

      const key = await storage.rotateIntegrationApiKey(integration.id, keyId, secretHash, lastFour);
      return res.status(201).json({
        key: {
          keyId: key.keyId,
          apiKey: `${keyId}.${secret}`,
          lastFour: key.lastFour,
          createdAt: key.createdAt,
        },
        note: "Store this key now. The secret will not be shown again.",
      });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/integrations/apps/:id/webhook-secret/rotate", requireAuth, async (req, res) => {
    try {
      const appSpaceId = Number(req.params.id);
      if (!Number.isInteger(appSpaceId)) {
        return res.status(400).json({ message: "Invalid app ID" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized to rotate webhook secret",
      });
      if (!canManage) return;

      const integration = await storage.getIntegrationAppByAppSpaceId(appSpaceId)
        || await storage.createOrUpdateIntegrationApp({ appSpaceId });

      const webhookSecret = `fuws_${crypto.randomBytes(24).toString("hex")}`;
      const updated = await storage.rotateIntegrationWebhookSecret(
        integration.id,
        webhookSecret,
        webhookSecret.slice(-4),
      );

      return res.status(201).json({
        webhookSecret: {
          value: webhookSecret,
          lastFour: updated.webhookSecretLastFour,
        },
        note: "Store this webhook secret now. It is shown only once.",
      });
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/integrations/apps/:id/health", requireAuth, async (req, res) => {
    try {
      const appSpaceId = Number(req.params.id);
      if (!Number.isInteger(appSpaceId)) {
        return res.status(400).json({ message: "Invalid app ID" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized to view integration health",
      });
      if (!canManage) return;

      const integration = await storage.getIntegrationAppByAppSpaceId(appSpaceId)
        || await storage.createOrUpdateIntegrationApp({ appSpaceId });
      const health = await storage.getIntegrationHealth(integration.id);
      const warnings: string[] = [];
      if (!health.hasApiKey) warnings.push("No active API key");
      if (!health.hasWebhookSecret) warnings.push("No webhook signing secret");
      if (!health.redirectConfigured) warnings.push("Redirect mode enabled but redirect URL missing");
      if (!health.embeddedConfigured) warnings.push("Embedded mode enabled but allowed origins missing");
      if (!health.hasWebhookUrl) warnings.push("Webhook URL missing");

      return res.json({
        healthy: warnings.length === 0,
        health,
        warnings,
      });
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/integrations/apps/:id/usage-summary", requireAuth, async (req, res) => {
    try {
      const appSpaceId = Number(req.params.id);
      if (!Number.isInteger(appSpaceId)) {
        return res.status(400).json({ message: "Invalid app ID" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized to view integration analytics",
      });
      if (!canManage) return;

      const integration = await storage.getIntegrationAppByAppSpaceId(appSpaceId);
      if (!integration) {
        return res.json({
          sessionsCount: 0,
          totalMinutes: 0,
          avgSessionMinutes: 0,
          liveNowCount: 0,
          pendingCandidateCount: 0,
          approvedCandidateCount: 0,
        });
      }

      const summary = await storage.getIntegrationUsageSummary(integration.id);
      const liveUsers = await storage.getLiveUsersForFounder(appSpaceId, 45);
      const pendingCandidates = await storage.getIntegrationEngagementCandidates(integration.id, "pending");
      const approvedCandidates = await storage.getIntegrationEngagementCandidates(integration.id, "approved");

      return res.json({
        sessionsCount: summary.sessionsCount,
        totalMinutes: summary.totalMinutes,
        avgSessionMinutes: summary.avgSessionMinutes,
        liveNowCount: liveUsers.length,
        pendingCandidateCount: pendingCandidates.length,
        approvedCandidateCount: approvedCandidates.length,
      });
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/integrations/apps/:id/engagement-candidates", requireAuth, async (req, res) => {
    try {
      const appSpaceId = Number(req.params.id);
      if (!Number.isInteger(appSpaceId)) {
        return res.status(400).json({ message: "Invalid app ID" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized to view engagement candidates",
      });
      if (!canManage) return;

      const status = req.query.status === "approved" ? "approved" : "pending";
      const integration = await storage.getIntegrationAppByAppSpaceId(appSpaceId);
      if (!integration) {
        return res.json({ status, candidates: [] });
      }

      const candidates = await storage.getIntegrationEngagementCandidates(integration.id, status);
      return res.json({ status, candidates });
    } catch (error) {
      throw error;
    }
  });

  // ============ PUBLIC INTEGRATION ENTRY ROUTES ============

  app.get("/i/:publicAppId/join", async (req, res) => {
    try {
      const publicAppId = String(req.params.publicAppId || "").trim();
      if (!publicAppId) {
        return res.status(400).json({ message: "Missing public app ID" });
      }

      const integration = await storage.getIntegrationAppByPublicAppId(publicAppId);
      if (!integration) {
        return res.status(404).json({ message: "Integration app not found" });
      }

      const appSpace = await storage.getAppSpace(integration.appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const intentToken = typeof req.query.intent === "string" ? req.query.intent.trim() : "";
      const directReturnTo = typeof req.query.returnTo === "string" ? req.query.returnTo.trim() : "";

      if (intentToken) {
        const intent = await storage.getIntegrationWaitlistIntentByHash(hashSecret(intentToken));
        if (!intent || intent.integrationAppId !== integration.id) {
          return res.status(404).json({ message: "Join intent not found" });
        }
        if (intent.expiresAt.getTime() < Date.now()) {
          return res.status(410).json({ message: "Join intent expired" });
        }
        if (intent.consumedAt) {
          return res.status(409).json({ message: "Join intent already used" });
        }

        req.session.integrationPrefill = {
          integrationAppId: integration.id,
          appSpaceId: appSpace.id,
          appSpaceSlug: appSpace.slug,
          publicAppId: integration.publicAppId,
          externalUserId: intent.externalUserId,
          email: intent.email,
          phone: intent.phone,
          returnTo: intent.returnTo,
          expiresAt: intent.expiresAt.toISOString(),
        };
        await storage.consumeIntegrationWaitlistIntent(intent.id);
      } else if (directReturnTo) {
        req.session.integrationPrefill = {
          integrationAppId: integration.id,
          appSpaceId: appSpace.id,
          appSpaceSlug: appSpace.slug,
          publicAppId: integration.publicAppId,
          externalUserId: null,
          email: null,
          phone: null,
          returnTo: directReturnTo,
          expiresAt: new Date(Date.now() + INTEGRATION_WAITLIST_INTENT_TTL_MS).toISOString(),
        };
      }

      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      return res.redirect(`${getBaseUrl(req)}/join/${integration.publicAppId}`);
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/integration/public/:publicAppId/join-context", async (req, res) => {
    try {
      const publicAppId = String(req.params.publicAppId || "").trim();
      if (!publicAppId) {
        return res.status(400).json({ message: "Missing public app ID" });
      }

      const integration = await storage.getIntegrationAppByPublicAppId(publicAppId);
      if (!integration) {
        return res.status(404).json({ message: "Integration app not found" });
      }
      const appSpace = await storage.getAppSpace(integration.appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const prefill = req.session.integrationPrefill;
      const sessionReturnTo = prefill?.publicAppId === publicAppId ? prefill.returnTo : null;
      const continueUrl = buildUrl(`${getBaseUrl(req)}/space/${appSpace.slug}`, {
        returnTo: sessionReturnTo || undefined,
      });

      return res.json({
        app: {
          publicAppId: integration.publicAppId,
          appSpaceId: appSpace.id,
          appSpaceSlug: appSpace.slug,
          appSpaceName: appSpace.name,
          appSpaceTagline: appSpace.tagline,
        },
        continueUrl,
        modes: {
          redirectEnabled: integration.redirectEnabled,
          embeddedEnabled: integration.embeddedEnabled,
        },
      });
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/integration/prefill", async (req, res) => {
    try {
      const prefill = req.session.integrationPrefill;
      if (!prefill) {
        return res.json({ prefill: null });
      }
      if (new Date(prefill.expiresAt).getTime() < Date.now()) {
        req.session.integrationPrefill = undefined;
        await new Promise<void>((resolve) => req.session.save(() => resolve()));
        return res.json({ prefill: null });
      }
      return res.json({
        prefill: {
          appSpaceId: prefill.appSpaceId,
          email: prefill.email ?? null,
          phone: prefill.phone ?? null,
          externalUserId: prefill.externalUserId ?? null,
          appSpaceSlug: prefill.appSpaceSlug,
          returnTo: prefill.returnTo ?? null,
        },
      });
    } catch (error) {
      throw error;
    }
  });

  app.delete("/api/integration/prefill", async (req, res) => {
    try {
      req.session.integrationPrefill = undefined;
      await new Promise<void>((resolve) => req.session.save(() => resolve()));
      return res.json({ success: true });
    } catch (error) {
      throw error;
    }
  });

  app.get("/i/access/:code", async (req, res) => {
    try {
      const code = String(req.params.code || "").trim();
      if (!code) {
        return res.status(400).json({ message: "Missing access code" });
      }

      const codeHash = hashSecret(code);
      const accessCode = await storage.getIntegrationAccessCodeByHash(codeHash);
      if (!accessCode || accessCode.status !== "issued") {
        return res.status(404).json({ message: "Access code not found or already redeemed" });
      }
      if (accessCode.expiresAt.getTime() < Date.now()) {
        return res.status(410).json({ message: "Access code expired" });
      }

      const integration = await storage.getIntegrationAppById(accessCode.integrationAppId);
      if (!integration) {
        return res.status(404).json({ message: "Integration app not found" });
      }
      const appSpace = await storage.getAppSpace(integration.appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const membership = await storage.getWaitlistMember(appSpace.id, accessCode.firstuserUserId);
      if (!membership || membership.status !== "approved") {
        await storage.expireIssuedIntegrationAccessCodes(integration.id, accessCode.firstuserUserId);
        return res.status(403).json({ message: "Access link is no longer valid for this membership state" });
      }

      // Set FirstUser session so widget/community surfaces can load immediately.
      req.session.userId = accessCode.firstuserUserId;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const requestedTarget = typeof req.query.target === "string" ? req.query.target : undefined;
      const baseUrl = getBaseUrl(req);

      if (requestedTarget && requestedTarget.startsWith("/")) {
        return res.redirect(`${baseUrl}${requestedTarget}`);
      }

      const platform = req.query.platform === "mobile" ? "mobile" : "web";
      if (platform === "mobile" && integration.mobileDeepLinkUrl) {
        return res.redirect(buildUrl(integration.mobileDeepLinkUrl, {
          fu_access_code: code,
          fu_public_app_id: integration.publicAppId,
        }));
      }

      if (integration.webRedirectUrl) {
        return res.redirect(buildUrl(integration.webRedirectUrl, {
          fu_access_code: code,
          fu_public_app_id: integration.publicAppId,
        }));
      }

      return res.redirect(`${baseUrl}/space/${appSpace.slug}/community`);
    } catch (error) {
      throw error;
    }
  });

  app.get("/i/widget/:token", async (req, res) => {
    try {
      const token = String(req.params.token || "").trim();
      const payload = verifyWidgetToken(token);
      if (!payload) {
        return res.status(401).json({ message: "Invalid widget token" });
      }

      const integration = await storage.getIntegrationAppById(payload.integrationAppId);
      if (!integration || integration.appSpaceId !== payload.appSpaceId) {
        return res.status(404).json({ message: "Integration app not found" });
      }

      const appSpace = await storage.getAppSpace(payload.appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      req.session.userId = payload.firstuserUserId;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const target = typeof req.query.target === "string" && req.query.target.startsWith("/")
        ? req.query.target
        : `/widget/live-chat?appSpaceId=${appSpace.id}`;

      return res.redirect(`${getBaseUrl(req)}${target}`);
    } catch (error) {
      throw error;
    }
  });

  // ============ PARTNER SERVER-TO-SERVER API (KEY AUTH) ============

  app.post("/api/integration/v1/waitlist/start", requireIntegrationApiKey, async (req, res) => {
    try {
      const auth = (req as Request & {
        integrationAuth: { integrationAppId: number; appSpaceId: number; publicAppId: string };
      }).integrationAuth;

      const parsed = z.object({
        externalUserId: z.string().min(1).max(200).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(40).optional(),
        returnTo: z.string().max(1024).optional(),
      }).safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid waitlist start payload" });
      }

      const appSpace = await storage.getAppSpace(auth.appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const baseUrl = getBaseUrl(req);
      const intent = await issueIntegrationWaitlistIntent({
        integrationAppId: auth.integrationAppId,
        externalUserId: parsed.data.externalUserId,
        email: parsed.data.email,
        phone: parsed.data.phone,
        returnTo: parsed.data.returnTo,
      });
      const continuationUrl = buildUrl(`${baseUrl}/i/${auth.publicAppId}/join`, {
        intent: intent.token,
      });

      return res.status(201).json({
        continuationUrl,
        hostedJoinUrl: `${baseUrl}/i/${auth.publicAppId}/join`,
        communityUrl: `${baseUrl}/space/${appSpace.slug}`,
        expiresAt: intent.expiresAt.toISOString(),
      });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/integration/v1/access/exchange", requireIntegrationApiKey, async (req, res) => {
    try {
      const auth = (req as Request & {
        integrationAuth: { integrationAppId: number; appSpaceId: number; publicAppId: string };
      }).integrationAuth;

      const parsed = z.object({
        code: z.string().min(10),
        externalUserId: z.string().min(1).max(200),
        clientPlatform: z.string().max(32).optional(),
      }).safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid access exchange payload" });
      }

      const accessCode = await storage.getIntegrationAccessCodeByHash(hashSecret(parsed.data.code));
      if (!accessCode || accessCode.integrationAppId !== auth.integrationAppId) {
        return res.status(404).json({ message: "Access code not found" });
      }
      if (accessCode.status !== "issued") {
        return res.status(409).json({ message: "Access code already redeemed" });
      }
      if (accessCode.expiresAt.getTime() < Date.now()) {
        return res.status(410).json({ message: "Access code expired" });
      }

      const redeemed = await storage.redeemIntegrationAccessCode(accessCode.id);
      if (!redeemed) {
        return res.status(409).json({ message: "Access code already redeemed" });
      }

      const user = await storage.getUser(redeemed.firstuserUserId);
      const member = await storage.getWaitlistMember(auth.appSpaceId, redeemed.firstuserUserId);
      const appSpace = await storage.getAppSpace(auth.appSpaceId);

      if (!member || member.status !== "approved") {
        await storage.expireIssuedIntegrationAccessCodes(auth.integrationAppId, redeemed.firstuserUserId);
        return res.status(403).json({ message: "User is not currently approved for this app" });
      }

      const link = await storage.upsertIntegrationIdentityLink({
        integrationAppId: auth.integrationAppId,
        firstuserUserId: redeemed.firstuserUserId,
        externalUserId: parsed.data.externalUserId,
      });

      await storage.upsertLivePresence({
        appSpaceId: auth.appSpaceId,
        userId: redeemed.firstuserUserId,
        status: "live",
        clientPlatform: parsed.data.clientPlatform ?? "web",
        lastSeenAt: new Date(),
      });

      return res.json({
        linkedIdentity: {
          externalUserId: link.externalUserId,
          firstuserUserId: link.firstuserUserId,
          currentPlanTier: link.currentPlanTier,
        },
        user: {
          id: user?.id ?? redeemed.firstuserUserId,
          username: user?.username ?? null,
          displayName: user?.displayName ?? null,
          avatarUrl: user?.avatarUrl ?? null,
        },
        membership: {
          status: member?.status ?? "pending",
          appSpaceId: auth.appSpaceId,
          appSpaceSlug: appSpace?.slug ?? null,
        },
      });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/integration/v1/usage/heartbeat", requireIntegrationApiKey, async (req, res) => {
    try {
      const auth = (req as Request & {
        integrationAuth: { integrationAppId: number; appSpaceId: number; publicAppId: string };
      }).integrationAuth;

      const parsed = z.object({
        externalUserId: z.string().min(1),
        status: z.enum(["live", "idle", "offline"]).default("live"),
        clientPlatform: z.string().max(32).optional(),
      }).safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid heartbeat payload" });
      }

      const link = await storage.getIntegrationIdentityLinkByExternalUserId(auth.integrationAppId, parsed.data.externalUserId);
      if (!link) {
        return res.status(404).json({ message: "Unknown external user mapping. Exchange access code first." });
      }

      const member = await storage.getWaitlistMember(auth.appSpaceId, link.firstuserUserId);
      const membershipStatus = member?.status === "approved" ? "approved" : "pending";

      await storage.upsertIntegrationUsageHeartbeat({
        integrationAppId: auth.integrationAppId,
        firstuserUserId: link.firstuserUserId,
        membershipStatus,
        clientPlatform: parsed.data.clientPlatform ?? "web",
        status: parsed.data.status,
        at: new Date(),
      });

      if (membershipStatus === "approved") {
        await storage.upsertLivePresence({
          appSpaceId: auth.appSpaceId,
          userId: link.firstuserUserId,
          status: parsed.data.status,
          clientPlatform: parsed.data.clientPlatform ?? "web",
          lastSeenAt: new Date(),
        });
      }

      return res.json({
        success: true,
        membershipStatus,
      });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/integration/v1/users/:externalUserId/plan", requireIntegrationApiKey, async (req, res) => {
    try {
      const auth = (req as Request & {
        integrationAuth: { integrationAppId: number; appSpaceId: number; publicAppId: string };
      }).integrationAuth;
      const externalUserId = String(req.params.externalUserId || "").trim();
      if (!externalUserId) {
        return res.status(400).json({ message: "External user ID required" });
      }

      const parsed = z.object({
        planTier: z.string().min(1).max(80),
      }).safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid plan payload" });
      }

      const existingLink = await storage.getIntegrationIdentityLinkByExternalUserId(auth.integrationAppId, externalUserId);
      if (!existingLink) {
        return res.status(404).json({ message: "Unknown external user mapping" });
      }

      const updated = await storage.upsertIntegrationIdentityLink({
        integrationAppId: auth.integrationAppId,
        firstuserUserId: existingLink.firstuserUserId,
        externalUserId,
        currentPlanTier: parsed.data.planTier,
      });

      const integrationApp = await storage.getIntegrationAppById(auth.integrationAppId);
      const member = await storage.getWaitlistMember(auth.appSpaceId, existingLink.firstuserUserId);
      if (integrationApp && member?.status !== "approved") {
        await sendIntegrationWebhook({
          integrationAppId: integrationApp.id,
          webhookUrl: integrationApp.webhookUrl,
          eventType: "integration.plan.mismatch",
          payload: {
            externalUserId,
            firstuserUserId: existingLink.firstuserUserId,
            planTier: parsed.data.planTier,
            membershipStatus: member?.status ?? "pending",
            message: "Plan was updated for a user who is not currently approved.",
          },
        });
      }

      return res.json({
        success: true,
        externalUserId: updated.externalUserId,
        currentPlanTier: updated.currentPlanTier,
      });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/integration/v1/chat/widget-token", requireIntegrationApiKey, async (req, res) => {
    try {
      const auth = (req as Request & {
        integrationAuth: { integrationAppId: number; appSpaceId: number; publicAppId: string };
      }).integrationAuth;

      const parsed = z.object({
        externalUserId: z.string().min(1),
      }).safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid widget token payload" });
      }

      const link = await storage.getIntegrationIdentityLinkByExternalUserId(auth.integrationAppId, parsed.data.externalUserId);
      if (!link) {
        return res.status(404).json({ message: "Unknown external user mapping" });
      }

      const member = await storage.getWaitlistMember(auth.appSpaceId, link.firstuserUserId);
      if (!member || member.status !== "approved") {
        return res.status(403).json({ message: "Approved membership required for live chat widget" });
      }

      const exp = Date.now() + INTEGRATION_WIDGET_TOKEN_TTL_MS;
      const token = createWidgetToken({
        integrationAppId: auth.integrationAppId,
        firstuserUserId: link.firstuserUserId,
        appSpaceId: auth.appSpaceId,
        exp,
      });
      const appSpace = await storage.getAppSpace(auth.appSpaceId);
      const fallbackTarget = appSpace ? `/widget/live-chat?appSpaceId=${appSpace.id}` : "/widget/live-chat";
      const widgetUrl = `${getBaseUrl(req)}/i/widget/${token}?target=${encodeURIComponent(fallbackTarget)}`;

      return res.json({
        token,
        expiresAt: new Date(exp).toISOString(),
        widgetUrl,
      });
    } catch (error) {
      throw error;
    }
  });

  // ============ LIVE PRESENCE + LIVE CHAT INTEGRATION API ============

  app.get("/api/integrations/apps/:id/live-users", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      if (Number.isNaN(appSpaceId)) {
        return res.status(400).json({ message: "Invalid app ID" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized to view live users",
      });
      if (!canManage) return;

      const liveUsers = await storage.getLiveUsersForFounder(appSpaceId, 45);
      return res.json({
        liveUsers,
        heartbeatIntervalSeconds: 15,
        liveTimeoutSeconds: 45,
      });
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/integrations/apps/:id/live-chats", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      if (Number.isNaN(appSpaceId)) {
        return res.status(400).json({ message: "Invalid app ID" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const userId = req.session.userId!;
      const canManage = await hasFounderManagementAccess(userId, appSpace);
      const member = await storage.getWaitlistMember(appSpaceId, userId);
      const isApprovedMember = member?.status === "approved";

      if (!canManage && !isApprovedMember) {
        return res.status(403).json({ message: "Approved membership required" });
      }

      const threads = await storage.getLiveChatThreadsForUser(appSpaceId, userId);
      return res.json({ threads });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/integrations/apps/:id/live-chats", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      if (Number.isNaN(appSpaceId)) {
        return res.status(400).json({ message: "Invalid app ID" });
      }

      const parsed = z.object({
        memberUserId: z.string().min(1),
      }).safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid live chat payload" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const canManage = await ensureFounderManagementAccess({
        req,
        res,
        appSpace,
        message: "Not authorized to start live chats",
      });
      if (!canManage) return;

      const member = await storage.getWaitlistMember(appSpaceId, parsed.data.memberUserId);
      if (!member || member.status !== "approved") {
        return res.status(400).json({ message: "Live chat requires an approved member" });
      }

      const presence = await storage.getLivePresenceByUser(appSpaceId, parsed.data.memberUserId);
      const preference = await storage.getUserLivePreference(parsed.data.memberUserId);
      const withinTimeout = presence?.lastSeenAt ? (Date.now() - presence.lastSeenAt.getTime()) <= 45_000 : false;
      const visibleToFounders = preference?.showLiveToFounders ?? true;

      if (!presence || presence.status !== "live" || !withinTimeout || !visibleToFounders) {
        return res.status(400).json({ message: "Member is not currently live and visible" });
      }

      const founderUserId = req.session.userId!;
      const thread = await storage.getOrCreateLiveChatThread(appSpaceId, founderUserId, parsed.data.memberUserId);
      return res.status(201).json({ thread });
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/integrations/apps/:id/live-chats/:threadId/messages", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const threadId = parseInt(req.params.threadId as string);
      if (Number.isNaN(appSpaceId) || Number.isNaN(threadId)) {
        return res.status(400).json({ message: "Invalid IDs" });
      }

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const thread = await storage.getLiveChatThreadById(threadId);
      if (!thread || thread.appSpaceId !== appSpaceId) {
        return res.status(404).json({ message: "Live chat thread not found" });
      }

      const userId = req.session.userId!;
      const isParticipant = await storage.isLiveChatParticipant(threadId, userId);
      if (!isParticipant) {
        return res.status(403).json({ message: "You are not a participant in this live chat" });
      }

      const before = req.query.before ? parseInt(req.query.before as string) : undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const messages = await storage.getLiveChatMessages(threadId, limit, before);
      return res.json({ thread, messages });
    } catch (error) {
      throw error;
    }
  });

  app.post("/api/integrations/apps/:id/live-chats/:threadId/messages", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const threadId = parseInt(req.params.threadId as string);
      if (Number.isNaN(appSpaceId) || Number.isNaN(threadId)) {
        return res.status(400).json({ message: "Invalid IDs" });
      }

      const parsed = z.object({
        body: z.string().min(1).max(2000),
      }).safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid message payload" });
      }

      const thread = await storage.getLiveChatThreadById(threadId);
      if (!thread || thread.appSpaceId !== appSpaceId) {
        return res.status(404).json({ message: "Live chat thread not found" });
      }

      const userId = req.session.userId!;
      const isParticipant = await storage.isLiveChatParticipant(threadId, userId);
      if (!isParticipant) {
        return res.status(403).json({ message: "You are not a participant in this live chat" });
      }

      if (thread.memberUserId === userId) {
        const member = await storage.getWaitlistMember(appSpaceId, userId);
        if (!member || member.status !== "approved") {
          return res.status(403).json({ message: "Approved membership required to reply" });
        }
      }

      const message = await storage.createLiveChatMessage({
        threadId,
        senderUserId: userId,
        body: parsed.data.body.trim(),
      });

      const sender = await storage.getUser(userId);
      const recipientUserId = thread.memberUserId === userId ? thread.founderUserId : thread.memberUserId;

      await createAndEmitNotification({
        userId: recipientUserId,
        type: "dm",
        data: {
          appSpaceId,
          liveThreadId: threadId,
          senderName: sender?.displayName || sender?.username || "Someone",
        },
      });

      return res.status(201).json({
        message: {
          ...message,
          sender: {
            id: sender?.id ?? userId,
            username: sender?.username ?? null,
            displayName: sender?.displayName ?? null,
            avatarUrl: sender?.avatarUrl ?? null,
          },
        },
      });
    } catch (error) {
      throw error;
    }
  });

  // ============ CHAT API ROUTES ============

  app.get("/api/appspaces/:id/waitlist-mode", requireAppSpaceFounder(), async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      if (Number.isNaN(appSpaceId)) {
        return res.status(400).json({ message: "Invalid appspace ID" });
      }

      let channelsList = await storage.getChannels(appSpaceId);
      if (channelsList.length === 0) {
        channelsList = await storage.createDefaultChannels(appSpaceId, { waitlistMode: "forum-waitlist" });
      }

      const mode = resolveWaitlistModeFromChannels(channelsList);
      return res.json({ mode });
    } catch (error) {
      throw error;
    }
  });

  app.patch("/api/appspaces/:id/waitlist-mode", requireAppSpaceFounder(), async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      if (Number.isNaN(appSpaceId)) {
        return res.status(400).json({ message: "Invalid appspace ID" });
      }

      const parsed = z.object({
        mode: z.enum(WAITLIST_MODE_VALUES),
      }).safeParse(req.body || {});

      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid waitlist mode payload" });
      }

      const targetMode: WaitlistMode = parsed.data.mode;
      let channelsList = await storage.getChannels(appSpaceId);

      if (channelsList.length === 0) {
        channelsList = await storage.createDefaultChannels(appSpaceId, { waitlistMode: targetMode });
        return res.json({ mode: targetMode, channels: channelsList });
      }

      const waitlistChannels = channelsList.filter((channel) => channel.isWaitlistersOnly);
      const modeConfig = targetMode === "forum-waitlist"
        ? { name: "forum-waitlist", type: "forum", description: "Forum posts for waitlist members" }
        : { name: "chat-waitlist", type: "chat", description: "Live chat for waitlist members" };

      if (waitlistChannels.length === 0) {
        const created = await storage.createChannel({
          appSpaceId,
          name: modeConfig.name,
          type: modeConfig.type,
          description: modeConfig.description,
          isWaitlistersOnly: true,
          isLocked: false,
          isReadOnly: false,
        });
        return res.json({ mode: targetMode, channels: [...channelsList, created] });
      }

      const preferredExisting = waitlistChannels.find((channel) =>
        WAITLIST_MODE_VALUES.includes(channel.name as WaitlistMode),
      );
      const primaryWaitlistChannel = preferredExisting ?? waitlistChannels[0];

      const updatedPrimary = await storage.updateChannel(primaryWaitlistChannel.id, {
        name: modeConfig.name,
        type: modeConfig.type,
        description: modeConfig.description,
        isWaitlistersOnly: true,
      });

      const refreshedChannels = await storage.getChannels(appSpaceId);

      return res.json({
        mode: targetMode,
        primaryChannel: updatedPrimary ?? primaryWaitlistChannel,
        channels: refreshedChannels,
      });
    } catch (error) {
      throw error;
    }
  });

  // Get channels for an appspace (supports spectator mode for unauthenticated users)
  app.get("/api/appspaces/:id/channels", async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const userId = req.session?.userId;

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      let channelsList = await storage.getChannels(appSpaceId);

      // If no channels exist, create default ones
      if (channelsList.length === 0) {
        channelsList = await storage.createDefaultChannels(appSpaceId, { waitlistMode: "forum-waitlist" });
      }

      // Spectator mode: show all channels (spectators can see locked channels with lock icons)
      if (!userId) {
        // Show all channels except waitlisters-only for spectators
        const spectatorChannels = channelsList.filter(channel => !channel.isWaitlistersOnly);
        return res.json({
          channels: spectatorChannels,
          memberStatus: null,
          isFounder: false,
        });
      }

      // Authenticated user - check membership and status
      const member = await storage.getWaitlistMember(appSpaceId, userId);
      const user = await storage.getUser(userId);
      const isFounder = appSpace.founderId === userId || user?.hasFounderAccess;
      const isApproved = member?.status === "approved";
      const isPending = member?.status === "pending";

      // Show all channels to authenticated users - frontend handles displaying lock icons
      // Filter out only waitlisters-only channels for non-waitlist members
      const accessibleChannels = channelsList.filter(channel => {
        if (isFounder) return true; // Founder sees all
        // Show all public channels to everyone (non-waitlisters-only)
        // Waitlisters-only channels only for pending members
        if (channel.isWaitlistersOnly && member?.status !== "pending") return false;
        return true;
      });

      return res.json({
        channels: accessibleChannels,
        memberStatus: member?.status || null,
        isFounder,
      });
    } catch (error) {
      throw error;
    }
  });

  // Get members for an appspace
  app.get("/api/appspaces/:id/members", async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const userId = req.session?.userId;

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      // Get all waitlist members for this app space
      const waitlistMembers = await storage.getWaitlistMembers(appSpaceId);

      // Get founder info
      const founder = await storage.getUser(appSpace.founderId);

      // Build members list
      const members: Array<{
        id: string;
        username: string | null;
        displayName: string | null;
        avatarUrl: string | null;
        status: "pending" | "approved";
        badgeTier: string | null;
        isFounder: boolean;
      }> = [];

      // Add founder first
      if (founder) {
        members.push({
          id: founder.id,
          username: founder.username,
          displayName: founder.displayName,
          avatarUrl: founder.avatarUrl,
          status: "approved",
          badgeTier: null,
          isFounder: true,
        });
      }

      // Add other members
      for (const member of waitlistMembers) {
        // Skip if this is the founder (already added)
        if (member.userId === appSpace.founderId) continue;

        const user = await storage.getUser(member.userId);
        if (user) {
          members.push({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            status: member.status as "pending" | "approved",
            badgeTier: member.badgeTier,
            isFounder: false,
          });
        }
      }

      return res.json({ members });
    } catch (error) {
      throw error;
    }
  });

  // Create a new channel (founder only)
  app.post("/api/appspaces/:id/channels", requireAppSpaceFounder(), async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const { name, description, type, isLocked, isWaitlistersOnly, isReadOnly } = req.body;

      if (!name || name.length > 50) {
        return res.status(400).json({ message: "Channel name is required and must be 50 characters or less" });
      }

      const channel = await storage.createChannel({
        appSpaceId,
        name: name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        description: description || null,
        type: type || "chat",
        isLocked: isLocked || false,
        isWaitlistersOnly: isWaitlistersOnly || false,
        isReadOnly: isReadOnly || false,
      });

      return res.status(201).json(channel);
    } catch (error) {
      throw error;
    }
  });

  // Get messages from a channel
  // Public read-only message preview (spectator mode).
  // This is intentionally restricted so we don't accidentally make every community public.
  app.get("/api/channels/:channelId/messages/public", async (req, res) => {
    try {
      const channelId = parseInt(req.params.channelId as string);
      const before = req.query.before ? parseInt(req.query.before as string) : undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const channel = await storage.getChannel(channelId);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }

      const appSpace = await storage.getAppSpace(channel.appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      // Only allow public preview for the FirstUser community for now.
      if (appSpace.slug !== "firstuser") {
        return res.status(403).json({ message: "Public preview not available for this community" });
      }

      // Only allow previewing truly public channels.
      if (channel.isLocked || channel.isWaitlistersOnly) {
        return res.status(403).json({ message: "This channel is not publicly viewable" });
      }

      const messages = await storage.getMessages(channelId, limit, before);
      return res.json({ messages, channelId });
    } catch (error) {
      throw error;
    }
  });

  app.get("/api/channels/:channelId/messages", requireAuth, async (req, res) => {
    try {
      const channelId = parseInt(req.params.channelId as string);
      const userId = req.session.userId!;
      const before = req.query.before ? parseInt(req.query.before as string) : undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const channel = await storage.getChannel(channelId);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }

      // Check access to channel
      const member = await storage.getWaitlistMember(channel.appSpaceId, userId);
      const appSpace = await storage.getAppSpace(channel.appSpaceId);
      const user = await storage.getUser(userId);
      const isFounder = appSpace?.founderId === userId || user?.hasFounderAccess;

      if (!isFounder && !member) {
        return res.status(403).json({ message: "You must be a member to view messages" });
      }

      if (channel.isWaitlistersOnly && member?.status !== "pending" && !isFounder) {
        return res.status(403).json({ message: "This channel is for waitlist members only" });
      }

      if (channel.isLocked && member?.status !== "approved" && !isFounder) {
        return res.status(403).json({ message: "This channel requires approved membership" });
      }

      const messages = await storage.getMessages(channelId, limit, before);
      return res.json({ messages, channelId });
    } catch (error) {
      throw error;
    }
  });

  // Send a message to a channel
  app.post("/api/channels/:channelId/messages", requireAuth, async (req, res) => {
    try {
      const channelId = parseInt(req.params.channelId as string);
      const userId = req.session.userId!;
      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Message content is required" });
      }

      if (content.length > 2000) {
        return res.status(400).json({ message: "Message must be 2000 characters or less" });
      }

      const channel = await storage.getChannel(channelId);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }

      // Check access
      const member = await storage.getWaitlistMember(channel.appSpaceId, userId);
      const appSpace = await storage.getAppSpace(channel.appSpaceId);
      const user = await storage.getUser(userId);
      const isFounder = appSpace?.founderId === userId || user?.hasFounderAccess;

      if (!isFounder && !member) {
        return res.status(403).json({ message: "You must be a member to send messages" });
      }

      // Pending users cannot send messages - they can only view
      if (!isFounder && member?.status === "pending") {
        return res.status(403).json({ message: "You need to be approved to chat. You can view messages while waiting." });
      }

      if (channel.isReadOnly && !isFounder) {
        return res.status(403).json({ message: "This channel is read-only" });
      }

      if (channel.isLocked && member?.status !== "approved" && !isFounder) {
        return res.status(403).json({ message: "This channel requires approved membership" });
      }

      const message = await storage.createMessage({
        channelId,
        userId,
        content: content.trim(),
        isPinned: false,
      });

      // Get user info for response
      const messageWithUser = {
        ...message,
        user: {
          id: user!.id,
          username: user!.username,
          displayName: user!.displayName,
          avatarUrl: user!.avatarUrl,
        },
      };

      return res.status(201).json(messageWithUser);
    } catch (error) {
      throw error;
    }
  });

  // ============ DM API ROUTES ============

  // Get user's DM conversations for an app space
  app.get("/api/appspaces/:id/conversations", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const userId = req.session.userId!;

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const conversationsList = await storage.getConversations(userId, appSpaceId);

      // Get founder info for this app space
      const founder = await storage.getUser(appSpace.founderId);

      return res.json({
        conversations: conversationsList,
        founder: founder ? {
          id: founder.id,
          username: founder.username,
          displayName: founder.displayName,
          avatarUrl: founder.avatarUrl,
        } : null,
      });
    } catch (error) {
      throw error;
    }
  });

  // Start or get existing conversation
  app.post("/api/appspaces/:id/conversations", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const userId = req.session.userId!;
      const { participantIds } = req.body as { participantIds: string[] };

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      // Check if user is a member
      const member = await storage.getWaitlistMember(appSpaceId, userId);
      const user = await storage.getUser(userId);
      const isFounder = appSpace.founderId === userId || user?.hasFounderAccess;

      if (!member && !isFounder) {
        return res.status(403).json({ message: "You must be a member to start conversations" });
      }

      // Pending users cannot DM
      if (member?.status === "pending" && !isFounder) {
        return res.status(403).json({ message: "Sorry you must be accepted into the app in order to use this feature" });
      }

      // Ensure the current user is included in participants
      const allParticipants = Array.from(new Set([userId, ...participantIds]));

      if (allParticipants.length < 2) {
        return res.status(400).json({ message: "A conversation requires at least 2 participants" });
      }

      const conversation = await storage.getOrCreateConversation(allParticipants, appSpaceId);
      const participants = await storage.getConversationParticipants(conversation.id);

      return res.json({ conversation, participants });
    } catch (error) {
      throw error;
    }
  });

  // Get or create conversation with founder (convenience endpoint)
  app.post("/api/appspaces/:id/conversations/founder", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const userId = req.session.userId!;

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      // Check if user is a member
      const member = await storage.getWaitlistMember(appSpaceId, userId);
      const user = await storage.getUser(userId);
      const isFounder = appSpace.founderId === userId || user?.hasFounderAccess;

      if (!member && !isFounder) {
        return res.status(403).json({ message: "You must be a member to message the founder" });
      }

      // Pending users cannot DM
      if (member?.status === "pending" && !isFounder) {
        return res.status(403).json({ message: "Sorry you must be accepted into the app in order to use this feature" });
      }

      // Cannot message yourself
      if (userId === appSpace.founderId) {
        return res.status(400).json({ message: "You cannot message yourself" });
      }

      const result = await storage.getOrCreateFounderConversation(userId, appSpaceId);
      const participants = await storage.getConversationParticipants(result.id);

      return res.json({ conversation: result, participants });
    } catch (error) {
      throw error;
    }
  });

  // Get messages from a conversation
  app.get("/api/conversations/:conversationId/messages", requireAuth, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.conversationId as string);
      const userId = req.session.userId!;
      const before = req.query.before ? parseInt(req.query.before as string) : undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Check if user is a participant
      const isParticipant = await storage.isConversationParticipant(conversationId, userId);
      if (!isParticipant) {
        return res.status(403).json({ message: "You are not a participant of this conversation" });
      }

      const messages = await storage.getDirectMessages(conversationId, limit, before);
      return res.json({ messages, conversationId });
    } catch (error) {
      throw error;
    }
  });

  // Send a DM
  app.post("/api/conversations/:conversationId/messages", requireAuth, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.conversationId as string);
      const userId = req.session.userId!;
      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Message content is required" });
      }

      if (content.length > 2000) {
        return res.status(400).json({ message: "Message must be 2000 characters or less" });
      }

      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Check if user is a participant
      const isParticipant = await storage.isConversationParticipant(conversationId, userId);
      if (!isParticipant) {
        return res.status(403).json({ message: "You are not a participant of this conversation" });
      }

      // Check membership status (pending users cannot send DMs)
      const appSpace = await storage.getAppSpace(conversation.appSpaceId);
      const member = await storage.getWaitlistMember(conversation.appSpaceId, userId);
      const user = await storage.getUser(userId);
      const isFounder = appSpace?.founderId === userId || user?.hasFounderAccess;

      if (!isFounder && member?.status === "pending") {
        return res.status(403).json({ message: "Sorry you must be accepted into the app in order to use this feature" });
      }

      const message = await storage.sendDirectMessage(conversationId, userId, content.trim());

      // Get user info for response
      const messageWithUser = {
        ...message,
        user: {
          id: user!.id,
          username: user!.username,
          displayName: user!.displayName,
          avatarUrl: user!.avatarUrl,
        },
      };

      const participants = await storage.getConversationParticipants(conversationId);
      const recipientIds = participants.map((participant) => participant.id).filter((id) => id !== userId);
      await Promise.all(recipientIds.map((recipientId) =>
        createAndEmitNotification({
          userId: recipientId,
          type: "dm",
          data: {
            senderName: user?.displayName || user?.username || "Someone",
            conversationId,
            appSpaceId: conversation.appSpaceId,
          },
        })
      ));

      return res.status(201).json(messageWithUser);
    } catch (error) {
      throw error;
    }
  });

  // ============ UNREAD COUNTS & CHANNEL READ TRACKING ============

  // Get unread counts for all channels in an app space
  app.get("/api/appspaces/:id/unread-counts", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const userId = req.session.userId!;

      const appSpace = await storage.getAppSpace(appSpaceId);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      const member = await storage.getWaitlistMember(appSpaceId, userId);
      const user = await storage.getUser(userId);
      const isFounder = appSpace.founderId === userId || user?.hasFounderAccess;
      if (!member && !isFounder) {
        return res.status(403).json({ message: "Not authorized for this community" });
      }

      const channelsList = await storage.getChannels(appSpaceId);
      const visibleChannelIds = new Set(
        channelsList
          .filter((channel) => {
            if (isFounder) return true;
            if (channel.isWaitlistersOnly) return member?.status === "pending";
            return true;
          })
          .map((channel) => channel.id),
      );

      const allCounts = await storage.getUnreadCountsForUser(userId, appSpaceId);
      const counts = Object.fromEntries(
        Object.entries(allCounts).filter(([channelId]) => visibleChannelIds.has(Number(channelId))),
      );
      return res.json({ counts });
    } catch (error) {
      throw error;
    }
  });

  // Mark a channel as read
  app.post("/api/channels/:channelId/read", requireAuth, async (req, res) => {
    try {
      const channelId = parseInt(req.params.channelId as string);
      const userId = req.session.userId!;

      await storage.markChannelRead(userId, channelId);
      return res.json({ success: true });
    } catch (error) {
      throw error;
    }
  });

  // ============ MESSAGE REACTIONS ============

  // Add reaction to a message
  app.post("/api/messages/:messageId/reactions", requireAuth, async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId as string);
      const userId = req.session.userId!;
      const { emoji } = req.body;

      if (!emoji || typeof emoji !== "string") {
        return res.status(400).json({ message: "Emoji is required" });
      }

      const message = await storage.getMessage(messageId);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      const channel = await storage.getChannel(message.channelId);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }

      // Check membership
      const member = await storage.getWaitlistMember(channel.appSpaceId, userId);
      const appSpace = await storage.getAppSpace(channel.appSpaceId);
      const user = await storage.getUser(userId);
      const isFounder = appSpace?.founderId === userId || user?.hasFounderAccess;

      if (!member && !isFounder) {
        return res.status(403).json({ message: "You must be a member to react" });
      }

      const reaction = await storage.addReaction(messageId, userId, emoji);
      return res.json(reaction);
    } catch (error) {
      throw error;
    }
  });

  // Remove reaction from a message
  app.delete("/api/messages/:messageId/reactions/:emoji", requireAuth, async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId as string);
      const userId = req.session.userId!;
      const emoji = decodeURIComponent(req.params.emoji as string);

      const removed = await storage.removeReaction(messageId, userId, emoji);
      return res.json({ success: removed });
    } catch (error) {
      throw error;
    }
  });

  // Get reactions for a message
  app.get("/api/messages/:messageId/reactions", async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId as string);
      const reactions = await storage.getMessageReactions(messageId);
      return res.json({ reactions });
    } catch (error) {
      throw error;
    }
  });

  // ============ NOTIFICATIONS ============

  // Get user's notifications
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const notificationsList = await storage.getNotifications(userId, limit);
      const unreadCount = await storage.getUnreadNotificationCount(userId);

      return res.json({ notifications: notificationsList, unreadCount });
    } catch (error) {
      throw error;
    }
  });

  // Mark notification as read
  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id as string);
      const userId = req.session.userId!;

      await storage.markNotificationRead(notificationId, userId);
      return res.json({ success: true });
    } catch (error) {
      throw error;
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      await storage.markAllNotificationsRead(userId);
      return res.json({ success: true });
    } catch (error) {
      throw error;
    }
  });

  // ============ APP SPACE DRAFTS (AUTO-SAVE) ============

  // Save draft
  app.post("/api/appspaces/draft", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { data } = req.body;

      if (!data) {
        return res.status(400).json({ message: "Draft data is required" });
      }

      const draft = await storage.saveDraft(userId, JSON.stringify(data));
      return res.json({ draft });
    } catch (error) {
      throw error;
    }
  });

  // Get draft
  app.get("/api/appspaces/draft", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const draft = await storage.getDraft(userId);

      if (!draft) {
        return res.json({ draft: null });
      }

      return res.json({
        draft: {
          ...draft,
          data: JSON.parse(draft.data),
        }
      });
    } catch (error) {
      throw error;
    }
  });

  // Delete draft
  app.delete("/api/appspaces/draft", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      await storage.deleteDraft(userId);
      return res.json({ success: true });
    } catch (error) {
      throw error;
    }
  });

  // ============ ADMIN IDEAS BACKLOG ============

  // Get all ideas (admin only - check hasFounderAccess and specific user)
  app.get("/api/admin/ideas", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);

      // Only the main FirstUser founder can access this
      if (!user?.hasFounderAccess) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const ideas = await storage.getAdminIdeas();
      return res.json({ ideas });
    } catch (error) {
      throw error;
    }
  });

  // Create idea
  app.post("/api/admin/ideas", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);

      if (!user?.hasFounderAccess) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { title, description, priority, status } = req.body;

      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      const idea = await storage.createAdminIdea({
        title,
        description: description || null,
        priority: priority || "medium",
        status: status || "idea",
      });

      return res.status(201).json(idea);
    } catch (error) {
      throw error;
    }
  });

  // Update idea
  app.patch("/api/admin/ideas/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);

      if (!user?.hasFounderAccess) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const ideaId = parseInt(req.params.id as string);
      const { title, description, priority, status } = req.body;

      const idea = await storage.updateAdminIdea(ideaId, {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(priority && { priority }),
        ...(status && { status }),
      });

      return res.json(idea);
    } catch (error) {
      throw error;
    }
  });

  // Delete idea
  app.delete("/api/admin/ideas/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);

      if (!user?.hasFounderAccess) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const ideaId = parseInt(req.params.id as string);
      await storage.deleteAdminIdea(ideaId);

      return res.json({ success: true });
    } catch (error) {
      throw error;
    }
  });

  // ============ MESSAGE SEARCH ============

  app.get("/api/appspaces/:id/messages/search", requireAuth, async (req, res) => {
    try {
      const appSpaceId = parseInt(req.params.id as string);
      const userId = req.session.userId!;
      const query = req.query.q as string;

      if (!query || query.length < 2) {
        return res.status(400).json({ message: "Search query must be at least 2 characters" });
      }

      const messages = await storage.searchMessages(userId, appSpaceId, query);
      return res.json({ messages });
    } catch (error) {
      throw error;
    }
  });

  return httpServer;
}
