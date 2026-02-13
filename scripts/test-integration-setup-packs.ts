import assert from "node:assert/strict";
import {
  buildIntegrationSetupPack,
  SUPPORTED_INTEGRATION_STACKS,
  type IntegrationStack,
} from "../server/integrationSetupPack";

const commonPromptNeedles = [
  "/api/integration/v1/waitlist/start",
  "/api/integration/v1/access/exchange",
  "/api/integration/v1/usage/heartbeat",
  "/api/integration/v1/users/:externalUserId/plan",
  "/api/integration/v1/chat/widget-token",
  "x-firstuser-signature-sha256",
];

const stackSpecificNeedles: Record<IntegrationStack, string[]> = {
  web: ["browser redirects"],
  "react-native": ["deep links"],
  "ios-swift": ["Swift Package Manager"],
  "android-kotlin": ["AAR"],
  flutter: ["Flutter plugin"],
  expo: ["Expo modules"],
  capacitor: ["Capacitor plugin"],
  unity: ["Unity C# wrapper"],
  nextjs: ["Next.js server routes"],
  vue: ["composables/plugins"],
  nuxt: ["Nitro server routes"],
  angular: ["Angular services/guards"],
};

function validateStack(stack: IntegrationStack) {
  const setupPack = buildIntegrationSetupPack({
    appName: "Acme App",
    appSpaceSlug: "acme",
    publicAppId: "app_acme_123",
    stack,
    baseUrl: "https://firstuser.example.com",
    webRedirectUrl: "https://acme.example.com/auth/firstuser",
    mobileDeepLinkUrl: "acme://firstuser/access",
    redirectEnabled: true,
    embeddedEnabled: true,
    webhookUrl: "https://acme.example.com/api/webhooks/firstuser",
    webhookSecretLastFour: "abcd",
    hasApiKey: true,
    keyId: "fuk_demo",
  });

  assert.ok(setupPack.masterPrompt.includes(`Target stack: ${stack}.`), `${stack}: missing stack marker`);
  assert.ok(setupPack.masterPrompt.includes("Hosted Join URL"), `${stack}: missing hosted join URL instructions`);

  for (const needle of commonPromptNeedles) {
    assert.ok(setupPack.masterPrompt.includes(needle), `${stack}: missing required prompt content '${needle}'`);
  }

  for (const needle of stackSpecificNeedles[stack]) {
    assert.ok(setupPack.masterPrompt.includes(needle), `${stack}: missing stack-specific prompt content '${needle}'`);
  }

  assert.ok(setupPack.fallbackManualSteps.length >= 7, `${stack}: fallback steps too short`);
  assert.ok(setupPack.verificationChecklist.length >= 6, `${stack}: verification checklist too short`);

  const checklistText = setupPack.verificationChecklist.join("\n");
  assert.ok(checklistText.includes("Join Waitlist"), `${stack}: checklist missing join flow validation`);
  assert.ok(checklistText.includes("exchange access code"), `${stack}: checklist missing exchange validation`);
  assert.ok(checklistText.includes("Heartbeat"), `${stack}: checklist missing heartbeat validation`);
  assert.ok(checklistText.includes("chat"), `${stack}: checklist missing chat validation`);
}

for (const stack of SUPPORTED_INTEGRATION_STACKS) {
  validateStack(stack);
}

console.log(`Integration setup pack conformance passed for ${SUPPORTED_INTEGRATION_STACKS.length} stacks.`);
