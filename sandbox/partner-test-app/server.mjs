import express from "express";
import session from "express-session";
import crypto from "crypto";

const PORT = Number(process.env.PARTNER_PORT || 5051);
const FIRSTUSER_BASE_URL = normalizeBaseUrl(process.env.FIRSTUSER_BASE_URL || "http://localhost:5000");
const PARTNER_APP_BASE_URL = normalizeBaseUrl(process.env.PARTNER_APP_BASE_URL || `http://localhost:${PORT}`);
const FIRSTUSER_PUBLIC_APP_ID = String(process.env.FIRSTUSER_PUBLIC_APP_ID || "").trim();
const FIRSTUSER_API_KEY = String(process.env.FIRSTUSER_API_KEY || "").trim();
const FIRSTUSER_WEBHOOK_SECRET = String(process.env.FIRSTUSER_WEBHOOK_SECRET || "").trim();
const PARTNER_SESSION_SECRET = String(process.env.PARTNER_SESSION_SECRET || "partner-test-app-dev-secret");

const localUsers = new Map();
const webhookEvents = [];
const accessLinks = [];

const app = express();
app.set("trust proxy", 1);
app.use(express.urlencoded({ extended: true }));
app.use(session({
  name: "partner-test-app.sid",
  secret: PARTNER_SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.post("/webhooks/firstuser", express.raw({ type: "application/json" }), (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ""));
  const signature = getSignatureHeader(req);

  let validSignature = false;
  if (FIRSTUSER_WEBHOOK_SECRET && signature) {
    const expected = crypto.createHmac("sha256", FIRSTUSER_WEBHOOK_SECRET).update(rawBody).digest("hex");
    validSignature = safeTimingEqual(signature, expected);
  }

  let parsed = null;
  try {
    parsed = JSON.parse(rawBody.toString("utf8"));
  } catch {
    parsed = { type: "invalid_json", data: { raw: rawBody.toString("utf8") } };
  }

  const receivedAt = new Date().toISOString();
  const event = {
    id: crypto.randomUUID(),
    receivedAt,
    validSignature,
    type: parsed?.type || "unknown",
    data: parsed?.data || null,
  };

  webhookEvents.unshift(event);
  if (webhookEvents.length > 100) webhookEvents.length = 100;

  const browserAccessUrl = parsed?.data?.access?.browserAccessUrl;
  if (typeof browserAccessUrl === "string" && browserAccessUrl) {
    accessLinks.unshift({
      id: crypto.randomUUID(),
      receivedAt,
      eventType: parsed.type || "unknown",
      browserAccessUrl,
      expiresAt: parsed?.data?.access?.expiresAt || null,
      firstuserUserId: parsed?.data?.user?.id || null,
      username: parsed?.data?.user?.username || null,
      displayName: parsed?.data?.user?.displayName || null,
    });
    if (accessLinks.length > 100) accessLinks.length = 100;
  }

  if (!validSignature) {
    return res.status(401).json({ received: true, validSignature: false });
  }

  return res.status(200).json({ received: true, validSignature: true });
});

app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "partner-test-app", timestamp: new Date().toISOString() });
});

app.get("/api/debug/state", (req, res) => {
  const localUser = getCurrentLocalUser(req);
  res.json({
    config: safeConfig(),
    session: {
      localExternalUserId: req.session.localExternalUserId || null,
      flash: req.session.flash || null,
    },
    localUser,
    webhookEvents: webhookEvents.slice(0, 20),
    accessLinks: accessLinks.slice(0, 20),
  });
});

app.post("/local-user/login", (req, res) => {
  const externalUserId = String(req.body.externalUserId || "").trim();
  const displayName = String(req.body.displayName || "").trim();

  if (!externalUserId) {
    setFlash(req, "error", "Please enter a local external user ID.");
    return res.redirect("/");
  }

  const user = localUsers.get(externalUserId) || {
    externalUserId,
    displayName: displayName || `User ${externalUserId}`,
    createdAt: new Date().toISOString(),
    currentPlanTier: "free",
  };

  if (displayName) user.displayName = displayName;
  user.lastSeenAt = new Date().toISOString();
  localUsers.set(externalUserId, user);

  req.session.localExternalUserId = externalUserId;
  setFlash(req, "success", `Signed into partner test app as ${externalUserId}.`);
  return res.redirect("/");
});

