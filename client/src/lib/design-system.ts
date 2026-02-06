/**
 * Design System Constants
 * Clean & Minimal - Professional design inspired by Linear/Vercel/Stripe
 */

// Color palette
export const colors = {
  // Backgrounds
  void: "#000000",           // Pure black background
  surface: "#0a0a0a",        // Near-black surface

  // Glass effects
  glassBorder: "rgba(255, 255, 255, 0.08)",  // Subtle white border
  glassBg: "rgba(255, 255, 255, 0.02)",      // Glass background
  glassBgHover: "rgba(255, 255, 255, 0.04)", // Glass hover

  // Text colors
  textPrimary: "rgba(255, 255, 255, 0.9)",   // White text
  textSecondary: "rgba(255, 255, 255, 0.5)", // Muted text
  textMuted: "rgba(255, 255, 255, 0.25)",    // Very muted text

  // Rainbow accent colors
  rainbow1: "#f59e0b",  // Orange/Amber
  rainbow2: "#ef4444",  // Red
  rainbow3: "#ec4899",  // Pink
  rainbow4: "#8b5cf6",  // Purple/Violet
  rainbow5: "#3b82f6",  // Blue
  rainbow6: "#10b981",  // Green/Emerald
} as const;

// Typography
export const typography = {
  fontDisplay: "'Space Grotesk', sans-serif",
  fontBody: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

// Gradients
export const gradients = {
  // Rainbow gradient for primary actions
  rainbow: `linear-gradient(135deg, ${colors.rainbow1} 0%, ${colors.rainbow3} 50%, ${colors.rainbow4} 100%)`,
  rainbowSubtle: `linear-gradient(135deg, rgba(245, 158, 11, 0.9) 0%, rgba(236, 72, 153, 0.9) 50%, rgba(139, 92, 246, 0.9) 100%)`,

  // Avatar/icon gradients
  avatarGradient: `linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)`,
  iconGradient: `linear-gradient(135deg, ${colors.rainbow4} 0%, ${colors.rainbow3} 100%)`,
} as const;

// Common style objects for inline styling
export const styles = {
  // Glass panel
  glassPanel: {
    background: colors.glassBg,
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: "16px",
  },

  // Primary button
  buttonPrimary: {
    background: gradients.rainbowSubtle,
    color: "white",
    border: `1px solid rgba(255, 255, 255, 0.1)`,
    padding: "12px 24px",
    borderRadius: "12px",
    fontWeight: 500,
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  // Secondary button
  buttonSecondary: {
    background: colors.glassBg,
    color: colors.textSecondary,
    border: `1px solid ${colors.glassBorder}`,
    padding: "12px 24px",
    borderRadius: "12px",
    fontWeight: 500,
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  // Section label
  sectionLabel: {
    fontSize: "10px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.15em",
    fontWeight: 500,
    color: colors.textMuted,
  },
} as const;

// CSS class names for Tailwind usage
export const tw = {
  // Text colors
  textPrimary: "text-white/90",
  textSecondary: "text-white/50",
  textMuted: "text-white/25",

  // Backgrounds
  bgVoid: "bg-black",
  bgSurface: "bg-[#0a0a0a]",
  bgGlass: "bg-white/[0.02]",
  bgGlassHover: "hover:bg-white/[0.04]",

  // Borders
  borderGlass: "border-white/[0.08]",

  // Glass panel
  glassPanel: "bg-white/[0.02] border border-white/[0.08] rounded-2xl",
} as const;
