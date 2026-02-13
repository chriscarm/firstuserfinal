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

export class FirstUserCapacitorSDK {
  private config: FirstUserConfig | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  init(config: FirstUserConfig) {
    this.config = {
      ...config,
      backendBaseUrl: config.backendBaseUrl.replace(/\/+$/, ""),
      heartbeatIntervalMs: config.heartbeatIntervalMs ?? 15000,
      defaultClientPlatform: config.defaultClientPlatform ?? "capacitor",
    };
  }

  startPresence(input: PresenceLoopOptions | ((status: PresenceStatus) => Promise<void>)) {
    if (!this.config) throw new Error("FirstUserCapacitorSDK not initialized");
    this.stopPresence();
    const intervalMs = this.config.heartbeatIntervalMs ?? 15000;

    if (typeof input === "function") {
      this.heartbeatTimer = setInterval(() => {
        const status = typeof document !== "undefined" && document.hidden ? "idle" : "live";
        void input(status);
      }, intervalMs);
      return;
    }

    const statusProvider = input.statusProvider ?? (() => (typeof document !== "undefined" && document.hidden ? "idle" : "live"));
    this.heartbeatTimer = setInterval(() => {
      void this.sendHeartbeat({
        externalUserId: input.externalUserId,
        status: statusProvider(),
        clientPlatform: input.clientPlatform,
      }).catch((error) => {
        if (input.onError) input.onError(error);
      });
    }, intervalMs);
  }

  stopPresence() {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  mountHostedChatWidget(widgetUrl: string) {
    return {
      tag: "iframe",
      src: widgetUrl,
    };
  }

  async startEmbeddedWaitlist(payload: EmbeddedWaitlistPayload) {
    return this.postJson("/api/firstuser/waitlist/start", payload);
  }

  async exchangeAccessCode(payload: AccessExchangePayload) {
    return this.postJson("/api/firstuser/access/exchange", {
      ...payload,
      clientPlatform: payload.clientPlatform ?? this.config?.defaultClientPlatform ?? "capacitor",
    });
  }

  async sendHeartbeat(payload: HeartbeatPayload) {
    const defaultStatus: PresenceStatus =
      typeof document !== "undefined" && document.hidden ? "idle" : "live";
    return this.postJson("/api/firstuser/usage/heartbeat", {
      ...payload,
      status: payload.status ?? defaultStatus,
      clientPlatform: payload.clientPlatform ?? this.config?.defaultClientPlatform ?? "capacitor",
    });
  }

  async setPlanTier(externalUserId: string, planTier: string) {
    return this.postJson(`/api/firstuser/users/${encodeURIComponent(externalUserId)}/plan`, {
      planTier,
    });
  }

  async getHostedChatWidgetToken(externalUserId: string): Promise<ChatWidgetTokenResponse> {
    return this.postJson("/api/firstuser/chat/widget-token", { externalUserId });
  }

  private getFetchImpl(): typeof fetch {
    const fetchImpl = this.config?.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new Error("No fetch implementation available. Provide config.fetchImpl.");
    }
    return fetchImpl;
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    if (!this.config) throw new Error("FirstUserCapacitorSDK not initialized");
    const response = await this.getFetchImpl()(`${this.config.backendBaseUrl}${path}`, {
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
}
