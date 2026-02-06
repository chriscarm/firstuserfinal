import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Lightbulb, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Idea {
  id: number;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "critical";
  status: "idea" | "planned" | "in_progress" | "completed" | "rejected";
  createdAt: string;
}

interface AdminIdeasPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorityColors: Record<Idea["priority"], string> = {
  low: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  medium: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  high: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  critical: "bg-red-500/20 text-red-300 border-red-500/30",
};

const statusColors: Record<Idea["status"], string> = {
  idea: "bg-gray-500/20 text-gray-300",
  planned: "bg-violet-500/20 text-violet-300",
  in_progress: "bg-blue-500/20 text-blue-300",
  completed: "bg-emerald-500/20 text-emerald-300",
  rejected: "bg-red-500/20 text-red-300",
};

export function AdminIdeasPanel({ open, onOpenChange }: AdminIdeasPanelProps) {
  const queryClient = useQueryClient();
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium" as Idea["priority"],
    status: "idea" as Idea["status"],
  });

  // Fetch ideas
  const { data: ideas = [], isLoading } = useQuery<Idea[]>({
    queryKey: ["admin-ideas"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ideas", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch ideas");
      const data = await res.json();
      return data.ideas;
    },
    enabled: open,
  });

  // Create idea
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/admin/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create idea");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ideas"] });
      resetForm();
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to create idea");
    },
  });

  // Update idea
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const res = await fetch(`/api/admin/ideas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update idea");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ideas"] });
      resetForm();
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to update idea");
    },
  });

  // Delete idea
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/ideas/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete idea");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ideas"] });
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to delete idea");
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      priority: "medium",
      status: "idea",
    });
    setEditingIdea(null);
    setIsAddingNew(false);
    setError(null);
  };

  const handleEdit = (idea: Idea) => {
    setEditingIdea(idea);
    setFormData({
      title: idea.title,
      description: idea.description || "",
      priority: idea.priority,
      status: idea.status,
    });
    setIsAddingNew(false);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) return;

    if (editingIdea) {
      updateMutation.mutate({ id: editingIdea.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const groupedIdeas = ideas.reduce<Record<Idea["status"], Idea[]>>(
    (acc, idea) => {
      if (!acc[idea.status]) acc[idea.status] = [];
      acc[idea.status].push(idea);
      return acc;
    },
    { idea: [], planned: [], in_progress: [], completed: [], rejected: [] }
  );

  const statusOrder: Idea["status"][] = ["in_progress", "planned", "idea", "completed", "rejected"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0510] border-white/10 max-w-4xl max-h-[85vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-white">
            <Lightbulb className="h-5 w-5 text-amber-400" />
            Ideas Backlog
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Track feature ideas and their progress
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 p-6 pt-4 h-[calc(85vh-100px)]">
          {/* Ideas List */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
              </div>
            ) : ideas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Lightbulb className="h-10 w-10 text-white/20 mb-3" />
                <p className="text-white/50">No ideas yet</p>
                <p className="text-xs text-white/30 mt-1">
                  Add your first idea to get started
                </p>
              </div>
            ) : (
              <div className="space-y-6 pr-4">
                {statusOrder.map((status) => {
                  const statusIdeas = groupedIdeas[status];
                  if (statusIdeas.length === 0) return null;

                  return (
                    <div key={status}>
                      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${statusColors[status].replace("text-", "bg-").replace("/20", "")}`} />
                        {status.replace("_", " ")} ({statusIdeas.length})
                      </h3>
                      <div className="space-y-2">
                        {statusIdeas.map((idea) => (
                          <div
                            key={idea.id}
                            className={`p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors ${
                              editingIdea?.id === idea.id ? "ring-1 ring-violet-500" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-white truncate">
                                  {idea.title}
                                </h4>
                                {idea.description && (
                                  <p className="text-sm text-white/50 mt-1 line-clamp-2">
                                    {idea.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge className={priorityColors[idea.priority]}>
                                    {idea.priority}
                                  </Badge>
                                  <span className="text-xs text-white/30">
                                    {new Date(idea.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleEdit(idea)}
                                  className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white/70"
                                  aria-label="Edit idea"
                                  title="Edit"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteMutation.mutate(idea.id)}
                                  className="p-1.5 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400"
                                  aria-label="Delete idea"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Add/Edit Form */}
          <div className="w-80 flex-shrink-0 border-l border-white/10 pl-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-white">
                {editingIdea ? "Edit Idea" : isAddingNew ? "New Idea" : "Actions"}
              </h3>
              {(editingIdea || isAddingNew) && (
                <button
                  onClick={resetForm}
                  className="text-white/40 hover:text-white/70"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {editingIdea || isAddingNew ? (
              <div className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                    <span>{error}</span>
                    <button
                      onClick={() => setError(null)}
                      className="ml-auto text-white/40 hover:text-white/60"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div>
                  <Input
                    placeholder="Idea title..."
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div>
                  <Textarea
                    placeholder="Description (optional)"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="bg-white/5 border-white/10 min-h-[100px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Priority</label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value: Idea["priority"]) =>
                        setFormData((prev) => ({ ...prev, priority: value }))
                      }
                    >
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Status</label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: Idea["status"]) =>
                        setFormData((prev) => ({ ...prev, status: value }))
                      }
                    >
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="idea">Idea</SelectItem>
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={!formData.title.trim() || createMutation.isPending || updateMutation.isPending}
                  className="w-full"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  {editingIdea ? "Update Idea" : "Add Idea"}
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setIsAddingNew(true)}
                className="w-full"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Idea
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
