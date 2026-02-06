import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { getBadgeColors, type BadgeTier } from "../lib/badges";

interface PositionSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: number;
  badgeTier: BadgeTier;
}

export function PositionSuccessModal({
  isOpen,
  onClose,
  position,
  badgeTier,
}: PositionSuccessModalProps) {
  const [, setLocation] = useLocation();
  const [displayPosition, setDisplayPosition] = useState(1);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      let current = 1;
      const increment = Math.max(1, Math.floor(position / 20));
      const interval = setInterval(() => {
        current = Math.min(current + increment, position);
        setDisplayPosition(current);
        if (current >= position) {
          clearInterval(interval);
        }
      }, 50);

      return () => clearInterval(interval);
    }
  }, [isOpen, position]);

  if (!isOpen) return null;

  const badgeColors = getBadgeColors(badgeTier);

  const handleViewProfile = () => {
    onClose();
    setLocation("/profile");
  };

  const handleExplore = () => {
    onClose();
    setLocation("/explore");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      {showConfetti && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-20px`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${3 + Math.random() * 2}s`,
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: [
                    "#8B5CF6",
                    "#D946EF",
                    "#FFD700",
                    "#C0C0C0",
                    "#3B82F6",
                  ][Math.floor(Math.random() * 5)],
                }}
              />
            </div>
          ))}
        </div>
      )}

      <div
        className="glass-panel max-w-md w-full mx-4 p-8 text-center space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <p className="text-white/60 text-lg">You're</p>
          <p className="text-6xl font-bold text-gradient font-display animate-scale-in">
            #{displayPosition}
          </p>
          <p className="text-white/60 text-lg">in line!</p>
        </div>

        <div className="space-y-3">
          <p className="text-white/60">You earned the</p>
          <div
            className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl animate-pulse-glow"
            style={{
              background: badgeColors.background,
              border: `2px solid ${badgeColors.border}`,
              boxShadow: `0 0 30px ${badgeColors.glow}`,
            }}
          >
            <span
              style={{ color: badgeColors.text }}
              className="text-3xl font-bold"
            >
              {badgeColors.label}
            </span>
            <span className="text-white/80 text-lg">badge</span>
          </div>
        </div>

        <div className="space-y-3 pt-4">
          <button
            onClick={handleExplore}
            className="btn-gradient w-full py-3 rounded-xl font-semibold text-white"
          >
            Explore More Apps
          </button>
          <button
            onClick={handleViewProfile}
            className="w-full py-3 rounded-xl font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            View Your Profile
          </button>
        </div>

        <p
          className="text-white/30 text-sm cursor-pointer hover:text-white/50 transition-colors"
          onClick={onClose}
        >
          Click anywhere to continue
        </p>
      </div>
    </div>
  );
}
