export interface FirstUserConfig {
  baseUrl: string;
  publicAppId: string;
  backendBaseUrl: string;
}

export type PresenceStatus = "live" | "idle" | "offline";

export class FirstUserNuxtSDK {
  private config: FirstUserConfig | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  init(config: FirstUserConfig) {
    this.config = config;
  }

  startPresence(sendHeartbeat: (status: PresenceStatus) => Promise<void>) {
    this.stopPresence();
    this.heartbeatTimer = setInterval(() => {
      const hidden = typeof document !== "undefined" ? document.hidden : false;
      void sendHeartbeat(hidden ? "idle" : "live");
    }, 15000);
  }

  mountHostedChatWidget(widgetUrl: string) {
    return {
      component: "iframe",
      attrs: {
        src: widgetUrl,
        title: "FirstUser Chat",
      },
    };
  }

  async startEmbeddedWaitlist(payload: Record<string, unknown>) {
    if (!this.config) throw new Error("FirstUserNuxtSDK not initialized");
    const response = await fetch(`${this.config.backendBaseUrl}/api/firstuser/waitlist/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Failed to start embedded waitlist flow");
    return response.json();
  }

  async setPlanTier(externalUserId: string, planTier: string) {
    if (!this.config) throw new Error("FirstUserNuxtSDK not initialized");
    const response = await fetch(`${this.config.backendBaseUrl}/api/firstuser/users/${encodeURIComponent(externalUserId)}/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planTier }),
    });
    if (!response.ok) throw new Error("Failed to set plan tier");
    return response.json();
  }

  private stopPresence() {
    if (!this.heartbeatTimer) return;
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
}
