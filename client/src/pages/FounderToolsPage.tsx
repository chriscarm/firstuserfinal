import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Megaphone, BarChart3, Award, Loader2, Home, Users, Upload, Save, Plus, Trash2, CheckCircle2, X, Radio, PlugZap, Copy, Globe, Smartphone, Link2, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AnnouncementsPanel } from "@/components/founder/AnnouncementsPanel";
import { PollsPanel } from "@/components/founder/PollsPanel";
import { BadgeAwardsPanel } from "@/components/founder/BadgeAwardsPanel";
import { LiveNowPanel } from "@/components/founder/LiveNowPanel";

type ToolsTab = "homepage" | "announcements" | "polls" | "badges" | "members" | "live-now" | "integrate" | "golden-ticket";
type WaitlistMode = "forum-waitlist" | "chat-waitlist";

interface Founder {
  name: string;
  title: string;
  avatar: string;
  photoUrl?: string;
  linkedInUrl?: string;
}

interface TierReward {
  tier: string;
  label: string;
  reward: string;
}

interface AppSpace {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  icon: string;
  problemTitle: string | null;
  problemDescription: string | null;
  solutionTitle: string | null;
  solutionDescription: string | null;
  solutionPoints: string | null;
  founders: string | null;
  tierRewards: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  screenshots: string | null;
}

