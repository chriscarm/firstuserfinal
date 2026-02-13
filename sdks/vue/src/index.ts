export interface FirstUserConfig {
  baseUrl: string;
  publicAppId: string;
  backendBaseUrl: string;
}

export type PresenceStatus = "live" | "idle" | "offline";

export function createFirstUserVueSDK() {
  let config: FirstUserConfig | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  function init(nextConfig: FirstUserConfig) {
    config = nextConfig;
  }

  function startPresence(sendHeartbeat: (status: PresenceStatus) => Promise<void>) {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      const hidden = typeof document !== "undefined" ? document.hidden : false;
      void sendHeartbeat(hidden ? "idle" : "live");
    }, 15000);
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

  async function startEmbeddedWaitlist(payload: Record<string, unknown>) {
    if (!config) throw new Error("FirstUser Vue SDK not initialized");
    const response = await fetch(`${config.backendBaseUrl}/api/firstuser/waitlist/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Failed to start embedded waitlist flow");
    return response.json();
  }

  async function setPlanTier(externalUserId: string, planTier: string) {
    if (!config) throw new Error("FirstUser Vue SDK not initialized");
    const response = await fetch(`${config.backendBaseUrl}/api/firstuser/users/${encodeURIComponent(externalUserId)}/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planTier }),
    });
    if (!response.ok) throw new Error("Failed to set plan tier");
    return response.json();
  }

  return {
    init,
    startPresence,
    mountHostedChatWidget,
    startEmbeddedWaitlist,
    setPlanTier,
  };
}
