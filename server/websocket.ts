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

// Track typing users per channel
const typingUsers: Map<number, Map<string, TypingUser>> = new Map();

// Track typing users per DM conversation
const dmTypingUsers: Map<number, Map<string, DMTypingUser>> = new Map();

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

    // Handle disconnect
    socket.on("disconnect", () => {
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

      // Remove from online users and broadcast
      onlineUsers.forEach((users, appSpaceId) => {
        const onlineUser = users.get(userId);
        if (onlineUser && onlineUser.socketId === socket.id) {
          users.delete(userId);
          io.to(`appspace:${appSpaceId}`).emit("presence:user-offline", userId);
        }
      });
    });
  });

  return io;
}
