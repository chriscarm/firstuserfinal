import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Smile, Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";

interface MessageUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

interface Reaction {
  emoji: string;
  count: number;
  users: string[];
}

interface ChatMessageProps {
  id: number;
  content: string;
  user: MessageUser;
  createdAt: string;
  isPinned: boolean;
  isOwn: boolean;
  showAvatar: boolean;
  showUsername: boolean;
  reactions?: Reaction[];
  onAddReaction?: (emoji: string) => void;
  onRemoveReaction?: (emoji: string) => void;
}

// Common emoji reactions
const EMOJI_OPTIONS = ["👍", "❤️", "😂", "🎉", "🔥", "👀", "✅", "🚀"];

export function ChatMessage({
  id,
  content,
  user,
  createdAt,
  isPinned,
  isOwn,
  showAvatar,
  showUsername,
  reactions = [],
  onAddReaction,
  onRemoveReaction,
}: ChatMessageProps) {
  const { user: currentUser } = useAuth();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const displayName = user.displayName || user.username || "Anonymous";
  const initials = displayName.slice(0, 2).toUpperCase();

  const formatTime = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return "just now";
    }
  };

  const handleReactionClick = (emoji: string) => {
    const existingReaction = reactions.find(r => r.emoji === emoji);
    const hasUserReacted = existingReaction?.users.includes(currentUser?.id || "");

    if (hasUserReacted) {
      onRemoveReaction?.(emoji);
    } else {
      onAddReaction?.(emoji);
    }
    setShowEmojiPicker(false);
  };

  return (
    <div
      className={`group flex gap-3 px-4 py-1 hover:bg-white/[0.02] relative ${
        showUsername ? "mt-4" : "mt-0.5"
      }`}
    >
      {/* Avatar */}
      <div className="w-10 flex-shrink-0">
        {showAvatar ? (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center overflow-hidden">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-bold text-white">{initials}</span>
            )}
          </div>
        ) : null}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {showUsername && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className={`font-semibold text-sm ${isOwn ? "text-violet-400" : "text-white"}`}>
              {displayName}
            </span>
            <span className="text-[10px] text-white/30">{formatTime(createdAt)}</span>
            {isPinned && (
              <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                pinned
              </span>
            )}
          </div>
        )}
        <p className="text-sm text-white/80 break-words whitespace-pre-wrap">{content}</p>

        {/* Reactions */}
        {(reactions.length > 0 || onAddReaction) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {reactions.map((reaction) => {
              const hasUserReacted = reaction.users.includes(currentUser?.id || "");
              return (
                <button
                  key={reaction.emoji}
                  onClick={() => handleReactionClick(reaction.emoji)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                    hasUserReacted
                      ? "bg-violet-500/30 border border-violet-500/50 text-white"
                      : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                  }`}
                  title={`${reaction.count} reaction${reaction.count !== 1 ? "s" : ""}`}
                >
                  <span>{reaction.emoji}</span>
                  <span className="font-medium">{reaction.count}</span>
                </button>
              );
            })}

            {/* Add reaction button */}
            {onAddReaction && (
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <button
                    className="flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70 opacity-0 group-hover:opacity-100 transition-all"
                    title="Add reaction"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-2 bg-black/95 border-white/10"
                  align="start"
                  sideOffset={4}
                >
                  <div className="flex gap-1">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReactionClick(emoji)}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors text-lg"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}
      </div>

      {/* Floating reaction button on hover */}
      {onAddReaction && reactions.length === 0 && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="flex items-center justify-center w-7 h-7 rounded-full bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70 transition-all"
                title="Add reaction"
              >
                <Smile className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-2 bg-black/95 border-white/10"
              align="end"
              sideOffset={4}
            >
              <div className="flex gap-1">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReactionClick(emoji)}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
