import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@/components/chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, Radio, Send, User } from "lucide-react";

interface LiveUser {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  title: string | null;
  linkedInUrl: string | null;
  lastSeenAt: string;
  status: string;
  clientPlatform: string;
  publicCommunities: Array<{ slug: string; name: string; status: string }>;
}

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

function displayName(user: { username: string | null; displayName: string | null } | undefined) {
  if (!user) return "Unknown";
  return user.displayName || user.username || "Unknown";
}

export function LiveNowPanel({ appSpaceId }: { appSpaceId: number }) {
  const queryClient = useQueryClient();
  const { socket, connected } = useChat();
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [composer, setComposer] = useState("");
  const [typingNames, setTypingNames] = useState<string[]>([]);

  const liveUsersQuery = useQuery<{ liveUsers: LiveUser[] }>({
    queryKey: ["integration-live-users", appSpaceId],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/apps/${appSpaceId}/live-users`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load live users");
      return res.json();
    },
    refetchInterval: 20_000,
  });

  const threadsQuery = useQuery<{ threads: LiveThread[] }>({
    queryKey: ["integration-live-threads", appSpaceId],
    queryFn: async () => {
      const res = await fetch(`/api/integrations/apps/${appSpaceId}/live-chats`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load live chats");
      return res.json();
    },
    refetchInterval: 10_000,
  });

  const selectedThread = useMemo(
    () => threadsQuery.data?.threads.find((thread) => thread.id === selectedThreadId) || null,
    [threadsQuery.data?.threads, selectedThreadId]
  );

  const messagesQuery = useQuery<{ messages: LiveMessage[] }>({
    queryKey: ["integration-live-messages", appSpaceId, selectedThreadId],
    queryFn: async () => {
      if (!selectedThreadId) return { messages: [] };
      const res = await fetch(`/api/integrations/apps/${appSpaceId}/live-chats/${selectedThreadId}/messages`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    enabled: !!selectedThreadId,
    refetchInterval: 5_000,
  });

  useEffect(() => {
    const threads = threadsQuery.data?.threads || [];
    if (!threads.length) {
      setSelectedThreadId(null);
      return;
    }
    if (!selectedThreadId || !threads.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(threads[0].id);
    }
  }, [threadsQuery.data?.threads, selectedThreadId]);

  useEffect(() => {
    if (!socket || !connected) return;

    const handlePresence = (payload: { appSpaceId?: number }) => {
      if (payload?.appSpaceId !== appSpaceId) return;
      queryClient.invalidateQueries({ queryKey: ["integration-live-users", appSpaceId] });
    };

    const handleLiveMessage = (payload: { threadId?: number }) => {
      if (!payload?.threadId) return;
      queryClient.invalidateQueries({ queryKey: ["integration-live-threads", appSpaceId] });
      if (payload.threadId === selectedThreadId) {
        queryClient.invalidateQueries({ queryKey: ["integration-live-messages", appSpaceId, selectedThreadId] });
      }
    };

    const handleTyping = (payload: { threadId?: number; user?: { displayName?: string | null; username?: string | null }; isTyping?: boolean }) => {
      if (payload?.threadId !== selectedThreadId || !payload.user) return;
      const label = payload.user.displayName || payload.user.username || "Someone";
      setTypingNames((previous) => {
        if (payload.isTyping) {
          return previous.includes(label) ? previous : [...previous, label];
        }
        return previous.filter((name) => name !== label);
      });
    };

    const handleRead = (payload: { threadId?: number }) => {
      if (payload?.threadId === selectedThreadId) {
        queryClient.invalidateQueries({ queryKey: ["integration-live-messages", appSpaceId, selectedThreadId] });
      }
    };

    socket.emit("presence.subscribe", { appSpaceId });
    socket.on("presence.live-updated", handlePresence);
    socket.on("presence.live-snapshot", handlePresence);
    socket.on("live_chat.message", handleLiveMessage);
    socket.on("live_chat.typing", handleTyping);
    socket.on("live_chat.read", handleRead);

    return () => {
      socket.emit("presence.unsubscribe", { appSpaceId });
      socket.off("presence.live-updated", handlePresence);
      socket.off("presence.live-snapshot", handlePresence);
      socket.off("live_chat.message", handleLiveMessage);
      socket.off("live_chat.typing", handleTyping);
      socket.off("live_chat.read", handleRead);
    };
  }, [socket, connected, appSpaceId, queryClient, selectedThreadId]);

  useEffect(() => {
    if (!socket || !connected || !selectedThreadId) return;

    socket.emit("live_chat.join", { threadId: selectedThreadId });
    socket.emit("live_chat.read", { threadId: selectedThreadId });
    setTypingNames([]);

    return () => {
      socket.emit("live_chat.leave", { threadId: selectedThreadId });
    };
  }, [socket, connected, selectedThreadId]);

  const startChatMutation = useMutation({
    mutationFn: async (memberUserId: string) => {
      const res = await fetch(`/api/integrations/apps/${appSpaceId}/live-chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ memberUserId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || "Failed to start live chat");
      return payload as { thread: LiveThread };
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ["integration-live-threads", appSpaceId] });
      setSelectedThreadId(payload.thread.id);
    },
  });

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
        throw new Error(payload.message || "Failed to send message");
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

  const liveUsers = liveUsersQuery.data?.liveUsers || [];
  const threads = threadsQuery.data?.threads || [];
  const messages = messagesQuery.data?.messages || [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="glass-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            Live Now
          </h3>
          <span className="text-xs text-white/50">{liveUsers.length} online</span>
        </div>

        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
          {liveUsersQuery.isLoading ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-white/40" />
            </div>
          ) : liveUsers.length === 0 ? (
            <p className="text-sm text-white/50 py-3">No approved users are live right now.</p>
          ) : (
            liveUsers.map((liveUser) => (
              <div key={liveUser.userId} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={liveUser.avatarUrl || undefined} alt={liveUser.displayName || liveUser.username || "User"} />
                    <AvatarFallback className="bg-white/10">
                      <User className="w-4 h-4 text-white/50" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{liveUser.displayName || liveUser.username || "Anonymous"}</p>
                    <p className="text-xs text-white/45 truncate">
                      {liveUser.title || "Member"} • {liveUser.clientPlatform}
                    </p>
                  </div>
                </div>
                {liveUser.publicCommunities.length > 0 && (
                  <p className="mt-2 text-[11px] text-white/40 truncate">
                    Also in: {liveUser.publicCommunities.map((community) => community.name).join(", ")}
                  </p>
                )}
                <Button
                  onClick={() => startChatMutation.mutate(liveUser.userId)}
                  disabled={startChatMutation.isPending}
                  className="mt-3 w-full h-9 text-xs bg-gradient-to-r from-violet-600 to-fuchsia-600"
                >
                  <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                  Chat Now
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="glass-panel p-4">
        <h3 className="text-base font-semibold text-white mb-3">Live Threads</h3>
        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
          {threadsQuery.isLoading ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-white/40" />
            </div>
          ) : threads.length === 0 ? (
            <p className="text-sm text-white/50 py-3">No live threads yet.</p>
          ) : (
            threads.map((thread) => {
              const isSelected = selectedThreadId === thread.id;
              return (
                <button
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                    isSelected
                      ? "border-violet-500/50 bg-violet-500/10"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                  }`}
                >
                  <p className="text-sm text-white">{displayName(thread.member)}</p>
                  <p className="text-xs text-white/50">
                    Last active {new Date(thread.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {thread.unreadCount > 0 && (
                    <span className="inline-flex mt-1 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-[11px] px-2 py-0.5">
                      {thread.unreadCount} unread
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="glass-panel p-4 flex flex-col">
        <h3 className="text-base font-semibold text-white mb-3">Conversation</h3>
        {!selectedThread ? (
          <p className="text-sm text-white/50">Select a live thread to start messaging.</p>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[380px] pr-1">
              {messagesQuery.isLoading ? (
                <div className="py-8 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-white/40" />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-sm text-white/50">No messages yet.</p>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-xs text-white/50 mb-1">{displayName(message.sender)}</p>
                    <p className="text-sm text-white/85">{message.body}</p>
                  </div>
                ))
              )}
            </div>

            {typingNames.length > 0 && (
              <p className="mt-2 text-xs text-white/45">{typingNames.join(", ")} typing...</p>
            )}

            <div className="mt-3 flex items-center gap-2">
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
                placeholder="Type a message..."
                className="flex-1 h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500/40"
              />
              <Button
                onClick={() => void sendMessage()}
                disabled={!composer.trim() || sendMessageFallbackMutation.isPending}
                className="h-10 px-3 bg-gradient-to-r from-violet-600 to-fuchsia-600"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
