import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface SdkContract {
  requiredMethods: string[];
  requiredApiFlows: string[];
  requiredRealtimeEvents: string[];
}

interface PlatformKit {
  id: string;
  sourcePath: string;
  readmePath: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const contractPath = path.join(repoRoot, "sdks", "contract", "firstuser-sdk-contract.json");
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8")) as SdkContract;

const platformKits: PlatformKit[] = [
  { id: "web", sourcePath: "sdks/web/index.ts", readmePath: "sdks/web/README.md" },
  { id: "react-native", sourcePath: "sdks/react-native/index.ts", readmePath: "sdks/react-native/README.md" },
  { id: "ios-swift", sourcePath: "sdks/ios-swift/Sources/FirstUserSDK/FirstUserSDK.swift", readmePath: "sdks/ios-swift/README.md" },
  { id: "android-kotlin", sourcePath: "sdks/android-kotlin/src/main/kotlin/com/firstuser/sdk/FirstUserSdk.kt", readmePath: "sdks/android-kotlin/README.md" },
  { id: "flutter", sourcePath: "sdks/flutter/lib/firstuser_sdk.dart", readmePath: "sdks/flutter/README.md" },
  { id: "expo", sourcePath: "sdks/expo/src/index.ts", readmePath: "sdks/expo/README.md" },
  { id: "capacitor", sourcePath: "sdks/capacitor/src/index.ts", readmePath: "sdks/capacitor/README.md" },
  { id: "unity", sourcePath: "sdks/unity/FirstUserSDK.cs", readmePath: "sdks/unity/README.md" },
  { id: "nextjs", sourcePath: "sdks/nextjs/src/index.ts", readmePath: "sdks/nextjs/README.md" },
  { id: "vue", sourcePath: "sdks/vue/src/index.ts", readmePath: "sdks/vue/README.md" },
  { id: "nuxt", sourcePath: "sdks/nuxt/src/index.ts", readmePath: "sdks/nuxt/README.md" },
  { id: "angular", sourcePath: "sdks/angular/projects/firstuser-sdk/src/lib/firstuser-sdk.service.ts", readmePath: "sdks/angular/README.md" },
];

assert.ok(Array.isArray(contract.requiredMethods) && contract.requiredMethods.length > 0, "SDK contract missing requiredMethods");
assert.ok(Array.isArray(contract.requiredApiFlows) && contract.requiredApiFlows.length > 0, "SDK contract missing requiredApiFlows");
assert.ok(Array.isArray(contract.requiredRealtimeEvents) && contract.requiredRealtimeEvents.length > 0, "SDK contract missing requiredRealtimeEvents");
assert.equal(platformKits.length, 12, "Expected 12 platform kits");

for (const platform of platformKits) {
  const sourceAbsPath = path.join(repoRoot, platform.sourcePath);
  const readmeAbsPath = path.join(repoRoot, platform.readmePath);

  assert.ok(fs.existsSync(sourceAbsPath), `${platform.id}: missing source file (${platform.sourcePath})`);
  assert.ok(fs.existsSync(readmeAbsPath), `${platform.id}: missing README (${platform.readmePath})`);

  const sourceText = fs.readFileSync(sourceAbsPath, "utf8");
  const readmeText = fs.readFileSync(readmeAbsPath, "utf8");

  for (const method of contract.requiredMethods) {
    assert.ok(sourceText.includes(method), `${platform.id}: missing method token '${method}' in source`);
    assert.ok(readmeText.includes(method), `${platform.id}: missing method token '${method}' in README`);
  }

  assert.ok(
    sourceText.includes("/api/firstuser/waitlist/start"),
    `${platform.id}: source missing /api/firstuser/waitlist/start route`,
  );
  assert.ok(
    sourceText.includes("/api/firstuser/users") && sourceText.includes("/plan"),
    `${platform.id}: source missing /api/firstuser/users/:externalUserId/plan route shape`,
  );
}

const workspaceReadmePath = path.join(repoRoot, "sdks", "README.md");
const workspaceReadme = fs.readFileSync(workspaceReadmePath, "utf8");
for (const platform of platformKits) {
  assert.ok(workspaceReadme.includes(platform.id), `sdks/README.md missing platform '${platform.id}'`);
}

console.log(`SDK platform conformance passed for ${platformKits.length} starter kits.`);
