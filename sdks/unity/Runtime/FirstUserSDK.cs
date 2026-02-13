using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Timers;

namespace FirstUser {
  public class FirstUserConfig {
    public string BaseUrl;
    public string PublicAppId;
    public string BackendBaseUrl;
    public int HeartbeatIntervalMs = 15000;
    public string DefaultClientPlatform = "unity";
  }

  public class FirstUserSDK {
    private FirstUserConfig _config;
    private Timer _heartbeatTimer;

    public void init(FirstUserConfig config) {
      _config = config;
      _config.BackendBaseUrl = config.BackendBaseUrl.TrimEnd('/');
    }

    public void startPresence(Action<string> sendHeartbeat) {
      stopPresence();
      sendHeartbeat("live");

      var interval = _config?.HeartbeatIntervalMs ?? 15000;
      _heartbeatTimer = new Timer(interval);
      _heartbeatTimer.Elapsed += (_, __) => sendHeartbeat("live");
      _heartbeatTimer.AutoReset = true;
      _heartbeatTimer.Enabled = true;
    }

    public void stopPresence() {
      if (_heartbeatTimer == null) return;
      _heartbeatTimer.Stop();
      _heartbeatTimer.Dispose();
      _heartbeatTimer = null;
    }

    public string mountHostedChatWidget(string widgetUrl) {
      return widgetUrl;
    }

    public Task<string> startEmbeddedWaitlist(Dictionary<string, string> payload) {
      return Post("/api/firstuser/waitlist/start", payload);
    }

    public Task<string> exchangeAccessCode(Dictionary<string, string> payload) {
      if (!payload.ContainsKey("clientPlatform")) {
        payload["clientPlatform"] = _config?.DefaultClientPlatform ?? "unity";
      }
      return Post("/api/firstuser/access/exchange", payload);
    }

    public Task<string> sendHeartbeat(Dictionary<string, string> payload) {
      if (!payload.ContainsKey("status")) {
        payload["status"] = "live";
      }
      if (!payload.ContainsKey("clientPlatform")) {
        payload["clientPlatform"] = _config?.DefaultClientPlatform ?? "unity";
      }
      return Post("/api/firstuser/usage/heartbeat", payload);
    }

    public Task<string> setPlanTier(string externalUserId, string planTier) {
      return Post($"/api/firstuser/users/{externalUserId}/plan", new Dictionary<string, string> {
        { "planTier", planTier },
      });
    }

    public Task<string> getHostedChatWidgetToken(string externalUserId) {
      return Post("/api/firstuser/chat/widget-token", new Dictionary<string, string> {
        { "externalUserId", externalUserId },
      });
    }

    private Task<string> Post(string path, Dictionary<string, string> payload) {
      if (_config == null) throw new Exception("FirstUserSDK not initialized");
      return Task.FromResult($"POST {_config.BackendBaseUrl}{path} payload={payload.Count}");
    }
  }
}
