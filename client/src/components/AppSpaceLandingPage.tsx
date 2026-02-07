import { useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, ChevronDown, Loader2, PartyPopper } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useFounderGate } from "@/hooks/useFounderGate";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AppSpace } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const defaultTierPerks: Record<string, string> = {
  "1st": "Unlimited Lifetime access for free",
  "10¹": "1 year free access",
  "10²": "6 months free access",
  "10³": "3 months free access",
  "10⁴": "1 month free access",
  "F": "Founder badge",
};

interface WaitlistUser {
  id: number;
  userId: string;
  position: number;
  badgeTier: string;
  isActive: boolean;
  status: string;
  joinedAt?: string;
  user?: {
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

interface AppSpaceLandingPageProps {
  appSpace: AppSpace;
  activeUsers: WaitlistUser[];
  waitlistUsers: WaitlistUser[];
  stats: {
    activeCount: number;
    waitlistCount: number;
  };
  goldenTicket?: {
    status: "open" | "selected" | "closed";
    selected: boolean;
    selectedAt: string | null;
    isWinner: boolean;
    serviceContingent: boolean;
  };
}

interface Founder {
  name: string;
  title: string;
  avatar?: string;
  avatarUrl?: string;
  photoUrl?: string;
  linkedInUrl?: string;
}

interface TierReward {
  tier: string;
  label: string;
  reward: string;
}

// CSS Custom Properties for the design system
const cssVars = {
  void: "#000000",
  surface: "#0a0a0a",
  glassBorder: "rgba(255, 255, 255, 0.08)",
  glassBg: "rgba(255, 255, 255, 0.02)",
  glassBgHover: "rgba(255, 255, 255, 0.04)",
  textPrimary: "rgba(255, 255, 255, 0.9)",
  textSecondary: "rgba(255, 255, 255, 0.5)",
  textMuted: "rgba(255, 255, 255, 0.25)",
  rainbow1: "#f59e0b",
  rainbow2: "#ef4444",
  rainbow3: "#ec4899",
  rainbow4: "#8b5cf6",
  rainbow5: "#3b82f6",
  rainbow6: "#10b981",
};

// Badge component with vibrant styling
const Badge = ({ tier, customPerk }: { tier: string; customPerk?: string }) => {
  const getBadgeStyle = (tier: string): React.CSSProperties => {
    switch (tier) {
      case "1st":
        return {
          background: "linear-gradient(to right, #facc15, #d97706)",
          color: "black",
          border: "none",
          boxShadow: "0 0 10px rgba(251, 191, 36, 0.4)",
        };
      case "10¹":
        return {
          background: "#d1d5db",
          color: "black",
          border: "none",
        };
      case "10²":
        return {
          background: "#b45309",
          color: "white",
          border: "none",
        };
      case "10³":
        return {
          background: "#7c3aed",
          color: "white",
          border: "none",
          boxShadow: "0 0 10px rgba(124, 58, 237, 0.4)",
        };
      case "10⁴":
        return {
          background: "rgba(255, 255, 255, 0.1)",
          color: "white",
          border: "1px solid rgba(255, 255, 255, 0.2)",
        };
      case "F":
        return {
          background: "linear-gradient(to right, #a855f7, #ec4899)",
          color: "white",
          border: "none",
        };
      default:
        return {
          background: "rgba(255, 255, 255, 0.1)",
          color: "white",
          border: "1px solid rgba(255, 255, 255, 0.2)",
        };
    }
  };

  const perk = customPerk || defaultTierPerks[tier] || "Early access perk";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            style={{
              ...getBadgeStyle(tier),
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px 10px",
              fontSize: "10px",
              fontWeight: 600,
              borderRadius: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              fontFamily: "'Space Grotesk', sans-serif",
              cursor: "help",
            }}
          >
            {tier}
          </span>
        </TooltipTrigger>
        <TooltipContent className="bg-zinc-900 text-white border-white/10 max-w-xs">
          <p className="text-sm font-medium">{perk}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default function AppSpaceLandingPage({
  appSpace,
  activeUsers,
  waitlistUsers,
  stats,
  goldenTicket,
}: AppSpaceLandingPageProps) {
  const [, setLocation] = useLocation();
  const { user, openPhoneAuthModal } = useAuth();
  const [userTab, setUserTab] = useState<"active" | "waitlist">("active");
  const [tierExpanded, setTierExpanded] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [joinResult, setJoinResult] = useState<{ position: number; badgeTier: string } | null>(null);
  const queryClient = useQueryClient();

  const handleViewCommunity = () => {
    setLocation(`/space/${appSpace.slug}/community`);
  };

  const solutionPoints: string[] = appSpace.solutionPoints
    ? JSON.parse(appSpace.solutionPoints)
    : [];
  const founders: Founder[] = appSpace.founders
    ? JSON.parse(appSpace.founders)
    : [];
  const tierRewards: TierReward[] = appSpace.tierRewards
    ? JSON.parse(appSpace.tierRewards)
    : [];

  const joinWaitlistMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appspaces/${appSpace.id}/join`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to join waitlist");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setJoinResult({ position: data.member.position, badgeTier: data.member.badgeTier });
      setShowSuccessModal(true);
      queryClient.invalidateQueries({ queryKey: ["appspace", appSpace.slug] });
    },
    onError: (error: Error) => {
      if (error.message === "Already joined this waitlist") {
        setLocation(`/space/${appSpace.slug}/community`);
      } else {
        console.error("Join waitlist error:", error.message);
      }
    },
  });

  const handleJoinWaitlist = () => {
    if (!user) {
      openPhoneAuthModal(appSpace.slug, appSpace.id);
      return;
    }
    joinWaitlistMutation.mutate();
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "??";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return "Recently";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${diffWeeks}w ago`;
  };

  const displayUsers = userTab === "active" ? activeUsers : waitlistUsers;
  const currentTier = tierRewards[0];

  const screenshots: string[] = appSpace.screenshots
    ? JSON.parse(appSpace.screenshots)
    : [];

  const btnPrimaryStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, rgba(245, 158, 11, 0.9) 0%, rgba(236, 72, 153, 0.9) 50%, rgba(139, 92, 246, 0.9) 100%)`,
    color: "white",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    padding: "12px 24px",
    borderRadius: "12px",
    fontWeight: 500,
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  };

  const btnSecondaryStyle: React.CSSProperties = {
    background: cssVars.glassBg,
    color: cssVars.textSecondary,
    border: `1px solid ${cssVars.glassBorder}`,
    padding: "12px 24px",
    borderRadius: "12px",
    fontWeight: 500,
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: cssVars.void,
        color: cssVars.textPrimary,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        WebkitFontSmoothing: "antialiased",
        overflowX: "hidden",
        fontWeight: 400,
        paddingBottom: "100px",
      }}
      className="lg:pb-0"
    >
      {/* Header Section */}
      <div
        style={{
          borderBottom: `1px solid ${cssVars.glassBorder}`,
          padding: "48px 24px",
        }}
      >
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          {/* Logo */}
          <div
            className="hover-glow-subtle"
            style={{
              width: "96px",
              height: "96px",
              margin: "0 auto 32px",
              position: "relative",
              borderRadius: "24px",
              boxShadow: `0 0 60px rgba(245, 158, 11, 0.08), 0 0 100px rgba(236, 72, 153, 0.05), 0 0 140px rgba(139, 92, 246, 0.03)`,
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "24px",
                background: cssVars.void,
                border: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {appSpace.logoUrl ? (
                <img
                  src={appSpace.logoUrl}
                  alt={appSpace.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: "48px",
                    fontWeight: 600,
                    background: `linear-gradient(180deg, ${cssVars.rainbow1} 0%, ${cssVars.rainbow2} 25%, ${cssVars.rainbow3} 45%, ${cssVars.rainbow4} 65%, ${cssVars.rainbow5} 85%, ${cssVars.rainbow6} 100%)`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    filter: "drop-shadow(0 0 20px rgba(236, 72, 153, 0.3))",
                  }}
                >
                  1
                </span>
              )}
            </div>
          </div>

          {/* App Name */}
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "32px",
              fontWeight: 500,
              color: cssVars.textPrimary,
              marginBottom: "12px",
              letterSpacing: "-0.03em",
            }}
          >
            {appSpace.name}
          </h1>

          {/* Tagline */}
          <p
            style={{
              fontSize: "16px",
              color: cssVars.textSecondary,
              maxWidth: "500px",
              margin: "0 auto 32px",
              lineHeight: 1.6,
              fontWeight: 400,
            }}
          >
            {appSpace.tagline}
          </p>

          <div style={{ marginBottom: "24px" }}>
            <span
              className={(goldenTicket?.status ?? "open") === "open" ? "bg-fuchsia-500/20 text-fuchsia-200" : "bg-white/10 text-white/80"}
              style={{
                display: "inline-flex",
                padding: "6px 12px",
                borderRadius: "9999px",
                border: "1px solid rgba(255, 255, 255, 0.18)",
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              {(goldenTicket?.status ?? "open") === "open" ? "Golden Ticket Open" : "Golden Ticket Selected"}
            </span>
            <p style={{ marginTop: "10px", color: cssVars.textSecondary, fontSize: "13px" }}>
              Help build this product and you could be chosen for max-tier access free for life (service-contingent).
            </p>
          </div>

          {/* CTA Buttons (Desktop) */}
          <div className="hidden lg:flex" style={{ alignItems: "center", justifyContent: "center", gap: "12px" }}>
            <div className="laser-wrapper">
              <button
                onClick={handleViewCommunity}
                style={btnSecondaryStyle}
              >
                Community Chat
              </button>
            </div>
            <button
              onClick={handleJoinWaitlist}
              disabled={joinWaitlistMutation.isPending}
              className="hover-lift"
              style={{
                ...btnPrimaryStyle,
                opacity: joinWaitlistMutation.isPending ? 0.5 : 1,
              }}
            >
              {joinWaitlistMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Joining...
                </>
              ) : (
                "Join Waitlist"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Content */}
      <div className="lg:hidden" style={{ padding: "32px 24px" }}>
        {/* Problem Section */}
        <div>
          <div
            style={{
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              marginBottom: "16px",
              fontWeight: 500,
              color: "rgba(239, 68, 68, 0.7)",
            }}
          >
            The Problem
          </div>
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "20px",
              fontWeight: 500,
              color: cssVars.textPrimary,
              lineHeight: 1.3,
              marginBottom: "12px",
            }}
          >
            {appSpace.problemTitle || "Problem not defined"}
          </h2>
          <p style={{ color: cssVars.textSecondary, lineHeight: 1.7, fontSize: "14px", fontWeight: 400 }}>
            {appSpace.problemDescription || "No problem description available."}
          </p>
        </div>

        <hr style={{ border: "none", borderTop: `1px solid ${cssVars.glassBorder}`, margin: "32px 0" }} />

        {/* Solution Section */}
        <div>
          <div
            style={{
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              marginBottom: "16px",
              fontWeight: 500,
              color: "rgba(16, 185, 129, 0.7)",
            }}
          >
            The Solution
          </div>
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "20px",
              fontWeight: 500,
              color: cssVars.textPrimary,
              lineHeight: 1.3,
              marginBottom: "12px",
            }}
          >
            {appSpace.solutionTitle || "Solution not defined"}
          </h2>
          <p style={{ color: cssVars.textSecondary, lineHeight: 1.7, fontSize: "14px", fontWeight: 400 }}>
            {appSpace.solutionDescription || "No solution description available."}
          </p>
          {solutionPoints.length > 0 && (
            <ul style={{ listStyle: "none", marginTop: "20px" }}>
              {solutionPoints.map((point, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    color: cssVars.textSecondary,
                    fontSize: "14px",
                    marginBottom: "12px",
                  }}
                >
                  <CheckCircle2
                    style={{
                      width: "16px",
                      height: "16px",
                      color: cssVars.rainbow6,
                      flexShrink: 0,
                      marginTop: "2px",
                      opacity: 0.8,
                    }}
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <hr style={{ border: "none", borderTop: `1px solid ${cssVars.glassBorder}`, margin: "32px 0" }} />

        {/* Founders - Mobile */}
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              marginBottom: "16px",
              fontWeight: 500,
              color: cssVars.textMuted,
            }}
          >
            Founders
          </div>
          <div
            style={{
              display: "flex",
              gap: "12px",
              overflowX: "auto",
              paddingBottom: "8px",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {founders.length > 0 ? (
              founders.map((founder, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    background: cssVars.glassBg,
                    border: `1px solid ${cssVars.glassBorder}`,
                    borderRadius: "16px",
                    padding: "14px",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "12px",
                      background: `linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)`,
                      border: `1px solid ${cssVars.glassBorder}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: cssVars.textSecondary,
                      overflow: "hidden",
                    }}
                  >
                    {founder.photoUrl || founder.avatarUrl ? (
                      <img
                        src={founder.photoUrl || founder.avatarUrl}
                        alt={founder.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      getInitials(founder.name)
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 500, color: cssVars.textPrimary }}>
                      {founder.name}
                    </div>
                    <div style={{ fontSize: "12px", color: cssVars.textMuted, marginTop: "2px" }}>
                      {founder.title}
                    </div>
                    {founder.linkedInUrl && (
                      <a
                        href={founder.linkedInUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "11px",
                          color: cssVars.textMuted,
                          textDecoration: "none",
                          marginTop: "2px",
                          display: "inline-block",
                        }}
                      >
                        LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p style={{ fontSize: "14px", color: cssVars.textMuted }}>No founders listed</p>
            )}
          </div>
        </div>

        <hr style={{ border: "none", borderTop: `1px solid ${cssVars.glassBorder}`, margin: "32px 0" }} />

        {/* Screenshots - Mobile */}
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              marginBottom: "16px",
              fontWeight: 500,
              color: cssVars.textMuted,
            }}
          >
            Screenshots
          </div>
          <div
            style={{
              display: "flex",
              gap: "12px",
              overflowX: "auto",
              paddingBottom: "8px",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {screenshots.length > 0
              ? screenshots.map((url, i) => (
                  <div
                    key={i}
                    style={{
                      flexShrink: 0,
                      width: "160px",
                      height: "100px",
                      borderRadius: "12px",
                      background: cssVars.glassBg,
                      border: `1px solid ${cssVars.glassBorder}`,
                      overflow: "hidden",
                    }}
                  >
                    <img src={url} alt={`Screenshot ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))
              : [1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    style={{
                      flexShrink: 0,
                      width: "160px",
                      height: "100px",
                      borderRadius: "12px",
                      background: cssVars.glassBg,
                      border: `1px solid ${cssVars.glassBorder}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ fontSize: "11px", color: cssVars.textMuted }}>Coming soon</span>
                  </div>
                ))}
          </div>
        </div>

        <hr style={{ border: "none", borderTop: `1px solid ${cssVars.glassBorder}`, margin: "32px 0" }} />

        {/* Tier Rewards Collapsible - Mobile */}
        {tierRewards.length > 0 && (
          <div>
            <button
              onClick={() => setTierExpanded(!tierExpanded)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: cssVars.glassBg,
                border: `1px solid ${cssVars.glassBorder}`,
                borderRadius: "16px",
                padding: "16px",
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                {currentTier && <Badge tier={currentTier.tier} />}
                <div style={{ textAlign: "left" }}>
                  <div
                    style={{
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: cssVars.textMuted,
                    }}
                  >
                    Current Tier Reward
                  </div>
                  <div style={{ fontSize: "13px", color: cssVars.textSecondary, fontWeight: 400, marginTop: "2px" }}>
                    {currentTier?.reward || "Join to unlock rewards"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "10px",
                    textTransform: "uppercase",
                    color: cssVars.textMuted,
                    letterSpacing: "0.05em",
                  }}
                >
                  View all
                </span>
                <ChevronDown
                  style={{
                    width: "18px",
                    height: "18px",
                    color: cssVars.textMuted,
                    transition: "transform 0.3s ease",
                    transform: tierExpanded ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </div>
            </button>

            {tierExpanded && (
              <div
                style={{
                  marginTop: "8px",
                  background: cssVars.glassBg,
                  border: `1px solid ${cssVars.glassBorder}`,
                  borderRadius: "16px",
                  padding: "8px",
                }}
              >
                {tierRewards.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "12px",
                      borderRadius: "12px",
                      background: "transparent",
                      marginBottom: i < tierRewards.length - 1 ? "4px" : 0,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Badge tier={t.tier} />
                        <span style={{ fontSize: "12px", color: cssVars.textMuted }}>{t.label}</span>
                      </div>
                      <span
                        style={{
                          fontSize: "9px",
                          color: cssVars.textMuted,
                          background: "rgba(255, 255, 255, 0.03)",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Perks
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "12px",
                        color: cssVars.textSecondary,
                        background: "rgba(255, 255, 255, 0.02)",
                        border: `1px solid ${cssVars.glassBorder}`,
                        borderRadius: "8px",
                        padding: "10px",
                      }}
                    >
                      {t.reward}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar (Mobile) */}
      <div
        className="lg:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(0, 0, 0, 0.9)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: `1px solid ${cssVars.glassBorder}`,
          padding: "16px",
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", gap: "12px" }}>
          <div className="laser-wrapper" style={{ flex: 1 }}>
            <button
              onClick={handleViewCommunity}
              style={{ ...btnSecondaryStyle, width: "100%", justifyContent: "center" }}
            >
              Community Chat
            </button>
          </div>
          <button
            onClick={handleJoinWaitlist}
            disabled={joinWaitlistMutation.isPending}
            className="hover-lift"
            style={{
              ...btnPrimaryStyle,
              flex: 1,
              justifyContent: "center",
              opacity: joinWaitlistMutation.isPending ? 0.5 : 1,
            }}
          >
            {joinWaitlistMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Joining...
              </>
            ) : (
              "Join Waitlist"
            )}
          </button>
        </div>
      </div>

      {/* Desktop Grid */}
      <div
        className="hidden lg:grid"
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          gridTemplateColumns: "repeat(12, 1fr)",
          minHeight: "calc(100vh - 280px)",
        }}
      >
        {/* Left Column */}
        <div
          style={{
            gridColumn: "span 3",
            borderRight: `1px solid ${cssVars.glassBorder}`,
            padding: "32px 24px",
          }}
        >
          {/* Founders */}
          <div style={{ marginBottom: "40px" }}>
            <div
              style={{
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                marginBottom: "16px",
                fontWeight: 500,
                color: cssVars.textMuted,
              }}
            >
              Founders
            </div>
            {founders.length > 0 ? (
              founders.map((founder, i) => (
                <div
                  key={i}
                  className="hover-glow-card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    background: cssVars.glassBg,
                    border: `1px solid ${cssVars.glassBorder}`,
                    borderRadius: "14px",
                    padding: "14px",
                    marginBottom: "10px",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "12px",
                      background: `linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)`,
                      border: `1px solid ${cssVars.glassBorder}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: cssVars.textSecondary,
                      overflow: "hidden",
                    }}
                  >
                    {founder.photoUrl || founder.avatarUrl ? (
                      <img
                        src={founder.photoUrl || founder.avatarUrl}
                        alt={founder.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      getInitials(founder.name)
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 500, color: cssVars.textPrimary }}>
                      {founder.name}
                    </div>
                    <div style={{ fontSize: "12px", color: cssVars.textMuted, marginTop: "2px" }}>
                      {founder.title}
                    </div>
                    {founder.linkedInUrl && (
                      <a
                        href={founder.linkedInUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "11px",
                          color: cssVars.textMuted,
                          textDecoration: "none",
                          marginTop: "2px",
                          display: "inline-block",
                        }}
                      >
                        LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p style={{ fontSize: "14px", color: cssVars.textMuted }}>No founders listed</p>
            )}
          </div>

          {/* Tier Rewards */}
          <div>
            <div
              style={{
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                marginBottom: "16px",
                fontWeight: 500,
                color: cssVars.textMuted,
              }}
            >
              Tier Rewards
            </div>
            {tierRewards.length > 0 ? (
              tierRewards.map((t, i) => (
                <div
                  key={i}
                  className="group hover-glow-card"
                  style={{
                    padding: "14px",
                    borderRadius: "14px",
                    background: cssVars.glassBg,
                    border: `1px solid ${cssVars.glassBorder}`,
                    marginBottom: "8px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Badge tier={t.tier} />
                      <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.7)" }}>{t.label}</span>
                    </div>
                    <span
                      style={{
                        fontSize: "9px",
                        color: "rgba(255, 255, 255, 0.5)",
                        background: "rgba(255, 255, 255, 0.06)",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Perks
                    </span>
                  </div>
                  <div
                    className="max-h-0 overflow-hidden group-hover:max-h-20 transition-all duration-300 ease-out"
                  >
                    <div
                      style={{
                        marginTop: "10px",
                        fontSize: "12px",
                        color: cssVars.textSecondary,
                        background: "rgba(255, 255, 255, 0.02)",
                        border: `1px solid ${cssVars.glassBorder}`,
                        borderRadius: "8px",
                        padding: "10px",
                      }}
                    >
                      {t.reward}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ fontSize: "14px", color: cssVars.textMuted }}>No rewards set</p>
            )}
          </div>
        </div>

        {/* Middle Column */}
        <div
          style={{
            gridColumn: "span 6",
            borderRight: `1px solid ${cssVars.glassBorder}`,
            padding: "32px 40px",
          }}
        >
          {/* Problem Section */}
          <div style={{ marginBottom: "40px" }}>
            <div
              style={{
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                marginBottom: "16px",
                fontWeight: 500,
                color: "rgba(239, 68, 68, 0.7)",
              }}
            >
              The Problem
            </div>
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "22px",
                fontWeight: 500,
                color: cssVars.textPrimary,
                lineHeight: 1.3,
                marginBottom: "14px",
              }}
            >
              {appSpace.problemTitle || "Problem not defined"}
            </h2>
            <p style={{ color: cssVars.textSecondary, lineHeight: 1.7, fontWeight: 400 }}>
              {appSpace.problemDescription || "No problem description available."}
            </p>
          </div>

          <hr style={{ border: "none", borderTop: `1px solid ${cssVars.glassBorder}`, margin: "32px 0" }} />

          {/* Solution Section */}
          <div style={{ marginBottom: "40px" }}>
            <div
              style={{
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                marginBottom: "16px",
                fontWeight: 500,
                color: "rgba(16, 185, 129, 0.7)",
              }}
            >
              The Solution
            </div>
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "22px",
                fontWeight: 500,
                color: cssVars.textPrimary,
                lineHeight: 1.3,
                marginBottom: "14px",
              }}
            >
              {appSpace.solutionTitle || "Solution not defined"}
            </h2>
            <p style={{ color: cssVars.textSecondary, lineHeight: 1.7, fontWeight: 400, marginBottom: "24px" }}>
              {appSpace.solutionDescription || "No solution description available."}
            </p>
            {solutionPoints.length > 0 && (
              <ul style={{ listStyle: "none", marginTop: "24px" }}>
                {solutionPoints.map((point, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      color: cssVars.textSecondary,
                      marginBottom: "14px",
                      fontSize: "14px",
                    }}
                  >
                    <CheckCircle2
                      style={{
                        width: "18px",
                        height: "18px",
                        color: cssVars.rainbow6,
                        flexShrink: 0,
                        marginTop: "2px",
                        opacity: 0.7,
                      }}
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Screenshots */}
          <div style={{ borderTop: `1px solid ${cssVars.glassBorder}`, paddingTop: "32px" }}>
            <div
              style={{
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                marginBottom: "16px",
                fontWeight: 500,
                color: cssVars.textMuted,
              }}
            >
              Screenshots
            </div>
            <div
              style={{
                display: "flex",
                gap: "12px",
                overflowX: "auto",
                paddingBottom: "8px",
              }}
            >
              {screenshots.length > 0
                ? screenshots.map((url, i) => (
                    <div
                      key={i}
                      style={{
                        flexShrink: 0,
                        width: "180px",
                        height: "110px",
                        borderRadius: "12px",
                        background: cssVars.glassBg,
                        border: `1px solid ${cssVars.glassBorder}`,
                        overflow: "hidden",
                      }}
                    >
                      <img src={url} alt={`Screenshot ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  ))
                : [1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      style={{
                        flexShrink: 0,
                        width: "180px",
                        height: "110px",
                        borderRadius: "12px",
                        background: cssVars.glassBg,
                        border: `1px solid ${cssVars.glassBorder}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span style={{ fontSize: "11px", color: cssVars.textMuted }}>Coming soon</span>
                    </div>
                  ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ gridColumn: "span 3", display: "flex", flexDirection: "column" }}>
          {/* Stats */}
          <div
            style={{
              background: cssVars.glassBg,
              borderBottom: `1px solid ${cssVars.glassBorder}`,
              padding: "20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", textAlign: "center" }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "24px",
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 500,
                    color: cssVars.textPrimary,
                  }}
                >
                  {stats.activeCount}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: cssVars.textMuted,
                    marginTop: "4px",
                  }}
                >
                  Active
                </div>
              </div>
              <div style={{ width: "1px", background: cssVars.glassBorder }} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "24px",
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 500,
                    color: cssVars.textPrimary,
                  }}
                >
                  {stats.waitlistCount.toLocaleString()}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: cssVars.textMuted,
                    marginTop: "4px",
                  }}
                >
                  Waiting
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${cssVars.glassBorder}` }}>
            <button
              onClick={() => setUserTab("active")}
              style={{
                flex: 1,
                padding: "14px",
                fontSize: "11px",
                fontWeight: 500,
                color: userTab === "active" ? cssVars.textPrimary : cssVars.textMuted,
                background: userTab === "active" ? cssVars.glassBg : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Active Users
            </button>
            <button
              onClick={() => setUserTab("waitlist")}
              style={{
                flex: 1,
                padding: "14px",
                fontSize: "11px",
                fontWeight: 500,
                color: userTab === "waitlist" ? cssVars.textPrimary : cssVars.textMuted,
                background: userTab === "waitlist" ? cssVars.glassBg : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Waitlist
            </button>
          </div>

          {/* User List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {displayUsers.length > 0 ? (
              displayUsers.map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderBottom: `1px solid ${cssVars.glassBorder}`,
                    transition: "background 0.2s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        background: `linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: 500,
                        color: cssVars.textMuted,
                        border: `1px solid ${cssVars.glassBorder}`,
                        overflow: "hidden",
                      }}
                    >
                      {u.user?.avatarUrl ? (
                        <img
                          src={u.user.avatarUrl}
                          alt={u.user.displayName || u.user.username || "User"}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        getInitials(u.user?.displayName || u.user?.username)
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: cssVars.textSecondary }}>
                        @{u.user?.username || "anonymous"}
                      </div>
                      <div style={{ fontSize: "10px", color: cssVars.textMuted, marginTop: "2px" }}>
                        {formatTimeAgo(u.joinedAt)}
                      </div>
                    </div>
                  </div>
                  {userTab === "active" ? (
                    <span
                      style={{
                        fontSize: "9px",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: cssVars.rainbow6,
                        opacity: 0.8,
                      }}
                    >
                      Active
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "'Space Grotesk', monospace",
                        color: cssVars.textMuted,
                      }}
                    >
                      #{u.position}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div style={{ padding: "20px", textAlign: "center", fontSize: "13px", color: cssVars.textMuted }}>
                {userTab === "active" ? "No active users yet" : "No users on waitlist"}
              </div>
            )}
          </div>

          {/* Recently Approved */}
          {activeUsers.length > 0 && (
            <div style={{ borderTop: `1px solid ${cssVars.glassBorder}`, padding: "20px" }}>
              <div
                style={{
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  marginBottom: "12px",
                  fontWeight: 500,
                  color: cssVars.textMuted,
                }}
              >
                Recently Approved
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {activeUsers.slice(0, 8).map((u) => (
                  <div
                    key={u.id}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "10px",
                      background: `linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      fontWeight: 500,
                      color: cssVars.textMuted,
                      border: `1px solid ${cssVars.glassBorder}`,
                      overflow: "hidden",
                    }}
                  >
                    {u.user?.avatarUrl ? (
                      <img
                        src={u.user.avatarUrl}
                        alt={u.user.displayName || u.user.username || "User"}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      getInitials(u.user?.displayName || u.user?.username)
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Success Modal - Position & Badge Earned */}
      {showSuccessModal && joinResult && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(4px)",
            padding: "16px",
          }}
        >
          <div
            style={{
              background: cssVars.surface,
              border: `1px solid rgba(255, 255, 255, 0.1)`,
              borderRadius: "20px",
              padding: "32px",
              maxWidth: "400px",
              width: "100%",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "80px",
                height: "80px",
                margin: "0 auto 24px",
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${cssVars.rainbow4} 0%, ${cssVars.rainbow3} 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PartyPopper style={{ width: "40px", height: "40px", color: "white" }} />
            </div>
            <h2 style={{ fontSize: "24px", fontWeight: 700, color: "white", marginBottom: "8px" }}>You're In!</h2>
            <p style={{ color: "rgba(255, 255, 255, 0.6)", marginBottom: "24px" }}>
              Welcome to the {appSpace.name} waitlist
            </p>

            <div
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: `1px solid rgba(255, 255, 255, 0.1)`,
                borderRadius: "16px",
                padding: "24px",
                marginBottom: "24px",
              }}
            >
              <div style={{ fontSize: "36px", fontWeight: 700, color: "white", marginBottom: "8px" }}>
                #{joinResult.position}
              </div>
              <p style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.5)" }}>Your Position</p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                marginBottom: "24px",
              }}
            >
              <Badge tier={joinResult.badgeTier} />
              <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>Badge Earned!</span>
            </div>

            <button
              onClick={() => setShowSuccessModal(false)}
              style={{
                width: "100%",
                ...btnPrimaryStyle,
                justifyContent: "center",
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
