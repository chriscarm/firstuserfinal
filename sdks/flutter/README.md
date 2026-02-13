# FirstUser Flutter SDK

Use this in Flutter mobile apps.

Methods:
- init
- startPresence
- stopPresence
- mountHostedChatWidget
- startEmbeddedWaitlist
- exchangeAccessCode
- sendHeartbeat
- setPlanTier
- getHostedChatWidgetToken

Partner backend routes this SDK calls:
- POST /api/firstuser/waitlist/start
- POST /api/firstuser/access/exchange
- POST /api/firstuser/usage/heartbeat
- POST /api/firstuser/users/:externalUserId/plan
- POST /api/firstuser/chat/widget-token
