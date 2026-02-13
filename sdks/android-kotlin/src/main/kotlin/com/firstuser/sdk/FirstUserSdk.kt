package com.firstuser.sdk

data class FirstUserConfig(
  val baseUrl: String,
  val publicAppId: String,
  val backendBaseUrl: String,
)

class FirstUserSdk {
  private var config: FirstUserConfig? = null

  fun init(config: FirstUserConfig) {
    this.config = config
  }

  fun startPresence(sendHeartbeat: (String) -> Unit) {
    sendHeartbeat("live")
  }

  fun mountHostedChatWidget(widgetUrl: String): String {
    return widgetUrl
  }

  suspend fun startEmbeddedWaitlist(payload: Map<String, String>): String {
    requireNotNull(config) { "FirstUserSdk not initialized" }
    return "POST /api/firstuser/waitlist/start payload=$payload"
  }

  suspend fun setPlanTier(externalUserId: String, planTier: String): String {
    requireNotNull(config) { "FirstUserSdk not initialized" }
    return "POST /api/firstuser/users/$externalUserId/plan planTier=$planTier"
  }
}
