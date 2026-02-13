export type FirstUserConfig = {
  baseUrl: string;
  publicAppId: string;
  backendBaseUrl: string;
};

export class FirstUserExpoSDK {
  private config: FirstUserConfig | null = null;

  init(config: FirstUserConfig) {
    this.config = config;
  }

  startPresence(sendHeartbeat: (status: "live" | "idle" | "offline") => Promise<void>) {
    void sendHeartbeat("live");
  }

  mountHostedChatWidget(widgetUrl: string) {
    return { component: "WebView", props: { source: { uri: widgetUrl } } };
  }

  async startEmbeddedWaitlist(payload: Record<string, unknown>) {
    if (!this.config) throw new Error("FirstUserExpoSDK not initialized");
    return { endpoint: `${this.config.backendBaseUrl}/api/firstuser/waitlist/start`, payload };
  }

  async setPlanTier(externalUserId: string, planTier: string) {
    if (!this.config) throw new Error("FirstUserExpoSDK not initialized");
    return { endpoint: `${this.config.backendBaseUrl}/api/firstuser/users/${externalUserId}/plan`, planTier };
  }
}
