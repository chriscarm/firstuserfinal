export interface FirstUserConfig {
  baseUrl: string;
  publicAppId: string;
  backendBaseUrl: string;
}

export class FirstUserWebSDK {
  private config: FirstUserConfig | null = null;
  private heartbeatTimer: number | null = null;

  init(config: FirstUserConfig) {
    this.config = config;
  }

  startPresence(sendHeartbeat: (status: "live" | "idle" | "offline") => Promise<void>) {
    this.stopPresence();
    this.heartbeatTimer = window.setInterval(() => {
      void sendHeartbeat(document.hidden ? "idle" : "live");
    }, 15000);
  }

  mountHostedChatWidget(container: HTMLElement, widgetUrl: string) {
    const iframe = document.createElement("iframe");
    iframe.src = widgetUrl;
    iframe.width = "100%";
    iframe.height = "420";
    iframe.style.border = "0";
    container.appendChild(iframe);
    return iframe;
  }

  async startEmbeddedWaitlist(payload: {
    externalUserId: string;
    email?: string;
    phone?: string;
    returnTo?: string;
  }) {
    if (!this.config) throw new Error("FirstUser SDK not initialized");
    const response = await fetch(`${this.config.backendBaseUrl}/api/firstuser/waitlist/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Failed to start embedded waitlist flow");
    return response.json();
  }

  async setPlanTier(externalUserId: string, planTier: string) {
    if (!this.config) throw new Error("FirstUser SDK not initialized");
    const response = await fetch(`${this.config.backendBaseUrl}/api/firstuser/users/${encodeURIComponent(externalUserId)}/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planTier }),
    });
    if (!response.ok) throw new Error("Failed to set plan tier");
    return response.json();
  }

  private stopPresence() {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
