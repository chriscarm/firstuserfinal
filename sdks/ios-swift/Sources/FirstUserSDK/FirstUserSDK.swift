import Foundation

public struct FirstUserConfig {
    public let baseUrl: String
    public let publicAppId: String
    public let backendBaseUrl: String

    public init(baseUrl: String, publicAppId: String, backendBaseUrl: String) {
        self.baseUrl = baseUrl
        self.publicAppId = publicAppId
        self.backendBaseUrl = backendBaseUrl
    }
}

public final class FirstUserSDK {
    private var config: FirstUserConfig?

    public init() {}

    public func initSdk(_ config: FirstUserConfig) {
        self.config = config
    }

    public func init(_ config: FirstUserConfig) {
        initSdk(config)
    }

    public func startPresence(sendHeartbeat: @escaping (String) -> Void) {
        sendHeartbeat("live")
    }

    public func mountHostedChatWidget(widgetUrl: String) -> URL? {
        URL(string: widgetUrl)
    }

    public func startEmbeddedWaitlist(payload: [String: String]) async throws -> Data {
        guard let config else { throw NSError(domain: "FirstUser", code: 1) }
        let endpoint = URL(string: "\(config.backendBaseUrl)/api/firstuser/waitlist/start")!
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        let (data, _) = try await URLSession.shared.data(for: request)
        return data
    }

    public func setPlanTier(externalUserId: String, planTier: String) async throws -> Data {
        guard let config else { throw NSError(domain: "FirstUser", code: 1) }
        let endpoint = URL(string: "\(config.backendBaseUrl)/api/firstuser/users/\(externalUserId)/plan")!
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["planTier": planTier])
        let (data, _) = try await URLSession.shared.data(for: request)
        return data
    }
}
