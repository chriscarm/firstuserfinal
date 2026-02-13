# FirstUser Next.js SDK Starter

Use this starter for Next.js apps that need browser + server integration.

Required surface:
- init
- startPresence
- mountHostedChatWidget
- startEmbeddedWaitlist
- setPlanTier

Expected partner backend routes:
- POST /api/firstuser/waitlist/start
- POST /api/firstuser/users/:externalUserId/plan
