import { useState } from "react";
import { Check, X, MoreVertical, Ban, Search } from "lucide-react";
import { toast } from "sonner";
import { ApproveUserModal } from "./ApproveUserModal";
import { RejectUserModal } from "./RejectUserModal";
import { BanUserModal } from "./BanUserModal";
import { BulkActionModal } from "./BulkActionModal";

interface WaitlistMember {
  id: number;
  userId: string;
  position: number;
  badgeTier: string;
  status: string;
  username: string | null;
  email: string;
  phoneVerified: boolean;
  joinedAt: string;
}

interface WaitlistTableProps {
  appSpaceId: number;
  members: WaitlistMember[];
  onMemberUpdated: () => void;
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-gray-600/20", text: "text-gray-400", label: "Pending" },
  approved: { bg: "bg-green-600/20", text: "text-green-400", label: "Approved" },
  rejected: { bg: "bg-red-600/20", text: "text-red-400", label: "Rejected" },
  banned: { bg: "bg-red-900/30", text: "text-red-500", label: "Banned" },
};

export function WaitlistTable({ appSpaceId, members, onMemberUpdated }: WaitlistTableProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  
  const [approveModal, setApproveModal] = useState<WaitlistMember | null>(null);
  const [rejectModal, setRejectModal] = useState<WaitlistMember | null>(null);
  const [banModal, setBanModal] = useState<WaitlistMember | null>(null);
  const [bulkAction, setBulkAction] = useState<"approve" | "reject" | null>(null);

  const filteredMembers = members.filter(m => 
    (m.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     m.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredMembers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredMembers.map(m => m.userId));
    }
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const updateMemberStatus = async (userId: string, status: string) => {
    const res = await fetch(`/api/appspaces/${appSpaceId}/waitlist/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to update member");
    return res.json();
  };

  const handleApprove = async (member: WaitlistMember) => {
    await updateMemberStatus(member.userId, "approved");
    toast.success(`${member.username ? `@${member.username}` : "User"} has been approved!`);
    onMemberUpdated();
  };

  const handleReject = async (member: WaitlistMember) => {
    await updateMemberStatus(member.userId, "rejected");
    toast.success(`${member.username ? `@${member.username}` : "User"} has been rejected`);
    onMemberUpdated();
  };

  const handleBan = async (member: WaitlistMember) => {
    await updateMemberStatus(member.userId, "banned");
    toast.success(`${member.username ? `@${member.username}` : "User"} has been banned`);
    onMemberUpdated();
  };

  const handleBulkAction = async (onProgress: (current: number, total: number) => void) => {
    if (!bulkAction) return;
    
    const res = await fetch(`/api/appspaces/${appSpaceId}/waitlist/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userIds: selectedUsers, status: bulkAction === "approve" ? "approved" : "rejected" }),
    });
    
    if (!res.ok) throw new Error("Failed to process bulk action");
    
    const data = await res.json();
    onProgress(data.successCount, selectedUsers.length);
    
    toast.success(`${data.successCount} users ${bulkAction === "approve" ? "approved" : "rejected"}!`);
    setSelectedUsers([]);
    onMemberUpdated();
  };

  const pendingSelected = selectedUsers.filter(id => 
    members.find(m => m.userId === id)?.status === "pending"
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search by username or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-input w-full pl-10 pr-4 py-2 rounded-lg text-sm"
          />
        </div>
        
        {selectedUsers.length > 0 && (
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg">
            <span className="text-white/60 text-sm">{selectedUsers.length} selected</span>
            {pendingSelected.length > 0 && (
              <>
                <button
                  onClick={() => setBulkAction("approve")}
                  className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                >
                  Approve All
                </button>
                <button
                  onClick={() => setBulkAction("reject")}
                  className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                >
                  Reject All
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="glass-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="p-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedUsers.length === filteredMembers.length && filteredMembers.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-white/30"
                />
              </th>
              <th className="p-3 text-left text-white/60 text-sm font-medium">#</th>
              <th className="p-3 text-left text-white/60 text-sm font-medium">User</th>
              <th className="p-3 text-left text-white/60 text-sm font-medium">Badge</th>
              <th className="p-3 text-left text-white/60 text-sm font-medium">Status</th>
              <th className="p-3 text-left text-white/60 text-sm font-medium">Joined</th>
              <th className="p-3 text-right text-white/60 text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((member) => {
              const statusStyle = statusColors[member.status] || statusColors.pending;
              return (
                <tr key={member.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(member.userId)}
                      onChange={() => handleSelectUser(member.userId)}
                      className="rounded border-white/30"
                    />
                  </td>
                  <td className="p-3 text-white/60 text-sm">#{member.position}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center text-white font-bold text-sm">
                        {member.username?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">
                          {member.username ? `@${member.username}` : "No username"}
                        </p>
                        <p className="text-white/40 text-xs">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="text-white/60 text-sm">{member.badgeTier}</span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                      {statusStyle.label}
                    </span>
                  </td>
                  <td className="p-3 text-white/40 text-sm">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      {member.status === "pending" && (
                        <>
                          <button
                            onClick={() => setApproveModal(member)}
                            className="p-1.5 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setRejectModal(member)}
                            className="p-1.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {member.status === "rejected" && (
                        <button
                          onClick={() => setApproveModal(member)}
                          className="p-1.5 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors"
                          title="Reconsider"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {member.status === "approved" && (
                        <div className="relative">
                          <button
                            onClick={() => setDropdownOpen(dropdownOpen === member.userId ? null : member.userId)}
                            className="p-1.5 rounded hover:bg-white/10 transition-colors text-white/60"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {dropdownOpen === member.userId && (
                            <div className="absolute right-0 top-full mt-1 bg-black/90 border border-white/10 rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                              <button
                                onClick={() => {
                                  setBanModal(member);
                                  setDropdownOpen(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-white/5 flex items-center gap-2"
                              >
                                <Ban className="w-4 h-4" />
                                Ban User
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {filteredMembers.length === 0 && (
          <div className="p-8 text-center text-white/40">
            No members found
          </div>
        )}
      </div>

      {approveModal && (
        <ApproveUserModal
          isOpen={!!approveModal}
          onClose={() => setApproveModal(null)}
          onApprove={() => handleApprove(approveModal)}
          username={approveModal.username}
          position={approveModal.position}
          phoneVerified={approveModal.phoneVerified}
        />
      )}

      {rejectModal && (
        <RejectUserModal
          isOpen={!!rejectModal}
          onClose={() => setRejectModal(null)}
          onReject={() => handleReject(rejectModal)}
          username={rejectModal.username}
          position={rejectModal.position}
        />
      )}

      {banModal && (
        <BanUserModal
          isOpen={!!banModal}
          onClose={() => setBanModal(null)}
          onBan={() => handleBan(banModal)}
          username={banModal.username}
        />
      )}

      {bulkAction && (
        <BulkActionModal
          isOpen={!!bulkAction}
          onClose={() => setBulkAction(null)}
          onConfirm={handleBulkAction}
          action={bulkAction}
          count={pendingSelected.length}
        />
      )}
    </div>
  );
}
