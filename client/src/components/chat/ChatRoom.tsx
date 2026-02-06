import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Hash, WifiOff, ChevronUp, Pin, X } from "lucide-react";
import { useChat } from "./ChatProvider";
import { ChatMessage } from "./ChatMessage";
import { useAuth } from "@/lib/auth";

interface Channel {
  id: number;
  appSpaceId: number;
  name: string;
  description: string | null;
  type: string;
  isLocked: boolean;
  isWaitlistersOnly: boolean;
  isReadOnly: boolean;
}

interface ChatRoomProps {
  channel: Channel | null;
  appSpaceId: number;
}

export function ChatRoom({ channel, appSpaceId }: ChatRoomProps) {
  const { user } = useAuth();
  const {
    connected,
    messages,
    typingUsers,
    joinChannel,
    sendMessage,
    startTyping,
    stopTyping,
    loadMessages,
    loadMoreMessages,
    hasMoreMessages,
  } = useChat();

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Filter pinned messages
  const pinnedMessages = messages.filter(m => m.isPinned);

  // Join channel and load messages when channel changes
  useEffect(() => {
    if (channel && connected) {
      setIsLoading(true);
      joinChannel(channel.id, appSpaceId);
      loadMessages(channel.id).finally(() => setIsLoading(false));
    }
  }, [channel?.id, connected, appSpaceId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  // Detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setAutoScroll(isNearBottom);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    if (e.target.value.trim()) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !channel || isSending) return;

    const content = inputValue.trim();
    setInputValue("");
    setIsSending(true);
    setAutoScroll(true);

    try {
      sendMessage(content);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleLoadMore = async () => {
    if (hasMoreMessages && !isLoading) {
      setIsLoading(true);
      const container = messagesContainerRef.current;
      const previousScrollHeight = container?.scrollHeight || 0;

      await loadMoreMessages();

      // Maintain scroll position after loading more
      if (container) {
        const newScrollHeight = container.scrollHeight;
        container.scrollTop = newScrollHeight - previousScrollHeight;
      }
      setIsLoading(false);
    }
  };

  // Group messages by user for consecutive messages
  const groupedMessages = messages.reduce<Array<{ showAvatar: boolean; showUsername: boolean; message: (typeof messages)[0] }>>((acc, message, index) => {
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const isSameUser = prevMessage?.userId === message.userId;
    const timeDiff = prevMessage
      ? new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime()
      : Infinity;
    const isWithinTimeWindow = timeDiff < 5 * 60 * 1000; // 5 minutes

    acc.push({
      message,
      showAvatar: !isSameUser || !isWithinTimeWindow,
      showUsername: !isSameUser || !isWithinTimeWindow,
    });

    return acc;
  }, []);

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/40">
        <div className="text-center">
          <Hash className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Select a channel to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-black/20">
      {/* Channel Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <Hash className="w-5 h-5 text-white/40" />
        <div className="flex-1">
          <h2 className="font-semibold text-white">
            {channel.name.replace(/-/g, " ")}
          </h2>
          {channel.description && (
            <p className="text-xs text-white/40 truncate">{channel.description}</p>
          )}
        </div>
        {pinnedMessages.length > 0 && (
          <button
            onClick={() => setShowPinnedMessages(!showPinnedMessages)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              showPinnedMessages
                ? "bg-amber-500/20 text-amber-300"
                : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
            }`}
            title={`${pinnedMessages.length} pinned message${pinnedMessages.length > 1 ? "s" : ""}`}
          >
            <Pin className="w-3.5 h-3.5" />
            <span>{pinnedMessages.length}</span>
          </button>
        )}
        {!connected && (
          <div className="flex items-center gap-2 text-amber-400 text-sm">
            <WifiOff className="w-4 h-4" />
            <span>Reconnecting...</span>
          </div>
        )}
      </div>

      {/* Pinned Messages Panel */}
      {showPinnedMessages && pinnedMessages.length > 0 && (
        <div className="border-b border-white/10 bg-amber-500/5">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
            <div className="flex items-center gap-2 text-amber-300">
              <Pin className="w-4 h-4" />
              <span className="text-sm font-medium">Pinned Messages</span>
            </div>
            <button
              onClick={() => setShowPinnedMessages(false)}
              className="text-white/50 hover:text-white/70"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {pinnedMessages.map((message) => (
              <ChatMessage
                key={`pinned-${message.id}`}
                id={message.id}
                content={message.content}
                user={message.user}
                createdAt={message.createdAt}
                isPinned={true}
                isOwn={message.userId === user?.id}
                showAvatar={true}
                showUsername={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {/* Load More Button */}
        {hasMoreMessages && (
          <div className="p-4 text-center">
            <button
              onClick={handleLoadMore}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors text-sm"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
              Load earlier messages
            </button>
          </div>
        )}

        {/* Messages */}
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-white/40">
            <div className="text-center">
              <p className="text-lg mb-2">No messages yet</p>
              <p className="text-sm">Be the first to say something!</p>
            </div>
          </div>
        ) : (
          <div className="py-4">
            {groupedMessages.map(({ message, showAvatar, showUsername }) => (
              <ChatMessage
                key={message.id}
                id={message.id}
                content={message.content}
                user={message.user}
                createdAt={message.createdAt}
                isPinned={message.isPinned}
                isOwn={message.userId === user?.id}
                showAvatar={showAvatar}
                showUsername={showUsername}
              />
            ))}
          </div>
        )}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-2 text-sm text-white/40 flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span>
              {typingUsers.length === 1
                ? `${typingUsers[0].username || "Someone"} is typing...`
                : typingUsers.length === 2
                ? `${typingUsers[0].username || "Someone"} and ${typingUsers[1].username || "someone"} are typing...`
                : `${typingUsers.length} people are typing...`}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {channel.isReadOnly && !user?.hasFounderAccess ? (
        <div className="px-4 py-3 border-t border-white/5 text-center text-white/40 text-sm">
          This channel is read-only
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-4 border-t border-white/5">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={`Message #${channel.name.replace(/-/g, " ")}`}
                rows={1}
                disabled={!connected}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 resize-none max-h-32 disabled:opacity-50"
                style={{ minHeight: "48px" }}
              />
            </div>
            <button
              type="submit"
              disabled={!inputValue.trim() || !connected || isSending}
              className="h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {isSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
