export interface FirstUserConfig {
  baseUrl: string;
  publicAppId: string;
  backendBaseUrl: string;
}

export class FirstUserCapacitorSDK {
  private config: FirstUserConfig | null = null;

  init(config: FirstUserConfig) {
    this.config = config;
  }

  startPresence(sendHeartbeat: (status: "live" | "idle" | "offline") => Promise<void>) {
    void sendHeartbeat("live");
  }

  mountHostedChatWidget(widgetUrl: string) {
    return { tag: "iframe", src: widgetUrl };
  }

  async startEmbeddedWaitlist(payload: Record<string, unknown>) {
    if (!this.config) throw new Error("FirstUserCapacitorSDK not initialized");
    return { endpoint: `${this.config.backendBaseUrl}/api/firstuser/waitlist/start`, payload };
  }

  async setPlanTier(externalUserId: string, planTier: string) {
    if (!this.config) throw new Error("FirstUserCapacitorSDK not initialized");
    return { endpoint: `${this.config.backendBaseUrl}/api/firstuser/users/${externalUserId}/plan`, planTier };
  }
}
