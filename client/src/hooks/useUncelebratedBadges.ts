import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useBadgeCelebration } from "@/lib/BadgeCelebrationContext";
import type { BadgeTier } from "@/lib/badges";

interface UncelebratedBadge {
  id: number;
  appSpaceId: number;
  badgeTier: string;
  appName: string;
  appLogo?: string;
}

export function useUncelebratedBadges() {
  const { user } = useAuth();
  const { showCelebration } = useBadgeCelebration();
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (!user || hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const checkAndCelebrate = async () => {
      try {
        const res = await fetch("/api/users/me/uncelebrated-badges", {
          credentials: "include",
        });
        if (!res.ok) return;

        const { badges } = await res.json() as { badges: UncelebratedBadge[] };

        if (badges.length > 0) {
          const badge = badges[0];
          showCelebration({
            badgeTier: badge.badgeTier as BadgeTier,
            appName: badge.appName,
            appLogo: badge.appLogo,
          });

          await fetch(`/api/users/me/badges/${badge.id}/celebrated`, {
            method: "POST",
            credentials: "include",
          });
        }
      } catch (error) {
        console.error("Failed to check uncelebrated badges:", error);
      }
    };

    checkAndCelebrate();
  }, [user, showCelebration]);
}
