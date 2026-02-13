import { Hash, Lock, Clock, Megaphone } from "lucide-react";

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

interface ChannelListProps {
  channels: Channel[];
  activeChannelId: number | null;
  onSelectChannel: (channel: Channel) => void;
  unreadCounts?: Record<number, number>;
}

export function ChannelList({ channels, activeChannelId, onSelectChannel, unreadCounts = {} }: ChannelListProps) {
  const getChannelIcon = (channel: Channel) => {
    if (channel.isReadOnly) return <Megaphone className="w-4 h-4 text-white/40" />;
    if (channel.isLocked) return <Lock className="w-4 h-4 text-white/40" />;
    if (channel.isWaitlistersOnly) return <Clock className="w-4 h-4 text-yellow-400/60" />;
    return <Hash className="w-4 h-4 text-white/40" />;
  };

  const formatChannelName = (name: string) => {
    return name.replace(/-/g, " ");
  };

  if (channels.length === 0) {
    return (
      <div className="p-4 text-center text-white/40 text-sm">
        No channels available
      </div>
    );
  }

  const waitlistChannels = channels.filter(c => c.isWaitlistersOnly);
  const membersOnlyChannels = channels.filter(c => c.isLocked && !c.isWaitlistersOnly);

  return (
    <div className="space-y-1 p-2">
      {/* Waitlist channels */}
      {waitlistChannels.length > 0 && (
        <>
          <div className="text-xs text-white/30 uppercase tracking-wider px-2 py-2">
            Waitlists
          </div>
          {waitlistChannels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => onSelectChannel(channel)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                activeChannelId === channel.id
                  ? "bg-violet-500/20 text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              {getChannelIcon(channel)}
              <span className="flex-1 truncate text-sm font-medium">
                {formatChannelName(channel.name)}
              </span>
              {(unreadCounts[channel.id] || 0) > 0 && (
                <span className="text-xs font-semibold text-rose-300/90">
                  ({(unreadCounts[channel.id] || 0) > 99 ? "99+" : unreadCounts[channel.id]})
                </span>
              )}
            </button>
          ))}
        </>
      )}

      {/* Members only channels */}
      {membersOnlyChannels.length > 0 && (
        <>
          <div className="text-xs text-white/30 uppercase tracking-wider px-2 py-2 mt-4 flex items-center gap-1">
            Members Only <Lock className="w-3 h-3" />
          </div>
          {membersOnlyChannels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => onSelectChannel(channel)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                activeChannelId === channel.id
                  ? "bg-violet-500/20 text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              {getChannelIcon(channel)}
              <span className="flex-1 truncate text-sm font-medium">
                {formatChannelName(channel.name)}
              </span>
              {(unreadCounts[channel.id] || 0) > 0 && (
                <span className="text-xs font-semibold text-rose-300/90">
                  ({(unreadCounts[channel.id] || 0) > 99 ? "99+" : unreadCounts[channel.id]})
                </span>
              )}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
