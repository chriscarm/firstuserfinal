import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Search, Award, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CustomBadge {
  id: number;
  name: string;
  description: string | null;
  icon: string;
  awardCount: number;
}

interface WaitlistMember {
  id: number;
  userId: string;
  username: string | null;
  email: string;
  position: number;
}

interface AwardBadgeModalProps {
  appSpaceId: number;
  badge: CustomBadge | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AwardBadgeModal({ appSpaceId, badge, isOpen, onClose }: AwardBadgeModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<WaitlistMember | null>(null);
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const { data: membersData } = useQuery({
    queryKey: ["waitlist-members", appSpaceId],
    queryFn: async () => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/waitlist/members`, {
        credentials: "include",
      });
      if (!res.ok) return { members: [] };
      return res.json();
    },
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!badge || !selectedUser) throw new Error("Missing badge or user");
      const res = await fetch(`/api/appspaces/${appSpaceId}/custom-badges/${badge.id}/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: selectedUser.userId,
          reason: reason || undefined,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-badges", appSpaceId] });
      toast.success(`${badge?.name} badge awarded to ${selectedUser?.username || "user"}!`);
      resetForm();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setSearchQuery("");
    setSelectedUser(null);
    setReason("");
  };

  const members: WaitlistMember[] = membersData?.members ?? [];
  const filteredMembers = members.filter(m =>
    (m.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     m.email.toLowerCase().includes(searchQuery.toLowerCase())) &&
    searchQuery.length > 0
  );

  if (!isOpen || !badge) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md glass-panel overflow-hidden">
        <div className="h-[1px] bg-gradient-to-r from-violet-500 to-fuchsia-500" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{badge.icon}</span>
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Award {badge.name}
                </h3>
                <p className="text-sm text-white/60">{badge.description}</p>
              </div>
            </div>
            <button
              onClick={() => { resetForm(); onClose(); }}
              className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            {!selectedUser ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">
                    Search User
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by username or email..."
                      className="w-full h-11 pl-10 pr-4 rounded-lg glass-panel bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                </div>

                {filteredMembers.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredMembers.slice(0, 10).map((member) => (
                      <button
                        key={member.id}
                        onClick={() => setSelectedUser(member)}
                        className="w-full p-3 rounded-lg glass-panel hover:bg-white/10 text-left transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-bold">
                            #{member.position}
                          </div>
                          <div>
                            <p className="text-sm text-white font-medium">
                              {member.username ? `@${member.username}` : "No username"}
                            </p>
                            <p className="text-xs text-white/40">{member.email}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchQuery && filteredMembers.length === 0 && (
                  <p className="text-sm text-white/40 text-center py-4">
                    No users found matching "{searchQuery}"
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="p-4 rounded-lg bg-white/5">
                  <p className="text-xs text-white/40 mb-2">Selected User</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold">
                      #{selectedUser.position}
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {selectedUser.username ? `@${selectedUser.username}` : "No username"}
                      </p>
                      <p className="text-xs text-white/40">{selectedUser.email}</p>
                    </div>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="ml-auto text-xs text-violet-400 hover:text-violet-300"
                    >
                      Change
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">
                    Reason <span className="text-white/40">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={200}
                    placeholder="Why are you awarding this badge?"
                    className="w-full h-11 px-4 rounded-lg glass-panel bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500/50"
                  />
                  <span className="text-xs text-white/40">{reason.length}/200</span>
                </div>

                <button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                  className="w-full h-11 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {mutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Award className="h-4 w-4" />
                  )}
                  Award Badge
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
