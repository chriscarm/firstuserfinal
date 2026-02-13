package com.firstuser.sdk

import java.util.Timer
import kotlin.concurrent.fixedRateTimer

data class FirstUserConfig(
  val baseUrl: String,
  val publicAppId: String,
  val backendBaseUrl: String,
  val heartbeatIntervalMs: Long = 15000,
  val defaultClientPlatform: String = "android-kotlin",
)

class FirstUserSdk {
  private var config: FirstUserConfig? = null
  private var heartbeatTimer: Timer? = null

  fun init(config: FirstUserConfig) {
    this.config = config.copy(backendBaseUrl = config.backendBaseUrl.trimEnd('/'))
  }

  fun startPresence(sendHeartbeat: (String) -> Unit) {
    stopPresence()
    sendHeartbeat("live")
    val interval = config?.heartbeatIntervalMs ?: 15000
    heartbeatTimer = fixedRateTimer(initialDelay = interval, period = interval) {
      sendHeartbeat("live")
    }
  }

  fun stopPresence() {
    heartbeatTimer?.cancel()
    heartbeatTimer = null
  }

  fun mountHostedChatWidget(widgetUrl: String): String {
    return widgetUrl
  }

  suspend fun startEmbeddedWaitlist(payload: Map<String, String>): String {
    return post("/api/firstuser/waitlist/start", payload)
  }

  suspend fun exchangeAccessCode(payload: Map<String, String>): String {
    val finalPayload = payload.toMutableMap()
    if (!finalPayload.containsKey("clientPlatform")) {
      finalPayload["clientPlatform"] = config?.defaultClientPlatform ?: "android-kotlin"
    }
    return post("/api/firstuser/access/exchange", finalPayload)
  }

  suspend fun sendHeartbeat(payload: Map<String, String>): String {
    val finalPayload = payload.toMutableMap()
    if (!finalPayload.containsKey("status")) {
      finalPayload["status"] = "live"
    }
    if (!finalPayload.containsKey("clientPlatform")) {
      finalPayload["clientPlatform"] = config?.defaultClientPlatform ?: "android-kotlin"
    }
    return post("/api/firstuser/usage/heartbeat", finalPayload)
  }

  suspend fun setPlanTier(externalUserId: String, planTier: String): String {
    return post("/api/firstuser/users/$externalUserId/plan", mapOf("planTier" to planTier))
  }

  suspend fun getHostedChatWidgetToken(externalUserId: String): String {
    return post("/api/firstuser/chat/widget-token", mapOf("externalUserId" to externalUserId))
  }

  private suspend fun post(path: String, payload: Map<String, String>): String {
    val cfg = requireNotNull(config) { "FirstUserSdk not initialized" }
    return "POST ${cfg.backendBaseUrl}$path payload=$payload"
  }
}
