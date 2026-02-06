import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Users, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Poll {
  id: number;
  question: string;
  options: string;
  endsAt: string;
  showResultsBeforeVoting: boolean;
  allowMultipleVotes: boolean;
  createdAt: string;
}

interface PollCardProps {
  poll: Poll;
  appSpaceId: number;
}

interface PollResult {
  option: string;
  votes: number;
}

export function PollCard({ poll, appSpaceId }: PollCardProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const queryClient = useQueryClient();
  
  const options = JSON.parse(poll.options) as string[];
  const hasEnded = new Date(poll.endsAt) <= new Date();

  const { data: resultsData } = useQuery({
    queryKey: ["poll-results", poll.id],
    queryFn: async () => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/polls/${poll.id}/results`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch results");
      return res.json();
    },
  });

  const voteMutation = useMutation({
    mutationFn: async (optionIndex: number) => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/polls/${poll.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ optionIndex }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["poll-results", poll.id] });
      toast.success("Vote submitted!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const results: PollResult[] = resultsData?.results ?? [];
  const totalVotes = resultsData?.totalVotes ?? 0;
  const showResults = hasEnded || poll.showResultsBeforeVoting;

  const getTimeRemaining = () => {
    const now = new Date();
    const end = new Date(poll.endsAt);
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return "Ended";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d remaining`;
    if (hours > 0) return `${hours}h remaining`;
    return "< 1h remaining";
  };

  return (
    <div className="glass-panel p-4">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h4 className="font-semibold text-white">{poll.question}</h4>
        <div className="flex items-center gap-2 shrink-0">
          {hasEnded ? (
            <span className="px-2 py-1 rounded text-xs bg-white/10 text-white/60">
              Ended
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-violet-400">
              <Clock className="h-3 w-3" />
              {getTimeRemaining()}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-3">
        {options.map((option, index) => {
          const result = results[index];
          const percentage = totalVotes > 0 ? ((result?.votes ?? 0) / totalVotes) * 100 : 0;
          const isSelected = selectedOption === index;

          return (
            <button
              key={index}
              onClick={() => {
                if (!hasEnded) {
                  setSelectedOption(index);
                  voteMutation.mutate(index);
                }
              }}
              disabled={hasEnded || voteMutation.isPending}
              className={`w-full p-3 rounded-lg text-left transition-all relative overflow-hidden ${
                isSelected
                  ? "border border-violet-500 bg-violet-500/20"
                  : "glass-panel hover:bg-white/10"
              } ${hasEnded ? "cursor-default" : ""}`}
            >
              {showResults && (
                <div
                  className="absolute inset-0 bg-violet-500/20 transition-all"
                  style={{ width: `${percentage}%` }}
                />
              )}
              <div className="relative flex items-center justify-between">
                <span className="text-sm text-white">{option}</span>
                <div className="flex items-center gap-2">
                  {showResults && (
                    <span className="text-xs text-white/60">
                      {result?.votes ?? 0} ({percentage.toFixed(0)}%)
                    </span>
                  )}
                  {isSelected && voteMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                  )}
                  {isSelected && !voteMutation.isPending && (
                    <Check className="h-4 w-4 text-violet-400" />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-xs text-white/40">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {totalVotes} votes
        </span>
        {poll.allowMultipleVotes && (
          <span>Multiple votes allowed</span>
        )}
      </div>
    </div>
  );
}
