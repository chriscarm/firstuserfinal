import { useState } from "react";
import { Bell, Check, MessageCircle, AtSign, UserCheck, UserX, Hash } from "lucide-react";
import { useNotifications, Notification } from "./NotificationProvider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

function getNotificationIcon(type: Notification["type"]) {
  switch (type) {
    case "mention":
      return <AtSign className="h-4 w-4 text-violet-400" />;
    case "dm":
      return <MessageCircle className="h-4 w-4 text-blue-400" />;
    case "channel_message":
      return <Hash className="h-4 w-4 text-white/50" />;
    case "waitlist_approved":
      return <UserCheck className="h-4 w-4 text-emerald-400" />;
    case "waitlist_rejected":
      return <UserX className="h-4 w-4 text-red-400" />;
    default:
      return <Bell className="h-4 w-4 text-white/50" />;
  }
}

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
}

function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const { getNotificationMessage, markAsRead } = useNotifications();

  const handleClick = () => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-start gap-3 p-3 text-left transition-colors hover:bg-white/5 ${
        !notification.read ? "bg-violet-500/10" : ""
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {getNotificationIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${!notification.read ? "text-white" : "text-white/70"}`}>
          {getNotificationMessage(notification)}
        </p>
        <p className="text-xs text-white/40 mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>
      {!notification.read && (
        <div className="shrink-0 w-2 h-2 rounded-full bg-violet-500 mt-1.5" />
      )}
    </button>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, loading, markAllAsRead } = useNotifications();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex items-center justify-center h-11 w-11 rounded-lg hover:bg-white/[0.04] transition-all duration-200"
          data-testid="notification-bell"
        >
          <Bell className={`h-5 w-5 transition-colors ${
            unreadCount > 0 ? "text-white/90" : "text-white/25 hover:text-white/50"
          }`} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 bg-black/95 border-white/10"
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="font-semibold text-white">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs text-violet-400 hover:text-violet-300 hover:bg-white/5"
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[320px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-10 w-10 text-white/20 mb-3" />
              <p className="text-sm text-white/50">No notifications yet</p>
              <p className="text-xs text-white/30 mt-1">
                We'll notify you when something happens
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => setOpen(false)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
