import { getBadgeColors, type BadgeTier } from "../lib/badges";

interface BadgeCardProps {
  tier: BadgeTier;
  appName: string;
  appLogo?: string;
  size?: "sm" | "md" | "lg";
  showGlow?: boolean;
}

export function BadgeCard({ tier, appName, appLogo, size = "md", showGlow = false }: BadgeCardProps) {
  const colors = getBadgeColors(tier);

  const sizeClasses = {
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  const badgeSizes = {
    sm: "w-10 h-10 text-lg",
    md: "w-12 h-12 text-2xl",
    lg: "w-16 h-16 text-3xl",
  };

  const textSizes = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <div
      className={`rounded-2xl ${sizeClasses[size]} text-center`}
      style={{
        background: colors.background,
        border: `2px solid ${colors.border}`,
        boxShadow: showGlow ? `0 0 40px ${colors.glow}` : undefined,
      }}
    >
      {appLogo ? (
        <img src={appLogo} alt={appName} className={`${badgeSizes[size]} rounded-lg mx-auto mb-3 object-cover`} />
      ) : (
        <div
          className={`${badgeSizes[size]} rounded-lg mx-auto mb-3 flex items-center justify-center font-bold`}
          style={{ background: colors.background, color: colors.text, border: `1px solid ${colors.border}` }}
        >
          {colors.label}
        </div>
      )}
      <p className={`font-bold ${textSizes[size]}`} style={{ color: colors.text }}>
        {colors.label}
      </p>
      <p className="text-white/60 text-sm mt-1">{appName}</p>
    </div>
  );
}
