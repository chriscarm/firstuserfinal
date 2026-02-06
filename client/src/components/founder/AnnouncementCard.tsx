import { Pin, Trash2, Loader2 } from "lucide-react";

interface Announcement {
  id: number;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  authorId: string;
}

interface AnnouncementCardProps {
  announcement: Announcement;
  onDelete: () => void;
  isDeleting: boolean;
}

export function AnnouncementCard({ announcement, onDelete, isDeleting }: AnnouncementCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="glass-panel overflow-hidden">
      <div className="h-[1px] bg-gradient-to-r from-violet-500 to-fuchsia-500" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {announcement.isPinned && (
                <span className="flex items-center gap-1 text-xs text-violet-400">
                  <Pin className="h-3 w-3" />
                  Pinned
                </span>
              )}
              <span className="text-xs text-white/40">
                {formatDate(announcement.createdAt)}
              </span>
            </div>
            <h4 className="font-semibold text-white mb-2">{announcement.title}</h4>
            <p className="text-sm text-white/60 whitespace-pre-wrap">{announcement.body}</p>
          </div>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
