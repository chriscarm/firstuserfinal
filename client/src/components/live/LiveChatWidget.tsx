import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Minimize2, Send, User, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useChat } from "@/components/chat";

interface LiveThread {
  id: number;
  appSpaceId: number;
  founderUserId: string;
  memberUserId: string;
  openedAt: string;
  lastMessageAt: string;
  createdAt: string;
  unreadCount: number;
  founder: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
  member: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

interface LiveMessage {
  id: number;
  threadId: number;
  senderUserId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  sender: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

const HEARTBEAT_INTERVAL_MS = 15_000;

function readableName(user: { username: string | null; displayName: string | null } | undefined) {
  if (!user) return "Unknown";
  return user.displayName || user.username || "Unknown";
}

export function LiveChatWidget({
  appSpaceId,
  enabled,
  forceOpen = false,
  embedded = false,
}: {
  appSpaceId: number;
  enabled: boolean;
  forceOpen?: boolean;
  embedded?: boolean;
}) {
  const { socket, connected } = useChat();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [composer, setComposer] = useState("");

  const threadsQuery = useQuery<{ threads: LiveThread[] }>({
    queryKey: ["integration-live-threads", appSpaceId],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/apps/${appSpaceId}/live-chats`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load live threads");
      return res.json();
    },
    enabled,
    refetchInterval: 10_000,
  });

  const threads = threadsQuery.data?.threads || [];
  const totalUnread = threads.reduce((sum, thread) => sum + (thread.unreadCount || 0), 0);
  const isPanelOpen = forceOpen || open;

  useEffect(() => {
    if (!threads.length) {
      setSelectedThreadId(null);
      return;
    }
    if (!selectedThreadId || !threads.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(threads[0].id);
    }
  }, [threads, selectedThreadId]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  const messagesQuery = useQuery<{ messages: LiveMessage[] }>({
    queryKey: ["integration-live-messages", appSpaceId, selectedThreadId],
    queryFn: async () => {
      if (!selectedThreadId) return { messages: [] };
      const res = await fetch(`/api/integrations/apps/${appSpaceId}/live-chats/${selectedThreadId}/messages`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load live messages");
      return res.json();
    },
    enabled: enabled && !!selectedThreadId,
    refetchInterval: 5_000,
  });

  useEffect(() => {
    if (!enabled || !socket || !connected) return;

    const sendHeartbeat = () => {
      socket.emit("presence.heartbeat", {
        appSpaceId,
        clientPlatform: "web",
        status: "live",
      });
    };

    sendHeartbeat();
    const intervalId = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, socket, connected, appSpaceId]);

  useEffect(() => {
    if (!enabled || !socket) return;

    const handleLiveMessage = (payload: { threadId?: number }) => {
      if (!payload?.threadId) return;
      queryClient.invalidateQueries({ queryKey: ["integration-live-threads", appSpaceId] });
      if (payload.threadId === selectedThreadId) {
        queryClient.invalidateQueries({ queryKey: ["integration-live-messages", appSpaceId, selectedThreadId] });
      }
    };

    const handleRead = (payload: { threadId?: number }) => {
      if (payload?.threadId === selectedThreadId) {
        queryClient.invalidateQueries({ queryKey: ["integration-live-messages", appSpaceId, selectedThreadId] });
      }
    };

    socket.on("live_chat.message", handleLiveMessage);
    socket.on("live_chat.read", handleRead);

    return () => {
      socket.off("live_chat.message", handleLiveMessage);
      socket.off("live_chat.read", handleRead);
    };
  }, [enabled, socket, queryClient, appSpaceId, selectedThreadId]);

  useEffect(() => {
    if (!enabled || !socket || !connected || !selectedThreadId) return;

    socket.emit("live_chat.join", { threadId: selectedThreadId });
    if (isPanelOpen) {
      socket.emit("live_chat.read", { threadId: selectedThreadId });
    }

    return () => {
      socket.emit("live_chat.leave", { threadId: selectedThreadId });
    };
  }, [enabled, socket, connected, selectedThreadId, isPanelOpen]);

  useEffect(() => {
    if (!isPanelOpen || !socket || !selectedThreadId) return;
    socket.emit("live_chat.read", { threadId: selectedThreadId });
  }, [isPanelOpen, socket, selectedThreadId]);

  const sendMessageFallbackMutation = useMutation({
    mutationFn: async ({ threadId, body }: { threadId: number; body: string }) => {
      const res = await fetch(`/api/integrations/apps/${appSpaceId}/live-chats/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to send");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-live-messages", appSpaceId, selectedThreadId] });
      queryClient.invalidateQueries({ queryKey: ["integration-live-threads", appSpaceId] });
    },
  });

  const sendMessage = async () => {
    const body = composer.trim();
    if (!body || !selectedThreadId) return;

    if (socket && connected) {
      socket.emit("live_chat.message", { threadId: selectedThreadId, body });
      setComposer("");
      return;
    }

    await sendMessageFallbackMutation.mutateAsync({ threadId: selectedThreadId, body });
    setComposer("");
  };

  if (!enabled) return null;

  return (
    <div className={embedded ? "w-full h-full" : "fixed bottom-5 right-5 z-50"}>
      {!isPanelOpen ? (
        <button
          onClick={() => setOpen(true)}
          className="relative h-12 px-4 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/40 flex items-center gap-2"
        >
          <MessageSquare className="w-4 h-4" />
          Live Chat
          {totalUnread > 0 && (
            <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>
      ) : (
        <div className={`${embedded ? "w-full h-full" : "w-[320px] sm:w-[360px] h-[460px]"} rounded-2xl border border-white/10 bg-black/95 backdrop-blur-xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden`}>
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Founder Live Chat</p>
              <p className="text-xs text-white/45">Real-time support in app</p>
            </div>
            {!forceOpen && (
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="px-3 pt-2 flex flex-wrap gap-1 border-b border-white/5">
            {threads.length === 0 ? (
              <p className="text-xs text-white/50 px-1 pb-2">No founder thread yet. Founders can message you when you are live.</p>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`px-2 py-1 rounded-md text-xs border ${
                    selectedThreadId === thread.id
                      ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                      : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white/80"
                  }`}
                >
                  {readableName(thread.founder)}
                  {thread.unreadCount > 0 && <span className="ml-1 text-fuchsia-300">({thread.unreadCount})</span>}
                </button>
              ))
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messagesQuery.isLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-white/40" />
              </div>
            ) : (messagesQuery.data?.messages || []).length === 0 ? (
              <p className="text-xs text-white/50">No messages yet.</p>
            ) : (
              (messagesQuery.data?.messages || []).map((message) => {
                const isMine = selectedThread?.memberUserId === message.sender.id;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 ${isMine ? "bg-violet-500/20 border border-violet-500/30" : "bg-white/5 border border-white/10"}`}>
                      {!isMine && (
                        <div className="flex items-center gap-2 mb-1">
                          <Avatar className="w-5 h-5">
                            <AvatarImage src={message.sender.avatarUrl || undefined} alt={readableName(message.sender)} />
                            <AvatarFallback className="bg-white/10">
                              <User className="w-3 h-3 text-white/50" />
                            </AvatarFallback>
                          </Avatar>
                          <p className="text-[11px] text-white/60">{readableName(message.sender)}</p>
                        </div>
                      )}
                      <p className="text-sm text-white/85">{message.body}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-3 py-3 border-t border-white/10 flex items-center gap-2">
            <input
              value={composer}
              onChange={(event) => {
                setComposer(event.target.value);
                if (socket && connected && selectedThreadId) {
                  socket.emit("live_chat.typing", { threadId: selectedThreadId, isTyping: event.target.value.trim().length > 0 });
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder={selectedThreadId ? "Message founder..." : "No active thread"}
              disabled={!selectedThreadId}
              className="flex-1 h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500/40 disabled:opacity-40"
            />
            <Button
              onClick={() => void sendMessage()}
              disabled={!selectedThreadId || !composer.trim() || sendMessageFallbackMutation.isPending}
              className="h-10 px-3 bg-gradient-to-r from-violet-600 to-fuchsia-600"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
