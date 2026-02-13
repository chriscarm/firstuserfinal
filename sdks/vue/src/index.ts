export interface FirstUserConfig {
  baseUrl: string;
  publicAppId: string;
  backendBaseUrl: string;
  heartbeatIntervalMs?: number;
  defaultClientPlatform?: string;
  fetchImpl?: typeof fetch;
}

export type PresenceStatus = "live" | "idle" | "offline";

export interface EmbeddedWaitlistPayload {
  externalUserId?: string;
  email?: string;
  phone?: string;
  returnTo?: string;
}

export interface AccessExchangePayload {
  code: string;
  externalUserId: string;
  clientPlatform?: string;
}

export interface HeartbeatPayload {
  externalUserId: string;
  status?: PresenceStatus;
  clientPlatform?: string;
}

export interface PresenceLoopOptions {
  externalUserId: string;
  clientPlatform?: string;
  statusProvider?: () => PresenceStatus;
  onError?: (error: unknown) => void;
}

export interface ChatWidgetTokenResponse {
  token: string;
  widgetUrl: string;
  expiresAt: string;
}

export function createFirstUserVueSDK() {
  let config: FirstUserConfig | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  function init(nextConfig: FirstUserConfig) {
    config = {
      ...nextConfig,
      backendBaseUrl: nextConfig.backendBaseUrl.replace(/\/+$/, ""),
      heartbeatIntervalMs: nextConfig.heartbeatIntervalMs ?? 15000,
      defaultClientPlatform: nextConfig.defaultClientPlatform ?? "vue",
    };
  }

  function startPresence(input: PresenceLoopOptions | ((status: PresenceStatus) => Promise<void>)) {
    if (!config) throw new Error("FirstUser Vue SDK not initialized");
    stopPresence();
    const intervalMs = config.heartbeatIntervalMs ?? 15000;

    if (typeof input === "function") {
      heartbeatTimer = setInterval(() => {
        void input(getVisibilityStatus());
      }, intervalMs);
      return;
    }

    const statusProvider = input.statusProvider ?? (() => getVisibilityStatus());
    heartbeatTimer = setInterval(() => {
      void sendHeartbeat({
        externalUserId: input.externalUserId,
        status: statusProvider(),
        clientPlatform: input.clientPlatform,
      }).catch((error) => {
        if (input.onError) input.onError(error);
      });
    }, intervalMs);
  }

  function stopPresence() {
    if (!heartbeatTimer) return;
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  function mountHostedChatWidget(widgetUrl: string) {
    return {
      component: "iframe",
      attrs: {
        src: widgetUrl,
        title: "FirstUser Chat",
      },
    };
  }

  async function startEmbeddedWaitlist(payload: EmbeddedWaitlistPayload) {
    return postJson("/api/firstuser/waitlist/start", payload);
  }

  async function exchangeAccessCode(payload: AccessExchangePayload) {
    return postJson("/api/firstuser/access/exchange", {
      ...payload,
      clientPlatform: payload.clientPlatform ?? config?.defaultClientPlatform ?? "vue",
    });
  }

  async function sendHeartbeat(payload: HeartbeatPayload) {
    return postJson("/api/firstuser/usage/heartbeat", {
      ...payload,
      status: payload.status ?? getVisibilityStatus(),
      clientPlatform: payload.clientPlatform ?? config?.defaultClientPlatform ?? "vue",
    });
  }

  async function setPlanTier(externalUserId: string, planTier: string) {
    return postJson(`/api/firstuser/users/${encodeURIComponent(externalUserId)}/plan`, {
      planTier,
    });
  }

  async function getHostedChatWidgetToken(externalUserId: string): Promise<ChatWidgetTokenResponse> {
    return postJson("/api/firstuser/chat/widget-token", { externalUserId });
  }

  function getVisibilityStatus(): PresenceStatus {
    if (typeof document !== "undefined" && document.hidden) return "idle";
    return "live";
  }

  function getFetchImpl(): typeof fetch {
    const fetchImpl = config?.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new Error("No fetch implementation available. Provide config.fetchImpl.");
    }
    return fetchImpl;
  }

  async function postJson<T>(path: string, body: unknown): Promise<T> {
    if (!config) throw new Error("FirstUser Vue SDK not initialized");
    const response = await getFetchImpl()(`${config.backendBaseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        json && typeof json === "object" && "message" in json && typeof json.message === "string"
          ? json.message
          : `Request failed for ${path}`;
      throw new Error(message);
    }
    return json as T;
  }

  return {
    init,
    startPresence,
    stopPresence,
    mountHostedChatWidget,
    startEmbeddedWaitlist,
    exchangeAccessCode,
    sendHeartbeat,
    setPlanTier,
    getHostedChatWidgetToken,
  };
}
