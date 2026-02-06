import { useState } from "react";
import { X, Check, AlertTriangle } from "lucide-react";

interface BulkActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (onProgress: (current: number, total: number) => void) => Promise<void>;
  action: "approve" | "reject";
  count: number;
}

export function BulkActionModal({
  isOpen,
  onClose,
  onConfirm,
  action,
  count,
}: BulkActionModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsLoading(true);
    setProgress({ current: 0, total: count });
    try {
      await onConfirm((current, total) => {
        setProgress({ current, total });
      });
      onClose();
    } catch (error) {
      console.error(`Failed to ${action} users:`, error);
    } finally {
      setIsLoading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const isApprove = action === "approve";
  const title = isApprove ? `Approve ${count} users?` : `Reject ${count} users?`;
  const buttonText = isApprove ? "Approve All" : "Reject All";
  const progressText = isApprove 
    ? `Approving ${progress.current} of ${progress.total}...`
    : `Rejecting ${progress.current} of ${progress.total}...`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div
        className="glass-panel max-w-sm w-full mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-3">
          <h3 className="text-xl font-bold text-white text-center font-display">
            {title}
          </h3>
          
          {isApprove ? (
            <div className="text-white/60 text-sm text-center space-y-2">
              <p>They'll all receive Active badges and full access.</p>
              <p>Users with verified phones will be notified via SMS.</p>
            </div>
          ) : (
            <div className="text-white/60 text-sm text-center">
              <p>They'll be marked as rejected but not notified.</p>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="space-y-2">
            <p className="text-white/60 text-sm text-center">{progressText}</p>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${isApprove ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`flex-1 py-2.5 rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2 ${
              isApprove 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            } disabled:opacity-50`}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isApprove ? (
              <>
                <Check className="w-4 h-4" />
                {buttonText}
              </>
            ) : (
              buttonText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
