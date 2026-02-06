import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";

interface BanUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBan: () => Promise<void>;
  username: string | null;
}

export function BanUserModal({
  isOpen,
  onClose,
  onBan,
  username,
}: BanUserModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleBan = async () => {
    setIsLoading(true);
    try {
      await onBan();
      onClose();
    } catch (error) {
      console.error("Failed to ban user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const displayName = username ? `@${username}` : "this user";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div
        className="max-w-sm w-full mx-4 p-6 space-y-4 rounded-2xl bg-red-950/20 backdrop-blur-md border border-red-500/20"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-lg bg-red-600/20 border border-red-500/30 mx-auto flex items-center justify-center text-red-400 font-bold text-lg">
            {username ? username[0].toUpperCase() : "?"}
          </div>
          <p className="text-white font-medium">{displayName}</p>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-bold text-white text-center font-display">
            Ban {displayName}?
          </h3>
          
          <ul className="text-white/60 text-sm space-y-1 list-disc list-inside">
            <li>They'll lose access to chat, forums, and DMs</li>
            <li>Their tier badge will be preserved</li>
            <li>Their Active badge will be removed</li>
          </ul>
          
          <div className="flex items-center gap-2 justify-center text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>This action cannot be undone.</span>
          </div>
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
            onClick={handleBan}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Ban User"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
