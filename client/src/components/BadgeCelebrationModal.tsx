import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { X } from "lucide-react";
import { BadgeCard } from "./BadgeCard";
import { type BadgeTier } from "../lib/badges";

interface BadgeCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  badgeTier: BadgeTier;
  appName: string;
  appLogo?: string;
  reward?: string;
}

export function BadgeCelebrationModal({
  isOpen,
  onClose,
  badgeTier,
  appName,
  appLogo,
  reward,
}: BadgeCelebrationModalProps) {
  const [, setLocation] = useLocation();
  const [animationStep, setAnimationStep] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      setAnimationStep(0);
      const timers = [
        setTimeout(() => setAnimationStep(1), 100),
        setTimeout(() => setAnimationStep(2), 600),
        setTimeout(() => setAnimationStep(3), 900),
        setTimeout(() => setAnimationStep(4), 1400),
      ];
      return () => timers.forEach(clearTimeout);
    } else {
      setAnimationStep(0);
      setShowConfetti(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleViewBadges = () => {
    onClose();
    setLocation("/profile");
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
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

      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors z-10"
      >
        <X className="w-6 h-6" />
      </button>

      <div
        className="glass-panel max-w-md w-full mx-4 p-8 text-center space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`text-6xl transition-all duration-500 ${
            animationStep >= 1 ? "animate-bounce-in" : "opacity-0 scale-0"
          }`}
        >
          🏆
        </div>

        <div
          className={`space-y-2 transition-all duration-300 ${
            animationStep >= 2 ? "animate-fade-in-up" : "opacity-0 translate-y-5"
          }`}
        >
          <h2 className="text-3xl font-bold text-gradient font-display">
            Congratulations!
          </h2>
          <p className="text-white/60">
            You're officially a founding member of {appName}
          </p>
        </div>

        <div
          className={`transition-all duration-500 ${
            animationStep >= 3 ? "animate-scale-glow" : "opacity-0 scale-50"
          }`}
        >
          <BadgeCard
            tier={badgeTier}
            appName={appName}
            appLogo={appLogo}
            size="lg"
            showGlow
          />
        </div>

        {reward && (
          <div
            className={`transition-all duration-300 ${
              animationStep >= 4 ? "animate-fade-in-up" : "opacity-0 translate-y-5"
            }`}
          >
            <div className="glass-panel p-4 space-y-2">
              <p className="text-white/60 text-sm">Your Reward</p>
              <p className="text-white font-semibold text-lg">{reward}</p>
            </div>
          </div>
        )}

        <div
          className={`pt-4 transition-all duration-300 ${
            animationStep >= 4 ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            onClick={handleViewBadges}
            className="btn-gradient w-full py-3 rounded-xl font-semibold text-white"
          >
            View My Badges
          </button>
        </div>
      </div>
    </div>
  );
}
