import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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
    const user = await storage.getUser(userId);
    if (appSpace.founderId !== userId && !user?.hasFounderAccess) {
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
  app.patch("/api/founder/appspaces/:slug", requireFounder, async (req, res) => {
    try {
      const slug = req.params.slug as string;
      const updates = req.body;

      const appSpace = await storage.getAppSpaceBySlug(slug);
      if (!appSpace) {
        return res.status(404).json({ message: "AppSpace not found" });
      }

      // Check if user is the founder of this appspace or has founder access
      const user = await storage.getUser(req.session.userId!);
      if (appSpace.founderId !== req.session.userId && !user?.hasFounderAccess) {
        return res.status(403).json({ message: "Not authorized to edit this appspace" });
      }

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
  app.post("/api/founder/users/:userId/award-badge", requireFounder, async (req, res) => {
    try {
      const userId = req.params.userId as string;
      const { badgeTier, appSpaceId } = req.body;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user is already a member
      let member = await storage.getWaitlistMember(appSpaceId, userId);

      if (!member) {
        // Add user to waitlist with the specified badge tier
        const position = await storage.getNextPosition(appSpaceId);
        member = await storage.joinWaitlist({
          appSpaceId,
          userId,
          position,
          badgeTier: badgeTier || getBadgeTier(position),
          isActive: true,
        });
      } else {
        // Update badge tier
        member = await storage.updateWaitlistMemberBadge(appSpaceId, userId, badgeTier);
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
        return res.status(500).json({ message: result.error || "Failed to send email" });
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
      const data = insertAppSpaceSchema.parse({
        ...req.body,
        founderId: req.session.userId
      });
      
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
      
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser?.hasFounderAccess && appSpace.founderId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized to manage members" });
      }
      
      const existingMember = await storage.getWaitlistMember(appSpaceId, targetUserId);
      if (!existingMember) {
        return res.status(404).json({ message: "Waitlist member not found" });
      }
      
      if (status) {
        await storage.updateWaitlistMemberStatus(appSpaceId, targetUserId, status);
        
        if (status === "approved") {
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
            },
          });

          const user = await storage.getUser(targetUserId);
          if (user?.phoneVerified && user?.phone) {
            const { sendSMS } = await import("./sms");
            const message = appSpace.slug === "firstuser"
              ? `You've been approved to create on FirstUser! 🎉 Start building your waitlist now.`
              : `🎉 You've been approved to ${appSpace.name}! You now have full access.`;
            await sendSMS(user.phone, message);
          }
        }

        if (status === "rejected") {
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
      
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser?.hasFounderAccess && appSpace.founderId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized to manage members" });
      }
      
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
              },
            });

            const user = await storage.getUser(userId);
            if (user?.phoneVerified && user?.phone) {
              const { sendSMS } = await import("./sms");
              const message = appSpace.slug === "firstuser"
                ? `You've been approved to create on FirstUser! 🎉`
                : `🎉 You've been approved to ${appSpace.name}!`;
              await sendSMS(user.phone, message);
            }
          }

          if (status === "rejected") {
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
      
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser?.hasFounderAccess && appSpace.founderId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized to view members" });
      }
      
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
      
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser?.hasFounderAccess && appSpace.founderId !== req.session.userId) {
        return res.status(403).json({ message: "Only founders can create announcements" });
      }
      
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
      
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser?.hasFounderAccess && appSpace.founderId !== req.session.userId) {
        return res.status(403).json({ message: "Only founders can delete announcements" });
      }
      
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
      
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser?.hasFounderAccess && appSpace.founderId !== req.session.userId) {
        return res.status(403).json({ message: "Only founders can create polls" });
      }
      
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
      
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser?.hasFounderAccess && appSpace.founderId !== req.session.userId) {
        return res.status(403).json({ message: "Only founders can award badges" });
      }
      
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

      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser?.hasFounderAccess && appSpace.founderId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

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

      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser?.hasFounderAccess && appSpace.founderId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

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

      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser?.hasFounderAccess && appSpace.founderId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

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

      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser?.hasFounderAccess && appSpace.founderId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

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

      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser?.hasFounderAccess && appSpace.founderId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

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
      
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser?.hasFounderAccess && appSpace.founderId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
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

  // ============ CHAT API ROUTES ============

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
        channelsList = await storage.createDefaultChannels(appSpaceId);
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
        // Waitlisters-only channels only for actual waitlist members
        if (channel.isWaitlistersOnly && !member) return false;
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

      const counts = await storage.getUnreadCountsForUser(userId, appSpaceId);
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
