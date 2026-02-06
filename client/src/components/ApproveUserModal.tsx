import { useState } from "react";
import { X, Check } from "lucide-react";

interface ApproveUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => Promise<void>;
  username: string | null;
  position: number;
  phoneVerified: boolean;
}

export function ApproveUserModal({
  isOpen,
  onClose,
  onApprove,
  username,
  position,
  phoneVerified,
}: ApproveUserModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      await onApprove();
      onClose();
    } catch (error) {
      console.error("Failed to approve user:", error);
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
            Approve {displayName}?
          </h3>
          <p className="text-white/60 text-sm text-center">
            They'll receive the Active badge and full access to chat, forums, and DMs.
          </p>
          {phoneVerified ? (
            <p className="text-green-400 text-xs text-center">
              They'll be notified via SMS.
            </p>
          ) : (
            <p className="text-white/40 text-xs text-center">
              They don't have a verified phone, so they won't receive an SMS notification.
            </p>
          )}
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
            onClick={handleApprove}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                Approve
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
