import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type ViewMode = "community" | "messages" | "discover";

interface LayoutContextValue {
  // Current view mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Active community/app space ID
  activeCommunityId: number | null;
  setActiveCommunityId: (id: number | null) => void;

  // Active channel ID within a community
  activeChannelId: number | null;
  setActiveChannelId: (id: number | null) => void;

  // Whether context panel (middle column) should be visible
  showContextPanel: boolean;
  setShowContextPanel: (show: boolean) => void;

  // Mobile sidebar state
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

interface LayoutProviderProps {
  children: ReactNode;
}

export function LayoutProvider({ children }: LayoutProviderProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("community");
  const [activeCommunityId, setActiveCommunityId] = useState<number | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [showContextPanel, setShowContextPanel] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const toggleMobileSidebar = useCallback(() => {
    setMobileSidebarOpen((prev) => !prev);
  }, []);

  // When view mode changes to discover, hide context panel
  const handleSetViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "discover") {
      setShowContextPanel(false);
    } else {
      setShowContextPanel(true);
    }
  }, []);

  const value: LayoutContextValue = {
    viewMode,
    setViewMode: handleSetViewMode,
    activeCommunityId,
    setActiveCommunityId,
    activeChannelId,
    setActiveChannelId,
    showContextPanel,
    setShowContextPanel,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    toggleMobileSidebar,
  };

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout(): LayoutContextValue {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within a LayoutProvider");
  }
  return context;
}
