import { useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Eye, Users, Compass, Sparkles } from "lucide-react";
import { AppLayout, HeaderTitle, MainPane } from "@/components/layout";
import { useUserCommunities } from "@/hooks/useUserCommunities";
import { useLayout } from "@/contexts/LayoutContext";

interface DiscoverAppSpace {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  icon: string;
  logoUrl: string | null;
  category: string | null;
  createdAt: string;
  memberCount: number;
  approvedCount: number;
  pendingCount: number;
}

const categoryGradients: Record<string, string> = {
  "AI Tools": "from-violet-500 to-pink-500",
  "Productivity": "from-blue-500 to-cyan-400",
  "Design": "from-pink-500 to-rose-400",
  "Social": "from-amber-500 to-orange-400",
  "Finance": "from-emerald-500 to-teal-400",
  default: "from-amber-500 via-pink-500 to-violet-500",
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { communities, ownedCommunities, joinedCommunities, isLoading: isLoadingCommunities } = useUserCommunities();
  const { setViewMode, setActiveCommunityId } = useLayout();

  useEffect(() => {
    setViewMode("discover");
  }, [setViewMode]);

  const { data: discoverData, isLoading: isLoadingDiscover } = useQuery<{ appSpaces: DiscoverAppSpace[] }>({
    queryKey: ["appspaces-discover"],
    queryFn: async () => {
      const response = await fetch("/api/appspaces/discover", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load dashboard data");
      return response.json();
    },
  });

  const appSpaces = discoverData?.appSpaces ?? [];
  const ownedIds = useMemo(() => new Set(ownedCommunities.map((community) => community.id)), [ownedCommunities]);

  const ownedSpaceStats = useMemo(() => {
    return ownedCommunities.map((community) => {
      const discoverMatch = appSpaces.find((app) => app.id === community.id);
      return {
        ...community,
        memberCount: discoverMatch?.memberCount ?? 0,
        approvedCount: discoverMatch?.approvedCount ?? 0,
      };
    });
  }, [appSpaces, ownedCommunities]);

  const recommendedSpaces = useMemo(() => {
    return appSpaces
      .filter((space) => !ownedIds.has(space.id))
      .sort((a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0))
      .slice(0, 6);
  }, [appSpaces, ownedIds]);

  const totalOwnedMembers = ownedSpaceStats.reduce((sum, community) => sum + community.memberCount, 0);
  const totalOwnedApproved = ownedSpaceStats.reduce((sum, community) => sum + community.approvedCount, 0);

  const isLoading = isLoadingCommunities || isLoadingDiscover;

  const handleCommunityClick = (community: { id: number; slug: string }) => {
    setViewMode("community");
    setActiveCommunityId(community.id);
    setLocation(`/space/${community.slug}/community`);
  };

  return (
    <AppLayout
      communities={communities}
      onCommunityClick={(community) => handleCommunityClick(community)}
      showContextPanel={false}
    >
      <MainPane
        mobileTitle="Dashboard"
        header={(
          <HeaderTitle
            title="Dashboard"
            subtitle="Your communities, growth, and next actions"
            actions={ownedCommunities.length === 0 ? (
              <Link href="/create">
                <Button size="sm" className="h-9">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Community
                </Button>
              </Link>
            ) : (
              <Link href={`/space/${ownedCommunities[0].slug}/community`}>
                <Button variant="outline" size="sm" className="h-9">
                  <Eye className="h-4 w-4 mr-2" />
                  Open Community
                </Button>
              </Link>
            )}
          />
        )}
      >
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-xs uppercase tracking-wide text-white/60 mb-1">Communities Owned</p>
              <p className="text-2xl font-bold text-white">{ownedCommunities.length}</p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-xs uppercase tracking-wide text-white/60 mb-1">Total Waitlist Members</p>
              <p className="text-2xl font-bold text-white">{totalOwnedMembers}</p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-xs uppercase tracking-wide text-white/60 mb-1">Approved Members</p>
              <p className="text-2xl font-bold text-white">{totalOwnedApproved}</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            </div>
          ) : (
            <>
              {ownedSpaceStats.length > 0 ? (
                <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white">Your Communities</h2>
                    <Link href="/create">
                      <a className="text-sm text-violet-300 hover:text-violet-200">Create another</a>
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {ownedSpaceStats.map((community) => (
                      <div
                        key={community.id}
                        className="rounded-lg border border-white/[0.08] bg-black/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div>
                          <p className="font-semibold text-white">{community.name}</p>
                          <p className="text-sm text-white/65">
                            {community.memberCount} waiting • {community.approvedCount} approved
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCommunityClick(community)}
                            className="h-9 px-3 rounded-lg border border-white/20 text-white/80 hover:bg-white/[0.05] text-sm"
                          >
                            Open Chat
                          </button>
                          <button
                            onClick={() => setLocation(`/space/${community.slug}/founder-tools`)}
                            className="h-9 px-3 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-sm font-medium hover:opacity-90"
                          >
                            Founder Tools
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
                  <Sparkles className="h-10 w-10 text-violet-300 mx-auto mb-3" />
                  <h2 className="text-xl font-bold text-white mb-2">Launch your first community</h2>
                  <p className="text-white/70 mb-4">
                    Build your waitlist page, invite early users, and manage everything from Founder Tools.
                  </p>
                  <Link href="/create">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Community
                    </Button>
                  </Link>
                </section>
              )}

              <section>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">Trending Communities</h2>
                    <p className="text-sm text-white/65">
                      {joinedCommunities.length} joined by you • discover more in Explore
                    </p>
                  </div>
                  <Link href="/explore">
                    <a className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white">
                      <Compass className="h-4 w-4" />
                      Explore all
                    </a>
                  </Link>
                </div>

                {recommendedSpaces.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 text-center text-white/70">
                    No communities available yet.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {recommendedSpaces.map((space) => {
                      const gradient = categoryGradients[space.category || ""] || categoryGradients.default;
                      return (
                        <Link key={space.id} href={`/space/${space.slug}`}>
                          <a className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden hover:border-white/20 transition-colors">
                            <div className={`h-20 bg-gradient-to-br ${gradient}`} />
                            <div className="p-4">
                              <p className="font-semibold text-white">{space.name}</p>
                              <p className="text-sm text-white/65 line-clamp-2 mt-1">
                                {space.tagline || space.description}
                              </p>
                              <div className="mt-3 flex items-center gap-1.5 text-sm text-white/50">
                                <Users className="h-4 w-4" />
                                <span>{space.memberCount} waiting</span>
                              </div>
                            </div>
                          </a>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </MainPane>
    </AppLayout>
  );
}
