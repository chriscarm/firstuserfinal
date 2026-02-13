# FirstUser SDK Workspace

This workspace contains production-ready v1 SDK kits for every supported integration stack.

Supported stacks:
1. web
2. react-native
3. ios-swift
4. android-kotlin
5. flutter
6. expo
7. capacitor
8. unity
9. nextjs
10. vue
11. nuxt
12. angular

Each SDK exposes the same contract so founders can use one integration mental model across platforms.

Required method contract (shared across all stacks):
- init
- startPresence
- stopPresence
- mountHostedChatWidget
- startEmbeddedWaitlist
- exchangeAccessCode
- sendHeartbeat
- setPlanTier
- getHostedChatWidgetToken

Required partner backend routes called by SDKs:
- POST /api/firstuser/waitlist/start
- POST /api/firstuser/access/exchange
- POST /api/firstuser/usage/heartbeat
- POST /api/firstuser/users/:externalUserId/plan
- POST /api/firstuser/chat/widget-token

Contract source of truth:
- `sdks/contract/firstuser-sdk-contract.json`

Validation commands:
- `npm run test:integration-stacks`
- `npm run test:sdk-kits`
- `npm run test:sdk-runtime`
