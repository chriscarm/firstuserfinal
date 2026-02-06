import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Megaphone, BarChart3, Award, Loader2, Home, Users, Upload, Save, Plus, Trash2, CheckCircle2, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AnnouncementsPanel } from "@/components/founder/AnnouncementsPanel";
import { PollsPanel } from "@/components/founder/PollsPanel";
import { BadgeAwardsPanel } from "@/components/founder/BadgeAwardsPanel";

type ToolsTab = "homepage" | "announcements" | "polls" | "badges" | "members";

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
  const hasHydrated = useRef(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

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
