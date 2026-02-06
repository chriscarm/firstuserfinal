export type BadgeTier = "first" | "silver" | "bronze" | "default" | "glass";

export function getBadgeTierFromPosition(position: number): BadgeTier {
  if (position === 1) return "first";
  if (position <= 10) return "silver";
  if (position <= 100) return "bronze";
  if (position <= 1000) return "default";
  return "glass";
}

// Convert database tier format to internal BadgeTier type
export function normalizeBadgeTier(tier: string): BadgeTier {
  const tierMap: Record<string, BadgeTier> = {
    "1st": "first",
    "first": "first",
    "10^1": "silver",
    "10¹": "silver",
    "silver": "silver",
    "10^2": "bronze",
    "10²": "bronze",
    "bronze": "bronze",
    "10^3": "default",
    "10³": "default",
    "default": "default",
    "10^4": "glass",
    "10⁴": "glass",
    "glass": "glass",
  };
  return tierMap[tier] || "glass";
}

export function getBadgeColors(tier: BadgeTier | string) {
  // Normalize the tier first
  const normalizedTier = typeof tier === "string" ? normalizeBadgeTier(tier) : tier;
  
  switch (normalizedTier) {
    case "first":
      return {
        background: "linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 193, 7, 0.1))",
        border: "rgba(255, 215, 0, 0.5)",
        text: "#FFD700",
        glow: "rgba(255, 215, 0, 0.3)",
        label: "1st",
        name: "Gold",
      };
    case "silver":
      return {
        background: "linear-gradient(135deg, rgba(192, 192, 192, 0.2), rgba(169, 169, 169, 0.1))",
        border: "rgba(192, 192, 192, 0.5)",
        text: "#C0C0C0",
        glow: "rgba(192, 192, 192, 0.3)",
        label: "10¹",
        name: "Silver",
      };
    case "bronze":
      return {
        background: "linear-gradient(135deg, rgba(205, 127, 50, 0.2), rgba(184, 115, 51, 0.1))",
        border: "rgba(205, 127, 50, 0.5)",
        text: "#CD7F32",
        glow: "rgba(205, 127, 50, 0.3)",
        label: "10²",
        name: "Bronze",
      };
    case "default":
      return {
        background: "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.1))",
        border: "rgba(59, 130, 246, 0.5)",
        text: "#3B82F6",
        glow: "rgba(59, 130, 246, 0.3)",
        label: "10³",
        name: "Blue",
      };
    case "glass":
      return {
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))",
        border: "rgba(255, 255, 255, 0.2)",
        text: "rgba(255, 255, 255, 0.8)",
        glow: "rgba(255, 255, 255, 0.1)",
        label: "10⁴",
        name: "Glass",
      };
  }
}
