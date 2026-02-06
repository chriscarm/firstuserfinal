import { Award } from "lucide-react";

interface CustomBadge {
  id: number;
  name: string;
  description: string | null;
  icon: string;
  awardCount: number;
}

interface CustomBadgeCardProps {
  badge: CustomBadge;
  onAward: () => void;
}

export function CustomBadgeCard({ badge, onAward }: CustomBadgeCardProps) {
  return (
    <div className="glass-panel p-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center text-2xl shrink-0">
          {badge.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white">{badge.name}</h4>
          {badge.description && (
            <p className="text-sm text-white/60 mt-0.5">{badge.description}</p>
          )}
          <p className="text-xs text-white/40 mt-2">
            Awarded {badge.awardCount} time{badge.awardCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <button
        onClick={onAward}
        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium hover:opacity-90 transition-opacity"
      >
        <Award className="h-4 w-4" />
        Award
      </button>
    </div>
  );
}
