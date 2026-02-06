import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/lib/auth";

interface Participant {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

interface Message {
  id: number;
  conversationId: number;
  senderId: string;
  content: string;
  createdAt: string;
  user: Participant;
}

interface Conversation {
  id: number;
  appSpaceId: number;
  createdAt: string;
  participants: Participant[];
  lastMessage?: {
    content: string;
    createdAt: string;
    senderId: string;
  };
}

interface DMContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  founder: Participant | null;
  isLoading: boolean;
  isLoadingMessages: boolean;
  typingUsers: Participant[];
  connected: boolean;
  selectConversation: (conversation: Conversation | null) => void;
  startConversationWithFounder: () => Promise<Conversation | null>;
  startConversation: (participantIds: string[]) => Promise<Conversation | null>;
  sendMessage: (content: string) => Promise<void>;
  refetchConversations: () => void;
  startTyping: () => void;
  stopTyping: () => void;
}

const DMContext = createContext<DMContextType | null>(null);

export function DMProvider({
  children,
  appSpaceId,
}: {
  children: ReactNode;
  appSpaceId: number | null;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Participant[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Initialize socket connection
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
      console.log("[DM] Connected to WebSocket");
      setConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("[DM] Disconnected from WebSocket");
      setConnected(false);
    });

    // Handle incoming DM messages
    newSocket.on("dm:message-received", (message: Message) => {
      setMessages(prev => [...prev, message]);
      // Also update conversation list
      queryClient.invalidateQueries({ queryKey: ["conversations", appSpaceId] });
    });

    // Handle typing indicators
    newSocket.on("dm:user-typing", (data: { conversationId: number; user: Participant }) => {
      if (data.user.id !== user.id) {
        setTypingUsers(prev => {
          if (prev.some(u => u.id === data.user.id)) return prev;
          return [...prev, data.user];
        });
      }
    });

    newSocket.on("dm:user-stopped-typing", (data: { conversationId: number; userId: string }) => {
      setTypingUsers(prev => prev.filter(u => u.id !== data.userId));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user, appSpaceId, queryClient]);

  // Fetch conversations
  const { data: conversationsData, isLoading, refetch: refetchConversations } = useQuery<{
    conversations: Conversation[];
    founder: Participant | null;
  }>({
    queryKey: ["conversations", appSpaceId],
    queryFn: async () => {
      if (!appSpaceId) return { conversations: [], founder: null };
      const res = await fetch(`/api/appspaces/${appSpaceId}/conversations`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
    enabled: !!appSpaceId,
  });

  // Fetch messages for current conversation (no polling - using WebSocket now)
  const { isLoading: isLoadingMessages } = useQuery<{
    messages: Message[];
  }>({
    queryKey: ["dm-messages", currentConversation?.id],
    queryFn: async () => {
      if (!currentConversation) return { messages: [] };
      const res = await fetch(`/api/conversations/${currentConversation.id}/messages`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      setMessages(data.messages);
      return data;
    },
    enabled: !!currentConversation?.id,
    // No polling - using WebSocket for real-time updates
  });

  // Join/leave DM conversation on socket
  useEffect(() => {
    if (socket && connected && currentConversation) {
      socket.emit("dm:join", { conversationId: currentConversation.id });
      setTypingUsers([]);

      return () => {
        socket.emit("dm:leave", { conversationId: currentConversation.id });
      };
    }
  }, [socket, connected, currentConversation]);

  // Start conversation mutation
  const startConversationMutation = useMutation({
    mutationFn: async (participantIds: string[]) => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ participantIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to start conversation");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", appSpaceId] });
    },
  });

  // Start conversation with founder mutation
  const startFounderConversationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/conversations/founder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to start conversation with founder");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", appSpaceId] });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!currentConversation) throw new Error("No conversation selected");

      // Use socket if connected, otherwise fall back to HTTP
      if (socket && connected) {
        socket.emit("dm:message", {
          conversationId: currentConversation.id,
          content: content.trim(),
        });

        // Stop typing indicator
        if (isTypingRef.current) {
          socket.emit("dm:typing-stop", { conversationId: currentConversation.id });
          isTypingRef.current = false;
        }
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }

        return {}; // Socket will handle the response
      }

      // Fallback to HTTP
      const res = await fetch(`/api/conversations/${currentConversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to send message");
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Only invalidate if using HTTP fallback (data will have message)
      if (data?.message) {
        queryClient.invalidateQueries({ queryKey: ["dm-messages", currentConversation?.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["conversations", appSpaceId] });
    },
  });

  const selectConversation = useCallback((conversation: Conversation | null) => {
    setCurrentConversation(conversation);
  }, []);

  const startConversationWithFounder = useCallback(async (): Promise<Conversation | null> => {
    try {
      const result = await startFounderConversationMutation.mutateAsync();
      const conversation = {
        ...result.conversation,
        participants: result.participants,
      };
      setCurrentConversation(conversation);
      return conversation;
    } catch (error) {
      console.error("Failed to start conversation with founder:", error);
      throw error;
    }
  }, [startFounderConversationMutation]);

  const startConversation = useCallback(async (participantIds: string[]): Promise<Conversation | null> => {
    try {
      const result = await startConversationMutation.mutateAsync(participantIds);
      const conversation = {
        ...result.conversation,
        participants: result.participants,
      };
      setCurrentConversation(conversation);
      return conversation;
    } catch (error) {
      console.error("Failed to start conversation:", error);
      throw error;
    }
  }, [startConversationMutation]);

  const sendMessage = useCallback(async (content: string) => {
    await sendMessageMutation.mutateAsync(content);
  }, [sendMessageMutation]);

  const startTyping = useCallback(() => {
    if (socket && currentConversation && !isTypingRef.current) {
      socket.emit("dm:typing-start", { conversationId: currentConversation.id });
      isTypingRef.current = true;
    }

    // Reset timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (socket && currentConversation && isTypingRef.current) {
        socket.emit("dm:typing-stop", { conversationId: currentConversation.id });
        isTypingRef.current = false;
      }
    }, 2000);
  }, [socket, currentConversation]);

  const stopTyping = useCallback(() => {
    if (socket && currentConversation && isTypingRef.current) {
      socket.emit("dm:typing-stop", { conversationId: currentConversation.id });
      isTypingRef.current = false;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [socket, currentConversation]);

  // Reset conversation when appSpaceId changes
  useEffect(() => {
    setCurrentConversation(null);
  }, [appSpaceId]);

  return (
    <DMContext.Provider
      value={{
        conversations: conversationsData?.conversations || [],
        currentConversation,
        messages,
        founder: conversationsData?.founder || null,
        isLoading,
        isLoadingMessages,
        typingUsers,
        connected,
        selectConversation,
        startConversationWithFounder,
        startConversation,
        sendMessage,
        refetchConversations,
        startTyping,
        stopTyping,
      }}
    >
      {children}
    </DMContext.Provider>
  );
}

export function useDM() {
  const context = useContext(DMContext);
  if (!context) {
    throw new Error("useDM must be used within a DMProvider");
  }
  return context;
}
