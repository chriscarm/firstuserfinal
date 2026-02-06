import { ReactNode } from "react";
import { NavRail } from "./NavRail";
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
  children,
  showContextPanel: showContextPanelProp,
}: AppLayoutProps) {
  const { showContextPanel: showContextPanelFromContext } = useLayout();

  // Allow prop to override context, but default to context value
  const showContextPanel = showContextPanelProp ?? showContextPanelFromContext;

  return (
    <div className="flex h-screen bg-void overflow-hidden text-white/90">
      {/* NavRail (60px fixed width) */}
      <NavRail communities={communities} draftCommunity={draftCommunity} onCommunityClick={onCommunityClick} />

      {/* Context Panel (200-260px, conditionally shown) */}
      {showContextPanel && contextPanel}

      {/* Main Pane (flexible width) */}
      {children}
    </div>
  );
}

// Export all layout components from this file for convenience
export { NavRail } from "./NavRail";
export { ContextPanel, ChannelItem, SectionHeader } from "./ContextPanel";
export { MainPane, HeaderTitle } from "./MainPane";
