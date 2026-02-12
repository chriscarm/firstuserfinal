import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { storage } from "./storage";
import type { Channel, ChatMessage } from "@shared/schema";

interface TypingUser {
  id: string;
  username: string | null;
  channelId: number;
  timestamp: number;
}

interface DMTypingUser {
  id: string;
  username: string | null;
  conversationId: number;
  timestamp: number;
}

interface LiveChatTypingUser {
  id: string;
  username: string | null;
  threadId: number;
  timestamp: number;
}

// Track typing users per channel
const typingUsers: Map<number, Map<string, TypingUser>> = new Map();

// Track typing users per DM conversation
const dmTypingUsers: Map<number, Map<string, DMTypingUser>> = new Map();

// Track typing users per live chat thread
const liveChatTypingUsers: Map<number, Map<string, LiveChatTypingUser>> = new Map();

// Track online users per app space
interface OnlineUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  socketId: string;
}

const onlineUsers: Map<number, Map<string, OnlineUser>> = new Map(); // appSpaceId -> Map<userId, user>

let ioInstance: Server | null = null;

export function emitNotificationToUser(userId: string, notification: unknown) {
  if (!ioInstance) return;
  ioInstance.to(`user:${userId}`).emit("new-notification", notification);
}

export function emitLiveChatMessageToThread(threadId: number, message: unknown) {
  if (!ioInstance) return;
  ioInstance.to(`live_chat:${threadId}`).emit("live_chat.message", message);
}

export function emitLiveChatReadToThread(threadId: number, payload: unknown) {
  if (!ioInstance) return;
  ioInstance.to(`live_chat:${threadId}`).emit("live_chat.read", payload);
}

// Clean up stale typing indicators (older than 3 seconds)
setInterval(() => {
  const now = Date.now();
  // Clean channel typing
  typingUsers.forEach((users, channelId) => {
    users.forEach((user, odId) => {
      if (now - user.timestamp > 3000) {
        users.delete(odId);
      }
    });
    if (users.size === 0) {
      typingUsers.delete(channelId);
    }
  });
  // Clean DM typing
  dmTypingUsers.forEach((users, conversationId) => {
    users.forEach((user, odId) => {
      if (now - user.timestamp > 3000) {
        users.delete(odId);
      }
    });
    if (users.size === 0) {
      dmTypingUsers.delete(conversationId);
    }
  });
  // Clean live chat typing
  liveChatTypingUsers.forEach((users, threadId) => {
    users.forEach((typingUser, typingUserId) => {
      if (now - typingUser.timestamp > 3000) {
        users.delete(typingUserId);
      }
    });
    if (users.size === 0) {
      liveChatTypingUsers.delete(threadId);
    }
  });
}, 1000);

