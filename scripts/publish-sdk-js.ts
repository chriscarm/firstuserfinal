import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JS_SDK_PACKAGES } from "./sdk-release-config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const publishMode = process.argv.includes("--publish") ? "publish" : "dry-run";

function assertDistArtifacts(packageDir: string) {
  const distDir = path.join(packageDir, "dist");
  const required = ["index.js", "index.cjs", "index.d.ts"];

  if (!fs.existsSync(distDir)) {
    throw new Error(`Missing dist directory: ${distDir}. Run npm run build:sdk-js first.`);
  }

  for (const file of required) {
    const artifact = path.join(distDir, file);
    if (!fs.existsSync(artifact)) {
      throw new Error(`Missing artifact: ${artifact}. Run npm run build:sdk-js first.`);
    }
  }
}

function publishPackage(packageAbsDir: string, mode: "publish" | "dry-run") {
  const baseArgs = ["publish", "--access", "public"];
  if (mode === "dry-run") {
    baseArgs.push("--dry-run");
  } else {
    baseArgs.push("--provenance");
  }

  execFileSync("npm", baseArgs, {
    cwd: packageAbsDir,
    stdio: "inherit",
  });
}

function main() {
  console.log(`SDK JS release mode: ${publishMode}`);

  for (const pkg of JS_SDK_PACKAGES) {
    const packageAbsDir = path.join(repoRoot, pkg.packageDir);
    assertDistArtifacts(packageAbsDir);

    console.log(`Publishing ${pkg.packageName} (${pkg.id})...`);
    publishPackage(packageAbsDir, publishMode);
  }

  console.log(`Completed JS SDK ${publishMode} for ${JS_SDK_PACKAGES.length} packages.`);
}

main();
