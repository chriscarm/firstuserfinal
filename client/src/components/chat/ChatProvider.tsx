import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/lib/auth";

interface ChatUser {
  id: string;
  username: string | null;
}

interface ChatMessage {
  id: number;
  channelId: number;
  userId: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

interface OnlineUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

interface ChatContextType {
  socket: Socket | null;
  connected: boolean;
  currentChannelId: number | null;
  messages: ChatMessage[];
  typingUsers: ChatUser[];
  unreadCounts: Record<number, number>;
  onlineUsers: OnlineUser[];
  joinChannel: (channelId: number, appSpaceId: number) => void;
  leaveChannel: () => void;
  sendMessage: (content: string) => void;
  startTyping: () => void;
  stopTyping: () => void;
  loadMessages: (channelId: number) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  hasMoreMessages: boolean;
  markChannelAsRead: (channelId: number) => Promise<void>;
  loadUnreadCounts: (appSpaceId: number) => Promise<void>;
  getTotalUnreadForCommunity: (appSpaceId: number) => number;
  isUserOnline: (userId: string) => boolean;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [currentChannelId, setCurrentChannelId] = useState<number | null>(null);
  const [currentAppSpaceId, setCurrentAppSpaceId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<ChatUser[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const [communityChannelMap, setCommunityChannelMap] = useState<Record<number, number[]>>({});
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Initialize socket connection when user is authenticated
  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const newSocket = io({
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("[Chat] Connected to WebSocket");
      setConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("[Chat] Disconnected from WebSocket");
      setConnected(false);
    });

    newSocket.on("error", (error) => {
      console.error("[Chat] Socket error:", error);
    });

    // Handle incoming messages
    newSocket.on("message-received", (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
    });

    // Handle typing indicators
    newSocket.on("user-typing", (data: { channelId: number; user: ChatUser }) => {
      if (data.user.id !== user.id) {
        setTypingUsers(prev => {
          if (prev.some(u => u.id === data.user.id)) return prev;
          return [...prev, data.user];
        });
      }
    });

    newSocket.on("user-stopped-typing", (data: { channelId: number; userId: string }) => {
      setTypingUsers(prev => prev.filter(u => u.id !== data.userId));
    });

    newSocket.on("typing-users", (data: { channelId: number; users: ChatUser[] }) => {
      setTypingUsers(data.users.filter(u => u.id !== user.id));
    });

    // Handle presence updates
    newSocket.on("presence:online-users", (users: OnlineUser[]) => {
      setOnlineUsers(users);
    });

    newSocket.on("presence:user-online", (onlineUser: OnlineUser) => {
      setOnlineUsers(prev => {
        if (prev.some(u => u.id === onlineUser.id)) return prev;
        return [...prev, onlineUser];
      });
    });

    newSocket.on("presence:user-offline", (userId: string) => {
      setOnlineUsers(prev => prev.filter(u => u.id !== userId));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  // Rejoin channel on reconnect
  useEffect(() => {
    if (connected && socket && currentChannelId && currentAppSpaceId) {
      socket.emit("join-channel", { channelId: currentChannelId, appSpaceId: currentAppSpaceId });
    }
  }, [connected]);

  const joinChannel = useCallback((channelId: number, appSpaceId: number) => {
    if (socket && connected) {
      // Leave previous channel
      if (currentChannelId) {
        socket.emit("leave-channel", { channelId: currentChannelId });
      }

      // Join new channel
      socket.emit("join-channel", { channelId, appSpaceId });
      setCurrentChannelId(channelId);
      setCurrentAppSpaceId(appSpaceId);
      setMessages([]);
      setTypingUsers([]);
      setHasMoreMessages(true);
    }
  }, [socket, connected, currentChannelId]);

  const leaveChannel = useCallback(() => {
    if (socket && currentChannelId) {
      socket.emit("leave-channel", { channelId: currentChannelId });
      setCurrentChannelId(null);
      setCurrentAppSpaceId(null);
      setMessages([]);
      setTypingUsers([]);
    }
  }, [socket, currentChannelId]);

  const loadMessages = useCallback(async (channelId: number) => {
    try {
      const res = await fetch(`/api/channels/${channelId}/messages?limit=50`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
        setHasMoreMessages(data.messages.length === 50);
      }
    } catch (error) {
      console.error("[Chat] Failed to load messages:", error);
    }
  }, []);

  const loadMoreMessages = useCallback(async () => {
    if (!currentChannelId || messages.length === 0) return;

    const oldestId = messages[0]?.id;
    try {
      const res = await fetch(`/api/channels/${currentChannelId}/messages?limit=50&before=${oldestId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...data.messages, ...prev]);
        setHasMoreMessages(data.messages.length === 50);
      }
    } catch (error) {
      console.error("[Chat] Failed to load more messages:", error);
    }
  }, [currentChannelId, messages]);

  const sendMessage = useCallback((content: string) => {
    if (socket && currentChannelId && content.trim()) {
      socket.emit("send-message", { channelId: currentChannelId, content: content.trim() });

      // Stop typing indicator
      if (isTypingRef.current) {
        socket.emit("typing-stop", { channelId: currentChannelId });
        isTypingRef.current = false;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  }, [socket, currentChannelId]);

  const startTyping = useCallback(() => {
    if (socket && currentChannelId && !isTypingRef.current) {
      socket.emit("typing-start", { channelId: currentChannelId });
      isTypingRef.current = true;
    }

    // Reset timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (socket && currentChannelId && isTypingRef.current) {
        socket.emit("typing-stop", { channelId: currentChannelId });
        isTypingRef.current = false;
      }
    }, 2000);
  }, [socket, currentChannelId]);

  const stopTyping = useCallback(() => {
    if (socket && currentChannelId && isTypingRef.current) {
      socket.emit("typing-stop", { channelId: currentChannelId });
      isTypingRef.current = false;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [socket, currentChannelId]);

  const loadUnreadCounts = useCallback(async (appSpaceId: number) => {
    try {
      const res = await fetch(`/api/appspaces/${appSpaceId}/unread-counts`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCounts(prev => ({ ...prev, ...data.counts }));

        // Track which channels belong to this community
        const channelIds = Object.keys(data.counts).map(Number);
        setCommunityChannelMap(prev => ({
          ...prev,
          [appSpaceId]: channelIds,
        }));
      }
    } catch (error) {
      console.error("[Chat] Failed to load unread counts:", error);
    }
  }, []);

  const markChannelAsRead = useCallback(async (channelId: number) => {
    try {
      await fetch(`/api/channels/${channelId}/read`, {
        method: "POST",
        credentials: "include",
      });
      // Update local count
      setUnreadCounts(prev => ({
        ...prev,
        [channelId]: 0,
      }));
    } catch (error) {
      console.error("[Chat] Failed to mark channel as read:", error);
    }
  }, []);

  const getTotalUnreadForCommunity = useCallback((appSpaceId: number) => {
    const channelIds = communityChannelMap[appSpaceId] || [];
    return channelIds.reduce((total, channelId) => total + (unreadCounts[channelId] || 0), 0);
  }, [communityChannelMap, unreadCounts]);

  const isUserOnline = useCallback((userId: string) => {
    return onlineUsers.some(u => u.id === userId);
  }, [onlineUsers]);

  // Update unread counts when receiving new messages
  useEffect(() => {
    if (socket) {
      const handleNewMessage = (message: ChatMessage) => {
        // If this is not the current channel, increment unread count
        if (message.channelId !== currentChannelId) {
          setUnreadCounts(prev => ({
            ...prev,
            [message.channelId]: (prev[message.channelId] || 0) + 1,
          }));
        }
      };

      socket.on("message-received", handleNewMessage);
      return () => {
        socket.off("message-received", handleNewMessage);
      };
    }
  }, [socket, currentChannelId]);

  // Mark current channel as read when joining
  useEffect(() => {
    if (currentChannelId) {
      markChannelAsRead(currentChannelId);
    }
  }, [currentChannelId, markChannelAsRead]);

  return (
    <ChatContext.Provider
      value={{
        socket,
        connected,
        currentChannelId,
        messages,
        typingUsers,
        unreadCounts,
        onlineUsers,
        joinChannel,
        leaveChannel,
        sendMessage,
        startTyping,
        stopTyping,
        loadMessages,
        loadMoreMessages,
        hasMoreMessages,
        markChannelAsRead,
        loadUnreadCounts,
        getTotalUnreadForCommunity,
        isUserOnline,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
