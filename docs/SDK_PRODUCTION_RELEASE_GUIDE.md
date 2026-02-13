# SDK Production Release Guide

This guide explains how to release all FirstUser SDKs safely.

## What is now automated

- JS SDK package builds (web, react-native, expo, capacitor, nextjs, vue, nuxt, angular)
- JS SDK publish workflow to npm (manual trigger, dry-run supported)
- Release readiness checks for all platforms
- Android Maven publish configuration
- Flutter pub.dev metadata
- Unity UPM package metadata

## One-time setup (GitHub repository secrets)

Set these in GitHub repository settings before production publishing:

1. `NPM_TOKEN`
2. `MAVEN_REPOSITORY_URL`
3. `MAVEN_REPOSITORY_USERNAME`
4. `MAVEN_REPOSITORY_PASSWORD`
5. `PUB_DEV_CREDENTIALS_JSON` (contents of pub.dev credentials.json for CI publish)

## Local preflight command

Run this before every release:

```bash
npm run verify
```

That command now checks:
- integration setup packs
- SDK contract conformance
- SDK runtime smoke tests
- JS SDK package build artifacts
- release readiness rules

## JS SDK release flow (npm)

### Dry run (recommended first)

```bash
npm run release:sdk-js:dry
```

### Real publish

```bash
npm run release:sdk-js
```

## GitHub Actions release flow

### 1) Readiness workflow

Workflow file: `.github/workflows/sdk-release-readiness.yml`

Runs on push/PR and checks:
- `npm run verify`
- Android Gradle build smoke
- Swift package build smoke
- Flutter analyze smoke

### 2) JS publish workflow

Workflow file: `.github/workflows/sdk-publish-js.yml`

Run manually with inputs:
- `dry_run=true` for rehearsal
- `dry_run=false` for actual publish

### 3) Android publish workflow

Workflow file: `.github/workflows/sdk-publish-android.yml`

Run manually with inputs:
- `dry_run=true` publishes to local Maven cache on CI for validation
- `dry_run=false` publishes to configured Maven repository

### 4) Flutter publish workflow

Workflow file: `.github/workflows/sdk-publish-flutter.yml`

Run manually with inputs:
- `dry_run=true` runs `dart pub publish --dry-run`
- `dry_run=false` publishes to pub.dev using `PUB_DEV_CREDENTIALS_JSON`

## Non-JS release commands

### iOS Swift (Swift Package Manager)

- Uses `sdks/ios-swift/Package.swift`
- Release by tagging repo version and referencing tag in SPM

### Android Kotlin (Maven)

```bash
cd sdks/android-kotlin
gradle publish
```

Requires `MAVEN_REPOSITORY_URL`, `MAVEN_REPOSITORY_USERNAME`, and `MAVEN_REPOSITORY_PASSWORD`.

### Flutter (pub.dev)

```bash
cd sdks/flutter
dart pub publish --dry-run
```

### Unity (UPM/OpenUPM)

- Package metadata lives in `sdks/unity/package.json`
- Runtime assembly lives in `sdks/unity/Runtime`

## Versioning policy

- Keep all SDK package versions aligned per release (example: all `1.0.1`)
- Use semantic versioning:
  - patch = safe bug fix
  - minor = new backward-compatible feature
  - major = breaking change

## Launch checklist

1. `npm run verify` passes on main.
2. JS publish dry-run passes.
3. Readiness workflow is green.
4. Release notes mention changed SDK methods or routes.
5. Publish real release.
6. Install each SDK in sample apps and confirm smoke tests.
