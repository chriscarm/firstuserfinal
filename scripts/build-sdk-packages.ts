import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JS_SDK_PACKAGES, type JsSdkPackageConfig } from "./sdk-release-config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function removeDist(distDir: string) {
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
}

async function buildPackage(pkg: JsSdkPackageConfig) {
  const packageAbsDir = path.join(repoRoot, pkg.packageDir);
  const entryAbsPath = path.join(packageAbsDir, pkg.entryFile);
  const distAbsDir = path.join(packageAbsDir, "dist");
  const entryBaseName = path.basename(pkg.entryFile, path.extname(pkg.entryFile));

  if (!fs.existsSync(entryAbsPath)) {
    throw new Error(`${pkg.id}: missing entry file ${pkg.entryFile}`);
  }

  removeDist(distAbsDir);

  await build({
    entryPoints: [entryAbsPath],
    outfile: path.join(distAbsDir, "index.js"),
    bundle: false,
    sourcemap: true,
    target: "es2020",
    format: "esm",
    platform: "neutral",
  });

  await build({
    entryPoints: [entryAbsPath],
    outfile: path.join(distAbsDir, "index.cjs"),
    bundle: false,
    sourcemap: true,
    target: "es2020",
    format: "cjs",
    platform: "neutral",
  });

  execFileSync(
    "npx",
    [
      "tsc",
      entryAbsPath,
      "--declaration",
      "--emitDeclarationOnly",
      "--module",
      "ESNext",
      "--target",
      "ES2020",
      "--moduleResolution",
      "Bundler",
      "--skipLibCheck",
      "--rootDir",
      path.dirname(entryAbsPath),
      "--outDir",
      distAbsDir,
    ],
    { stdio: "inherit", cwd: repoRoot },
  );

  const declarationFrom = path.join(distAbsDir, `${entryBaseName}.d.ts`);
  const declarationTo = path.join(distAbsDir, "index.d.ts");

  if (!fs.existsSync(declarationFrom)) {
    throw new Error(`${pkg.id}: expected declaration at ${declarationFrom}`);
  }

  if (declarationFrom !== declarationTo) {
    fs.copyFileSync(declarationFrom, declarationTo);
  }

  console.log(`Built ${pkg.id} SDK package.`);
}

async function main() {
  for (const pkg of JS_SDK_PACKAGES) {
    await buildPackage(pkg);
  }
  console.log(`Built ${JS_SDK_PACKAGES.length} JS SDK packages.`);
}

await main();
