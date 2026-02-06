import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Pin, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreateAnnouncementModalProps {
  appSpaceId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function CreateAnnouncementModal({ appSpaceId, isOpen, onClose }: CreateAnnouncementModalProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [sendSms, setSendSms] = useState(false);
  const queryClient = useQueryClient();

  const { data: statsData } = useQuery({
    queryKey: ["founder-stats", appSpaceId],
    queryFn: async () => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/founder-stats`, {
        credentials: "include",
      });
      if (!res.ok) return { verifiedPhoneUsers: 0 };
      return res.json();
    },
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, body, isPinned, sendSms }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements", appSpaceId] });
      queryClient.invalidateQueries({ queryKey: ["founder-stats", appSpaceId] });
      toast.success("Announcement posted!");
      resetForm();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setTitle("");
    setBody("");
    setIsPinned(false);
    setSendSms(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg glass-panel overflow-hidden">
        <div className="h-[1px] bg-gradient-to-r from-violet-500 to-fuchsia-500" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-xl font-bold text-white">
              New Announcement
            </h3>
            <button
              onClick={() => { resetForm(); onClose(); }}
              className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="Announcement title..."
                className="w-full h-11 px-4 rounded-lg glass-panel bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500/50"
              />
              <span className="text-xs text-white/40">{title.length}/100</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1">
                Body <span className="text-red-400">*</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Your announcement message..."
                className="w-full px-4 py-3 rounded-lg glass-panel bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500/50 resize-none"
              />
              <span className="text-xs text-white/40">{body.length}/1000</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <div className="flex items-center gap-2">
                <Pin className="h-4 w-4 text-violet-400" />
                <span className="text-sm text-white">Pin to top</span>
              </div>
              <button
                onClick={() => setIsPinned(!isPinned)}
                className={`w-10 h-6 rounded-full transition-colors ${
                  isPinned ? "bg-violet-500" : "bg-white/20"
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-1 ${
                  isPinned ? "translate-x-4" : "translate-x-0"
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-violet-400" />
                <div>
                  <span className="text-sm text-white">Send SMS to verified users</span>
                  <p className="text-xs text-white/40">
                    {statsData?.verifiedPhoneUsers ?? 0} users will receive a text
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSendSms(!sendSms)}
                className={`w-10 h-6 rounded-full transition-colors ${
                  sendSms ? "bg-violet-500" : "bg-white/20"
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-1 ${
                  sendSms ? "translate-x-4" : "translate-x-0"
                }`} />
              </button>
            </div>

            {(title || body) && (
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs text-white/40 mb-2">Preview</p>
                <h4 className="font-semibold text-white mb-1">{title || "Title"}</h4>
                <p className="text-sm text-white/60 whitespace-pre-wrap">{body || "Body"}</p>
              </div>
            )}

            <button
              onClick={() => mutation.mutate()}
              disabled={!title || !body || mutation.isPending}
              className="w-full h-11 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Post Announcement
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