export default function FounderToolsPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [isScopedRoute, scopedParams] = useRoute<{ slug: string }>("/space/:slug/founder-tools");
  const requestedSlug = isScopedRoute ? scopedParams.slug : null;
  const [activeTab, setActiveTab] = useState<ToolsTab>("homepage");

  const { data: ownedSpacesData, isLoading: ownedSpacesLoading } = useQuery<{ appSpaces: AppSpace[] }>({
    queryKey: ["userAppSpaces"],
    queryFn: async () => {
      const res = await fetch("/api/users/me/appspaces", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load your app spaces");
      return res.json();
    },
    enabled: !!user?.hasFounderAccess,
  });

  const ownedSpaces = ownedSpacesData?.appSpaces ?? [];
  const fallbackSlug = ownedSpaces[0]?.slug ?? null;
  const activeSlug = requestedSlug ?? fallbackSlug;

  // Resolve currently active appspace by slug
  const {
    data: appSpaceData,
    isLoading: appSpaceLoading,
    error: appSpaceError,
  } = useQuery<{ appSpace: AppSpace }>({
    queryKey: ["appspace", activeSlug, "public"],
    queryFn: async () => {
      if (!activeSlug) throw new Error("Missing appspace slug");
      const res = await fetch(`/api/appspaces/${activeSlug}/public`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load app space");
      return res.json();
    },
    enabled: !!activeSlug && !!user?.hasFounderAccess,
  });

  const activeAppSpace = appSpaceData?.appSpace;
  const activeAppSpaceId = activeAppSpace?.id ?? null;
  const activeAppSpaceSlug = activeAppSpace?.slug ?? activeSlug;

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["founder-stats", activeAppSpaceId],
    queryFn: async () => {
      if (!activeAppSpaceId) return null;
      const res = await fetch(`/api/appspaces/${activeAppSpaceId}/founder-stats`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.hasFounderAccess && !!activeAppSpaceId,
  });

  if (loading || ownedSpacesLoading || (activeSlug && appSpaceLoading)) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!user?.hasFounderAccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="glass-panel p-8 max-w-md text-center">
          <Award className="h-12 w-12 text-violet-400 mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-white mb-2">
            Founder Access Required
          </h2>
          <p className="text-white/60 mb-6">
            You need founder access to use these tools. Join the FirstUser waitlist and get approved to unlock founder features.
          </p>
          <Link href="/">
            <a className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium hover:opacity-90 transition-opacity">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </a>
          </Link>
        </div>
      </div>
    );
  }

  if (!activeSlug) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="glass-panel p-8 max-w-lg text-center space-y-4">
          <Award className="h-12 w-12 text-violet-400 mx-auto" />
          <h2 className="font-display text-xl font-bold text-white">No Community To Manage Yet</h2>
          <p className="text-white/70">
            Founder Tools unlock after you create your first community. Start one now and come back here to manage announcements, polls, badges, and members.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/create">
              <a className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium hover:opacity-90 transition-opacity">
                Create Community
              </a>
            </Link>
            <Link href="/explore">
              <a className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-white/20 text-white/80 hover:bg-white/[0.05]">
                Explore
              </a>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!activeAppSpace) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="glass-panel p-8 max-w-lg text-center space-y-4">
          <X className="h-12 w-12 text-red-400 mx-auto" />
          <h2 className="font-display text-xl font-bold text-white">Couldn&apos;t Load Founder Tools</h2>
          <p className="text-white/70">
            This community may have moved or you may not have access for this route.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setLocation("/founder-tools")}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium hover:opacity-90 transition-opacity"
            >
              Open Your Founder Tools
            </button>
            <Link href="/dashboard">
              <a className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-white/20 text-white/80 hover:bg-white/[0.05]">
                Go Dashboard
              </a>
            </Link>
          </div>
          {appSpaceError && (
            <p className="text-xs text-white/50">Error details are available in the browser console.</p>
          )}
        </div>
      </div>
    );
  }

  const tabs: { id: ToolsTab; label: string; icon: typeof Megaphone }[] = [
    { id: "homepage", label: "Homepage", icon: Home },
    { id: "announcements", label: "Announcements", icon: Megaphone },
    { id: "polls", label: "Polls", icon: BarChart3 },
    { id: "badges", label: "Badges", icon: Award },
    { id: "members", label: "Members", icon: Users },
    { id: "live-now", label: "Live Now", icon: Radio },
    { id: "integrate", label: "Integrate", icon: PlugZap },
    { id: "golden-ticket", label: "Golden Ticket", icon: Award },
  ];

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href={`/space/${activeAppSpaceSlug}/community`}>
            <a className="p-2 rounded-lg glass-panel hover:bg-white/10 transition-colors">
              <ArrowLeft className="h-5 w-5 text-white/60" />
            </a>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-white">
              Founder Tools
            </h1>
            <p className="text-sm text-white/60">
              {activeAppSpace.name}
            </p>
          </div>
        </div>

        {ownedSpaces.length > 1 && (
          <div className="mb-6">
            <label className="block text-xs uppercase tracking-wide text-white/50 mb-2">
              Active Community
            </label>
            <select
              value={activeAppSpaceSlug}
              onChange={(event) => setLocation(`/space/${event.target.value}/founder-tools`)}
              className="w-full h-11 rounded-lg bg-white/[0.05] border border-white/[0.12] px-3 text-sm text-white focus:outline-none focus:border-violet-500/50"
              data-testid="founder-tools-community-switch"
            >
              {ownedSpaces.map((space) => (
                <option key={space.id} value={space.slug} className="bg-black text-white">
                  {space.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="glass-panel p-4 text-center">
            <p className="text-2xl font-bold text-white">
              {statsLoading ? "-" : statsData?.totalAnnouncements ?? 0}
            </p>
            <p className="text-sm text-white/60">Announcements</p>
          </div>
          <div className="glass-panel p-4 text-center">
            <p className="text-2xl font-bold text-white">
              {statsLoading ? "-" : statsData?.activePolls ?? 0}
            </p>
            <p className="text-sm text-white/60">Active Polls</p>
          </div>
          <div className="glass-panel p-4 text-center">
            <p className="text-2xl font-bold text-white">
              {statsLoading ? "-" : statsData?.totalBadges ?? 0}
            </p>
            <p className="text-sm text-white/60">Badge Types</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 p-1 glass-panel rounded-xl">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === "homepage" && (
          <HomepageEditor
            appSpace={activeAppSpace}
            appSpaceSlug={activeAppSpaceSlug}
            isLoading={appSpaceLoading}
          />
        )}
        {activeTab === "announcements" && (
          <AnnouncementsPanel appSpaceId={activeAppSpace.id} />
        )}
        {activeTab === "polls" && (
          <PollsPanel appSpaceId={activeAppSpace.id} />
        )}
        {activeTab === "badges" && (
          <BadgeAwardsPanel appSpaceId={activeAppSpace.id} />
        )}
        {activeTab === "members" && (
          <MembersManager appSpaceId={activeAppSpace.id} />
        )}
        {activeTab === "live-now" && (
          <LiveNowPanel appSpaceId={activeAppSpace.id} />
        )}
        {activeTab === "integrate" && (
          <IntegrationsManager appSpaceId={activeAppSpace.id} appSpaceName={activeAppSpace.name} />
        )}
        {activeTab === "golden-ticket" && (
          <GoldenTicketManager appSpaceId={activeAppSpace.id} />
        )}
      </div>
    </div>
  );
}

type IntegrationStack =
  | "web"
  | "react-native"
  | "ios-swift"
  | "android-kotlin"
  | "flutter"
  | "expo"
  | "capacitor"
  | "unity"
  | "nextjs"
  | "vue"
  | "nuxt"
  | "angular";

const INTEGRATION_STACK_OPTIONS: Array<{ id: IntegrationStack; label: string }> = [
  { id: "web", label: "Web" },
  { id: "react-native", label: "React Native" },
  { id: "ios-swift", label: "iOS Swift" },
  { id: "android-kotlin", label: "Android Kotlin" },
  { id: "flutter", label: "Flutter" },
  { id: "expo", label: "Expo" },
  { id: "capacitor", label: "Capacitor" },
  { id: "unity", label: "Unity" },
  { id: "nextjs", label: "Next.js" },
  { id: "vue", label: "Vue" },
  { id: "nuxt", label: "Nuxt" },
  { id: "angular", label: "Angular" },
];

interface IntegrationSetupPayload {
  id: number;
  appSpaceId: number;
  publicAppId: string;
  redirectEnabled: boolean;
  embeddedEnabled: boolean;
  webRedirectUrl: string | null;
  mobileDeepLinkUrl: string | null;
  webhookUrl: string | null;
  webhookSecretLastFour: string | null;
  allowedOrigins: string[];
  createdAt: string;
  updatedAt: string;
}

interface IntegrationSetupResponse {
  setup: IntegrationSetupPayload;
  hostedJoinUrl: string;
  activeApiKey: { keyId: string; lastFour: string; createdAt: string } | null;
  health: {
    hasApiKey: boolean;
    hasWebhookUrl: boolean;
    hasWebhookSecret: boolean;
    redirectConfigured: boolean;
    embeddedConfigured: boolean;
  };
}

interface IntegrationSetupPackResponse {
  stack: IntegrationStack;
  setupPack: {
    masterPrompt: string;
    fallbackManualSteps: string[];
    verificationChecklist: string[];
  };
  hostedJoinUrl: string;
}

function IntegrationsManager({ appSpaceId, appSpaceName }: { appSpaceId: number; appSpaceName: string }) {
  const queryClient = useQueryClient();
  const [stack, setStack] = useState<IntegrationStack>("web");
  const [redirectEnabled, setRedirectEnabled] = useState(true);
  const [embeddedEnabled, setEmbeddedEnabled] = useState(false);
  const [webRedirectUrl, setWebRedirectUrl] = useState("");
  const [mobileDeepLinkUrl, setMobileDeepLinkUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [allowedOriginsText, setAllowedOriginsText] = useState("");
  const [copyStatus, setCopyStatus] = useState<string>("");
  const [freshApiKey, setFreshApiKey] = useState<string | null>(null);
  const [freshWebhookSecret, setFreshWebhookSecret] = useState<string | null>(null);

  const setupQuery = useQuery<IntegrationSetupResponse>({
    queryKey: ["integration-setup", appSpaceId],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/apps/${appSpaceId}/setup`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load integration setup");
      return res.json();
    },
  });

  const healthQuery = useQuery<{ healthy: boolean; warnings: string[] }>({
    queryKey: ["integration-health", appSpaceId],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/apps/${appSpaceId}/health`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load integration health");
      return res.json();
    },
    refetchInterval: 20_000,
  });

  const usageSummaryQuery = useQuery<{
    sessionsCount: number;
    totalMinutes: number;
    avgSessionMinutes: number;
    liveNowCount: number;
    pendingCandidateCount: number;
    approvedCandidateCount: number;
  }>({
    queryKey: ["integration-usage-summary", appSpaceId],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/apps/${appSpaceId}/usage-summary`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load integration usage summary");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const candidatesQuery = useQuery<{ status: "pending" | "approved"; candidates: Array<{
    userId: string;
    username: string | null;
    displayName: string | null;
    sessionsCount: number;
    totalMinutes: number;
    avgSessionMinutes: number;
  }> }>({
    queryKey: ["integration-engagement-candidates", appSpaceId],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/apps/${appSpaceId}/engagement-candidates?status=pending`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load candidate analytics");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const setupPackQuery = useQuery<IntegrationSetupPackResponse>({
    queryKey: ["integration-setup-pack", appSpaceId, stack],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/apps/${appSpaceId}/setup-pack?stack=${stack}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load setup pack");
      return res.json();
    },
  });

  useEffect(() => {
    const setup = setupQuery.data?.setup;
    if (!setup) return;
    setRedirectEnabled(setup.redirectEnabled);
    setEmbeddedEnabled(setup.embeddedEnabled);
    setWebRedirectUrl(setup.webRedirectUrl || "");
    setMobileDeepLinkUrl(setup.mobileDeepLinkUrl || "");
    setWebhookUrl(setup.webhookUrl || "");
    setAllowedOriginsText((setup.allowedOrigins || []).join(", "));
  }, [setupQuery.data?.setup]);

  const saveSetupMutation = useMutation({
    mutationFn: async () => {
      const body = {
        redirectEnabled,
        embeddedEnabled,
        webRedirectUrl: webRedirectUrl.trim() || null,
        mobileDeepLinkUrl: mobileDeepLinkUrl.trim() || null,
        webhookUrl: webhookUrl.trim() || null,
        allowedOrigins: allowedOriginsText
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      };
      const res = await fetch(`/api/integrations/apps/${appSpaceId}/setup`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to save setup");
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["integration-setup", appSpaceId] });
      void queryClient.invalidateQueries({ queryKey: ["integration-health", appSpaceId] });
      void queryClient.invalidateQueries({ queryKey: ["integration-setup-pack", appSpaceId] });
    },
  });

  const rotateKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/integrations/apps/${appSpaceId}/api-keys/rotate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to rotate API key");
      }
      return res.json() as Promise<{ key: { apiKey: string } }>;
    },
    onSuccess: (payload) => {
      setFreshApiKey(payload.key.apiKey);
      void queryClient.invalidateQueries({ queryKey: ["integration-setup", appSpaceId] });
      void queryClient.invalidateQueries({ queryKey: ["integration-health", appSpaceId] });
      void queryClient.invalidateQueries({ queryKey: ["integration-setup-pack", appSpaceId] });
    },
  });

  const rotateWebhookSecretMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/integrations/apps/${appSpaceId}/webhook-secret/rotate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to rotate webhook secret");
      }
      return res.json() as Promise<{ webhookSecret: { value: string } }>;
    },
    onSuccess: (payload) => {
      setFreshWebhookSecret(payload.webhookSecret.value);
      void queryClient.invalidateQueries({ queryKey: ["integration-setup", appSpaceId] });
      void queryClient.invalidateQueries({ queryKey: ["integration-health", appSpaceId] });
      void queryClient.invalidateQueries({ queryKey: ["integration-setup-pack", appSpaceId] });
    },
  });

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(`${label} copied`);
      window.setTimeout(() => setCopyStatus(""), 2000);
    } catch {
      setCopyStatus(`Could not copy ${label.toLowerCase()}`);
      window.setTimeout(() => setCopyStatus(""), 2000);
    }
  };

  const setupPack = setupPackQuery.data?.setupPack;
  const hostedJoinUrl = setupQuery.data?.hostedJoinUrl || setupPackQuery.data?.hostedJoinUrl;

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-300" />
          No-Code Integrate Wizard
        </h3>
        <p className="text-sm text-white/65">
          Configure once, then copy one master prompt into your AI coding tool to implement integration for {appSpaceName}.
        </p>
        {copyStatus && <p className="text-xs text-emerald-300 mt-3">{copyStatus}</p>}
      </div>

      <div className="glass-panel p-6 space-y-4">
        <h4 className="text-white font-semibold">Step 1: App Endpoints</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-wide text-white/50 flex items-center gap-2">
              <Globe className="h-3 w-3" />
              Web Redirect URL
            </span>
            <input
              type="url"
              value={webRedirectUrl}
              onChange={(event) => setWebRedirectUrl(event.target.value)}
              placeholder="https://yourapp.com/auth/firstuser"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-white focus:outline-none focus:border-violet-500/50"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-wide text-white/50 flex items-center gap-2">
              <Smartphone className="h-3 w-3" />
              Mobile Deep Link
            </span>
            <input
              type="text"
              value={mobileDeepLinkUrl}
              onChange={(event) => setMobileDeepLinkUrl(event.target.value)}
              placeholder="yourapp://firstuser/access"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-white focus:outline-none focus:border-violet-500/50"
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-xs uppercase tracking-wide text-white/50 flex items-center gap-2">
              <Link2 className="h-3 w-3" />
              Partner Webhook URL
            </span>
            <input
              type="url"
              value={webhookUrl}
              onChange={(event) => setWebhookUrl(event.target.value)}
              placeholder="https://yourapp.com/api/webhooks/firstuser"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-white focus:outline-none focus:border-violet-500/50"
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-xs uppercase tracking-wide text-white/50">Allowed Origins (for embedded mode)</span>
            <input
              type="text"
              value={allowedOriginsText}
              onChange={(event) => setAllowedOriginsText(event.target.value)}
              placeholder="https://yourapp.com, https://beta.yourapp.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-white focus:outline-none focus:border-violet-500/50"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.03]">
            <input
              type="checkbox"
              checked={redirectEnabled}
              onChange={(event) => setRedirectEnabled(event.target.checked)}
              className="h-4 w-4 accent-violet-500"
            />
            <span className="text-sm text-white">Enable Redirect Mode</span>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.03]">
            <input
              type="checkbox"
              checked={embeddedEnabled}
              onChange={(event) => setEmbeddedEnabled(event.target.checked)}
              className="h-4 w-4 accent-violet-500"
            />
            <span className="text-sm text-white">Enable Embedded API Mode</span>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={() => saveSetupMutation.mutate()}
            disabled={saveSetupMutation.isPending}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium disabled:opacity-60"
          >
            {saveSetupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Setup
          </button>
          {hostedJoinUrl && (
            <button
              onClick={() => void copyToClipboard(hostedJoinUrl, "Hosted Join URL")}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/20 text-white/80 hover:bg-white/[0.05]"
            >
              <Copy className="h-4 w-4" />
              Copy Hosted Join URL
            </button>
          )}
        </div>
      </div>

      <div className="glass-panel p-6 space-y-3">
        <h4 className="text-white font-semibold">Step 2: API Key + Webhook Secret</h4>
        <p className="text-sm text-white/65">
          Rotate both credentials now and save them in your backend secrets manager. Never put either value in frontend/mobile code.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
            <p className="text-xs uppercase tracking-wide text-white/50">Partner API Key</p>
            <button
              onClick={() => rotateKeyMutation.mutate()}
              disabled={rotateKeyMutation.isPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:opacity-60"
            >
              {rotateKeyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Rotate Key
            </button>
            {setupQuery.data?.activeApiKey && (
              <p className="text-xs text-white/60">
                Active key: <span className="text-white">{setupQuery.data.activeApiKey.keyId}</span> • ending {setupQuery.data.activeApiKey.lastFour}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
            <p className="text-xs uppercase tracking-wide text-white/50">Webhook Signing Secret</p>
            <button
              onClick={() => rotateWebhookSecretMutation.mutate()}
              disabled={rotateWebhookSecretMutation.isPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:opacity-60"
            >
              {rotateWebhookSecretMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Rotate Secret
            </button>
            <p className="text-xs text-white/60">
              Current secret ending: <span className="text-white">{setupQuery.data?.setup.webhookSecretLastFour || "not set"}</span>
            </p>
          </div>
        </div>
        {freshApiKey && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="text-xs text-emerald-200 mb-2">Copy now. This is shown only once.</p>
            <div className="flex items-center gap-2">
              <code className="text-[11px] text-emerald-100 break-all">{freshApiKey}</code>
              <button
                onClick={() => void copyToClipboard(freshApiKey, "API key")}
                className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-100 text-xs"
              >
                Copy
              </button>
            </div>
          </div>
        )}
        {freshWebhookSecret && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="text-xs text-emerald-200 mb-2">Copy webhook secret now. This is shown only once.</p>
            <div className="flex items-center gap-2">
              <code className="text-[11px] text-emerald-100 break-all">{freshWebhookSecret}</code>
              <button
                onClick={() => void copyToClipboard(freshWebhookSecret, "Webhook secret")}
                className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-100 text-xs"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="glass-panel p-6 space-y-4">
        <h4 className="text-white font-semibold">Step 3: Copy To AI</h4>
        <p className="text-xs text-white/60">
          Choose your target platform. Each option gives platform-specific implementation instructions.
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {INTEGRATION_STACK_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setStack(option.id)}
              className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${stack === option.id ? "bg-violet-500 text-white" : "bg-white/5 text-white/70"}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {setupPackQuery.isLoading ? (
          <div className="py-10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        ) : setupPack ? (
          <>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => void copyToClipboard(setupPack.masterPrompt, "Master Prompt")}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium"
              >
                <Copy className="h-4 w-4" />
                Copy Master Prompt
              </button>
              <button
                onClick={() => void copyToClipboard(setupPack.fallbackManualSteps.join("\n"), "Fallback Manual Steps")}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/20 text-white/80 hover:bg-white/[0.05]"
              >
                <Copy className="h-4 w-4" />
                Copy Fallback Manual Steps
              </button>
              <button
                onClick={() => void copyToClipboard(setupPack.verificationChecklist.join("\n"), "Verification Checklist")}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/20 text-white/80 hover:bg-white/[0.05]"
              >
                <Copy className="h-4 w-4" />
                Copy Verification Checklist
              </button>
            </div>
            <textarea
              readOnly
              value={setupPack.masterPrompt}
              className="w-full min-h-[220px] bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white/80 focus:outline-none"
            />
          </>
        ) : (
          <p className="text-sm text-white/60">Setup pack unavailable right now.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 text-center">
          <p className="text-2xl font-bold text-white">{usageSummaryQuery.data?.sessionsCount ?? 0}</p>
          <p className="text-xs text-white/60">Sessions</p>
        </div>
        <div className="glass-panel p-4 text-center">
          <p className="text-2xl font-bold text-white">{usageSummaryQuery.data?.totalMinutes ?? 0}</p>
          <p className="text-xs text-white/60">Minutes Used</p>
        </div>
        <div className="glass-panel p-4 text-center">
          <p className="text-2xl font-bold text-white">{usageSummaryQuery.data?.avgSessionMinutes ?? 0}</p>
          <p className="text-xs text-white/60">Avg Session (min)</p>
        </div>
        <div className="glass-panel p-4 text-center">
          <p className="text-2xl font-bold text-white">{usageSummaryQuery.data?.liveNowCount ?? 0}</p>
          <p className="text-xs text-white/60">Live Now</p>
        </div>
      </div>

      <div className="glass-panel p-6">
        <h4 className="text-white font-semibold mb-2">Health Check</h4>
        {healthQuery.isLoading ? (
          <p className="text-sm text-white/50">Checking integration health...</p>
        ) : (
          <>
            <p className={`text-sm ${healthQuery.data?.healthy ? "text-emerald-300" : "text-amber-300"}`}>
              {healthQuery.data?.healthy ? "Integration is healthy." : "Integration needs attention before go-live."}
            </p>
            {!healthQuery.data?.healthy && (
              <ul className="mt-3 space-y-1 text-xs text-white/65">
                {(healthQuery.data?.warnings || []).map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="glass-panel p-6">
        <h4 className="text-white font-semibold mb-2">Approval Candidates (Pending Users)</h4>
        <p className="text-xs text-white/60 mb-4">
          Use this to prioritize approvals based on real usage before users are approved.
        </p>
        <div className="space-y-2">
          {(candidatesQuery.data?.candidates || []).slice(0, 10).map((candidate) => (
            <div key={candidate.userId} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{candidate.displayName || candidate.username || "Unnamed user"}</p>
                <p className="text-xs text-white/50">{candidate.sessionsCount} sessions • {candidate.totalMinutes} min total</p>
              </div>
              <p className="text-xs text-white/70">{candidate.avgSessionMinutes} min avg</p>
            </div>
          ))}
          {(candidatesQuery.data?.candidates || []).length === 0 && (
            <p className="text-sm text-white/50">No pending-user engagement yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Homepage Editor Component
function HomepageEditor({
  appSpace,
  appSpaceSlug,
  isLoading,
}: {
  appSpace?: AppSpace;
  appSpaceSlug?: string | null;
  isLoading: boolean;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<AppSpace>>({});
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [solutionPointsList, setSolutionPointsList] = useState<string[]>([]);
  const [foundersList, setFoundersList] = useState<Founder[]>([]);
  const [tierRewardsList, setTierRewardsList] = useState<TierReward[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedWaitlistMode, setSelectedWaitlistMode] = useState<WaitlistMode>("forum-waitlist");
  const hasHydrated = useRef(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const { data: waitlistModeData, isLoading: waitlistModeLoading } = useQuery<{ mode: WaitlistMode }>({
    queryKey: ["waitlist-mode", appSpace?.id],
    queryFn: async () => {
      if (!appSpace?.id) throw new Error("Missing app space ID");
      const res = await fetch(`/api/appspaces/${appSpace.id}/waitlist-mode`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load waitlist mode");
      return res.json();
    },
    enabled: !!appSpace?.id,
  });

  useEffect(() => {
    if (waitlistModeData?.mode) {
      setSelectedWaitlistMode(waitlistModeData.mode);
    }
  }, [waitlistModeData?.mode]);

  useEffect(() => {
    if (appSpace && !hasHydrated.current) {
      hasHydrated.current = true;
      setFormData(appSpace);
      if (appSpace.solutionPoints) {
        try {
          const parsed = JSON.parse(appSpace.solutionPoints);
          setSolutionPointsList(Array.isArray(parsed) ? parsed : []);
        } catch {
          setSolutionPointsList([]);
        }
      }
      if (appSpace.founders) {
        try {
          const parsed = JSON.parse(appSpace.founders);
          setFoundersList(Array.isArray(parsed) ? parsed : []);
        } catch {
          setFoundersList([]);
        }
      }
      if (appSpace.tierRewards) {
        try {
          const parsed = JSON.parse(appSpace.tierRewards);
          setTierRewardsList(Array.isArray(parsed) ? parsed : []);
        } catch {
          setTierRewardsList([]);
        }
      }
    }
  }, [appSpace]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<AppSpace>) => {
      if (!appSpaceSlug) {
        throw new Error("No app space selected");
      }

      const res = await fetch(`/api/founder/appspaces/${appSpaceSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Failed to update (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      if (appSpaceSlug) {
        queryClient.invalidateQueries({ queryKey: ["appspace", appSpaceSlug, "public"] });
      }
      setSuccessMessage("Changes saved successfully!");
      setErrorMessage("");
      setTimeout(() => setSuccessMessage(""), 3000);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || "Failed to save changes");
      setSuccessMessage("");
    },
  });

  const waitlistModeMutation = useMutation({
    mutationFn: async (mode: WaitlistMode) => {
      if (!appSpace?.id) throw new Error("No app space selected");

      const res = await fetch(`/api/appspaces/${appSpace.id}/waitlist-mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Failed to update waitlist mode (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (payload: { mode?: WaitlistMode }) => {
      if (payload?.mode) {
        setSelectedWaitlistMode(payload.mode);
      }
      if (appSpace?.id) {
        queryClient.invalidateQueries({ queryKey: ["waitlist-mode", appSpace.id] });
        queryClient.invalidateQueries({ queryKey: ["channels", appSpace.id] });
      }
      setSuccessMessage("Waitlist experience updated.");
      setErrorMessage("");
      setTimeout(() => setSuccessMessage(""), 2500);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || "Failed to update waitlist experience");
      setSuccessMessage("");
    },
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "cover") => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (type === "logo") {
          setLogoPreview(dataUrl);
          setFormData((prev) => ({ ...prev, logoUrl: dataUrl }));
        } else {
          setCoverPreview(dataUrl);
          setFormData((prev) => ({ ...prev, coverImageUrl: dataUrl }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleWaitlistModeSelect = (mode: WaitlistMode) => {
    setSelectedWaitlistMode(mode);
    setErrorMessage("");
    waitlistModeMutation.mutate(mode);
  };

  const handleSave = () => {
    const updates: Partial<AppSpace> = {
      name: formData.name,
      tagline: formData.tagline,
      description: formData.description,
      icon: formData.icon,
      problemTitle: formData.problemTitle,
      problemDescription: formData.problemDescription,
      solutionTitle: formData.solutionTitle,
      solutionDescription: formData.solutionDescription,
      logoUrl: logoPreview || formData.logoUrl,
      coverImageUrl: coverPreview || formData.coverImageUrl,
    };
    updates.solutionPoints = JSON.stringify(solutionPointsList.filter(p => p.trim()));
    updates.founders = JSON.stringify(foundersList.filter(f => f.name.trim()));
    updates.tierRewards = JSON.stringify(tierRewardsList.filter(t => t.tier.trim()));
    setErrorMessage("");
    updateMutation.mutate(updates);
  };

  const addSolutionPoint = () => setSolutionPointsList([...solutionPointsList, ""]);
  const removeSolutionPoint = (index: number) => setSolutionPointsList(solutionPointsList.filter((_, i) => i !== index));
  const updateSolutionPoint = (index: number, value: string) => {
    const newPoints = [...solutionPointsList];
    newPoints[index] = value;
    setSolutionPointsList(newPoints);
  };

  const addFounder = () => setFoundersList([...foundersList, { name: "", title: "", avatar: "", photoUrl: "", linkedInUrl: "" }]);
  const removeFounder = (index: number) => setFoundersList(foundersList.filter((_, i) => i !== index));
  const updateFounder = (index: number, field: keyof Founder, value: string) => {
    const newFounders = [...foundersList];
    newFounders[index] = { ...newFounders[index], [field]: value };
    setFoundersList(newFounders);
  };

  const handleFounderPhotoUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        updateFounder(index, "photoUrl", dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const addTierReward = () => setTierRewardsList([...tierRewardsList, { tier: "", label: "", reward: "" }]);
  const removeTierReward = (index: number) => setTierRewardsList(tierRewardsList.filter((_, i) => i !== index));
  const updateTierReward = (index: number, field: keyof TierReward, value: string) => {
    const newRewards = [...tierRewardsList];
    newRewards[index] = { ...newRewards[index], [field]: value };
    setTierRewardsList(newRewards);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400">
          <CheckCircle2 className="w-5 h-5" />
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          <X className="w-5 h-5" />
          {errorMessage}
        </div>
      )}

      {/* Basic Info */}
      <div className="glass-panel p-6">
        <h3 className="text-lg font-bold text-white mb-4">Basic Info</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">App Name</label>
            <input
              type="text"
              value={formData.name || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Icon (Emoji)</label>
            <input
              type="text"
              value={formData.icon || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, icon: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Tagline</label>
            <input
              type="text"
              value={formData.tagline || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, tagline: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-violet-500/50"
            />
          </div>
        </div>
      </div>

      {/* Waitlist Experience */}
      <div className="glass-panel p-6">
        <h3 className="text-lg font-bold text-white mb-2">Waitlist Experience</h3>
        <p className="text-sm text-white/60 mb-4">
          Choose how pending users interact before approval. Default is <span className="font-semibold text-white/80">forum-waitlist</span>.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => handleWaitlistModeSelect("forum-waitlist")}
            disabled={waitlistModeLoading || waitlistModeMutation.isPending}
            className={`rounded-xl border p-4 text-left transition-colors ${
              selectedWaitlistMode === "forum-waitlist"
                ? "border-emerald-400/60 bg-emerald-500/10"
                : "border-white/15 bg-white/[0.03] hover:bg-white/[0.06]"
            } disabled:opacity-60`}
          >
            <p className="text-sm font-semibold text-white">forum-waitlist</p>
            <p className="text-xs text-white/60 mt-1">
              Post-style waitlist room for longer updates and threaded-feeling conversations.
            </p>
          </button>
          <button
            onClick={() => handleWaitlistModeSelect("chat-waitlist")}
            disabled={waitlistModeLoading || waitlistModeMutation.isPending}
            className={`rounded-xl border p-4 text-left transition-colors ${
              selectedWaitlistMode === "chat-waitlist"
                ? "border-amber-400/60 bg-amber-500/10"
                : "border-white/15 bg-white/[0.03] hover:bg-white/[0.06]"
            } disabled:opacity-60`}
          >
            <p className="text-sm font-semibold text-white">chat-waitlist</p>
            <p className="text-xs text-white/60 mt-1">
              Fast live-chat room for real-time waitlist conversations.
            </p>
          </button>
        </div>
        <p className="text-xs text-white/50 mt-3">
          This renames your primary waitlist channel and keeps member channels unchanged.
        </p>
      </div>

      {/* Logo Upload */}
      <div className="glass-panel p-6">
        <h3 className="text-lg font-bold text-white mb-4">Logo</h3>
        <div className="flex items-center gap-6">
          <div
            onClick={() => logoInputRef.current?.click()}
            className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity overflow-hidden"
          >
            {logoPreview || appSpace?.logoUrl ? (
              <img src={logoPreview || appSpace?.logoUrl || ""} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl">{appSpace?.icon || "🚀"}</span>
            )}
          </div>
          <div>
            <input ref={logoInputRef} type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "logo")} className="hidden" />
            <button onClick={() => logoInputRef.current?.click()} className="px-4 py-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors flex items-center gap-2">
              <Upload className="w-4 h-4" /> Upload Logo
            </button>
          </div>
        </div>
      </div>

      {/* Problem Section */}
      <div className="glass-panel p-6">
        <h3 className="text-lg font-bold text-white mb-4"><span className="text-red-400">The Problem</span></h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Problem Title</label>
            <input type="text" value={formData.problemTitle || ""} onChange={(e) => setFormData((prev) => ({ ...prev, problemTitle: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Problem Description</label>
            <textarea value={formData.problemDescription || ""} onChange={(e) => setFormData((prev) => ({ ...prev, problemDescription: e.target.value }))} rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-violet-500/50 resize-none" />
          </div>
        </div>
      </div>

      {/* Solution Section */}
      <div className="glass-panel p-6">
        <h3 className="text-lg font-bold text-white mb-4"><span className="text-green-400">The Solution</span></h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Solution Title</label>
            <input type="text" value={formData.solutionTitle || ""} onChange={(e) => setFormData((prev) => ({ ...prev, solutionTitle: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Solution Description</label>
            <textarea value={formData.solutionDescription || ""} onChange={(e) => setFormData((prev) => ({ ...prev, solutionDescription: e.target.value }))} rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-violet-500/50 resize-none" />
          </div>
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Solution Points</label>
            <div className="space-y-3">
              {solutionPointsList.map((point, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-green-500/20 text-green-400 text-xs">{index + 1}</span>
                  <input type="text" value={point} onChange={(e) => updateSolutionPoint(index, e.target.value)} placeholder="Enter a solution benefit..." className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-white focus:outline-none focus:border-violet-500/50" />
                  <button onClick={() => removeSolutionPoint(index)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={addSolutionPoint} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"><Plus className="w-4 h-4" />Add Point</button>
            </div>
          </div>
        </div>
      </div>

      {/* Founders Section */}
      <div className="glass-panel p-6">
        <h3 className="text-lg font-bold text-white mb-4">Founders</h3>
        <div className="space-y-4">
          {foundersList.map((founder, index) => (
            <div key={index} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm text-white/50">Founder {index + 1}</span>
                <button onClick={() => removeFounder(index)} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <label className="block text-xs text-white/40 mb-1">Photo</label>
                  <div className="relative group">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center overflow-hidden">
                      {founder.photoUrl ? <img src={founder.photoUrl} alt={founder.name} className="w-full h-full object-cover" /> : <span className="text-lg font-medium">{founder.avatar || "?"}</span>}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-xl">
                      <Upload className="w-5 h-5 text-white" />
                      <input type="file" accept="image/*" onChange={(e) => handleFounderPhotoUpload(index, e)} className="hidden" />
                    </label>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><label className="block text-xs text-white/40 mb-1">Name</label><input type="text" value={founder.name} onChange={(e) => updateFounder(index, "name", e.target.value)} placeholder="John Doe" className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-violet-500/50" /></div>
                  <div><label className="block text-xs text-white/40 mb-1">Title</label><input type="text" value={founder.title} onChange={(e) => updateFounder(index, "title", e.target.value)} placeholder="CEO & Founder" className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-violet-500/50" /></div>
                  <div><label className="block text-xs text-white/40 mb-1">LinkedIn URL</label><input type="url" value={founder.linkedInUrl || ""} onChange={(e) => updateFounder(index, "linkedInUrl", e.target.value)} placeholder="https://linkedin.com/in/username" className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-violet-500/50" /></div>
                </div>
              </div>
            </div>
          ))}
          <button onClick={addFounder} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors"><Plus className="w-4 h-4" />Add Founder</button>
        </div>
      </div>

      {/* Tier Rewards Section */}
      <div className="glass-panel p-6">
        <h3 className="text-lg font-bold text-white mb-4">Tier Rewards</h3>
        <div className="space-y-4">
          {tierRewardsList.map((tier, index) => (
            <div key={index} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm text-white/50">Tier {index + 1}</span>
                <button onClick={() => removeTierReward(index)} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label className="block text-xs text-white/40 mb-1">Position</label><input type="text" value={tier.tier} onChange={(e) => updateTierReward(index, "tier", e.target.value)} placeholder="1st" className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-violet-500/50" /></div>
                <div><label className="block text-xs text-white/40 mb-1">Label</label><input type="text" value={tier.label} onChange={(e) => updateTierReward(index, "label", e.target.value)} placeholder="First User" className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-violet-500/50" /></div>
                <div><label className="block text-xs text-white/40 mb-1">Reward</label><input type="text" value={tier.reward} onChange={(e) => updateTierReward(index, "reward", e.target.value)} placeholder="Lifetime free" className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-violet-500/50" /></div>
              </div>
            </div>
          ))}
          <button onClick={addTierReward} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"><Plus className="w-4 h-4" />Add Tier</button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={updateMutation.isPending} className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white font-bold flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50">
          {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

// Members Manager Component
function MembersManager({ appSpaceId }: { appSpaceId: number }) {
  const queryClient = useQueryClient();

  const { data: membersData } = useQuery({
    queryKey: ["waitlist-members", appSpaceId],
    queryFn: async () => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/waitlist/members`, { credentials: "include" });
      if (!res.ok) return { members: [] };
      return res.json();
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/waitlist/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update member");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist-members", appSpaceId] });
    },
  });

  const members = membersData?.members || [];

  return (
    <div className="glass-panel overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <h3 className="text-lg font-bold text-white">Waitlist Members ({members.length})</h3>
      </div>
      <div className="divide-y divide-white/5">
        {members.map((member: any) => (
          <div key={member.id} className="p-4 flex items-center justify-between hover:bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-sm font-bold text-white">
                {(member.username || member.email).slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{member.username || "Anonymous"}</p>
                <p className="text-xs text-white/50">{member.email} • #{member.position}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs ${member.status === "approved" ? "bg-green-500/20 text-green-400" : member.status === "rejected" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                {member.status}
              </span>
              {member.status === "pending" && (
                <>
                  <button onClick={() => updateMemberMutation.mutate({ userId: member.userId, status: "approved" })} className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs hover:bg-green-500/20">Approve</button>
                  <button onClick={() => updateMemberMutation.mutate({ userId: member.userId, status: "rejected" })} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20">Reject</button>
                </>
              )}
            </div>
          </div>
        ))}
        {members.length === 0 && <div className="p-8 text-center text-white/40">No members yet</div>}
      </div>
    </div>
  );
}

interface GoldenTicketFounderResponse {
  ticket: {
    id: number;
    status: "open" | "selected" | "closed";
    winnerUserId: string | null;
    selectedAt: string | null;
    serviceContingent: boolean;
    nonTransferable: boolean;
    rateLimitedByPolicy: boolean;
    winnerVisibility: "status_only";
  };
  tiers: Array<{
    id: number;
    rank: number;
    label: string;
    reward: string;
    isLifetime: boolean;
    benefits: string[];
  }>;
  winner: null | {
    id: string;
    username: string | null;
    displayName: string | null;
    email: string | null;
    phone: string | null;
  };
  audits: Array<{
    id: number;
    eventType: string;
    eventData: string | null;
    createdAt: string;
  }>;
  policyEvents: Array<{
    id: number;
    category: string;
    description: string;
    status: string;
    resolution: string | null;
    createdAt: string;
  }>;
}

function GoldenTicketManager({ appSpaceId }: { appSpaceId: number }) {
  const queryClient = useQueryClient();
  const [winnerUserId, setWinnerUserId] = useState("");
  const [winnerReason, setWinnerReason] = useState("");
  const [tierDrafts, setTierDrafts] = useState<Array<{ rank: number; label: string; reward: string; isLifetime: boolean; benefits: string }>>([]);
  const [serviceContingent, setServiceContingent] = useState(true);
  const [nonTransferable, setNonTransferable] = useState(true);
  const [rateLimitedByPolicy, setRateLimitedByPolicy] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<GoldenTicketFounderResponse>({
    queryKey: ["golden-ticket-founder", appSpaceId],
    queryFn: async () => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/golden-ticket/founder`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load Golden Ticket settings");
      return res.json();
    },
  });

  useEffect(() => {
    if (!data) return;
    setServiceContingent(data.ticket.serviceContingent);
    setNonTransferable(data.ticket.nonTransferable);
    setRateLimitedByPolicy(data.ticket.rateLimitedByPolicy);
    setTierDrafts(
      data.tiers
        .sort((a, b) => a.rank - b.rank)
        .map((tier) => ({
          rank: tier.rank,
          label: tier.label,
          reward: tier.reward,
          isLifetime: tier.isLifetime,
          benefits: (tier.benefits || [tier.reward]).join("\n"),
        }))
    );
  }, [data]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["golden-ticket-founder", appSpaceId] });
    queryClient.invalidateQueries({ queryKey: ["appspace", appSpaceId, "public"] });
    queryClient.invalidateQueries({ queryKey: ["appspaces-discover"] });
  };

  const savePolicyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/golden-ticket/policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          serviceContingent,
          nonTransferable,
          rateLimitedByPolicy,
          winnerVisibility: "status_only",
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to save policy");
      }
      return res.json();
    },
    onSuccess: refresh,
  });

  const saveTiersMutation = useMutation({
    mutationFn: async () => {
      const payload = tierDrafts.map((tier) => ({
        rank: tier.rank,
        label: tier.label,
        reward: tier.reward,
        isLifetime: tier.isLifetime,
        benefits: tier.benefits
          .split("\n")
          .map((benefit) => benefit.trim())
          .filter(Boolean),
      }));

      const res = await fetch(`/api/appspaces/${appSpaceId}/golden-ticket/tiers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tiers: payload }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to save tiers");
      }
      return res.json();
    },
    onSuccess: () => {
      setLocalError(null);
      refresh();
    },
    onError: (error: Error) => {
      setLocalError(error.message);
    },
  });

  const selectWinnerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/golden-ticket/select-winner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          winnerUserId,
          reason: winnerReason || undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to select winner");
      }
      return res.json();
    },
    onSuccess: () => {
      setWinnerReason("");
      setWinnerUserId("");
      refresh();
    },
    onError: (error: Error) => {
      setLocalError(error.message);
    },
  });

  if (isLoading || !data) {
    return (
      <div className="glass-panel p-10 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  const addTier = () => {
    const nextRank = (tierDrafts[tierDrafts.length - 1]?.rank || 0) + 1;
    setTierDrafts((prev) => [
      ...prev,
      { rank: nextRank, label: `Tier ${nextRank}`, reward: "", isLifetime: false, benefits: "" },
    ]);
  };

  const updateTier = (index: number, patch: Partial<{ rank: number; label: string; reward: string; isLifetime: boolean; benefits: string }>) => {
    setTierDrafts((prev) => prev.map((tier, tierIndex) => (tierIndex === index ? { ...tier, ...patch } : tier)));
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Golden Ticket Policy</h3>
            <p className="text-sm text-white/60">Exactly one mandatory lifetime winner per community.</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${data.ticket.status === "open" ? "bg-emerald-500/20 text-emerald-300" : "bg-violet-500/20 text-violet-300"}`}>
            {data.ticket.status === "open" ? "Open" : "Selected"}
          </span>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <label className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-white/80 flex items-center justify-between">
            Service contingent
            <input type="checkbox" checked={serviceContingent} onChange={(event) => setServiceContingent(event.target.checked)} />
          </label>
          <label className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-white/80 flex items-center justify-between">
            Non-transferable
            <input type="checkbox" checked={nonTransferable} onChange={(event) => setNonTransferable(event.target.checked)} />
          </label>
          <label className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-white/80 flex items-center justify-between">
            Rate-limited by policy
            <input type="checkbox" checked={rateLimitedByPolicy} onChange={(event) => setRateLimitedByPolicy(event.target.checked)} />
          </label>
        </div>

        <div className="mt-4">
          <button
            onClick={() => savePolicyMutation.mutate()}
            disabled={savePolicyMutation.isPending}
            className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 disabled:opacity-60"
          >
            {savePolicyMutation.isPending ? "Saving..." : "Save Policy"}
          </button>
        </div>
      </div>

      <div className="glass-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Ticket Tiers</h3>
          <button onClick={addTier} className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-sm">Add Tier</button>
        </div>

        <div className="space-y-3">
          {tierDrafts.map((tier, index) => (
            <div key={index} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="grid md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Rank</label>
                  <input
                    type="number"
                    value={tier.rank}
                    min={1}
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white"
                    onChange={(event) => updateTier(index, { rank: Number(event.target.value || 1) })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Label</label>
                  <input
                    type="text"
                    value={tier.label}
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white"
                    onChange={(event) => updateTier(index, { label: event.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-white/40 mb-1">Reward</label>
                  <input
                    type="text"
                    value={tier.reward}
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white"
                    onChange={(event) => updateTier(index, { reward: event.target.value })}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <label className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80 flex items-center justify-between">
                  Lifetime
                  <input
                    type="checkbox"
                    checked={tier.isLifetime}
                    onChange={(event) => updateTier(index, { isLifetime: event.target.checked })}
                  />
                </label>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Benefits (one per line)</label>
                  <textarea
                    value={tier.benefits}
                    rows={3}
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white"
                    onChange={(event) => updateTier(index, { benefits: event.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {localError && (
          <p className="mt-3 text-sm text-red-300">{localError}</p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => saveTiersMutation.mutate()}
            disabled={saveTiersMutation.isPending}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white disabled:opacity-60"
          >
            {saveTiersMutation.isPending ? "Saving..." : "Save Tiers"}
          </button>
          <span className="text-xs text-white/50">Tier 1 must remain lifetime. Existing benefits cannot be removed after publish.</span>
        </div>
      </div>

      <div className="glass-panel p-5 space-y-4">
        <h3 className="text-lg font-bold text-white">Select Winner (One-time)</h3>
        {data.ticket.status === "selected" ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Winner selected on {data.ticket.selectedAt ? new Date(data.ticket.selectedAt).toLocaleString() : "-"}. Identity is private on public pages.
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Winner user ID"
                value={winnerUserId}
                onChange={(event) => setWinnerUserId(event.target.value)}
                className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white"
              />
              <input
                type="text"
                placeholder="Optional reason"
                value={winnerReason}
                onChange={(event) => setWinnerReason(event.target.value)}
                className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white"
              />
            </div>
            <button
              onClick={() => {
                if (!winnerUserId.trim()) {
                  setLocalError("Winner user ID is required");
                  return;
                }
                const confirmed = window.confirm("Selecting a Golden Ticket winner is irreversible. Continue?");
                if (confirmed) {
                  setLocalError(null);
                  selectWinnerMutation.mutate();
                }
              }}
              disabled={selectWinnerMutation.isPending}
              className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-60"
            >
              {selectWinnerMutation.isPending ? "Selecting..." : "Confirm Winner"}
            </button>
          </>
        )}
      </div>

      <div className="glass-panel p-5">
        <h3 className="text-lg font-bold text-white mb-3">Audit Timeline</h3>
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {data.audits.length === 0 ? (
            <p className="text-sm text-white/50">No audit events yet.</p>
          ) : (
            data.audits.map((event) => (
              <div key={event.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                <p className="text-sm text-white/85">{event.eventType.replace(/_/g, " ")}</p>
                <p className="text-xs text-white/45">{new Date(event.createdAt).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="glass-panel p-5">
        <h3 className="text-lg font-bold text-white mb-3">Policy Reports</h3>
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {data.policyEvents.length === 0 ? (
            <p className="text-sm text-white/50">No policy reports.</p>
          ) : (
            data.policyEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-white/85">{event.category.replace(/_/g, " ")}</p>
                  <span className="text-xs text-white/50">{event.status}</span>
                </div>
                <p className="text-xs text-white/60 mt-1">{event.description}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
