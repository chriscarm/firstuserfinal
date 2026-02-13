class FirstUserConfig {
  final String baseUrl;
  final String publicAppId;
  final String backendBaseUrl;

  const FirstUserConfig({
    required this.baseUrl,
    required this.publicAppId,
    required this.backendBaseUrl,
  });
}

class FirstUserSdk {
  FirstUserConfig? _config;

  void init(FirstUserConfig config) {
    _config = config;
  }

  void startPresence(Future<void> Function(String status) sendHeartbeat) {
    sendHeartbeat("live");
  }

  Map<String, dynamic> mountHostedChatWidget(String widgetUrl) {
    return {
      "type": "webview",
      "url": widgetUrl,
    };
  }

  Future<Map<String, dynamic>> startEmbeddedWaitlist(Map<String, dynamic> payload) async {
    if (_config == null) throw Exception("FirstUserSdk not initialized");
    return {
      "endpoint": "${_config!.backendBaseUrl}/api/firstuser/waitlist/start",
      "payload": payload,
    };
  }

  Future<Map<String, dynamic>> setPlanTier(String externalUserId, String planTier) async {
    if (_config == null) throw Exception("FirstUserSdk not initialized");
    return {
      "externalUserId": externalUserId,
      "planTier": planTier,
      "endpoint": "${_config!.backendBaseUrl}/api/firstuser/users/$externalUserId/plan",
    };
  }
}
