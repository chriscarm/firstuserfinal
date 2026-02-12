import { ReactNode } from "react";
import { useLocation } from "wouter";
import { Home, Compass, Plus, Mail, User, X } from "lucide-react";
import { NavRail } from "./NavRail";
import { useAuth } from "@/lib/auth";
import { useLayout } from "@/contexts/LayoutContext";

interface Community {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
}

// Draft community for real-time preview in CreateSpace wizard
export interface DraftCommunity {
  id: number;  // Use -1 for draft
  name: string;
  slug: string;
  logoUrl: string | null;
}

interface AppLayoutProps {
  // Communities to display in NavRail
  communities?: Community[];

  // Draft community for real-time preview (shown at top of NavRail)
  draftCommunity?: DraftCommunity | null;

  // Handler when a community is clicked in NavRail
  onCommunityClick?: (community: Community) => void;

  // Context panel content (channel list, DM list, etc.)
  // Pass null to hide context panel (for discover view)
  contextPanel?: ReactNode | null;

  // Extra mobile-only content shown inside the global slide-out menu
  mobileContextContent?: ReactNode;

  // Main pane content
  children: ReactNode;

  // Whether to show the context panel
  showContextPanel?: boolean;
}

export function AppLayout({
  communities = [],
  draftCommunity,
  onCommunityClick,
  contextPanel,
  mobileContextContent,
  children,
  showContextPanel: showContextPanelProp,
}: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const {
    viewMode,
    setViewMode,
    activeCommunityId,
    setActiveCommunityId,
    showContextPanel: showContextPanelFromContext,
    mobileSidebarOpen,
    setMobileSidebarOpen,
  } = useLayout();

  // Allow prop to override context, but default to context value
  const showContextPanel = showContextPanelProp ?? showContextPanelFromContext;

  const closeMobileMenu = () => {
    setMobileSidebarOpen(false);
  };

  const isDashboardActive = location.startsWith("/dashboard");
  const isDiscoverActive = location.startsWith("/explore") || viewMode === "discover";
  const isCreateActive = location.startsWith("/create");
  const isMessagesActive = location.startsWith("/messages") || viewMode === "messages";
  const isAccountActive = location.startsWith("/settings") || location.startsWith("/profile");

  const mobileNavBase =
    "w-full h-11 px-3 rounded-lg border border-transparent flex items-center gap-3 transition-all duration-200";
  const mobileNavState = (isActive: boolean) =>
    isActive
      ? "bg-white/[0.1] border-white/[0.15] text-white/90"
      : "text-white/65 hover:text-white/90 hover:bg-white/[0.05] hover:border-white/[0.1]";

  const goToDashboard = () => {
    setViewMode("discover");
    setLocation("/dashboard");
    closeMobileMenu();
  };

  const goToDiscover = () => {
    setViewMode("discover");
    setLocation("/explore");
    closeMobileMenu();
  };

  const goToCreate = () => {
    setLocation("/create");
    closeMobileMenu();
  };

  const goToMessages = () => {
    setViewMode("messages");
    setLocation("/messages");
    closeMobileMenu();
  };

  const goToAccount = () => {
    setLocation("/settings");
    closeMobileMenu();
  };

  const handleCommunitySelect = (community: Community) => {
    setViewMode("community");
    setActiveCommunityId(community.id);
    if (onCommunityClick) {
      onCommunityClick(community);
    } else {
      setLocation(`/space/${community.slug}/community`);
    }
    closeMobileMenu();
  };

  return (
    <div className="flex h-screen bg-void overflow-hidden text-white/90">
      {/* NavRail (60px fixed width) */}
      <NavRail communities={communities} draftCommunity={draftCommunity} onCommunityClick={onCommunityClick} />

      {/* Context Panel (200-260px, conditionally shown) */}
      {showContextPanel && contextPanel}

      {/* Main Pane (flexible width) */}
      {children}

      {/* Mobile menu overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 md:hidden"
          onClick={closeMobileMenu}
          data-testid="app-layout-mobile-overlay"
        />
      )}

      {/* Mobile global menu */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] md:hidden bg-black/95 border-r border-white/[0.08] transform transition-transform duration-200 flex flex-col ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        data-testid="app-layout-mobile-menu"
      >
        <div className="h-14 px-4 border-b border-white/[0.08] flex items-center justify-between">
          <span className="font-display font-bold text-white/90">Navigation</span>
          <button
            onClick={closeMobileMenu}
            className="h-10 w-10 flex items-center justify-center rounded-lg text-white/50 hover:text-white/90 hover:bg-white/[0.04] transition-all duration-200"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          <button
            onClick={goToDashboard}
            className={`${mobileNavBase} ${mobileNavState(isDashboardActive)}`}
            data-testid="mobile-nav-dashboard"
          >
            <Home className="h-4 w-4" />
            <span className="text-sm font-medium">Dashboard</span>
          </button>

          <div>
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">Apps</p>
            <div className="space-y-1">
              {draftCommunity && (
                <div className="h-11 px-3 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-center gap-3">
                  <div className="h-7 w-7 rounded-md bg-gradient-to-br from-amber-500 via-pink-500 to-violet-500 flex items-center justify-center overflow-hidden">
                    {draftCommunity.logoUrl ? (
                      <img src={draftCommunity.logoUrl} alt={draftCommunity.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-white">{draftCommunity.name?.[0]?.toUpperCase() || "+"}</span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-white/90 truncate">{draftCommunity.name || "New Community"}</span>
                  <span className="text-[10px] font-bold text-amber-200 bg-amber-500/20 px-1.5 py-0.5 rounded">NEW</span>
                </div>
              )}

              {communities.map((community) => {
                const isCommunityActive =
                  activeCommunityId === community.id || location.startsWith(`/space/${community.slug}/community`);
                return (
                  <button
                    key={community.id}
                    onClick={() => handleCommunitySelect(community)}
                    className={`${mobileNavBase} ${mobileNavState(isCommunityActive)}`}
                    data-testid={`mobile-nav-community-${community.slug}`}
                  >
                    <div className="h-7 w-7 rounded-md bg-gradient-to-br from-amber-500 via-pink-500 to-violet-500 flex items-center justify-center overflow-hidden shrink-0">
                      {community.logoUrl ? (
                        <img src={community.logoUrl} alt={community.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-bold text-white">{community.name?.[0]?.toUpperCase() || "?"}</span>
                      )}
                    </div>
                    <span className="text-sm font-medium truncate">{community.name}</span>
                  </button>
                );
              })}

              {communities.length === 0 && !draftCommunity && (
                <div className="h-11 px-3 rounded-lg border border-white/[0.08] bg-white/[0.02] flex items-center text-sm text-white/45">
                  No apps yet
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-white/[0.08]" />

          <div className="space-y-1">
            <button
              onClick={goToDiscover}
              className={`${mobileNavBase} ${mobileNavState(isDiscoverActive)}`}
              data-testid="mobile-nav-discover"
            >
              <Compass className="h-4 w-4" />
              <span className="text-sm font-medium">Discover</span>
            </button>
            <button
              onClick={goToCreate}
              className={`${mobileNavBase} ${mobileNavState(isCreateActive)}`}
              data-testid="mobile-nav-create"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">Create Community</span>
            </button>
            <button
              onClick={goToMessages}
              className={`${mobileNavBase} ${mobileNavState(isMessagesActive)}`}
              data-testid="mobile-nav-messages"
            >
              <Mail className="h-4 w-4" />
              <span className="text-sm font-medium">Messages</span>
            </button>
            <button
              onClick={goToAccount}
              className={`${mobileNavBase} ${mobileNavState(isAccountActive)}`}
              data-testid="mobile-nav-account"
            >
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-amber-500/20 via-pink-500/20 to-violet-500/20 border border-white/[0.1] flex items-center justify-center overflow-hidden shrink-0">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user?.username || "User"} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-4 w-4 text-white/60" />
                )}
              </div>
              <span className="text-sm font-medium">Account</span>
            </button>
          </div>

          {mobileContextContent && (
            <div>
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">Current App</p>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-2">{mobileContextContent}</div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

// Export all layout components from this file for convenience
export { NavRail } from "./NavRail";
export { ContextPanel, ChannelItem, SectionHeader } from "./ContextPanel";
export { MainPane, HeaderTitle } from "./MainPane";
