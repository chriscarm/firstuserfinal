using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace FirstUser {
  public class FirstUserConfig {
    public string BaseUrl;
    public string PublicAppId;
    public string BackendBaseUrl;
  }

  public class FirstUserSDK {
    private FirstUserConfig _config;

    public void init(FirstUserConfig config) {
      _config = config;
    }

    public void startPresence(Action<string> sendHeartbeat) {
      sendHeartbeat("live");
    }

    public string mountHostedChatWidget(string widgetUrl) {
      return widgetUrl;
    }

    public Task<string> startEmbeddedWaitlist(Dictionary<string, string> payload) {
      if (_config == null) throw new Exception("FirstUserSDK not initialized");
      return Task.FromResult($"{_config.BackendBaseUrl}/api/firstuser/waitlist/start");
    }

    public Task<string> setPlanTier(string externalUserId, string planTier) {
      if (_config == null) throw new Exception("FirstUserSDK not initialized");
      return Task.FromResult($"{_config.BackendBaseUrl}/api/firstuser/users/{externalUserId}/plan");
    }
  }
}
