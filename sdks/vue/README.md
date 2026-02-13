# FirstUser Vue SDK Starter

Use this starter for Vue 3 apps with plugin/composable patterns.

Required surface:
- init
- startPresence
- mountHostedChatWidget
- startEmbeddedWaitlist
- setPlanTier

Expected partner backend routes:
- POST /api/firstuser/waitlist/start
- POST /api/firstuser/users/:externalUserId/plan
