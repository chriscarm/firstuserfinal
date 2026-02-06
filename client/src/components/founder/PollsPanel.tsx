import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { CreatePollModal } from "./CreatePollModal";
import { PollCard } from "./PollCard";

interface Poll {
  id: number;
  question: string;
  options: string;
  endsAt: string;
  showResultsBeforeVoting: boolean;
  allowMultipleVotes: boolean;
  createdAt: string;
}

interface PollsPanelProps {
  appSpaceId: number;
}

export function PollsPanel({ appSpaceId }: PollsPanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["polls", appSpaceId],
    queryFn: async () => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/polls`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch polls");
      return res.json();
    },
  });

  const polls: Poll[] = data?.polls ?? [];
  const activePolls = polls.filter(p => new Date(p.endsAt) > new Date());
  const endedPolls = polls.filter(p => new Date(p.endsAt) <= new Date());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-white/90">
          Polls
        </h3>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Create Poll
        </button>
      </div>

      {isLoading ? (
        <div className="glass-panel p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      ) : polls.length === 0 ? (
        <div className="glass-panel p-8 text-center">
          <p className="text-white/60">No polls yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activePolls.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-white/60 mb-3">Active Polls</h4>
              <div className="space-y-3">
                {activePolls.map((poll) => (
                  <PollCard key={poll.id} poll={poll} appSpaceId={appSpaceId} />
                ))}
              </div>
            </div>
          )}
          
          {endedPolls.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-white/60 mb-3">Ended Polls</h4>
              <div className="space-y-3">
                {endedPolls.map((poll) => (
                  <PollCard key={poll.id} poll={poll} appSpaceId={appSpaceId} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <CreatePollModal
        appSpaceId={appSpaceId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
