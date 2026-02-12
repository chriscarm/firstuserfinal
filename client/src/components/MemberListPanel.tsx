import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Crown, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { useChat } from "@/components/chat";

interface Member {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: "pending" | "approved";
  badgeTier: string | null;
  isFounder: boolean;
}

interface MemberListPanelProps {
  appSpaceId: number;
  founderId: string;
  onMemberClick?: (member: Member) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function MemberListPanel({
  appSpaceId,
  founderId,
  onMemberClick,
  collapsed = false,
  onToggleCollapsed,
}: MemberListPanelProps) {
  const { isUserOnline, onlineUsers } = useChat();
  const [hoveredMember, setHoveredMember] = useState<string | null>(null);

  // Fetch members
  const { data: membersData, isLoading } = useQuery<{
    members: Member[];
  }>({
    queryKey: ["community-members", appSpaceId],
    queryFn: async () => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/members`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
    enabled: appSpaceId > 0,
  });

  const members = membersData?.members || [];

  // Separate and sort members
  const founder = members.find(m => m.isFounder);
  const approvedMembers = members.filter(m => m.status === "approved" && !m.isFounder);
  const onlineMembersList = approvedMembers.filter(m => isUserOnline(m.id));
  const offlineMembersList = approvedMembers.filter(m => !isUserOnline(m.id));

  const getBadgeColor = (tier: string | null) => {
    switch (tier?.toLowerCase()) {
      case "gold":
        return "text-yellow-400 bg-yellow-400/10";
      case "silver":
        return "text-gray-300 bg-gray-300/10";
      case "bronze":
        return "text-amber-600 bg-amber-600/10";
      default:
        return "text-white/50 bg-white/5";
    }
  };

  const MemberItem = ({ member }: { member: Member }) => {
    const isOnline = isUserOnline(member.id);
    const displayName = member.displayName || member.username || "Anonymous";

    return (
      <button
        onClick={() => onMemberClick?.(member)}
        onMouseEnter={() => setHoveredMember(member.id)}
        onMouseLeave={() => setHoveredMember(null)}
        className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
      >
        <div className="relative">
          <Avatar className="h-8 w-8">
            {member.avatarUrl ? (
              <AvatarImage src={member.avatarUrl} alt={displayName} />
            ) : null}
            <AvatarFallback className="bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-white/70 text-xs">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {/* Online indicator */}
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black ${
              isOnline ? "bg-emerald-500" : "bg-gray-500"
            }`}
          />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5">
            <span className={`text-sm truncate ${isOnline ? "text-white" : "text-white/50"}`}>
              {displayName}
            </span>
            {member.isFounder && (
              <Crown className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
            )}
          </div>
          {member.badgeTier && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${getBadgeColor(member.badgeTier)}`}>
              {member.badgeTier}
            </span>
          )}
        </div>
      </button>
    );
  };

  if (isLoading) {
    if (collapsed) {
      return (
        <aside className="hidden lg:flex flex-col w-12 bg-white/[0.02] border-l border-white/[0.08]">
          <button
            onClick={onToggleCollapsed}
            className="h-14 w-full flex items-center justify-center border-b border-white/[0.08] text-white/55 hover:text-white/85 hover:bg-white/[0.05] transition-colors"
            title="Show members"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 flex items-center justify-center">
            <Users className="h-4 w-4 text-white/35" />
          </div>
        </aside>
      );
    }

    return (
      <div className="w-60 bg-white/[0.02] border-l border-white/[0.08] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (collapsed) {
    return (
      <aside className="hidden lg:flex flex-col w-12 bg-white/[0.02] border-l border-white/[0.08]">
        <button
          onClick={onToggleCollapsed}
          className="h-14 w-full flex items-center justify-center border-b border-white/[0.08] text-white/55 hover:text-white/85 hover:bg-white/[0.05] transition-colors"
          title="Show members"
          data-testid="members-panel-expand"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 flex flex-col items-center justify-start gap-2 pt-3">
          <Users className="h-4 w-4 text-white/45" />
          <span className="text-[10px] text-white/35 font-semibold">{members.length}</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-white/[0.02] border-l border-white/[0.08]">
      <div className="h-14 px-4 flex items-center border-b border-white/[0.08]">
        <Users className="h-4 w-4 text-white/50 mr-2" />
        <span className="text-sm font-medium text-white/70">Members</span>
        <span className="ml-auto text-xs text-white/30">{members.length}</span>
        <button
          onClick={onToggleCollapsed}
          className="ml-2 h-8 w-8 rounded-lg flex items-center justify-center text-white/45 hover:text-white/85 hover:bg-white/[0.05] transition-colors"
          title="Hide members"
          data-testid="members-panel-collapse"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {/* Founder Section */}
          {founder && (
            <div>
              <div className="flex items-center gap-1.5 px-2 mb-2">
                <Crown className="h-3 w-3 text-amber-400" />
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide">
                  Founder
                </span>
              </div>
              <MemberItem member={founder} />
            </div>
          )}

          {/* Online Members */}
          {onlineMembersList.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">
                  Online — {onlineMembersList.length}
                </span>
              </div>
              {onlineMembersList.map(member => (
                <MemberItem key={member.id} member={member} />
              ))}
            </div>
          )}

          {/* Offline Members */}
          {offlineMembersList.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-gray-500" />
                <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">
                  Offline — {offlineMembersList.length}
                </span>
              </div>
              {offlineMembersList.map(member => (
                <MemberItem key={member.id} member={member} />
              ))}
            </div>
          )}

          {/* No members state */}
          {members.length === 0 && (
            <div className="text-center py-8">
              <User className="h-8 w-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm text-white/40">No members yet</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
