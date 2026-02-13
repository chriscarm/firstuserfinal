import assert from "node:assert/strict";
import { setTimeout as wait } from "node:timers/promises";

import { FirstUserWebSDK } from "../sdks/web/index";
import { FirstUserReactNativeSDK } from "../sdks/react-native/index";
import { FirstUserExpoSDK } from "../sdks/expo/src/index";
import { FirstUserCapacitorSDK } from "../sdks/capacitor/src/index";
import { FirstUserNextJsSDK } from "../sdks/nextjs/src/index";
import { createFirstUserVueSDK } from "../sdks/vue/src/index";
import { FirstUserNuxtSDK } from "../sdks/nuxt/src/index";
import { FirstUserSdkService } from "../sdks/angular/projects/firstuser-sdk/src/lib/firstuser-sdk.service";

type FetchCall = {
  url: string;
  method: string;
  body: unknown;
};

function createFetchMock() {
  const calls: FetchCall[] = [];

  const fetchMock: typeof fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({
      url,
      method: (init?.method || "GET").toUpperCase(),
      body,
    });

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          url,
          method: (init?.method || "GET").toUpperCase(),
          body,
        };
      },
    } as Response;
  }) as typeof fetch;

  return { fetchMock, calls };
}

function assertPosted(calls: FetchCall[], path: string) {
  assert.ok(calls.some((call) => call.method === "POST" && call.url.endsWith(path)), `Missing POST ${path}`);
}

function installBrowserShims() {
  const appended: Array<Record<string, unknown>> = [];
  const documentShim = {
    hidden: false,
    createElement(_tag: string) {
      return {
        src: "",
        width: "",
        height: "",
        style: { border: "" },
        setAttribute() {
          return undefined;
        },
      };
    },
  };

  const windowShim = {
    setInterval,
    clearInterval,
  };

  (globalThis as { document?: unknown }).document = documentShim;
  (globalThis as { window?: unknown }).window = windowShim;

  const container = {
    appendChild(node: Record<string, unknown>) {
      appended.push(node);
    },
  };

  return {
    container,
    appended,
    cleanup() {
      delete (globalThis as { document?: unknown }).document;
      delete (globalThis as { window?: unknown }).window;
    },
  };
}

async function exerciseStandardApi(
  sdk: {
    startEmbeddedWaitlist: (payload: Record<string, unknown>) => Promise<unknown>;
    exchangeAccessCode: (payload: Record<string, unknown>) => Promise<unknown>;
    sendHeartbeat: (payload: Record<string, unknown>) => Promise<unknown>;
    setPlanTier: (externalUserId: string, planTier: string) => Promise<unknown>;
    getHostedChatWidgetToken: (externalUserId: string) => Promise<unknown>;
  },
) {
  await sdk.startEmbeddedWaitlist({ externalUserId: "ext_1", email: "member@example.com" });
  await sdk.exchangeAccessCode({ code: "code_1234567890", externalUserId: "ext_1" });
  await sdk.sendHeartbeat({ externalUserId: "ext_1", status: "live" });
  await sdk.setPlanTier("ext_1", "pro");
  await sdk.getHostedChatWidgetToken("ext_1");
}

async function testWebRuntime() {
  const { fetchMock, calls } = createFetchMock();
  const browser = installBrowserShims();

  const sdk = new FirstUserWebSDK();
  sdk.init({
    baseUrl: "https://firstuser.example.com",
    publicAppId: "app_demo",
    backendBaseUrl: "https://partner.example.com",
    heartbeatIntervalMs: 5,
    fetchImpl: fetchMock,
  });

  sdk.mountHostedChatWidget(browser.container as unknown as HTMLElement, "https://firstuser.example.com/widget");
  assert.equal(browser.appended.length, 1, "Web SDK should mount an iframe");

  await exerciseStandardApi(sdk);
  assertPosted(calls, "/api/firstuser/waitlist/start");
  assertPosted(calls, "/api/firstuser/access/exchange");
  assertPosted(calls, "/api/firstuser/usage/heartbeat");
  assertPosted(calls, "/api/firstuser/users/ext_1/plan");
  assertPosted(calls, "/api/firstuser/chat/widget-token");

  let heartbeatCallbackCount = 0;
  sdk.startPresence(async () => {
    heartbeatCallbackCount += 1;
  });
  await wait(16);
  sdk.stopPresence();
  assert.ok(heartbeatCallbackCount >= 2, "Web SDK callback heartbeat did not run");

  sdk.startPresence({ externalUserId: "ext_1" });
  await wait(16);
  sdk.stopPresence();
  const heartbeatPosts = calls.filter((call) => call.url.endsWith("/api/firstuser/usage/heartbeat"));
  assert.ok(heartbeatPosts.length >= 2, "Web SDK API heartbeat loop did not post");

  browser.cleanup();
}

