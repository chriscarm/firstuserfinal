import 'dart:async';

class FirstUserConfig {
  final String baseUrl;
  final String publicAppId;
  final String backendBaseUrl;
  final Duration heartbeatInterval;
  final String defaultClientPlatform;

  const FirstUserConfig({
    required this.baseUrl,
    required this.publicAppId,
    required this.backendBaseUrl,
    this.heartbeatInterval = const Duration(seconds: 15),
    this.defaultClientPlatform = "flutter",
  });
}

class FirstUserSdk {
  FirstUserConfig? _config;
  Timer? _heartbeatTimer;

  void init(FirstUserConfig config) {
    _config = FirstUserConfig(
      baseUrl: config.baseUrl,
      publicAppId: config.publicAppId,
      backendBaseUrl: config.backendBaseUrl.replaceAll(RegExp(r"/+$"), ""),
      heartbeatInterval: config.heartbeatInterval,
      defaultClientPlatform: config.defaultClientPlatform,
    );
  }

  void startPresence(Future<void> Function(String status) sendHeartbeat) {
    stopPresence();
    sendHeartbeat("live");
    final interval = _config?.heartbeatInterval ?? const Duration(seconds: 15);
    _heartbeatTimer = Timer.periodic(interval, (_) {
      sendHeartbeat("live");
    });
  }

  void stopPresence() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  Map<String, dynamic> mountHostedChatWidget(String widgetUrl) {
    return {
      "type": "webview",
      "url": widgetUrl,
    };
  }

  Future<Map<String, dynamic>> startEmbeddedWaitlist(
    Map<String, dynamic> payload,
  ) async {
    _ensureInitialized();
    return _post("/api/firstuser/waitlist/start", payload);
  }

  Future<Map<String, dynamic>> exchangeAccessCode(
    Map<String, dynamic> payload,
  ) async {
    _ensureInitialized();
    final finalPayload = Map<String, dynamic>.from(payload);
    finalPayload.putIfAbsent(
      "clientPlatform",
      () => _config?.defaultClientPlatform ?? "flutter",
    );
    return _post("/api/firstuser/access/exchange", finalPayload);
  }

  Future<Map<String, dynamic>> sendHeartbeat(
    Map<String, dynamic> payload,
  ) async {
    _ensureInitialized();
    final finalPayload = Map<String, dynamic>.from(payload);
    finalPayload.putIfAbsent("status", () => "live");
    finalPayload.putIfAbsent(
      "clientPlatform",
      () => _config?.defaultClientPlatform ?? "flutter",
    );
    return _post("/api/firstuser/usage/heartbeat", finalPayload);
  }

  Future<Map<String, dynamic>> setPlanTier(
    String externalUserId,
    String planTier,
  ) async {
    _ensureInitialized();
    return _post("/api/firstuser/users/$externalUserId/plan", {
      "planTier": planTier,
    });
  }

  Future<Map<String, dynamic>> getHostedChatWidgetToken(
    String externalUserId,
  ) async {
    _ensureInitialized();
    return _post("/api/firstuser/chat/widget-token", {
      "externalUserId": externalUserId,
    });
  }

  void _ensureInitialized() {
    if (_config == null) {
      throw Exception("FirstUserSdk not initialized");
    }
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> payload,
  ) async {
    final cfg = _config;
    if (cfg == null) throw Exception("FirstUserSdk not initialized");
    return {
      "endpoint": "${cfg.backendBaseUrl}$path",
      "payload": payload,
    };
  }
}
