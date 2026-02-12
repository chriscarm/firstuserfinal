import { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type UserStatus = "owner" | "member" | "waitlist" | null;

interface ContextPanelProps {
  // Header configuration
  title?: string;
  subtitle?: string;
  logoUrl?: string | null;
  userStatus?: UserStatus;

  // Children for the scrollable content
  children: ReactNode;

  // Footer content (optional)
  footer?: ReactNode;

  // Custom width (default is 200-260px)
  width?: "narrow" | "normal" | "wide";
}

function StatusBadge({ status }: { status: UserStatus }) {
  if (!status) return null;

  switch (status) {
    case "owner":
      return (
        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
          Owner
        </Badge>
      );
    case "member":
      return (
        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
          Member
        </Badge>
      );
    case "waitlist":
      return (
        <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-xs">
          On Waitlist
        </Badge>
      );
    default:
      return null;
  }
}

export function ContextPanel({
  title,
  subtitle,
  logoUrl,
  userStatus,
  children,
  footer,
  width = "normal",
}: ContextPanelProps) {
  const widthClass = {
    narrow: "w-[180px]",
    normal: "w-[200px]",
    wide: "w-[260px]",
  }[width];

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`
          hidden md:flex flex-col ${widthClass}
          bg-white/[0.02] border-r border-white/[0.08]
        `}
        data-testid="context-panel"
      >
        {/* Header */}
        {(title || logoUrl) && (
          <div className="h-14 px-4 flex items-center gap-3 border-b border-white/[0.08]">
            {/* Logo */}
            {logoUrl && (
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 via-pink-500 to-violet-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                <img
                  src={logoUrl}
                  alt={title || "Community"}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {!logoUrl && title && (
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 via-pink-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-bold text-white">
                  {title[0]?.toUpperCase() || "?"}
                </span>
              </div>
            )}

            {/* Title and status */}
            <div className="flex-1 min-w-0">
              {title && (
                <span className="font-display font-bold text-white/90 truncate block">
                  {title}
                </span>
              )}
              {subtitle && (
                <span className="text-xs text-white/55 block">{subtitle}</span>
              )}
              {userStatus && !subtitle && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <StatusBadge status={userStatus} />
                </div>
              )}
            </div>

            <ChevronDown className="h-4 w-4 text-white/50" />
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto py-4 px-2">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-white/[0.08] p-3">{footer}</div>
        )}
      </aside>

    </>
  );
}

// Channel list item component for reuse
interface ChannelItemProps {
  icon: ReactNode;
  name: string;
  isActive?: boolean;
  isLocked?: boolean;
  onClick?: () => void;
  testId?: string;
  variant?: "default" | "waitlist";
  unreadCount?: number;
  tooltip?: string;
}

export function ChannelItem({
  icon,
  name,
  isActive,
  isLocked,
  onClick,
  testId,
  variant = "default",
  unreadCount,
  tooltip,
}: ChannelItemProps) {
  const activeClass = variant === "waitlist"
    ? "bg-amber-500/15 border-l-2 border-amber-400 text-amber-300"
    : "bg-white/[0.08] border-l-2 border-white/50 text-white/90";

  const iconActiveClass = variant === "waitlist" ? "text-amber-300" : "text-white/90";

  return (
    <div
      onClick={isLocked ? undefined : onClick}
      className={`flex items-center gap-2 h-11 px-2 rounded-lg transition-all duration-200 group relative ${
        isLocked
          ? "opacity-50 cursor-not-allowed"
          : isActive
          ? activeClass
          : "hover:bg-white/[0.04] cursor-pointer"
      }`}
      data-testid={testId}
      title={isLocked && tooltip ? tooltip : undefined}
    >
      <div className={`h-4 w-4 ${isActive ? iconActiveClass : "text-white/25"}`}>
        {icon}
      </div>
      <span
        className={`flex-1 text-sm ${
          isLocked
            ? "text-white/25"
            : isActive
            ? (variant === "waitlist" ? "text-amber-300" : "text-white/90")
            : "text-white/50 group-hover:text-white/70"
        }`}
      >
        {name}
      </span>
      {unreadCount !== undefined && unreadCount > 0 && !isActive && (
        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </div>
  );
}

// Section header for channel lists
interface SectionHeaderProps {
  title: string;
  icon?: ReactNode;
  variant?: "default" | "waitlist" | "locked";
}

export function SectionHeader({ title, icon, variant = "default" }: SectionHeaderProps) {
  const colorClass = {
    default: "text-white/25",
    waitlist: "text-amber-400",
    locked: "text-white/25",
  }[variant];

  return (
    <div className={`text-[10px] font-semibold ${colorClass} uppercase tracking-[0.15em] px-2 mb-2 mt-3 flex items-center gap-1.5`}>
      {title}
      {icon}
    </div>
  );
}
