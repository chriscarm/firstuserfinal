import { X } from "lucide-react";
import { getBadgeTierFromPosition, getBadgeColors } from "../lib/badges";

interface JoinWaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  appName: string;
  appLogo?: string;
  nextPosition: number;
}

export function JoinWaitlistModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  appName,
  appLogo,
  nextPosition,
}: JoinWaitlistModalProps) {
  if (!isOpen) return null;

  const badgeTier = getBadgeTierFromPosition(nextPosition);
  const badgeColors = getBadgeColors(badgeTier);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-0">
        <div className="glass-panel w-full max-w-md mx-auto md:rounded-2xl rounded-t-2xl md:relative fixed md:bottom-auto bottom-0 left-0 right-0">
          <div className="h-1 w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 md:rounded-t-2xl" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6 space-y-6">
            <div className="flex justify-center">
              {appLogo ? (
                <img
                  src={appLogo}
                  alt={appName}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {appName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-white font-display">
                Join {appName}
              </h2>
              <p className="text-white/60">
                You're about to join the waitlist for {appName}.
              </p>
            </div>

            <div className="glass-panel p-4 text-center">
              <p className="text-white/60 text-sm mb-1">You'll be</p>
              <p className="text-4xl font-bold text-gradient font-display">
                #{nextPosition}
              </p>
              <p className="text-white/60 text-sm mt-1">in line</p>
            </div>

            <div
              className="glass-panel p-4 text-center"
              style={{
                boxShadow: `0 0 20px ${badgeColors.glow}`,
              }}
            >
              <p className="text-white/60 text-sm mb-2">You'll earn the</p>
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
                style={{
                  background: badgeColors.background,
                  border: `1px solid ${badgeColors.border}`,
                }}
              >
                <span style={{ color: badgeColors.text }} className="font-bold">
                  {badgeColors.label}
                </span>
                <span className="text-white/60">badge</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className="btn-gradient w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Joining...
                  </>
                ) : (
                  "Join Waitlist"
                )}
              </button>
              <button
                onClick={onClose}
                disabled={isLoading}
                className="w-full py-3 rounded-xl font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
