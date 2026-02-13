# FirstUser SDK Workspace

This folder contains the integration starter kits that our AI Setup Pack can generate against.

If you are a founder with no coding background, your flow is:
1. Open Founder Tools -> Integrate.
2. Copy the "Master Prompt".
3. Paste it into your AI coding tool.
4. The AI implements one of these SDK starters in your app stack.

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

Every SDK kit includes:
- a platform README
- a starter implementation exposing the required FirstUser methods

Contract source of truth:
- `sdks/contract/firstuser-sdk-contract.json`

Current required methods:
- `init`
- `startPresence`
- `mountHostedChatWidget`
- `startEmbeddedWaitlist`
- `setPlanTier`

Partner backend route convention used by starter kits:
- `POST /api/firstuser/waitlist/start`
- `POST /api/firstuser/users/:externalUserId/plan`

Validation command:
- `npm run test:sdk-kits`