export function setupWebSocket(httpServer: HttpServer, sessionMiddleware: any): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === "production" ? false : ["http://localhost:5000"],
      credentials: true,
    },
    path: "/socket.io",
  });

  ioInstance = io;

  // Use session middleware for Socket.IO
  io.use((socket, next) => {
    sessionMiddleware(socket.request, {} as any, next);
  });

  io.on("connection", async (socket: Socket) => {
    const session = (socket.request as any).session;
    const userId = session?.userId;

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    const user = await storage.getUser(userId);
    if (!user) {
      socket.disconnect(true);
      return;
    }

    console.log(`[WebSocket] User connected: ${user.username || user.id}`);

    // Store user info on socket
    (socket as any).userId = userId;
    socket.join(`user:${userId}`);

    (socket as any).user = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };

    const heartbeatAppSpaces = new Set<number>();

    // Join a channel room
    socket.on("join-channel", async (data: { channelId: number; appSpaceId: number }) => {
      try {
        const { channelId, appSpaceId } = data;

        // Validate channel access
        const channel = await storage.getChannel(channelId);
        if (!channel || channel.appSpaceId !== appSpaceId) {
          socket.emit("error", { message: "Channel not found" });
          return;
        }

        const member = await storage.getWaitlistMember(appSpaceId, userId);
        const appSpace = await storage.getAppSpace(appSpaceId);
        const isFounder = appSpace?.founderId === userId || user.hasFounderAccess;

        // Check access
        if (!isFounder && !member) {
          socket.emit("error", { message: "You must be a member to join this channel" });
          return;
        }

        if (channel.isWaitlistersOnly && member?.status !== "pending" && !isFounder) {
          socket.emit("error", { message: "This channel is for waitlist members only" });
          return;
        }

        if (channel.isLocked && member?.status !== "approved" && !isFounder) {
          socket.emit("error", { message: "This channel requires approved membership" });
          return;
        }

        // Leave previous channel rooms and join new one
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
          if (room.startsWith("channel:")) {
            socket.leave(room);
          }
        });

        const roomName = `channel:${channelId}`;
        socket.join(roomName);

        // Also join the app space room for presence tracking
        const appSpaceRoom = `appspace:${appSpaceId}`;
        socket.join(appSpaceRoom);

        // Track user as online in this app space
        if (!onlineUsers.has(appSpaceId)) {
          onlineUsers.set(appSpaceId, new Map());
        }
        const appSpaceOnline = onlineUsers.get(appSpaceId)!;
        const onlineUser: OnlineUser = {
          id: userId,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          socketId: socket.id,
        };

        if (!appSpaceOnline.has(userId)) {
          appSpaceOnline.set(userId, onlineUser);
          // Broadcast user online to others in the app space
          socket.to(appSpaceRoom).emit("presence:user-online", {
            id: userId,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
          });
        }

        // Send current online users to the joining user
        const onlineList = Array.from(appSpaceOnline.values()).map(u => ({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
        }));
        socket.emit("presence:online-users", onlineList);

        // Send current typing users in this channel
        const channelTyping = typingUsers.get(channelId);
        if (channelTyping && channelTyping.size > 0) {
          const typingList = Array.from(channelTyping.values())
            .filter(u => u.id !== userId)
            .map(u => ({ id: u.id, username: u.username }));
          socket.emit("typing-users", { channelId, users: typingList });
        }

        console.log(`[WebSocket] User ${user.username} joined channel ${channelId}`);
      } catch (error) {
        console.error("[WebSocket] join-channel error:", error);
        socket.emit("error", { message: "Failed to join channel" });
      }
    });

    // Leave a channel room
    socket.on("leave-channel", (data: { channelId: number }) => {
      const roomName = `channel:${data.channelId}`;
      socket.leave(roomName);

      // Remove from typing users
      const channelTyping = typingUsers.get(data.channelId);
      if (channelTyping) {
        channelTyping.delete(userId);
        // Broadcast updated typing users
        io.to(roomName).emit("typing-users", {
          channelId: data.channelId,
          users: Array.from(channelTyping.values()).map(u => ({ id: u.id, username: u.username })),
        });
      }
    });

    // Handle typing indicator
    socket.on("typing-start", (data: { channelId: number }) => {
      const { channelId } = data;

      if (!typingUsers.has(channelId)) {
        typingUsers.set(channelId, new Map());
      }

      const channelTyping = typingUsers.get(channelId)!;
      channelTyping.set(userId, {
        id: userId,
        username: user.username,
        channelId,
        timestamp: Date.now(),
      });

      // Broadcast to others in the channel
      const roomName = `channel:${channelId}`;
      socket.to(roomName).emit("user-typing", {
        channelId,
        user: { id: userId, username: user.username },
      });
    });

    socket.on("typing-stop", (data: { channelId: number }) => {
      const { channelId } = data;

      const channelTyping = typingUsers.get(channelId);
      if (channelTyping) {
        channelTyping.delete(userId);

        // Broadcast to others in the channel
        const roomName = `channel:${channelId}`;
        socket.to(roomName).emit("user-stopped-typing", {
          channelId,
          userId,
        });
      }
    });

    // Send a message via WebSocket
    socket.on("send-message", async (data: { channelId: number; content: string }) => {
      try {
        const { channelId, content } = data;

        if (!content || content.trim().length === 0 || content.length > 2000) {
          socket.emit("error", { message: "Invalid message content" });
          return;
        }

        const channel = await storage.getChannel(channelId);
        if (!channel) {
          socket.emit("error", { message: "Channel not found" });
          return;
        }

        const member = await storage.getWaitlistMember(channel.appSpaceId, userId);
        const appSpace = await storage.getAppSpace(channel.appSpaceId);
        const isFounder = appSpace?.founderId === userId || user.hasFounderAccess;

        // Check write access
        if (!isFounder && !member) {
          socket.emit("error", { message: "You must be a member to send messages" });
          return;
        }

        // Pending users cannot send messages - they can only view
        if (!isFounder && member?.status === "pending") {
          socket.emit("error", { message: "You need to be approved to chat. You can view messages while waiting." });
          return;
        }

        if (channel.isReadOnly && !isFounder) {
          socket.emit("error", { message: "This channel is read-only" });
          return;
        }

        if (channel.isLocked && member?.status !== "approved" && !isFounder) {
          socket.emit("error", { message: "This channel requires approved membership" });
          return;
        }

        // Create message
        const message = await storage.createMessage({
          channelId,
          userId,
          content: content.trim(),
          isPinned: false,
        });

        const messageWithUser = {
          ...message,
          user: (socket as any).user,
        };

        // Broadcast to all in channel (including sender)
        const roomName = `channel:${channelId}`;
        io.to(roomName).emit("message-received", messageWithUser);

        // Clear typing indicator
        const channelTyping = typingUsers.get(channelId);
        if (channelTyping) {
          channelTyping.delete(userId);
          socket.to(roomName).emit("user-stopped-typing", { channelId, userId });
        }
      } catch (error) {
        console.error("[WebSocket] send-message error:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // ============ DM SOCKET HANDLERS ============

    // Join a DM conversation room
    socket.on("dm:join", async (data: { conversationId: number }) => {
      try {
        const { conversationId } = data;

        // Validate conversation access
        const isParticipant = await storage.isConversationParticipant(conversationId, userId);
        if (!isParticipant) {
          socket.emit("error", { message: "You are not a participant of this conversation" });
          return;
        }

        // Leave previous DM rooms and join new one
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
          if (room.startsWith("dm:")) {
            socket.leave(room);
          }
        });

        const roomName = `dm:${conversationId}`;
        socket.join(roomName);

        // Send current typing users in this conversation
        const convTyping = dmTypingUsers.get(conversationId);
        if (convTyping && convTyping.size > 0) {
          const typingList = Array.from(convTyping.values())
            .filter(u => u.id !== userId)
            .map(u => ({ id: u.id, username: u.username }));
          socket.emit("dm:typing-users", { conversationId, users: typingList });
        }

        console.log(`[WebSocket] User ${user.username} joined DM ${conversationId}`);
      } catch (error) {
        console.error("[WebSocket] dm:join error:", error);
        socket.emit("error", { message: "Failed to join conversation" });
      }
    });

    // Leave a DM conversation room
    socket.on("dm:leave", (data: { conversationId: number }) => {
      const roomName = `dm:${data.conversationId}`;
      socket.leave(roomName);

      // Remove from typing users
      const convTyping = dmTypingUsers.get(data.conversationId);
      if (convTyping) {
        convTyping.delete(userId);
        io.to(roomName).emit("dm:typing-users", {
          conversationId: data.conversationId,
          users: Array.from(convTyping.values()).map(u => ({ id: u.id, username: u.username })),
        });
      }
    });

    // Handle DM typing indicator
    socket.on("dm:typing-start", (data: { conversationId: number }) => {
      const { conversationId } = data;

      if (!dmTypingUsers.has(conversationId)) {
        dmTypingUsers.set(conversationId, new Map());
      }

      const convTyping = dmTypingUsers.get(conversationId)!;
      convTyping.set(userId, {
        id: userId,
        username: user.username,
        conversationId,
        timestamp: Date.now(),
      });

      // Broadcast to others in the conversation
      const roomName = `dm:${conversationId}`;
      socket.to(roomName).emit("dm:user-typing", {
        conversationId,
        user: { id: userId, username: user.username },
      });
    });

    socket.on("dm:typing-stop", (data: { conversationId: number }) => {
      const { conversationId } = data;

      const convTyping = dmTypingUsers.get(conversationId);
      if (convTyping) {
        convTyping.delete(userId);

        const roomName = `dm:${conversationId}`;
        socket.to(roomName).emit("dm:user-stopped-typing", {
          conversationId,
          userId,
        });
      }
    });

    // Send a DM via WebSocket
    socket.on("dm:message", async (data: { conversationId: number; content: string }) => {
      try {
        const { conversationId, content } = data;

        if (!content || content.trim().length === 0 || content.length > 2000) {
          socket.emit("error", { message: "Invalid message content" });
          return;
        }

        // Verify participant
        const isParticipant = await storage.isConversationParticipant(conversationId, userId);
        if (!isParticipant) {
          socket.emit("error", { message: "You are not a participant of this conversation" });
          return;
        }

        // Check membership status (pending users cannot DM)
        const conversation = await storage.getConversation(conversationId);
        if (!conversation) {
          socket.emit("error", { message: "Conversation not found" });
          return;
        }

        const member = await storage.getWaitlistMember(conversation.appSpaceId, userId);
        const appSpace = await storage.getAppSpace(conversation.appSpaceId);
        const isFounder = appSpace?.founderId === userId || user.hasFounderAccess;

        if (!isFounder && member?.status === "pending") {
          socket.emit("error", { message: "Sorry you must be accepted into the app in order to use this feature" });
          return;
        }

        // Send message
        const message = await storage.sendDirectMessage(conversationId, userId, content.trim());

        const messageWithUser = {
          ...message,
          user: (socket as any).user,
        };

        // Broadcast to all in conversation
        const roomName = `dm:${conversationId}`;
        io.to(roomName).emit("dm:message-received", messageWithUser);

        const participants = await storage.getConversationParticipants(conversationId);
        const recipientIds = participants.map((p) => p.id).filter((id) => id !== userId);
        await Promise.all(recipientIds.map(async (recipientId) => {
          const notification = await storage.createNotification({
            userId: recipientId,
            type: "dm",
            data: JSON.stringify({
              senderName: user.displayName || user.username || "Someone",
              conversationId,
              appSpaceId: conversation.appSpaceId,
            }),
          });
          emitNotificationToUser(recipientId, notification);
        }));

        // Clear typing indicator
        const convTyping = dmTypingUsers.get(conversationId);
        if (convTyping) {
          convTyping.delete(userId);
          socket.to(roomName).emit("dm:user-stopped-typing", { conversationId, userId });
        }
      } catch (error) {
        console.error("[WebSocket] dm:message error:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // ============ LIVE PRESENCE + LIVE CHAT SOCKET HANDLERS ============

    socket.on("presence.subscribe", async (data: { appSpaceId: number }) => {
      try {
        const appSpaceId = Number(data?.appSpaceId);
        if (!Number.isInteger(appSpaceId)) {
          socket.emit("error", { message: "Invalid app ID" });
          return;
        }

        const appSpace = await storage.getAppSpace(appSpaceId);
        if (!appSpace) {
          socket.emit("error", { message: "AppSpace not found" });
          return;
        }

        const canManage = appSpace.founderId === userId || !!user.hasFounderAccess;
        if (!canManage) {
          socket.emit("error", { message: "Founder access required for live presence" });
          return;
        }

        const roomName = `integration-live:${appSpaceId}:founders`;
        socket.join(roomName);
        const liveUsers = await storage.getLiveUsersForFounder(appSpaceId, 45);
        socket.emit("presence.live-snapshot", {
          appSpaceId,
          liveUsers,
          heartbeatIntervalSeconds: 15,
          liveTimeoutSeconds: 45,
        });
      } catch (error) {
        console.error("[WebSocket] presence.subscribe error:", error);
        socket.emit("error", { message: "Failed to subscribe to live presence" });
      }
    });

    socket.on("presence.unsubscribe", (data: { appSpaceId: number }) => {
      const appSpaceId = Number(data?.appSpaceId);
      if (!Number.isInteger(appSpaceId)) return;
      socket.leave(`integration-live:${appSpaceId}:founders`);
    });

    socket.on("presence.heartbeat", async (data: {
      appSpaceId: number;
      clientPlatform?: string;
      status?: "live" | "idle" | "offline";
    }) => {
      try {
        const appSpaceId = Number(data?.appSpaceId);
        if (!Number.isInteger(appSpaceId)) {
          socket.emit("error", { message: "Invalid app ID" });
          return;
        }

        const appSpace = await storage.getAppSpace(appSpaceId);
        if (!appSpace) {
          socket.emit("error", { message: "AppSpace not found" });
          return;
        }

        const member = await storage.getWaitlistMember(appSpaceId, userId);
        const isFounder = appSpace.founderId === userId || !!user.hasFounderAccess;
        if (!isFounder && member?.status !== "approved") {
          socket.emit("error", { message: "Approved membership required for live presence" });
          return;
        }

        const status = data?.status && ["live", "idle", "offline"].includes(data.status) ? data.status : "live";
        const clientPlatform = typeof data?.clientPlatform === "string" && data.clientPlatform.trim()
          ? data.clientPlatform.trim().slice(0, 32)
          : "web";
        const presence = await storage.upsertLivePresence({
          appSpaceId,
          userId,
          status,
          clientPlatform,
          lastSeenAt: new Date(),
        });
        heartbeatAppSpaces.add(appSpaceId);

        const liveUsers = await storage.getLiveUsersForFounder(appSpaceId, 45);
        io.to(`integration-live:${appSpaceId}:founders`).emit("presence.live-updated", {
          appSpaceId,
          liveUsers,
          heartbeatIntervalSeconds: 15,
          liveTimeoutSeconds: 45,
        });

        socket.emit("presence.heartbeat.ack", {
          appSpaceId,
          status: presence.status,
          lastSeenAt: presence.lastSeenAt,
        });
      } catch (error) {
        console.error("[WebSocket] presence.heartbeat error:", error);
        socket.emit("error", { message: "Failed to process heartbeat" });
      }
    });

    socket.on("live_chat.join", async (data: { threadId: number }) => {
      try {
        const threadId = Number(data?.threadId);
        if (!Number.isInteger(threadId)) {
          socket.emit("error", { message: "Invalid thread ID" });
          return;
        }

        const thread = await storage.getLiveChatThreadById(threadId);
        if (!thread) {
          socket.emit("error", { message: "Live chat thread not found" });
          return;
        }

        const isParticipant = await storage.isLiveChatParticipant(threadId, userId);
        if (!isParticipant) {
          socket.emit("error", { message: "You are not a participant in this live chat" });
          return;
        }

        const roomName = `live_chat:${threadId}`;
        socket.join(roomName);

        const threadTyping = liveChatTypingUsers.get(threadId);
        if (threadTyping && threadTyping.size > 0) {
          socket.emit("live_chat.typing_snapshot", {
            threadId,
            users: Array.from(threadTyping.values()).filter((typingUser) => typingUser.id !== userId).map((typingUser) => ({
              id: typingUser.id,
              username: typingUser.username,
            })),
          });
        }
      } catch (error) {
        console.error("[WebSocket] live_chat.join error:", error);
        socket.emit("error", { message: "Failed to join live chat thread" });
      }
    });

    socket.on("live_chat.leave", (data: { threadId: number }) => {
      const threadId = Number(data?.threadId);
      if (!Number.isInteger(threadId)) return;

      socket.leave(`live_chat:${threadId}`);
      const threadTyping = liveChatTypingUsers.get(threadId);
      if (threadTyping) {
        threadTyping.delete(userId);
      }
      socket.to(`live_chat:${threadId}`).emit("live_chat.typing", {
        threadId,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
        isTyping: false,
      });
    });

    socket.on("live_chat.message", async (data: { threadId: number; body: string }) => {
      try {
        const threadId = Number(data?.threadId);
        if (!Number.isInteger(threadId)) {
          socket.emit("error", { message: "Invalid thread ID" });
          return;
        }

        const body = typeof data?.body === "string" ? data.body.trim() : "";
        if (!body || body.length > 2000) {
          socket.emit("error", { message: "Message must be between 1 and 2000 characters" });
          return;
        }

        const thread = await storage.getLiveChatThreadById(threadId);
        if (!thread) {
          socket.emit("error", { message: "Live chat thread not found" });
          return;
        }

        const isParticipant = await storage.isLiveChatParticipant(threadId, userId);
        if (!isParticipant) {
          socket.emit("error", { message: "You are not a participant in this live chat" });
          return;
        }

        if (thread.memberUserId === userId) {
          const member = await storage.getWaitlistMember(thread.appSpaceId, userId);
          if (!member || member.status !== "approved") {
            socket.emit("error", { message: "Approved membership required to send live chat messages" });
            return;
          }
        }

        const message = await storage.createLiveChatMessage({
          threadId,
          senderUserId: userId,
          body,
        });

        const payload = {
          ...message,
          sender: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
          },
        };

        emitLiveChatMessageToThread(threadId, payload);

        const recipientUserId = thread.memberUserId === userId ? thread.founderUserId : thread.memberUserId;
        const notification = await storage.createNotification({
          userId: recipientUserId,
          type: "dm",
          data: JSON.stringify({
            appSpaceId: thread.appSpaceId,
            liveThreadId: threadId,
            senderName: user.displayName || user.username || "Someone",
          }),
        });
        emitNotificationToUser(recipientUserId, notification);

        const threadTyping = liveChatTypingUsers.get(threadId);
        if (threadTyping) {
          threadTyping.delete(userId);
          socket.to(`live_chat:${threadId}`).emit("live_chat.typing", {
            threadId,
            user: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
            },
            isTyping: false,
          });
        }
      } catch (error) {
        console.error("[WebSocket] live_chat.message error:", error);
        socket.emit("error", { message: "Failed to send live chat message" });
      }
    });

    socket.on("live_chat.typing", async (data: { threadId: number; isTyping: boolean }) => {
      try {
        const threadId = Number(data?.threadId);
        if (!Number.isInteger(threadId)) return;

        const isParticipant = await storage.isLiveChatParticipant(threadId, userId);
        if (!isParticipant) return;

        if (!liveChatTypingUsers.has(threadId)) {
          liveChatTypingUsers.set(threadId, new Map());
        }
        const threadTyping = liveChatTypingUsers.get(threadId)!;

        if (data?.isTyping) {
          threadTyping.set(userId, {
            id: userId,
            username: user.username,
            threadId,
            timestamp: Date.now(),
          });
        } else {
          threadTyping.delete(userId);
        }

        socket.to(`live_chat:${threadId}`).emit("live_chat.typing", {
          threadId,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
          },
          isTyping: !!data?.isTyping,
        });
      } catch (error) {
        console.error("[WebSocket] live_chat.typing error:", error);
      }
    });

    socket.on("live_chat.read", async (data: { threadId: number }) => {
      try {
        const threadId = Number(data?.threadId);
        if (!Number.isInteger(threadId)) return;

        const isParticipant = await storage.isLiveChatParticipant(threadId, userId);
        if (!isParticipant) return;

        await storage.markLiveChatThreadRead(threadId, userId);
        emitLiveChatReadToThread(threadId, {
          threadId,
          userId,
          readAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("[WebSocket] live_chat.read error:", error);
      }
    });

    // Handle disconnect
    socket.on("disconnect", async () => {
      console.log(`[WebSocket] User disconnected: ${user.username || user.id}`);

      // Remove from all channel typing indicators
      typingUsers.forEach((users, channelId) => {
        if (users.has(userId)) {
          users.delete(userId);
          io.to(`channel:${channelId}`).emit("user-stopped-typing", { channelId, userId });
        }
      });

      // Remove from all DM typing indicators
      dmTypingUsers.forEach((users, conversationId) => {
        if (users.has(userId)) {
          users.delete(userId);
          io.to(`dm:${conversationId}`).emit("dm:user-stopped-typing", { conversationId, userId });
        }
      });

      // Remove from all live chat typing indicators
      liveChatTypingUsers.forEach((users, threadId) => {
        if (users.has(userId)) {
          users.delete(userId);
          socket.to(`live_chat:${threadId}`).emit("live_chat.typing", {
            threadId,
            user: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
            },
            isTyping: false,
          });
        }
      });

      // Remove from online users and broadcast
      onlineUsers.forEach((users, appSpaceId) => {
        const onlineUser = users.get(userId);
        if (onlineUser && onlineUser.socketId === socket.id) {
          users.delete(userId);
          io.to(`appspace:${appSpaceId}`).emit("presence:user-offline", userId);
        }
      });

      // Mark integration live presence offline for spaces this socket heartbeated on.
      const heartbeatAppSpaceIds = Array.from(heartbeatAppSpaces.values());
      await Promise.all(heartbeatAppSpaceIds.map(async (appSpaceId) => {
        try {
          await storage.upsertLivePresence({
            appSpaceId,
            userId,
            status: "offline",
            clientPlatform: "web",
            lastSeenAt: new Date(),
          });
          const liveUsers = await storage.getLiveUsersForFounder(appSpaceId, 45);
          io.to(`integration-live:${appSpaceId}:founders`).emit("presence.live-updated", {
            appSpaceId,
            liveUsers,
            heartbeatIntervalSeconds: 15,
            liveTimeoutSeconds: 45,
          });
        } catch (error) {
          console.error("[WebSocket] Failed to mark live presence offline:", error);
        }
      }));
    });
  });

  return io;
}
