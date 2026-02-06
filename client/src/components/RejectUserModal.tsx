import { useState } from "react";
import { X } from "lucide-react";

interface RejectUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReject: () => Promise<void>;
  username: string | null;
  position: number;
}

export function RejectUserModal({
  isOpen,
  onClose,
  onReject,
  username,
  position,
}: RejectUserModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleReject = async () => {
    setIsLoading(true);
    try {
      await onReject();
      onClose();
    } catch (error) {
      console.error("Failed to reject user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const displayName = username ? `@${username}` : "this user";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div
        className="glass-panel max-w-sm w-full mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-500 mx-auto flex items-center justify-center text-white font-bold text-lg">
            {username ? username[0].toUpperCase() : "?"}
          </div>
          <p className="text-white font-medium">{displayName}</p>
          <p className="text-white/50 text-sm">Position #{position}</p>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-bold text-white text-center font-display">
            Reject {displayName}?
          </h3>
          <p className="text-white/60 text-sm text-center">
            They'll remain on the waitlist but won't be approved for full access.
          </p>
          <p className="text-white/40 text-xs text-center">
            They won't be notified of this decision.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleReject}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Reject"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
