import { ReactNode } from "react";
import { Menu, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLayout } from "@/contexts/LayoutContext";

interface MainPaneProps {
  // Header configuration
  header?: ReactNode;
  mobileTitle?: string;

  // Sub-header for tabs or filters
  subHeader?: ReactNode;

  // Main content
  children: ReactNode;

  // Whether the main pane should have padding
  noPadding?: boolean;
}

export function MainPane({
  header,
  mobileTitle,
  subHeader,
  children,
  noPadding = false,
}: MainPaneProps) {
  const { user } = useAuth();
  const { toggleMobileSidebar } = useLayout();

  return (
    <main className="flex-1 flex flex-col z-10 overflow-hidden bg-[#0a0a0a]">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-white/[0.08] bg-[#0a0a0a]">
        <button
          onClick={toggleMobileSidebar}
          className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-white/[0.04] transition-all duration-200"
          data-testid="main-pane-hamburger"
        >
          <Menu className="h-6 w-6 text-white/90" />
        </button>
        <span className="font-display font-bold text-white/90">
          {mobileTitle || "Dashboard"}
        </span>
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500/20 via-pink-500/20 to-violet-500/20 border border-white/[0.08] flex items-center justify-center overflow-hidden">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user?.username || "User"}
              className="h-full w-full object-cover"
            />
          ) : (
            <User className="h-4 w-4 text-white/50" />
          )}
        </div>
      </header>

      {/* Desktop Header */}
      {header && (
        <header
          className="hidden md:flex items-center justify-between h-14 px-6 border-b border-white/[0.08]"
          data-testid="main-pane-header"
        >
          {header}
        </header>
      )}

      {/* Sub-header (tabs, filters, etc.) */}
      {subHeader && (
        <div className="border-b border-white/[0.08]" data-testid="main-pane-subheader">
          {subHeader}
        </div>
      )}

      {/* Main content */}
      <div
        className={`flex-1 overflow-y-auto ${noPadding ? "" : "p-4 md:p-6"}`}
        data-testid="main-pane-content"
      >
        {children}
      </div>
    </main>
  );
}

// Common header variants for reuse
interface HeaderTitleProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function HeaderTitle({ icon, title, subtitle, actions }: HeaderTitleProps) {
  return (
    <>
      <div className="flex items-center gap-3">
        {icon && <div className="text-white/50">{icon}</div>}
        <div>
          <h1 className="font-display text-xl font-bold text-white/90">{title}</h1>
          {subtitle && (
            <p className="text-sm text-white/50">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </>
  );
}