app.post("/local-user/logout", (req, res) => {
  req.session.localExternalUserId = undefined;
  setFlash(req, "info", "Signed out from partner test app session.");
  return res.redirect("/");
});

app.post("/waitlist/redirect", (req, res) => {
  if (!FIRSTUSER_PUBLIC_APP_ID) {
    setFlash(req, "error", "Missing FIRSTUSER_PUBLIC_APP_ID in test app env.");
    return res.redirect("/");
  }

  const localUser = ensureLocalUserForFlow(req, res);
  if (!localUser) return;

  const returnTo = buildPartnerReturnTo(localUser.externalUserId);
  const joinUrl = new URL(`${FIRSTUSER_BASE_URL}/i/${encodeURIComponent(FIRSTUSER_PUBLIC_APP_ID)}/join`);
  joinUrl.searchParams.set("returnTo", returnTo);

  setFlash(req, "info", "Redirecting to FirstUser hosted join flow.");
  return res.redirect(joinUrl.toString());
});

app.post("/waitlist/embedded", async (req, res) => {
  const localUser = ensureLocalUserForFlow(req, res);
  if (!localUser) return;

  try {
    const payload = {
      externalUserId: localUser.externalUserId,
      email: stringOrUndefined(req.body.email),
      phone: stringOrUndefined(req.body.phone),
      returnTo: buildPartnerReturnTo(localUser.externalUserId),
    };

    const response = await callFirstUser("/api/integration/v1/waitlist/start", {
      method: "POST",
      body: payload,
    });

    setFlash(req, "info", "Embedded waitlist start succeeded. Continuing to FirstUser...");
    return res.redirect(response.continuationUrl);
  } catch (error) {
    setFlash(req, "error", `Embedded waitlist start failed: ${friendlyError(error)}`);
    return res.redirect("/");
  }
});

app.get("/auth/firstuser", async (req, res) => {
  const externalUserIdQuery = String(req.query.externalUserId || "").trim();
  if (externalUserIdQuery) {
    req.session.localExternalUserId = externalUserIdQuery;
    if (!localUsers.has(externalUserIdQuery)) {
      localUsers.set(externalUserIdQuery, {
        externalUserId: externalUserIdQuery,
        displayName: `User ${externalUserIdQuery}`,
        createdAt: new Date().toISOString(),
        currentPlanTier: "free",
      });
    }
  }

  const code = String(req.query.fu_access_code || "").trim();
  const publicAppId = String(req.query.fu_public_app_id || "").trim();

  if (!code) {
    setFlash(req, "info", "Returned from FirstUser. User is likely pending approval until access code is issued.");
    return res.redirect("/");
  }

  const localUser = getCurrentLocalUser(req);
  if (!localUser) {
    setFlash(req, "error", "Access code received, but no local user session exists. Sign in locally and retry.");
    return res.redirect("/");
  }

  try {
    const exchange = await exchangeAccessCode(code, localUser.externalUserId);
    localUser.firstuserUserId = exchange?.user?.id || exchange?.linkedIdentity?.firstuserUserId || null;
    localUser.firstuserUsername = exchange?.user?.username || null;
    localUser.firstuserDisplayName = exchange?.user?.displayName || null;
    localUser.firstuserAvatarUrl = exchange?.user?.avatarUrl || null;
    localUser.membershipStatus = exchange?.membership?.status || null;
    localUser.lastExchangeAt = new Date().toISOString();
    if (publicAppId) localUser.lastPublicAppId = publicAppId;

    localUsers.set(localUser.externalUserId, localUser);
    setFlash(req, "success", "Access code exchanged successfully. User is now linked and live heartbeat can start.");
  } catch (error) {
    setFlash(req, "error", `Access exchange failed: ${friendlyError(error)}`);
  }

  return res.redirect("/");
});

