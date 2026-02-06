import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Search, Users, Loader2, Plus, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { AppSpace } from "@shared/schema";
import { AppLayout, MainPane, HeaderTitle } from "@/components/layout";
import { useUserCommunities } from "@/hooks/useUserCommunities";
import { useLayout } from "@/contexts/LayoutContext";

interface DiscoverAppSpace extends AppSpace {
  memberCount: number;
  approvedCount: number;
  pendingCount: number;
}

type FilterType = "all" | "new" | "popular";

const filters: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "popular", label: "Popular" },
];

// Map badge tier to variant
function getBadgeVariant(tier: string): "first" | "silver" | "bronze" | "default" | "glass" {
  if (tier === "1st") return "first";
  if (tier === "10^1") return "silver";
  if (tier === "10²" || tier === "10^2") return "bronze";
  if (tier === "10³" || tier === "10^3") return "default";
  return "glass";
}

// Gradient options for different categories - rainbow spectrum
const categoryGradients: Record<string, string> = {
  "AI Tools": "from-violet-500 to-pink-500",
  "Productivity": "from-blue-500 to-cyan-400",
  "Design": "from-pink-500 to-rose-400",
  "Social": "from-amber-500 to-orange-400",
  "Finance": "from-emerald-500 to-teal-400",
  "default": "from-amber-500 via-pink-500 to-violet-500",
};

// Check if app is new (created within last 7 days)
function isNewApp(createdAt: string | Date): boolean {
  const created = new Date(createdAt);
  const now = new Date();
  const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 7;
}

