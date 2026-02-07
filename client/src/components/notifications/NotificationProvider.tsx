import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { io, Socket } from "socket.io-client";

export interface Notification {
  id: number;
  userId: string;
  type: "mention" | "dm" | "channel_message" | "waitlist_approved" | "waitlist_rejected" | "golden_ticket";
  data: string; // JSON string
  read: boolean;
  createdAt: string;
}

interface ParsedNotificationData {
  message?: string;
  communityName?: string;
  channelName?: string;
  senderName?: string;
  appSpaceId?: number;
  appSpaceName?: string;
  appSpaceSlug?: string;
  channelId?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  parseNotificationData: (notification: Notification) => ParsedNotificationData;
  getNotificationMessage: (notification: Notification) => string;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Initialize socket for real-time notifications
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const newSocket = io({
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("[Notifications] Connected to WebSocket");
    });

    // Listen for new notifications
    newSocket.on("new-notification", (notification: Notification) => {
      setNotifications(prev => [notification, ...prev]);
      if (!notification.read) {
        setUnreadCount(prev => prev + 1);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const res = await fetch("/api/notifications", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error("[Notifications] Failed to fetch:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch notifications on mount
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: number) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
        credentials: "include",
      });
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("[Notifications] Failed to mark as read:", error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
        credentials: "include",
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("[Notifications] Failed to mark all as read:", error);
    }
  }, []);

  const parseNotificationData = useCallback((notification: Notification): ParsedNotificationData => {
    try {
      return JSON.parse(notification.data);
    } catch {
      return {};
    }
  }, []);

  const getNotificationMessage = useCallback((notification: Notification): string => {
    const data = parseNotificationData(notification);

    switch (notification.type) {
      case "mention":
        return `${data.senderName || "Someone"} mentioned you in #${data.channelName || "a channel"}`;
      case "dm":
        return `${data.senderName || "Someone"} sent you a direct message`;
      case "channel_message":
        return `New message in #${data.channelName || "a channel"}`;
      case "waitlist_approved":
        return `🎉 You've been approved to join ${data.appSpaceName || "a community"}!`;
      case "waitlist_rejected":
        return `Your request to join ${data.appSpaceName || "a community"} was declined`;
      case "golden_ticket":
        return data.message || "Golden Ticket update";
      default:
        return data.message || "New notification";
    }
  }, [parseNotificationData]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        parseNotificationData,
        getNotificationMessage,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