app.post("/auth/exchange", async (req, res) => {
  const code = String(req.body.code || "").trim();
  if (!code) {
    setFlash(req, "error", "Please paste an access code.");
    return res.redirect("/");
  }

  const localUser = getCurrentLocalUser(req);
  if (!localUser) {
    setFlash(req, "error", "Sign in to a local test user before exchanging access code.");
    return res.redirect("/");
  }

  try {
    const exchange = await exchangeAccessCode(code, localUser.externalUserId);
    localUser.firstuserUserId = exchange?.user?.id || exchange?.linkedIdentity?.firstuserUserId || null;
    localUser.firstuserUsername = exchange?.user?.username || null;
    localUser.firstuserDisplayName = exchange?.user?.displayName || null;
    localUser.firstuserAvatarUrl = exchange?.user?.avatarUrl || null;
    localUser.membershipStatus = exchange?.membership?.status || null;
    localUser.lastExchangeAt = new Date().toISOString();

    localUsers.set(localUser.externalUserId, localUser);
    setFlash(req, "success", "Manual access exchange succeeded.");
  } catch (error) {
    setFlash(req, "error", `Manual exchange failed: ${friendlyError(error)}`);
  }

  return res.redirect("/");
});

app.post("/api/firstuser/heartbeat", async (req, res) => {
  const localUser = getCurrentLocalUser(req);
  if (!localUser) {
    return res.status(401).json({ message: "No local user session" });
  }
  if (!localUser.firstuserUserId) {
    return res.status(409).json({ message: "User is not linked yet. Exchange access code first." });
  }

  const status = normalizeHeartbeatStatus(req.body?.status);
  try {
    const response = await callFirstUser("/api/integration/v1/usage/heartbeat", {
      method: "POST",
      body: {
        externalUserId: localUser.externalUserId,
        status,
        clientPlatform: "web",
      },
    });

    localUser.membershipStatus = response.membershipStatus || localUser.membershipStatus || null;
    localUser.lastHeartbeatAt = new Date().toISOString();
    localUser.lastHeartbeatStatus = status;
    localUsers.set(localUser.externalUserId, localUser);

    return res.json({ ok: true, status, membershipStatus: response.membershipStatus || null });
  } catch (error) {
    return res.status(500).json({ message: friendlyError(error) });
  }
});

app.post("/api/firstuser/plan", async (req, res) => {
  const localUser = getCurrentLocalUser(req);
  if (!localUser) {
    return res.status(401).json({ message: "No local user session" });
  }
  if (!localUser.firstuserUserId) {
    return res.status(409).json({ message: "User is not linked yet. Exchange access code first." });
  }

  const planTier = String(req.body?.planTier || "").trim() || "free";
  try {
    const response = await callFirstUser(`/api/integration/v1/users/${encodeURIComponent(localUser.externalUserId)}/plan`, {
      method: "POST",
      body: { planTier },
    });

    localUser.currentPlanTier = response.currentPlanTier || planTier;
    localUser.lastPlanSyncAt = new Date().toISOString();
    localUsers.set(localUser.externalUserId, localUser);

    return res.json({ ok: true, currentPlanTier: response.currentPlanTier || planTier });
  } catch (error) {
    return res.status(500).json({ message: friendlyError(error) });
  }
});

app.get("/api/firstuser/widget", async (req, res) => {
  const localUser = getCurrentLocalUser(req);
  if (!localUser) {
    return res.status(401).json({ message: "No local user session" });
  }
  if (!localUser.firstuserUserId) {
    return res.status(409).json({ message: "User is not linked yet. Exchange access code first." });
  }

  try {
    const response = await callFirstUser("/api/integration/v1/chat/widget-token", {
      method: "POST",
      body: { externalUserId: localUser.externalUserId },
    });
    return res.json(response);
  } catch (error) {
    return res.status(500).json({ message: friendlyError(error) });
  }
});

app.post("/debug/clear", (_req, res) => {
  webhookEvents.length = 0;
  accessLinks.length = 0;
  return res.redirect("/");
});

app.get("/", (req, res) => {
  const localUser = getCurrentLocalUser(req);
  const flash = consumeFlash(req);

  const page = renderPage({
    flash,
    localUser,
    config: safeConfig(),
    accessLinks: accessLinks.slice(0, 12),
    webhookEvents: webhookEvents.slice(0, 20),
  });

  res.status(200).send(page);
});

