import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { CustomBadgeCard } from "./CustomBadgeCard";
import { AwardBadgeModal } from "./AwardBadgeModal";

interface CustomBadge {
  id: number;
  name: string;
  description: string | null;
  icon: string;
  awardCount: number;
}

interface BadgeAwardsPanelProps {
  appSpaceId: number;
}

export function BadgeAwardsPanel({ appSpaceId }: BadgeAwardsPanelProps) {
  const [selectedBadge, setSelectedBadge] = useState<CustomBadge | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["custom-badges", appSpaceId],
    queryFn: async () => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/custom-badges`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch badges");
      return res.json();
    },
  });

  const badges: CustomBadge[] = data?.badges ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-white/90">
          Custom Badges
        </h3>
      </div>

      <p className="text-sm text-white/60">
        Award custom badges to recognize outstanding community members.
      </p>

      {isLoading ? (
        <div className="glass-panel p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      ) : badges.length === 0 ? (
        <div className="glass-panel p-8 text-center">
          <p className="text-white/60">No custom badges available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {badges.map((badge) => (
            <CustomBadgeCard
              key={badge.id}
              badge={badge}
              onAward={() => setSelectedBadge(badge)}
            />
          ))}
        </div>
      )}

      <AwardBadgeModal
        appSpaceId={appSpaceId}
        badge={selectedBadge}
        isOpen={!!selectedBadge}
        onClose={() => setSelectedBadge(null)}
      />
    </div>
  );
}
