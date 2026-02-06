import { useDM } from "./DMProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, MessageCircle, Loader2, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface DMListProps {
  canDM: boolean;
  onLockedClick?: () => void;
}

export function DMList({ canDM, onLockedClick }: DMListProps) {
  const { user } = useAuth();
  const {
    conversations,
    currentConversation,
    founder,
    isLoading,
    selectConversation,
    startConversationWithFounder,
  } = useDM();

  const handleFounderClick = async () => {
    if (!canDM) {
      onLockedClick?.();
      return;
    }
    try {
      await startConversationWithFounder();
    } catch (error) {
      // Error is handled in provider
    }
  };

  const handleConversationClick = (conversation: typeof conversations[0]) => {
    if (!canDM) {
      onLockedClick?.();
      return;
    }
    selectConversation(conversation);
  };

  // Get the other participant in a conversation (not the current user)
  const getOtherParticipant = (conversation: typeof conversations[0]) => {
    return conversation.participants.find(p => p.id !== user?.id) || conversation.participants[0];
  };

  // Format time for last message
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-white/40" />
      </div>
    );
  }

  // Check if founder conversation already exists
  const existingFounderConversation = founder
    ? conversations.find(c => c.participants.some(p => p.id === founder.id))
    : null;

  return (
    <div className="space-y-1">
      <div className="text-xs text-white/30 uppercase tracking-wider px-3 py-2">
        Direct Messages
      </div>

      {/* Founder contact - always show at top if exists and not current user */}
      {founder && founder.id !== user?.id && !existingFounderConversation && (
        <button
          onClick={handleFounderClick}
          title={!canDM ? "Direct messages unlock when you're approved" : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-white/5 ${
            !canDM ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          <div className="relative">
            <Avatar className="h-8 w-8">
              {founder.avatarUrl ? (
                <AvatarImage src={founder.avatarUrl} alt={founder.displayName || founder.username || "Founder"} />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
                <User className="h-4 w-4 text-white/70" />
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 text-[8px] bg-yellow-500 text-black px-1 rounded font-bold">
              F
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-white truncate block">
              {founder.displayName || founder.username || "Founder"}
            </span>
            <span className="text-xs text-white/40">Founder</span>
          </div>
          {!canDM && <Lock className="h-3.5 w-3.5 text-yellow-500" />}
        </button>
      )}

      {/* Existing conversations */}
      {conversations.map((conversation) => {
        const otherParticipant = getOtherParticipant(conversation);
        const isSelected = currentConversation?.id === conversation.id;
        const isFounderConv = founder && conversation.participants.some(p => p.id === founder.id);

        return (
          <button
            key={conversation.id}
            onClick={() => handleConversationClick(conversation)}
            title={!canDM ? "Direct messages unlock when you're approved" : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
              isSelected
                ? "bg-violet-500/20 text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            } ${!canDM ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <div className="relative">
              <Avatar className="h-8 w-8">
                {otherParticipant?.avatarUrl ? (
                  <AvatarImage
                    src={otherParticipant.avatarUrl}
                    alt={otherParticipant.displayName || otherParticipant.username || "User"}
                  />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
                  <User className="h-4 w-4 text-white/70" />
                </AvatarFallback>
              </Avatar>
              {isFounderConv && (
                <span className="absolute -bottom-0.5 -right-0.5 text-[8px] bg-yellow-500 text-black px-1 rounded font-bold">
                  F
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">
                  {otherParticipant?.displayName || otherParticipant?.username || "User"}
                </span>
                {conversation.lastMessage && (
                  <span className="text-[10px] text-white/40 shrink-0">
                    {formatTime(conversation.lastMessage.createdAt)}
                  </span>
                )}
              </div>
              {conversation.lastMessage && (
                <p className="text-xs text-white/40 truncate">
                  {conversation.lastMessage.content}
                </p>
              )}
            </div>
            {!canDM && <Lock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
          </button>
        );
      })}

      {/* Empty state */}
      {conversations.length === 0 && (!founder || founder.id === user?.id) && (
        <div className="px-3 py-4 text-center">
          <MessageCircle className="h-8 w-8 text-white/20 mx-auto mb-2" />
          <p className="text-xs text-white/40">No conversations yet</p>
        </div>
      )}
    </div>
  );
}