app.listen(PORT, () => {
  console.log(`[partner-test-app] running on ${PARTNER_APP_BASE_URL}`);
  console.log(`[partner-test-app] webhook URL: ${PARTNER_APP_BASE_URL}/webhooks/firstuser`);
  console.log(`[partner-test-app] redirect URL: ${PARTNER_APP_BASE_URL}/auth/firstuser`);
});

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function stringOrUndefined(value) {
  const cleaned = String(value || "").trim();
  return cleaned || undefined;
}

function normalizeHeartbeatStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (status === "idle" || status === "offline") return status;
  return "live";
}

function getSignatureHeader(req) {
  const v1 = req.headers["x-firstuser-signature-sha256"];
  if (typeof v1 === "string" && v1.trim()) return v1.trim();

  const v0 = req.headers["x-firstuser-signature"];
  if (typeof v0 === "string" && v0.trim()) return v0.trim();

  return "";
}

function safeTimingEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function safeConfig() {
  return {
    firstUserBaseUrl: FIRSTUSER_BASE_URL,
    partnerAppBaseUrl: PARTNER_APP_BASE_URL,
    firstUserPublicAppId: FIRSTUSER_PUBLIC_APP_ID || "(missing)",
    hasApiKey: !!FIRSTUSER_API_KEY,
    hasWebhookSecret: !!FIRSTUSER_WEBHOOK_SECRET,
    suggestedSetup: {
      webRedirectUrl: `${PARTNER_APP_BASE_URL}/auth/firstuser`,
      webhookUrl: `${PARTNER_APP_BASE_URL}/webhooks/firstuser`,
      hostedJoinUrl: FIRSTUSER_PUBLIC_APP_ID
        ? `${FIRSTUSER_BASE_URL}/i/${encodeURIComponent(FIRSTUSER_PUBLIC_APP_ID)}/join`
        : "(missing FIRSTUSER_PUBLIC_APP_ID)",
    },
  };
}

function setFlash(req, type, message) {
  req.session.flash = {
    type,
    message,
    at: new Date().toISOString(),
  };
}

function consumeFlash(req) {
  const flash = req.session.flash || null;
  req.session.flash = undefined;
  return flash;
}

function getCurrentLocalUser(req) {
  const externalUserId = req.session.localExternalUserId;
  if (!externalUserId) return null;
  return localUsers.get(externalUserId) || null;
}

function ensureLocalUserForFlow(req, res) {
  const localUser = getCurrentLocalUser(req);
  if (!localUser) {
    setFlash(req, "error", "Sign in as a local partner user before starting waitlist flow.");
    res.redirect("/");
    return null;
  }
  return localUser;
}

function buildPartnerReturnTo(externalUserId) {
  const url = new URL(`${PARTNER_APP_BASE_URL}/auth/firstuser`);
  url.searchParams.set("externalUserId", externalUserId);
  return url.toString();
}

async function exchangeAccessCode(code, externalUserId) {
  return callFirstUser("/api/integration/v1/access/exchange", {
    method: "POST",
    body: {
      code,
      externalUserId,
      clientPlatform: "web",
    },
  });
}

function firstUserAuthHeaders() {
  if (!FIRSTUSER_API_KEY) {
    throw new Error("FIRSTUSER_API_KEY is missing in partner test app env.");
  }
  return {
    authorization: `Bearer ${FIRSTUSER_API_KEY}`,
    "content-type": "application/json",
  };
}

