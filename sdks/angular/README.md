# FirstUser Angular SDK Starter

Use this starter for Angular apps via a shared injectable service.

Required surface:
- init
- startPresence
- mountHostedChatWidget
- startEmbeddedWaitlist
- setPlanTier

Expected partner backend routes:
- POST /api/firstuser/waitlist/start
- POST /api/firstuser/users/:externalUserId/plan