async function testClassSdkRuntime(
  label: string,
  sdk: {
    init: (config: Record<string, unknown>) => void;
    startPresence: (input: unknown) => void;
    stopPresence: () => void;
    mountHostedChatWidget: (widgetUrl: string) => unknown;
    startEmbeddedWaitlist: (payload: Record<string, unknown>) => Promise<unknown>;
    exchangeAccessCode: (payload: Record<string, unknown>) => Promise<unknown>;
    sendHeartbeat: (payload: Record<string, unknown>) => Promise<unknown>;
    setPlanTier: (externalUserId: string, planTier: string) => Promise<unknown>;
    getHostedChatWidgetToken: (externalUserId: string) => Promise<unknown>;
  },
) {
  const { fetchMock, calls } = createFetchMock();
  sdk.init({
    baseUrl: "https://firstuser.example.com",
    publicAppId: "app_demo",
    backendBaseUrl: "https://partner.example.com",
    heartbeatIntervalMs: 5,
    fetchImpl: fetchMock,
  });

  const mountResult = sdk.mountHostedChatWidget("https://firstuser.example.com/widget");
  assert.ok(mountResult, `${label} mountHostedChatWidget should return a mount descriptor`);

  await exerciseStandardApi(sdk);
  assertPosted(calls, "/api/firstuser/waitlist/start");
  assertPosted(calls, "/api/firstuser/access/exchange");
  assertPosted(calls, "/api/firstuser/usage/heartbeat");
  assertPosted(calls, "/api/firstuser/users/ext_1/plan");
  assertPosted(calls, "/api/firstuser/chat/widget-token");

  let callbackCount = 0;
  sdk.startPresence(async () => {
    callbackCount += 1;
  });
  await wait(16);
  sdk.stopPresence();
  assert.ok(callbackCount >= 2, `${label} callback heartbeat did not run`);

  sdk.startPresence({ externalUserId: "ext_1" });
  await wait(16);
  sdk.stopPresence();
  const heartbeatPosts = calls.filter((call) => call.url.endsWith("/api/firstuser/usage/heartbeat"));
  assert.ok(heartbeatPosts.length >= 2, `${label} API heartbeat loop did not post`);
}

async function testVueRuntime() {
  const { fetchMock, calls } = createFetchMock();
  const sdk = createFirstUserVueSDK();
  sdk.init({
    baseUrl: "https://firstuser.example.com",
    publicAppId: "app_demo",
    backendBaseUrl: "https://partner.example.com",
    heartbeatIntervalMs: 5,
    fetchImpl: fetchMock,
  });

  const mountResult = sdk.mountHostedChatWidget("https://firstuser.example.com/widget");
  assert.ok(mountResult, "Vue SDK mountHostedChatWidget should return a mount descriptor");

  await exerciseStandardApi(sdk);
  assertPosted(calls, "/api/firstuser/waitlist/start");
  assertPosted(calls, "/api/firstuser/access/exchange");
  assertPosted(calls, "/api/firstuser/usage/heartbeat");
  assertPosted(calls, "/api/firstuser/users/ext_1/plan");
  assertPosted(calls, "/api/firstuser/chat/widget-token");

  let callbackCount = 0;
  sdk.startPresence(async () => {
    callbackCount += 1;
  });
  await wait(16);
  sdk.stopPresence();
  assert.ok(callbackCount >= 2, "Vue SDK callback heartbeat did not run");

  sdk.startPresence({ externalUserId: "ext_1" });
  await wait(16);
  sdk.stopPresence();
  const heartbeatPosts = calls.filter((call) => call.url.endsWith("/api/firstuser/usage/heartbeat"));
  assert.ok(heartbeatPosts.length >= 2, "Vue SDK API heartbeat loop did not post");
}

async function main() {
  await testWebRuntime();
  await testClassSdkRuntime("React Native", new FirstUserReactNativeSDK());
  await testClassSdkRuntime("Expo", new FirstUserExpoSDK());
  await testClassSdkRuntime("Capacitor", new FirstUserCapacitorSDK());
  await testClassSdkRuntime("Next.js", new FirstUserNextJsSDK());
  await testClassSdkRuntime("Nuxt", new FirstUserNuxtSDK());
  await testClassSdkRuntime("Angular", new FirstUserSdkService());
  await testVueRuntime();

  console.log("SDK runtime smoke tests passed for all JS-family stacks.");
}

await main();
