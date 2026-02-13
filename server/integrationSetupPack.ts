export const SUPPORTED_INTEGRATION_STACKS = [
  "web",
  "react-native",
  "ios-swift",
  "android-kotlin",
  "flutter",
  "expo",
  "capacitor",
  "unity",
  "nextjs",
  "vue",
  "nuxt",
  "angular",
] as const;

export type IntegrationStack = typeof SUPPORTED_INTEGRATION_STACKS[number];

export interface IntegrationSetupPackOptions {
  appName: string;
  appSpaceSlug: string;
  publicAppId: string;
  stack: IntegrationStack;
  baseUrl: string;
  webRedirectUrl: string | null;
  mobileDeepLinkUrl: string | null;
  redirectEnabled: boolean;
  embeddedEnabled: boolean;
  webhookUrl: string | null;
  webhookSecretLastFour?: string | null;
  hasApiKey: boolean;
  keyId?: string;
}

export interface IntegrationSetupPack {
  masterPrompt: string;
  fallbackManualSteps: string[];
  verificationChecklist: string[];
}

const STACK_LABELS: Record<IntegrationStack, string> = {
  web: "Web (Vanilla JS)",
  "react-native": "React Native",
  "ios-swift": "iOS (Swift)",
  "android-kotlin": "Android (Kotlin)",
  flutter: "Flutter",
  expo: "Expo",
  capacitor: "Capacitor",
  unity: "Unity",
  nextjs: "Next.js",
  vue: "Vue",
  nuxt: "Nuxt",
  angular: "Angular",
};

const STACK_NOTES: Record<IntegrationStack, string> = {
  web: "Use browser redirects and server-side fetch calls for all protected FirstUser API operations.",
  "react-native": "Use deep links and a backend-for-mobile pattern. Never call integration API key routes directly from client app code.",
  "ios-swift": "Use Swift Package Manager integration and URL schemes/universal links for access handoff.",
  "android-kotlin": "Ship as Android library (AAR), use intent/deep-link handoff, and keep FirstUser API keys server-side only.",
  flutter: "Implement a Flutter plugin with platform channels to native iOS/Android for deep links and lifecycle hooks.",
  expo: "Use Expo modules + EAS compatible deep links. Keep all secure exchange and heartbeat auth in backend routes.",
  capacitor: "Implement as a Capacitor plugin with iOS/Android bridge and web fallback, with server-controlled exchange flow.",
  unity: "Implement as Unity C# wrapper plus native plugins for iOS/Android deep-link handoff and lifecycle heartbeat.",
  nextjs: "Use Next.js server routes/actions for secure API key calls and middleware-safe redirect handoffs.",
  vue: "Use composables/plugins for client hooks and server endpoints for secure exchange/heartbeat.",
  nuxt: "Use Nuxt server routes for secure integration calls and composables for client-side session wiring.",
  angular: "Use Angular services/guards for app flow and backend routes for all API-key-authenticated FirstUser calls.",
};

const STACK_IMPLEMENTATION_HINTS: Record<IntegrationStack, string[]> = {
  web: [
    "Expose a backend endpoint for /auth/firstuser redirect handoff and access code exchange.",
    "Mount hosted chat in iframe after fetching widget token from your backend.",
  ],
  "react-native": [
    "Handle approved access deep links in Linking and forward code to backend exchange endpoint.",
    "Mount hosted chat widget in WebView using server-issued widgetUrl.",
  ],
  "ios-swift": [
    "Implement openURL/scene deep-link handling for fu_access_code handoff.",
    "Use URLSession to your backend only; backend talks to FirstUser integration API.",
  ],
  "android-kotlin": [
    "Handle intent-filter deep links and pass fu_access_code to backend exchange endpoint.",
    "Use OkHttp/Retrofit to your backend; backend handles FirstUser integration credentials.",
  ],
  flutter: [
    "Use uni_links/app_links for deep-link handoff and a repository layer for backend API calls.",
    "Bridge app lifecycle states to heartbeat status live/idle/offline.",
  ],
  expo: [
    "Configure app.json scheme + linking for approved access handoff.",
    "Use server API routes for exchange/heartbeat; Expo client never sees integration key.",
  ],
  capacitor: [
    "Use App plugin URL open events for access deep-link parsing.",
    "Route exchange + heartbeat through your server endpoints.",
  ],
  unity: [
    "Add C# manager that forwards deep-link/access codes to partner backend.",
    "Emit heartbeat on app focus/resume/pause with 15s cadence while active.",
  ],
  nextjs: [
    "Use Route Handlers (/app/api/* or /pages/api/*) for waitlist/start, access/exchange, and heartbeat proxy calls.",
    "Use server-side redirects for hosted join and approved return flow.",
  ],
  vue: [
    "Implement plugin/composable for session + heartbeat orchestration.",
    "Use backend route proxy for all API-key-protected FirstUser endpoints.",
  ],
  nuxt: [
    "Use Nitro server routes for waitlist/start and access/exchange calls.",
    "Wire client heartbeat via composable and visibility lifecycle hooks.",
  ],
  angular: [
    "Use HttpClient services + route guards for auth handoff and post-exchange state.",
    "Use backend API endpoints for secure FirstUser integration calls.",
  ],
};

