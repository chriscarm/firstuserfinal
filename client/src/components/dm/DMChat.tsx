import { useState } from "react";
import { useDM } from "./DMProvider";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { User, Send, Loader2, MessageCircle, ArrowLeft } from "lucide-react";

interface DMChatProps {
  canDM: boolean;
  onBack?: () => void;
}

export function DMChat({ canDM, onBack }: DMChatProps) {
  const { user } = useAuth();
  const { currentConversation, messages, isLoadingMessages, sendMessage, selectConversation, typingUsers, startTyping, stopTyping } = useDM();
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Get the other participant
  const otherParticipant = currentConversation?.participants.find(p => p.id !== user?.id);

  const handleSend = async () => {
    if (!newMessage.trim() || !canDM || isSending) return;

    setIsSending(true);
    try {
      await sendMessage(newMessage.trim());
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleBack = () => {
    selectConversation(null);
    onBack?.();
  };

  if (!currentConversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <MessageCircle className="h-12 w-12 text-white/20 mb-4" />
        <h3 className="text-lg font-medium text-white/60 mb-2">No conversation selected</h3>
        <p className="text-sm text-white/40">
          Select a conversation from the left sidebar to start messaging
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 px-4 flex items-center gap-3 border-b border-violet-500/10 bg-[#1a0530] shrink-0">
        {onBack && (
          <button
            onClick={handleBack}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors lg:hidden"
          >
            <ArrowLeft className="h-4 w-4 text-white/70" />
          </button>
        )}
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
        <div>
          <h2 className="font-medium text-white">
            {otherParticipant?.displayName || otherParticipant?.username || "User"}
          </h2>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingMessages ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="h-12 w-12 text-white/20 mb-3" />
            <p className="text-white/50">No messages yet</p>
            {canDM && (
              <p className="text-white/30 text-sm mt-1">Send a message to start the conversation</p>
            )}
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderId === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  {msg.user?.avatarUrl ? (
                    <AvatarImage src={msg.user.avatarUrl} alt={msg.user.displayName || msg.user.username || ""} />
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
                    <User className="h-4 w-4 text-white/70" />
                  </AvatarFallback>
                </Avatar>
                <div className={`flex-1 max-w-[70%] ${isOwn ? "text-right" : ""}`}>
                  <div className={`flex items-center gap-2 mb-1 ${isOwn ? "justify-end" : ""}`}>
                    <span className="text-sm font-medium text-white/80">
                      {msg.user?.displayName || msg.user?.username || "User"}
                    </span>
                    <span className="text-xs text-white/40">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div
                    className={`inline-block px-4 py-2 rounded-2xl ${
                      isOwn
                        ? "bg-violet-600 text-white"
                        : "bg-white/10 text-white/90"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="border-t border-violet-500/10 p-4 bg-[#0a0510] shrink-0">
        {canDM ? (
          <div className="space-y-2">
            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <div className="flex items-center gap-2 px-2 text-sm text-violet-300">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span>
                  {typingUsers.map(u => u.displayName || u.username).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                </span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  if (e.target.value.length > 0) {
                    startTyping();
                  } else {
                    stopTyping();
                  }
                }}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                onBlur={stopTyping}
                placeholder={`Message ${otherParticipant?.displayName || otherParticipant?.username || ""}...`}
                className="flex-1 h-11 px-4 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500/50"
                disabled={isSending}
              />
              <Button
                onClick={handleSend}
                disabled={!newMessage.trim() || isSending}
                className="h-11 w-11 p-0 shrink-0"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-center">
            <p className="text-sm text-yellow-200/80">
              Sorry you must be accepted into the app in order to use this feature
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
