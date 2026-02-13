export interface FirstUserConfig {
  baseUrl: string;
  publicAppId: string;
  backendBaseUrl: string;
}

export class FirstUserReactNativeSDK {
  private config: FirstUserConfig | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  init(config: FirstUserConfig) {
    this.config = config;
  }

  startPresence(sendHeartbeat: (status: "live" | "idle" | "offline") => Promise<void>) {
    this.stopPresence();
    this.timer = setInterval(() => {
      void sendHeartbeat("live");
    }, 15000);
  }

  mountHostedChatWidget(widgetUrl: string) {
    return {
      component: "WebView",
      props: { source: { uri: widgetUrl } },
    };
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
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
