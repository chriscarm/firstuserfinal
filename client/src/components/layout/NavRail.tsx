import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Home,
  Mail,
  Compass,
  Plus,
  User,
  Lightbulb,
} from "lucide-react";
import { useLayout } from "@/contexts/LayoutContext";
import { NotificationBell } from "@/components/notifications";
import { AdminIdeasPanel } from "@/components/AdminIdeasPanel";

interface Community {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
}

// Draft community for real-time preview in CreateSpace wizard
interface DraftCommunity {
  id: number;  // Use -1 for draft
  name: string;
  slug: string;
  logoUrl: string | null;
}

interface NavRailProps {
  communities?: Community[];
  draftCommunity?: DraftCommunity | null;
  onCommunityClick?: (community: Community) => void;
  unreadCounts?: Record<number, number>; // community ID -> total unread count
}

// Get 1-2 character initials from name
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 0 || !words[0]) return "?";
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function NavRail({ communities = [], draftCommunity, onCommunityClick, unreadCounts = {} }: NavRailProps) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { viewMode, setViewMode, activeCommunityId, setActiveCommunityId } = useLayout();
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const isDashboardActive = location.startsWith("/dashboard");
  const isMessagesActive = location.startsWith("/messages") || viewMode === "messages";
  const isDiscoverActive = location.startsWith("/explore") || viewMode === "discover";
  const isAccountActive = location.startsWith("/settings") || location.startsWith("/profile");

  const railSlotBase =
    "group relative mx-2 flex h-11 w-11 items-center justify-center rounded-xl border border-transparent transition-all duration-200";
  const railSlotState = (isActive: boolean) =>
    isActive
      ? "bg-white/[0.1] border-white/[0.14] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]"
      : "hover:bg-white/[0.05] hover:border-white/[0.1]";
  const railIconState = (isActive: boolean) =>
    isActive ? "text-white/90" : "text-white/35 group-hover:text-white/70";

  const handleDashboardClick = () => {
    setViewMode("discover");
    setLocation("/dashboard");
  };

  const handleMailClick = () => {
    setViewMode("messages");
    setLocation("/messages");
  };

  const handleDiscoverClick = () => {
    setViewMode("discover");
    setLocation("/explore");
  };

  const handleAccountClick = () => {
    setLocation("/settings");
  };

  const handleCommunityClick = (community: Community) => {
    setViewMode("community");
    setActiveCommunityId(community.id);
    onCommunityClick?.(community);
  };

  return (
    <aside
      className="hidden md:flex flex-col w-[60px] bg-black border-r border-white/[0.08] z-20"
      data-testid="nav-rail"
    >
      {/* Top Section: Messages */}
      <div className="border-b border-white/[0.08] py-2">
        <button
          onClick={handleMailClick}
          className={`${railSlotBase} ${railSlotState(isMessagesActive)}`}
          data-testid="nav-rail-mail"
          title="Messages"
        >
          <Mail className={`h-5 w-5 transition-colors ${railIconState(isMessagesActive)}`} />
        </button>
      </div>

      {/* Communities Section */}
      <div className="flex-1 py-3 space-y-2 overflow-y-auto">
        {/* Dashboard */}
        <button
          onClick={handleDashboardClick}
          className={`${railSlotBase} ${railSlotState(isDashboardActive)}`}
          data-testid="nav-rail-dashboard"
          title="Dashboard"
        >
          <Home className={`h-5 w-5 transition-colors ${railIconState(isDashboardActive)}`} />
        </button>

        {/* Draft Community Preview (for CreateSpace wizard) */}
        {draftCommunity && (
          <div className="relative mx-2">
            <div
              className="relative flex items-center justify-center h-11 w-11 rounded-xl bg-white/[0.1] border border-white/[0.14] cursor-default"
              data-testid="nav-rail-draft-community"
              title={draftCommunity.name || "New Community"}
            >
              {/* Active indicator - rainbow gradient with pulse */}
              <div
                className="absolute left-[-2px] top-1/2 -translate-y-1/2 w-1 h-5 rounded-full animate-pulse"
                style={{
                  background: "linear-gradient(180deg, #f59e0b 0%, #ec4899 50%, #8b5cf6 100%)"
                }}
              />
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 via-pink-500 to-violet-500 flex items-center justify-center overflow-hidden ring-2 ring-amber-500/50 animate-pulse">
                {draftCommunity.logoUrl ? (
                  <img
                    src={draftCommunity.logoUrl}
                    alt={draftCommunity.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold text-white">
                    {getInitials(draftCommunity.name) || "+"}
                  </span>
                )}
              </div>
            </div>
            {/* NEW indicator */}
            <span className="absolute -top-1 -right-1 text-[10px] font-bold bg-amber-500 text-black rounded-full px-1.5 py-0.5">
              NEW
            </span>
          </div>
        )}

        {communities.map((community) => {
          const unreadCount = unreadCounts[community.id] || 0;
          const isActive = viewMode === "community" && activeCommunityId === community.id;

          return (
            <button
              key={community.id}
              onClick={() => handleCommunityClick(community)}
              className={`${railSlotBase} ${railSlotState(isActive)} hover-border-brighten`}
              data-testid={`nav-rail-community-${community.slug}`}
              title={community.name}
            >
              {/* Active indicator - rainbow gradient */}
              {isActive && (
                <div
                  className="absolute left-[-2px] top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
                  style={{
                    background: "linear-gradient(180deg, #f59e0b 0%, #ec4899 50%, #8b5cf6 100%)"
                  }}
                />
              )}
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 via-pink-500 to-violet-500 flex items-center justify-center overflow-hidden">
                {community.logoUrl ? (
                  <img
                    src={community.logoUrl}
                    alt={community.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-white">
                    {community.name?.[0]?.toUpperCase() || "?"}
                  </span>
                )}
              </div>
              {/* Unread badge */}
              {unreadCount > 0 && !isActive && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          );
        })}

        {/* Discover Button */}
        <button
          onClick={handleDiscoverClick}
          className={`${railSlotBase} ${railSlotState(isDiscoverActive)}`}
          data-testid="nav-rail-discover"
          title="Discover communities"
        >
          <Compass className={`h-5 w-5 transition-colors ${railIconState(isDiscoverActive)}`} />
        </button>

      </div>

      {/* Bottom Section: Utility Actions */}
      <div className="py-3 space-y-2 border-t border-white/[0.08]">
        {/* Admin Ideas Panel - Only visible to FirstUser founder */}
        {user?.hasFounderAccess && (
          <button
            onClick={() => setShowAdminPanel(true)}
            className={`${railSlotBase} hover:bg-amber-500/10 hover:border-amber-500/25`}
            data-testid="nav-rail-admin"
            title="Admin: Ideas Backlog"
          >
            <Lightbulb className="h-5 w-5 text-amber-400/60 group-hover:text-amber-300 transition-colors" />
          </button>
        )}

        {/* Create New Community */}
        <Link href="/create">
          <div
            className="group flex items-center justify-center h-11 w-11 mx-2 rounded-xl border border-dashed border-white/[0.18] hover:border-white/[0.3] hover:bg-white/[0.05] cursor-pointer transition-all duration-200"
            data-testid="nav-rail-create"
            title="Create a new community"
          >
            <Plus className="h-5 w-5 text-white/35 group-hover:text-white/70 transition-colors" />
          </div>
        </Link>

        {/* Notifications */}
        <div className="flex items-center justify-center">
          <NotificationBell
            triggerClassName={`${railSlotBase} ${railSlotState(false)}`}
            iconClassName={`h-5 w-5 transition-colors ${railIconState(false)}`}
            badgeClassName="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
          />
        </div>

        {/* Account (Settings + Profile) */}
        <button
          onClick={handleAccountClick}
          className={`${railSlotBase} ${railSlotState(isAccountActive)}`}
          data-testid="nav-rail-account"
          title="Account settings"
        >
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-500/20 via-pink-500/20 to-violet-500/20 border border-white/[0.1] flex items-center justify-center overflow-hidden">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user?.username || "User"}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className={`h-5 w-5 transition-colors ${railIconState(isAccountActive)}`} />
            )}
          </div>
        </button>
      </div>

      {/* Admin Ideas Panel */}
      {user?.hasFounderAccess && (
        <AdminIdeasPanel
          open={showAdminPanel}
          onOpenChange={setShowAdminPanel}
        />
      )}
    </aside>
  );
}