async function callFirstUser(path, options = {}) {
  const response = await fetch(`${FIRSTUSER_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: firstUserAuthHeaders(),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(payload?.message || `FirstUser API request failed (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function friendlyError(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unexpected error";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderBadge(yesNo) {
  return yesNo
    ? '<span class="pill ok">configured</span>'
    : '<span class="pill warn">missing</span>';
}

function renderPage({ flash, localUser, config, accessLinks: links, webhookEvents: events }) {
  const flashHtml = flash
    ? `<div class="flash ${escapeHtml(flash.type)}">${escapeHtml(flash.message)}</div>`
    : "";

  const localUserHtml = localUser
    ? `<div class="user-card">
        <p><strong>Local user:</strong> ${escapeHtml(localUser.externalUserId)} (${escapeHtml(localUser.displayName || "Unnamed")})</p>
        <p><strong>Linked FirstUser ID:</strong> ${escapeHtml(localUser.firstuserUserId || "not linked yet")}</p>
        <p><strong>Membership status:</strong> ${escapeHtml(localUser.membershipStatus || "unknown")}</p>
        <p><strong>Current plan tier:</strong> ${escapeHtml(localUser.currentPlanTier || "free")}</p>
      </div>`
    : '<p class="muted">No local user session yet.</p>';

  const accessLinksHtml = links.length
    ? links.map((link) => `
        <tr>
          <td>${escapeHtml(link.eventType)}</td>
          <td>${escapeHtml(link.displayName || link.username || link.firstuserUserId || "unknown")}</td>
          <td>${escapeHtml(link.expiresAt || "-")}</td>
          <td><a class="btn small" href="${escapeHtml(link.browserAccessUrl)}">Use access link</a></td>
        </tr>
      `).join("")
    : '<tr><td colspan="4" class="muted">No access links received yet.</td></tr>';

  const webhookRows = events.length
    ? events.map((event) => `
        <tr>
          <td>${escapeHtml(event.receivedAt)}</td>
          <td>${escapeHtml(event.type)}</td>
          <td>${event.validSignature ? '<span class="pill ok">valid</span>' : '<span class="pill warn">invalid</span>'}</td>
        </tr>
      `).join("")
    : '<tr><td colspan="3" class="muted">No webhook events yet.</td></tr>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FirstUser Partner Test App</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b0b0f;
      --panel: #151521;
      --text: #f8f8fc;
      --muted: #b4b5c4;
      --line: #2b2d45;
      --brand: #7c5cff;
      --brand2: #42d6ff;
      --ok: #15c17f;
      --warn: #ffb648;
      --danger: #ff6b6b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: radial-gradient(circle at 5% 0%, #201a42 0%, var(--bg) 45%);
      color: var(--text);
    }
    .wrap { max-width: 1120px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 6px; font-size: 30px; }
    h2 { margin: 0 0 14px; font-size: 20px; }
    p { margin: 0; }
    .muted { color: var(--muted); }
    .grid { display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .panel {
      border: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0));
      border-radius: 14px;
      padding: 16px;
    }
    .panel.full { grid-column: 1 / -1; }
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
    label { color: var(--muted); font-size: 13px; }
    input, select {
      width: 100%;
      border: 1px solid var(--line);
      background: #0f1020;
      color: var(--text);
      border-radius: 10px;
      padding: 10px;
      font-size: 14px;
    }
    .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border: 1px solid #4a4b67;
      border-radius: 10px;
      background: linear-gradient(90deg, var(--brand), var(--brand2));
      color: white;
      text-decoration: none;
      font-weight: 600;
      padding: 9px 12px;
      cursor: pointer;
    }
    .btn.secondary {
      background: #1b1c2d;
      border-color: #353754;
      color: #edf0ff;
      font-weight: 500;
    }
    .btn.small { font-size: 12px; padding: 7px 10px; }
    .pill {
      display: inline-block;
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border: 1px solid transparent;
    }
    .pill.ok { color: #c0ffe6; background: rgba(21,193,127,0.14); border-color: rgba(21,193,127,0.35); }
    .pill.warn { color: #ffe5bf; background: rgba(255,182,72,0.14); border-color: rgba(255,182,72,0.35); }
    .flash {
      padding: 12px;
      border-radius: 10px;
      margin: 12px 0 20px;
      border: 1px solid transparent;
    }
    .flash.success { background: rgba(21,193,127,0.12); border-color: rgba(21,193,127,0.35); }
    .flash.info { background: rgba(124,92,255,0.13); border-color: rgba(124,92,255,0.35); }
    .flash.error { background: rgba(255,107,107,0.14); border-color: rgba(255,107,107,0.35); }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px 8px; border-top: 1px solid var(--line); font-size: 13px; }
    th { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .code {
      display: block;
      margin-top: 6px;
      background: #101225;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px;
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-size: 12px;
      word-break: break-all;
    }
    iframe { width: 100%; min-height: 420px; border: 1px solid var(--line); border-radius: 12px; background: #0c0d18; }
    .user-card {
      border: 1px solid #333650;
      background: #121425;
      border-radius: 10px;
      padding: 10px;
      line-height: 1.6;
      margin-bottom: 12px;
    }
    @media (max-width: 860px) {
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <h1>FirstUser Partner Integration Sandbox</h1>
    <p class="muted">Use this test app to validate redirect + embedded waitlist flow, access exchange, heartbeat analytics, live radar eligibility, and hosted founder chat widget.</p>

    ${flashHtml}

    <section class="grid">
      <article class="panel">
        <h2>1) Copy These Into Founder Tools</h2>
        <p class="muted">In FirstUser > Founder Tools > Integrate, use these exact values.</p>
        <div class="field">
          <label>Web Redirect URL</label>
          <code class="code">${escapeHtml(config.suggestedSetup.webRedirectUrl)}</code>
        </div>
        <div class="field">
          <label>Webhook URL</label>
          <code class="code">${escapeHtml(config.suggestedSetup.webhookUrl)}</code>
        </div>
        <div class="field">
          <label>Hosted Join URL (generated by FirstUser)</label>
          <code class="code">${escapeHtml(config.suggestedSetup.hostedJoinUrl)}</code>
        </div>
        <div class="row">
          <span>API key: ${renderBadge(config.hasApiKey)}</span>
          <span>Webhook secret: ${renderBadge(config.hasWebhookSecret)}</span>
        </div>
      </article>

      <article class="panel">
        <h2>2) Local Partner User Session</h2>
        ${localUserHtml}
        <form method="post" action="/local-user/login">
          <div class="field">
            <label>External User ID (partner side)</label>
            <input name="externalUserId" placeholder="partner_user_001" value="${escapeHtml(localUser?.externalUserId || "")}" required />
          </div>
          <div class="field">
            <label>Display Name</label>
            <input name="displayName" placeholder="Taylor Founder" value="${escapeHtml(localUser?.displayName || "")}" />
          </div>
          <div class="row">
            <button class="btn" type="submit">Sign In As Local User</button>
          </div>
        </form>
        <form method="post" action="/local-user/logout" style="margin-top:8px;">
          <button class="btn secondary" type="submit">Sign Out Local User</button>
        </form>
      </article>

      <article class="panel">
        <h2>3) Start Waitlist Flow (Redirect)</h2>
        <p class="muted">This mimics a normal "Join Waitlist" button that sends people to FirstUser hosted join.</p>
        <form method="post" action="/waitlist/redirect" class="row" style="margin-top:12px;">
          <button class="btn" type="submit">Start Redirect Waitlist Flow</button>
        </form>
      </article>

      <article class="panel">
        <h2>4) Start Waitlist Flow (Embedded API)</h2>
        <p class="muted">This simulates a partner-owned form posting to FirstUser waitlist start API.</p>
        <form method="post" action="/waitlist/embedded">
          <div class="field">
            <label>Email (optional prefill)</label>
            <input name="email" type="email" placeholder="user@example.com" />
          </div>
          <div class="field">
            <label>Phone (optional prefill)</label>
            <input name="phone" type="text" placeholder="+15551234567" />
          </div>
          <button class="btn" type="submit">Start Embedded Waitlist Flow</button>
        </form>
      </article>

      <article class="panel full">
        <h2>5) Access Links Issued By FirstUser (From Webhooks)</h2>
        <p class="muted">After founder approval, FirstUser sends webhook events with one-click access links. Click "Use access link" while signed into the intended local user above.</p>
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>User</th>
              <th>Expires</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${accessLinksHtml}</tbody>
        </table>
      </article>

      <article class="panel">
        <h2>6) Manual Access Exchange</h2>
        <p class="muted">Use this if you want to paste an access code manually.</p>
        <form method="post" action="/auth/exchange">
          <div class="field">
            <label>fu_access_code</label>
            <input name="code" placeholder="paste access code" />
          </div>
          <button class="btn" type="submit">Exchange Code</button>
        </form>
      </article>

      <article class="panel">
        <h2>7) Live Heartbeat + Plan + Widget</h2>
        <p class="muted">These calls use server-to-server API key auth. Secrets never touch browser JS.</p>
        <div class="row" style="margin-top:8px;">
          <button class="btn secondary" id="hb-live">Send Live</button>
          <button class="btn secondary" id="hb-idle">Send Idle</button>
          <button class="btn secondary" id="hb-offline">Send Offline</button>
        </div>
        <div class="row" style="margin-top:10px;">
          <select id="plan-tier">
            <option value="free">free</option>
            <option value="mid">mid</option>
            <option value="pro">pro</option>
          </select>
          <button class="btn secondary" id="plan-save">Sync Plan Tier</button>
        </div>
        <div class="row" style="margin-top:10px;">
          <button class="btn" id="load-widget">Load Hosted Chat Widget</button>
        </div>
        <p class="muted" id="runtime-status" style="margin-top:10px;">Runtime status: idle</p>
      </article>

      <article class="panel full">
        <h2>8) Hosted Chat Widget Frame</h2>
        <p class="muted">Widget appears after successful token request for an approved + linked user.</p>
        <iframe id="widget-frame" title="FirstUser Hosted Chat Widget"></iframe>
      </article>

      <article class="panel full">
        <h2>9) Webhook Delivery Log</h2>
        <div class="row" style="margin-bottom:8px;">
          <form method="post" action="/debug/clear">
            <button class="btn secondary" type="submit">Clear Logs</button>
          </form>
          <a class="btn secondary" href="/api/debug/state" target="_blank">Open JSON State</a>
        </div>
        <table>
          <thead>
            <tr>
              <th>Received</th>
              <th>Event Type</th>
              <th>Signature</th>
            </tr>
          </thead>
          <tbody>${webhookRows}</tbody>
        </table>
      </article>
    </section>
  </main>

  <script>
    const hasLinkedUser = ${localUser?.firstuserUserId ? "true" : "false"};
    const statusEl = document.getElementById("runtime-status");
    const widgetFrame = document.getElementById("widget-frame");

    async function postJson(path, body) {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Request failed");
      }
      return payload;
    }

    async function sendHeartbeat(status) {
      try {
        const payload = await postJson("/api/firstuser/heartbeat", { status });
        statusEl.textContent = "Runtime status: heartbeat " + status + " ok (membership: " + (payload.membershipStatus || "unknown") + ")";
      } catch (error) {
        statusEl.textContent = "Runtime status: heartbeat " + status + " failed (" + error.message + ")";
      }
    }

    document.getElementById("hb-live").addEventListener("click", () => sendHeartbeat("live"));
    document.getElementById("hb-idle").addEventListener("click", () => sendHeartbeat("idle"));
    document.getElementById("hb-offline").addEventListener("click", () => sendHeartbeat("offline"));

    document.getElementById("plan-save").addEventListener("click", async () => {
      const planTier = document.getElementById("plan-tier").value;
      try {
        const payload = await postJson("/api/firstuser/plan", { planTier });
        statusEl.textContent = "Runtime status: plan synced (" + payload.currentPlanTier + ")";
      } catch (error) {
        statusEl.textContent = "Runtime status: plan sync failed (" + error.message + ")";
      }
    });

    document.getElementById("load-widget").addEventListener("click", async () => {
      try {
        const response = await fetch("/api/firstuser/widget");
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || "Failed to fetch widget URL");
        }
        widgetFrame.src = payload.widgetUrl;
        statusEl.textContent = "Runtime status: widget loaded";
      } catch (error) {
        statusEl.textContent = "Runtime status: widget load failed (" + error.message + ")";
      }
    });

    if (hasLinkedUser) {
      sendHeartbeat(document.hidden ? "idle" : "live");
      setInterval(() => sendHeartbeat(document.hidden ? "idle" : "live"), 15000);
      document.addEventListener("visibilitychange", () => {
        sendHeartbeat(document.hidden ? "idle" : "live");
      });
      window.addEventListener("beforeunload", () => {
        fetch("/api/firstuser/heartbeat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "offline" }),
          keepalive: true,
        });
      });
    }
  </script>
</body>
</html>`;
}
