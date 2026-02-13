import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Hash, Lock, Clock, Megaphone, Loader2, WifiOff } from "lucide-react";
import { useChat } from "./ChatProvider";
import { ChatRoom } from "./ChatRoom";
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
  createdAt: string;
}

interface CommunityChatProps {
  appSpaceId: number;
}

export function CommunityChat({ appSpaceId }: CommunityChatProps) {
  const { user } = useAuth();
  const { connected, unreadCounts, loadUnreadCounts, markChannelAsRead } = useChat();
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  // Fetch channels for this appspace
  const { data: channelsData, isLoading: channelsLoading } = useQuery<{ channels: Channel[] }>({
    queryKey: ["channels", appSpaceId],
    queryFn: async () => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/channels`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch channels");
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const channels = channelsData?.channels || [];

  useEffect(() => {
    if (user && appSpaceId) {
      void loadUnreadCounts(appSpaceId);
    }
  }, [user, appSpaceId, loadUnreadCounts]);

  // Auto-select first channel when loaded
  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      setSelectedChannel(channels[0]);
    }
  }, [channels, selectedChannel]);

  const getChannelIcon = (channel: Channel) => {
    if (channel.isReadOnly) return <Megaphone className="w-4 h-4 text-white/40" />;
    if (channel.isLocked) return <Lock className="w-4 h-4 text-white/40" />;
    if (channel.isWaitlistersOnly) return <Clock className="w-4 h-4 text-yellow-400/60" />;
    return <Hash className="w-4 h-4 text-white/40" />;
  };

  const formatChannelName = (name: string) => {
    return name.replace(/-/g, " ");
  };

  // Group channels by type
  const waitlistersChannels = channels.filter(c => c.isWaitlistersOnly);
  const regularChannels = channels.filter(c => !c.isWaitlistersOnly);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full text-white/40">
        Please sign in to view chat
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Channel Sidebar */}
      <div className="w-[200px] bg-[#1a0530] border-r border-violet-500/10 flex flex-col">
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-violet-500/10">
          <span className="font-display font-bold text-white">Chat</span>
          {!connected && (
            <WifiOff className="w-4 h-4 text-amber-400" />
          )}
        </div>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto py-2">
          {channelsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
            </div>
          ) : channels.length === 0 ? (
            <div className="px-4 py-8 text-center text-white/40 text-sm">
              No channels available
            </div>
          ) : (
            <>
              {/* Waitlisters Only Section */}
              {waitlistersChannels.length > 0 && (
                <>
                  <div className="text-xs font-semibold text-white/30 uppercase tracking-wider px-4 py-2">
                    Waitlisters Only
                  </div>
                  {waitlistersChannels.map((channel) => {
                    const channelUnread = unreadCounts[channel.id] || 0;
                    return (
                    <button
                      key={channel.id}
                      onClick={() => {
                        setSelectedChannel(channel);
                        void markChannelAsRead(channel.id);
                      }}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${
                        selectedChannel?.id === channel.id
                          ? "bg-violet-500/20 text-white border-l-2 border-violet-500"
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {getChannelIcon(channel)}
                      <span className="flex-1 truncate text-sm">{formatChannelName(channel.name)}</span>
                      {channelUnread > 0 && (
                        <span className="text-xs font-semibold text-rose-300/90">({channelUnread > 99 ? "99+" : channelUnread})</span>
                      )}
                    </button>
                  )})}
                </>
              )}

              {/* Regular Channels */}
              {regularChannels.length > 0 && (
                <>
                  <div className="text-xs font-semibold text-white/30 uppercase tracking-wider px-4 py-2 mt-2">
                    Channels
                  </div>
                  {regularChannels.map((channel) => {
                    const channelUnread = unreadCounts[channel.id] || 0;
                    return (
                    <button
                      key={channel.id}
                      onClick={() => {
                        setSelectedChannel(channel);
                        void markChannelAsRead(channel.id);
                      }}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${
                        selectedChannel?.id === channel.id
                          ? "bg-violet-500/20 text-white border-l-2 border-violet-500"
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {getChannelIcon(channel)}
                      <span className="flex-1 truncate text-sm">{formatChannelName(channel.name)}</span>
                      {channelUnread > 0 && (
                        <span className="text-xs font-semibold text-rose-300/90">({channelUnread > 99 ? "99+" : channelUnread})</span>
                      )}
                      {channel.isLocked && (
                        <span className="text-[10px] text-violet-400/70 bg-violet-400/10 px-1.5 py-0.5 rounded">
                          approved
                        </span>
                      )}
                    </button>
                  )})}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Chat Room */}
      <div className="flex-1 flex flex-col">
        <ChatRoom channel={selectedChannel} appSpaceId={appSpaceId} />
      </div>
    </div>
  );
}
