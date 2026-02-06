import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreatePollModalProps {
  appSpaceId: number;
  isOpen: boolean;
  onClose: () => void;
}

const durationOptions = [
  { value: "1h", label: "1 hour" },
  { value: "6h", label: "6 hours" },
  { value: "24h", label: "24 hours" },
  { value: "3d", label: "3 days" },
  { value: "7d", label: "7 days" },
];

export function CreatePollModal({ appSpaceId, isOpen, onClose }: CreatePollModalProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState("24h");
  const [showResultsBeforeVoting, setShowResultsBeforeVoting] = useState(false);
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const filteredOptions = options.filter(o => o.trim());
      const res = await fetch(`/api/appspaces/${appSpaceId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          question,
          options: filteredOptions,
          duration,
          showResultsBeforeVoting,
          allowMultipleVotes,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls", appSpaceId] });
      queryClient.invalidateQueries({ queryKey: ["founder-stats", appSpaceId] });
      toast.success("Poll created!");
      resetForm();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setQuestion("");
    setOptions(["", ""]);
    setDuration("24h");
    setShowResultsBeforeVoting(false);
    setAllowMultipleVotes(false);
  };

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const validOptionsCount = options.filter(o => o.trim()).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg glass-panel overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="h-[1px] bg-gradient-to-r from-violet-500 to-fuchsia-500" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-xl font-bold text-white">
              Create Poll
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
                Question <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What do you want to ask?"
                className="w-full h-11 px-4 rounded-lg glass-panel bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                Options <span className="text-white/40">({validOptionsCount}/6)</span>
              </label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 h-11 px-4 rounded-lg glass-panel bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500/50"
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {options.length < 6 && (
                <button
                  onClick={addOption}
                  className="mt-2 flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300"
                >
                  <Plus className="h-4 w-4" />
                  Add option
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1">
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full h-11 px-4 rounded-lg glass-panel bg-white/5 border-white/10 text-white focus:outline-none focus:border-violet-500/50"
              >
                {durationOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <span className="text-sm text-white">Show results before voting</span>
              <button
                onClick={() => setShowResultsBeforeVoting(!showResultsBeforeVoting)}
                className={`w-10 h-6 rounded-full transition-colors ${
                  showResultsBeforeVoting ? "bg-violet-500" : "bg-white/20"
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-1 ${
                  showResultsBeforeVoting ? "translate-x-4" : "translate-x-0"
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <span className="text-sm text-white">Allow multiple votes</span>
              <button
                onClick={() => setAllowMultipleVotes(!allowMultipleVotes)}
                className={`w-10 h-6 rounded-full transition-colors ${
                  allowMultipleVotes ? "bg-violet-500" : "bg-white/20"
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-1 ${
                  allowMultipleVotes ? "translate-x-4" : "translate-x-0"
                }`} />
              </button>
            </div>

            <button
              onClick={() => mutation.mutate()}
              disabled={!question || validOptionsCount < 2 || mutation.isPending}
              className="w-full h-11 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Poll
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