export default function Explore() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [, setLocation] = useLocation();
  const { communities } = useUserCommunities();
  const { setViewMode, setActiveCommunityId } = useLayout();

  // Set view mode to discover when this page mounts
  useEffect(() => {
    setViewMode("discover");
  }, [setViewMode]);

  // Fetch real appspaces from API
  const { data: discoverData, isLoading } = useQuery<{ appSpaces: DiscoverAppSpace[] }>({
    queryKey: ["appspaces-discover"],
    queryFn: async () => {
      const res = await fetch("/api/appspaces/discover", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch discover appspaces");
      return res.json();
    },
  });

  const appSpaces = discoverData?.appSpaces ?? [];

  const filteredApps = appSpaces.filter((app) => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (app.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (app.tagline || "").toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    const memberCount = app.memberCount || 0;

    switch (activeFilter) {
      case "new": return isNewApp(app.createdAt);
      case "popular": return memberCount > 50;
      default: return true;
    }
  });

  const handleCommunityClick = (community: { id: number; slug: string }) => {
    setViewMode("community");
    setActiveCommunityId(community.id);
    setLocation(`/space/${community.slug}/community`);
  };

  return (
    <AppLayout
      communities={communities}
      onCommunityClick={(c) => handleCommunityClick(c)}
      showContextPanel={false}
    >
      <MainPane
        mobileTitle="Discover"
        header={
          <HeaderTitle
            title="Discover Communities"
          />
        }
      >
        <div className="max-w-5xl mx-auto">
          {/* Page Header */}
          <div className="mb-8 text-center">
            <h1 className="mb-4 font-display text-4xl font-bold text-white/90 md:text-5xl" data-testid="text-explore-title">
              Discover AppSpaces
            </h1>
            <p className="text-lg text-white/50 mb-8" data-testid="text-explore-subtitle">
              Find the next big thing. Be early. Earn your badge.
            </p>

            {/* Search Bar */}
            <div className="mx-auto max-w-lg mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                <input
                  type="text"
                  placeholder="Search apps..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 rounded-full bg-white/[0.02] border border-white/[0.08] text-white/90 placeholder:text-white/40 focus:outline-none focus:border-white/20 transition-colors"
                  data-testid="input-search"
                />
              </div>
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap justify-center gap-2 mb-10">
              {filters.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  className={`h-11 px-5 rounded-full font-medium transition-all duration-200 ${
                    activeFilter === filter.key
                      ? "bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 text-white"
                      : "bg-white/[0.02] border border-white/[0.08] text-white/50 hover:text-white/70 hover:border-white/[0.15]"
                  }`}
                  data-testid={`filter-${filter.key}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-white/50" />
            </div>
          )}

          {/* App Cards Grid */}
          {!isLoading && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredApps.map((app) => {
                const memberCount = app.memberCount || 0;
                const gradient = categoryGradients[app.category || ""] || categoryGradients.default;
                const isNew = isNewApp(app.createdAt);

                return (
                  <Link key={app.id} href={`/space/${app.slug}`}>
                    <div
                      className="group bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:border-white/[0.15] hover:-translate-y-1"
                      data-testid={`card-app-${app.slug}`}
                    >
                      {/* Gradient Header */}
                      <div className={`relative h-24 bg-gradient-to-br ${gradient}`}>
                        {/* NEW Badge */}
                        {isNew && (
                          <span
                            className="absolute top-3 right-3 px-2 py-0.5 text-xs font-bold rounded bg-emerald-400 text-black"
                            data-testid={`badge-new-${app.slug}`}
                          >
                            NEW
                          </span>
                        )}

                        {/* App Icon */}
                        <div className="absolute left-1/2 bottom-0 translate-y-1/2 -translate-x-1/2">
                          <div className="h-14 w-14 rounded-lg bg-black/80 border border-white/[0.15] flex items-center justify-center text-2xl overflow-hidden">
                            {app.logoUrl ? (
                              <img src={app.logoUrl} alt={app.name} className="w-full h-full object-cover" />
                            ) : (
                              app.icon
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="pt-10 pb-5 px-5">
                        <h3
                          className="font-display text-lg font-bold text-white/90 text-center mb-2 group-hover:text-white transition-colors"
                          data-testid={`text-app-name-${app.slug}`}
                        >
                          {app.name}
                        </h3>
                        <p
                          className="text-sm text-white/50 text-center mb-4 line-clamp-2"
                          data-testid={`text-app-desc-${app.slug}`}
                        >
                          {app.tagline || app.description}
                        </p>

                        {/* Bottom Row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-sm text-white/45">
                            <Users className="h-4 w-4" />
                            <span data-testid={`text-waiting-${app.slug}`}>{memberCount} waiting</span>
                          </div>
                          <Badge variant={getBadgeVariant(memberCount > 0 ? "10^3" : "10^4")} data-testid={`badge-tier-${app.slug}`}>
                            {memberCount > 0 ? "10³" : "10⁴"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}

              {/* Create Your Own CTA Card */}
              <Link href="/create">
                <div
                  className="group bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-dashed border-violet-500/30 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:border-violet-500/50 hover:-translate-y-1 hover:bg-gradient-to-br hover:from-violet-500/20 hover:to-fuchsia-500/20"
                  data-testid="card-create-community"
                >
                  {/* Header */}
                  <div className="relative h-24 flex items-center justify-center bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20">
                    <div className="absolute left-1/2 bottom-0 translate-y-1/2 -translate-x-1/2">
                      <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 border border-white/20 flex items-center justify-center">
                        <Plus className="h-7 w-7 text-white" />
                      </div>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="pt-10 pb-5 px-5 text-center">
                    <h3 className="font-display text-lg font-bold text-white/90 mb-2 group-hover:text-white transition-colors">
                      Create Your Own
                    </h3>
                    <p className="text-sm text-white/50 mb-4">
                      Have an app idea? Build your waitlist community and connect with early supporters.
                    </p>
                    <div className="flex items-center justify-center gap-2 text-violet-400 text-sm font-medium">
                      <Sparkles className="h-4 w-4" />
                      <span>Get Started Free</span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {!isLoading && filteredApps.length === 0 && (
            <div className="text-center py-12">
              <p className="text-white/50 text-lg">No apps match your search.</p>
            </div>
          )}
        </div>
      </MainPane>
    </AppLayout>
  );
}
