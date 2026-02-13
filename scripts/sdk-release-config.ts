export interface JsSdkPackageConfig {
  id: string;
  packageName: string;
  packageDir: string;
  entryFile: string;
}

export const JS_SDK_PACKAGES: JsSdkPackageConfig[] = [
  {
    id: "web",
    packageName: "@firstuser/sdk-web",
    packageDir: "sdks/web",
    entryFile: "index.ts",
  },
  {
    id: "react-native",
    packageName: "@firstuser/sdk-react-native",
    packageDir: "sdks/react-native",
    entryFile: "index.ts",
  },
  {
    id: "expo",
    packageName: "@firstuser/sdk-expo",
    packageDir: "sdks/expo",
    entryFile: "src/index.ts",
  },
  {
    id: "capacitor",
    packageName: "@firstuser/sdk-capacitor",
    packageDir: "sdks/capacitor",
    entryFile: "src/index.ts",
  },
  {
    id: "nextjs",
    packageName: "@firstuser/sdk-nextjs",
    packageDir: "sdks/nextjs",
    entryFile: "src/index.ts",
  },
  {
    id: "vue",
    packageName: "@firstuser/sdk-vue",
    packageDir: "sdks/vue",
    entryFile: "src/index.ts",
  },
  {
    id: "nuxt",
    packageName: "@firstuser/sdk-nuxt",
    packageDir: "sdks/nuxt",
    entryFile: "src/index.ts",
  },
  {
    id: "angular",
    packageName: "@firstuser/sdk-angular",
    packageDir: "sdks/angular",
    entryFile: "projects/firstuser-sdk/src/index.ts",
  },
];

export const RELEASE_WORKFLOW_FILES = [
  ".github/workflows/sdk-release-readiness.yml",
  ".github/workflows/sdk-publish-js.yml",
  ".github/workflows/sdk-publish-android.yml",
  ".github/workflows/sdk-publish-flutter.yml",
];

export const NON_JS_RELEASE_FILES = [
  "sdks/android-kotlin/build.gradle.kts",
  "sdks/android-kotlin/settings.gradle.kts",
  "sdks/android-kotlin/gradle.properties",
  "sdks/ios-swift/Package.swift",
  "sdks/flutter/pubspec.yaml",
  "sdks/unity/package.json",
  "docs/SDK_PRODUCTION_RELEASE_GUIDE.md",
];
