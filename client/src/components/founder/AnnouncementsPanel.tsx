import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pin, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CreateAnnouncementModal } from "./CreateAnnouncementModal";
import { AnnouncementCard } from "./AnnouncementCard";

interface Announcement {
  id: number;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  authorId: string;
}

interface AnnouncementsPanelProps {
  appSpaceId: number;
}

export function AnnouncementsPanel({ appSpaceId }: AnnouncementsPanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["announcements", appSpaceId],
    queryFn: async () => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/announcements`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch announcements");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (announcementId: number) => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/announcements/${announcementId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete announcement");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements", appSpaceId] });
      toast.success("Announcement deleted");
    },
  });

  const announcements: Announcement[] = data?.announcements ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-white/90">
          Announcements
        </h3>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          New Announcement
        </button>
      </div>

      {isLoading ? (
        <div className="glass-panel p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="glass-panel p-8 text-center">
          <p className="text-white/60">No announcements yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              onDelete={() => deleteMutation.mutate(announcement.id)}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      <CreateAnnouncementModal
        appSpaceId={appSpaceId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