export function isIntegrationStack(value: unknown): value is IntegrationStack {
  return typeof value === "string" && (SUPPORTED_INTEGRATION_STACKS as readonly string[]).includes(value);
}

export function buildIntegrationSetupPack(options: IntegrationSetupPackOptions): IntegrationSetupPack {
  const integrationApiBase = `${options.baseUrl}/api/integration/v1`;
  const hostedJoinUrl = `${options.baseUrl}/i/${options.publicAppId}/join`;
  const stackLabel = STACK_LABELS[options.stack];
  const platformNotes = STACK_NOTES[options.stack];
  const stackHints = STACK_IMPLEMENTATION_HINTS[options.stack];
  const keyInstruction = options.hasApiKey && options.keyId
    ? `Use API key id ${options.keyId} and the secret shown in Founder Tools when authenticating with FirstUser.`
    : "First generate an API key in FirstUser Founder Tools > Integrate, then use it for all server-to-server calls.";

  const masterPrompt = `You are implementing FirstUser integration for ${options.appName}.

Goal:
- Add FirstUser waitlist + approval access + live usage heartbeat + founder chat support.
- Target stack: ${options.stack}.
- Stack label: ${stackLabel}.
- ${platformNotes}

FirstUser config:
- Base URL: ${options.baseUrl}
- Public App ID: ${options.publicAppId}
- Hosted Join URL: ${hostedJoinUrl}
- Redirect enabled: ${options.redirectEnabled}
- Embedded enabled: ${options.embeddedEnabled}
- Partner web redirect URL: ${options.webRedirectUrl || "(not set yet)"}
- Partner mobile deep link URL: ${options.mobileDeepLinkUrl || "(not set yet)"}
- Webhook URL: ${options.webhookUrl || "(not set yet)"}
- Webhook secret ending: ${options.webhookSecretLastFour || "(rotate webhook secret in Founder Tools)"}
- ${keyInstruction}

Platform-specific implementation notes:
${stackHints.map((hint, idx) => `${idx + 1}. ${hint}`).join("\n")}

Implement exactly:
1) Add a "Join Waitlist" entry point that points to ${hostedJoinUrl} (redirect mode).
2) If using embedded mode, add backend endpoint that calls ${integrationApiBase}/waitlist/start and then redirects user to the returned continuationUrl.
3) On approval deep-link/access code, call backend to exchange code with ${integrationApiBase}/access/exchange.
4) Map external user id to returned FirstUser user id.
5) Start heartbeat every 15s from backend via ${integrationApiBase}/usage/heartbeat with status live/idle/offline and clientPlatform.
6) Send plan tier updates to ${integrationApiBase}/users/:externalUserId/plan whenever billing tier changes.
7) Request hosted chat widget token from ${integrationApiBase}/chat/widget-token and mount iframe/webview to the returned widgetUrl.
8) Do not expose API secrets in frontend/mobile code. Backend only.
9) Verify webhook signatures using header x-firstuser-signature-sha256 and your FirstUser webhook secret.

Output required:
- Provide files changed.
- Provide the exact environment variables needed.
- Provide a short test plan proving: join flow, access exchange, heartbeat, and chat widget load.
`;

  const fallbackManualSteps = [
    "Create or rotate an integration API key in Founder Tools > Integrate.",
    `Add a Join Waitlist entry point in your app linking to ${hostedJoinUrl}.`,
    "When users are approved, consume access code on your backend via /api/integration/v1/access/exchange.",
    "Store external_user_id <-> firstuser_user_id mapping in your database.",
    "Send usage heartbeat every 15 seconds while app is active.",
    "Mount hosted chat widget URL returned from /api/integration/v1/chat/widget-token.",
    "Validate incoming webhook signatures before processing events.",
  ];

  const verificationChecklist = [
    "Join Waitlist entry opens FirstUser join flow.",
    "Approved user can one-click into app and exchange access code successfully.",
    "Heartbeat appears in Founder Tools Live Now within 20 seconds.",
    "User disappears from live list within 45 seconds after app close.",
    "Founder can send chat message and user receives it in hosted widget.",
    "No phone/email appears in founder live user or chat payloads.",
  ];

  return {
    masterPrompt,
    fallbackManualSteps,
    verificationChecklist,
  };
}

