# FirstUser Nuxt SDK Starter

Use this starter for Nuxt apps (Nitro server + client composables).

Required surface:
- init
- startPresence
- mountHostedChatWidget
- startEmbeddedWaitlist
- setPlanTier

Expected partner backend routes:
- POST /api/firstuser/waitlist/start
- POST /api/firstuser/users/:externalUserId/plan
