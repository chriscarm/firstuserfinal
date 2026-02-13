# Integration Stack Matrix

FirstUser now ships AI setup packs for the following stacks:

1. `web`
2. `react-native`
3. `ios-swift`
4. `android-kotlin`
5. `flutter`
6. `expo`
7. `capacitor`
8. `unity`
9. `nextjs`
10. `vue`
11. `nuxt`
12. `angular`

## How setup packs are validated

Run:

```bash
npm run test:integration-stacks
```

This conformance test verifies every stack prompt includes:
- waitlist start API flow
- access exchange API flow
- heartbeat API flow
- plan sync API flow
- chat widget token API flow
- webhook signature verification guidance
- stack-specific implementation notes

## Founder Tools behavior

Founder Tools -> Integrate -> Step 3 now lets founders select any supported stack and copy a platform-specific master prompt.
