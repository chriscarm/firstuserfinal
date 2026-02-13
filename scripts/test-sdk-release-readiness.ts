import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  JS_SDK_PACKAGES,
  NON_JS_RELEASE_FILES,
  RELEASE_WORKFLOW_FILES,
} from "./sdk-release-config";

interface PackageJsonShape {
  name?: string;
  version?: string;
  main?: string;
  module?: string;
  types?: string;
  files?: string[];
  publishConfig?: {
    access?: string;
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function assertFileExists(relativePath: string) {
  const fullPath = path.join(repoRoot, relativePath);
  assert.ok(fs.existsSync(fullPath), `Missing required file: ${relativePath}`);
}

function assertIncludes(filePath: string, token: string) {
  const fullPath = path.join(repoRoot, filePath);
  const content = fs.readFileSync(fullPath, "utf8");
  assert.ok(content.includes(token), `${filePath} missing token '${token}'`);
}

function validateJsPackages() {
  const seenNames = new Set<string>();

  for (const pkg of JS_SDK_PACKAGES) {
    const packageJsonPath = path.join(repoRoot, pkg.packageDir, "package.json");
    assert.ok(fs.existsSync(packageJsonPath), `${pkg.id}: missing package.json`);

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as PackageJsonShape;

    assert.equal(packageJson.name, pkg.packageName, `${pkg.id}: package name mismatch`);
    assert.ok(packageJson.version && packageJson.version.length > 0, `${pkg.id}: version missing`);
    assert.equal(packageJson.main, "dist/index.cjs", `${pkg.id}: main should be dist/index.cjs`);
    assert.equal(packageJson.module, "dist/index.js", `${pkg.id}: module should be dist/index.js`);
    assert.equal(packageJson.types, "dist/index.d.ts", `${pkg.id}: types should be dist/index.d.ts`);
    assert.equal(packageJson.publishConfig?.access, "public", `${pkg.id}: publish access must be public`);
    assert.ok(Array.isArray(packageJson.files), `${pkg.id}: files field missing`);
    assert.ok(packageJson.files?.includes("dist"), `${pkg.id}: files should include dist`);

    assert.ok(!seenNames.has(pkg.packageName), `${pkg.id}: duplicate package name ${pkg.packageName}`);
    seenNames.add(pkg.packageName);

    const packageAbsDir = path.join(repoRoot, pkg.packageDir);
    const distArtifacts = ["dist/index.js", "dist/index.cjs", "dist/index.d.ts"];
    for (const artifact of distArtifacts) {
      assert.ok(fs.existsSync(path.join(packageAbsDir, artifact)), `${pkg.id}: missing build artifact ${artifact}`);
    }
  }
}

function validateNonJsReleaseScaffolding() {
  for (const relativePath of NON_JS_RELEASE_FILES) {
    assertFileExists(relativePath);
  }

  assertIncludes("sdks/android-kotlin/build.gradle.kts", "maven-publish");
  assertIncludes("sdks/android-kotlin/build.gradle.kts", "publishing");
  assertIncludes("sdks/flutter/pubspec.yaml", "homepage:");
  assertIncludes("sdks/flutter/pubspec.yaml", "repository:");
  assertIncludes("sdks/unity/package.json", "\"name\": \"com.firstuser.sdk\"");
}

function validateWorkflows() {
  for (const workflowPath of RELEASE_WORKFLOW_FILES) {
    assertFileExists(workflowPath);
  }
}

function main() {
  validateJsPackages();
  validateNonJsReleaseScaffolding();
  validateWorkflows();
  console.log("SDK production release readiness checks passed.");
}

main();
