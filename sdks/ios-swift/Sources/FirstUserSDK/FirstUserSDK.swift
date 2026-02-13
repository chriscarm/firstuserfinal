import Foundation

public struct FirstUserConfig {
    public let baseUrl: String
    public let publicAppId: String
    public let backendBaseUrl: String
    public let heartbeatIntervalMs: TimeInterval
    public let defaultClientPlatform: String

    public init(
        baseUrl: String,
        publicAppId: String,
        backendBaseUrl: String,
        heartbeatIntervalMs: TimeInterval = 15000,
        defaultClientPlatform: String = "ios-swift"
    ) {
        self.baseUrl = baseUrl
        self.publicAppId = publicAppId
        self.backendBaseUrl = backendBaseUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        self.heartbeatIntervalMs = heartbeatIntervalMs
        self.defaultClientPlatform = defaultClientPlatform
    }
}

public enum FirstUserSDKError: Error {
    case notInitialized
    case invalidUrl
    case invalidResponse
    case requestFailed(String)
}

public final class FirstUserSDK {
    private var config: FirstUserConfig?
    private var heartbeatTimer: Timer?

    public init() {}

    public func initSdk(_ config: FirstUserConfig) {
        self.config = config
    }

    public func `init`(_ config: FirstUserConfig) {
        initSdk(config)
    }

    public func startPresence(sendHeartbeat: @escaping (String) -> Void) {
        stopPresence()
        sendHeartbeat("live")
        let interval = (config?.heartbeatIntervalMs ?? 15000) / 1000
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { _ in
            sendHeartbeat("live")
        }
    }

    public func stopPresence() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
    }

    public func mountHostedChatWidget(widgetUrl: String) -> URL? {
        URL(string: widgetUrl)
    }

    public func startEmbeddedWaitlist(payload: [String: Any]) async throws -> Data {
        try await post(path: "/api/firstuser/waitlist/start", body: payload)
    }

    public func exchangeAccessCode(payload: [String: Any]) async throws -> Data {
        var finalPayload = payload
        if finalPayload["clientPlatform"] == nil {
            finalPayload["clientPlatform"] = config?.defaultClientPlatform ?? "ios-swift"
        }
        return try await post(path: "/api/firstuser/access/exchange", body: finalPayload)
    }

    public func sendHeartbeat(payload: [String: Any]) async throws -> Data {
        var finalPayload = payload
        if finalPayload["status"] == nil {
            finalPayload["status"] = "live"
        }
        if finalPayload["clientPlatform"] == nil {
            finalPayload["clientPlatform"] = config?.defaultClientPlatform ?? "ios-swift"
        }
        return try await post(path: "/api/firstuser/usage/heartbeat", body: finalPayload)
    }

    public func setPlanTier(externalUserId: String, planTier: String) async throws -> Data {
        try await post(
            path: "/api/firstuser/users/\(externalUserId)/plan",
            body: ["planTier": planTier]
        )
    }

    public func getHostedChatWidgetToken(externalUserId: String) async throws -> Data {
        try await post(
            path: "/api/firstuser/chat/widget-token",
            body: ["externalUserId": externalUserId]
        )
    }

    private func post(path: String, body: [String: Any]) async throws -> Data {
        guard let config else { throw FirstUserSDKError.notInitialized }
        guard let url = URL(string: "\(config.backendBaseUrl)\(path)") else {
            throw FirstUserSDKError.invalidUrl
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw FirstUserSDKError.invalidResponse
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            throw FirstUserSDKError.requestFailed("Request failed for \(path) with status \(httpResponse.statusCode)")
        }

        return data
    }
}
