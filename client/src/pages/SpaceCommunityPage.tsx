import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useChat, MessageSearch } from "@/components/chat";
import { useAccessLevel } from "@/hooks/useAccessLevel";
import { useUserCommunities } from "@/hooks/useUserCommunities";
import { useLayout } from "@/contexts/LayoutContext";
import { AppLayout, ContextPanel, MainPane, SectionHeader, HeaderTitle } from "@/components/layout";
import { MemberListPanel } from "@/components/MemberListPanel";
import { SurveyResponseModal } from "@/components/SurveyResponseModal";
import { LiveChatWidget } from "@/components/live/LiveChatWidget";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Hash,
  Clock,
  Lock,
  Loader2,
  User,
  Send,
  AlertCircle,
  MessageCircle,
  Users,
  Gift,
  Map,
  Bell,
  Crown,
  Zap,
  Bug,
  Globe,
  Star,
  Sparkles,
  Settings2,
  Search,
} from "lucide-react";

interface RealChannel {
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

// Icon mapping based on channel name
function ChannelIcon({ name, className }: { name: string; className?: string }) {
  const lowerName = name.toLowerCase();

  if (lowerName.includes("waitlist") || lowerName.includes("chat") || lowerName.includes("let-me-in")) {
    return <MessageCircle className={className} />;
  }
  if (lowerName.includes("what-i-gotta-do")) {
    return <Star className={className} />;
  }
  if (lowerName.includes("founder")) {
    return <Hash className={className} />;
  }
  if (lowerName.includes("perk") || lowerName.includes("access") || lowerName.includes("gear")) {
    return <Gift className={className} />;
  }
  if (lowerName.includes("roadmap") || lowerName.includes("product")) {
    return <Map className={className} />;
  }
  if (lowerName.includes("deal") || lowerName.includes("exclusive")) {
    return <Bell className={className} />;
  }
  if (lowerName.includes("vip") || lowerName.includes("lounge")) {
    return <Crown className={className} />;
  }
  if (lowerName.includes("investor") || lowerName.includes("network")) {
    return <Zap className={className} />;
  }
  if (lowerName.includes("beta") || lowerName.includes("tester")) {
    return <Bug className={className} />;
  }
  if (lowerName.includes("referral") || lowerName.includes("reward")) {
    return <Globe className={className} />;
  }
  if (lowerName.includes("founding") || lowerName.includes("member") || lowerName.includes("introduction")) {
    return <Users className={className} />;
  }
  if (lowerName.includes("voting") || lowerName.includes("feature")) {
    return <Star className={className} />;
  }
  if (lowerName.includes("sneak") || lowerName.includes("peek")) {
    return <Sparkles className={className} />;
  }
  if (lowerName.includes("general")) {
    return <MessageCircle className={className} />;
  }
  if (lowerName.includes("feedback") || lowerName.includes("suggestion")) {
    return <MessageCircle className={className} />;
  }
  if (lowerName.includes("announcement")) {
    return <Bell className={className} />;
  }

  return <Hash className={className} />;
}

interface AppSpace {
  id: number;
  founderId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  tagline: string | null;
}

function ChatRoomView({
  channel,
  appSpaceId,
  canChat,
  isSpectator,
  canAccessLocked,
  onJoinWaitlist,
}: {
  channel: RealChannel;
  appSpaceId: number;
  canChat: boolean;
  isSpectator: boolean;
  canAccessLocked: boolean;
  onJoinWaitlist: () => void;
}) {
  const { user } = useAuth();
  const { messages, sendMessage, connected, joinChannel, leaveChannel, currentChannelId, loadMessages } = useChat();
  const [newMessageText, setNewMessageText] = useState("");
  const [publicMessages, setPublicMessages] = useState<any[]>([]);
  const [isLoadingPublicMessages, setIsLoadingPublicMessages] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Spectators do not have a websocket session (server disconnects unauthenticated sockets),
    // so we fetch a public read-only message preview over HTTP.
    if (channel.id && isSpectator) {
      setIsLoadingPublicMessages(true);
      fetch(`/api/channels/${channel.id}/messages/public?limit=50`, { credentials: "include" })
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to load public messages");
          return res.json();
        })
        .then((data) => {
          if (!cancelled) setPublicMessages(data.messages || []);
        })
        .catch((error) => {
          console.error("[ChatRoomView] Failed to load public messages:", error);
          if (!cancelled) setPublicMessages([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoadingPublicMessages(false);
        });
      return () => {
        cancelled = true;
      };
    }

    // Authenticated users use websocket + regular message history endpoint.
    if (channel.id && appSpaceId && !isSpectator) {
      joinChannel(channel.id, appSpaceId);
      loadMessages(channel.id);
      return () => leaveChannel();
    }

    return () => {
      cancelled = true;
    };
  }, [channel.id, appSpaceId, joinChannel, leaveChannel, isSpectator, loadMessages]);

  const handleSendMessage = () => {
    if (!newMessageText.trim() || !canChat) return;
    sendMessage(newMessageText.trim());
    setNewMessageText("");
  };

  // Only show messages if we're in the current channel
  const channelMessages = currentChannelId === channel.id ? messages : [];
  const effectiveMessages = isSpectator ? publicMessages : channelMessages;

  // Check if user can access this channel
  const isLockedChannel = channel.isLocked && !channel.isWaitlistersOnly;
  const canViewChannel = !isLockedChannel || canAccessLocked;

  if (!canViewChannel) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Lock className="h-12 w-12 text-yellow-500/30 mb-4" />
        <h3 className="text-lg font-medium text-white/50 mb-2">Members Only</h3>
        <p className="text-sm text-white/60">
          Sorry you must be accepted into the app in order to access this channel
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isSpectator && isLoadingPublicMessages ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        ) : effectiveMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Hash className="h-12 w-12 text-white/10 mb-3" />
            <p className="text-white/55">No messages yet</p>
            {canChat && (
              <p className="text-white/40 text-sm mt-1">Be the first to say something!</p>
            )}
          </div>
        ) : (
          effectiveMessages.map((msg: any) => (
            <div key={msg.id} className="flex gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                {msg.user?.avatarUrl ? (
                  <AvatarImage src={msg.user.avatarUrl} alt={msg.user.displayName || msg.user.username} />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-amber-500/20 via-pink-500/20 to-violet-500/20">
                  <User className="h-5 w-5 text-white/50" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-white/90">
                    {msg.user?.displayName || msg.user?.username || "Anonymous"}
                  </span>
                  <span className="text-xs text-white/45">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-white/70">{msg.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-white/[0.08] p-4 bg-black">
        {canChat && canViewChannel ? (
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder={`Message #${channel.name}...`}
              className="flex-1 h-11 px-4 rounded-lg bg-white/5 border border-white/[0.08] text-white/90 placeholder:text-white/45 focus:outline-none focus:border-white/20 transition-colors"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessageText.trim()}
              className="h-11 w-11 p-0 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : isSpectator ? (
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl px-4 py-3 text-white/65 flex items-center justify-between">
            <span>Join the waitlist to chat...</span>
            <button
              onClick={onJoinWaitlist}
              className="bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 hover:opacity-90 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-opacity"
            >
              Join Waitlist
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertCircle className="h-5 w-5 text-yellow-400 shrink-0" />
            <p className="text-sm text-yellow-200/80">
              You can view messages while on the waitlist. Chat will be available once you're approved.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Convert access level to user status for badge
function getStatusFromAccessLevel(level: string, isFounder: boolean): "owner" | "member" | "waitlist" | null {
  if (isFounder) return "owner";
  if (level === "approved") return "member";
  if (level === "pending") return "waitlist";
  return null;
}

// Inner content component for a single community page
function SpaceCommunityContent() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [, setLocation] = useLocation();
  const { user, openPhoneAuthModal } = useAuth();
  const queryClient = useQueryClient();
  const [selectedChannel, setSelectedChannel] = useState<RealChannel | null>(null);
  const [isMembersPanelCollapsed, setIsMembersPanelCollapsed] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Get unread counts from chat context
  const { unreadCounts, loadUnreadCounts, markChannelAsRead } = useChat();

  // Use layout context
  const { setViewMode, setActiveCommunityId } = useLayout();
  const { communities } = useUserCommunities();

  // Fetch app space data
  const {
    data: appSpaceData,
    isLoading: isLoadingAppSpace,
    error: appSpaceError,
    refetch: refetchAppSpace,
    isFetching: isRefetchingAppSpace,
  } = useQuery<{ appSpace: AppSpace }>({
    queryKey: ["appspace", slug, "public"],
    queryFn: async () => {
      const res = await fetch(`/api/appspaces/${slug}/public`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load app space");
      return res.json();
    },
    enabled: !!slug,
  });

  const appSpace = appSpaceData?.appSpace;

  // Set view mode and active community when page loads
  useEffect(() => {
    if (appSpace) {
      setViewMode("community");
      setActiveCommunityId(appSpace.id);
    }
  }, [appSpace, setViewMode, setActiveCommunityId]);

  // Load unread counts when app space is available
  useEffect(() => {
    if (appSpace?.id && user) {
      loadUnreadCounts(appSpace.id);
    }
  }, [appSpace?.id, user, loadUnreadCounts]);

  // Use access level hook
  const { level, canChat, canAccessLocked, memberStatus } = useAccessLevel(appSpace?.id || null);

  // Fetch channels
  const { data: channelsData, isLoading: isLoadingChannels } = useQuery<{
    channels: RealChannel[];
    memberStatus: string | null;
    isFounder: boolean;
  }>({
    queryKey: ["channels", appSpace?.id, user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/appspaces/${appSpace?.id}/channels`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load channels");
      return res.json();
    },
    enabled: !!appSpace?.id,
  });

  const channels = channelsData?.channels || [];
  const isFounder = channelsData?.isFounder || false;

  // Check if user needs to complete survey
  const { data: surveyData } = useQuery({
    queryKey: ["survey-check", appSpace?.id, user?.id],
    queryFn: async () => {
      // Fetch survey questions
      const questionsRes = await fetch(`/api/appspaces/${appSpace?.id}/survey`, {
        credentials: "include",
      });
      if (!questionsRes.ok) throw new Error("Failed to fetch survey");
      const { questions } = await questionsRes.json();
      return { questions, hasQuestions: questions.length > 0 };
    },
    enabled: !!appSpace?.id && !!user && (level === "pending" || level === "approved"),
  });

  // Check local storage for survey completion status
  useEffect(() => {
    if (appSpace?.id && user?.id) {
      const completionKey = `survey_completed_${appSpace.id}_${user.id}`;
      const completed = localStorage.getItem(completionKey) === "true";

      // Show survey modal if user is a member and hasn't completed it
      if (surveyData?.hasQuestions && !completed && (level === "pending" || level === "approved")) {
        setShowSurveyModal(true);
      }
    }
  }, [appSpace?.id, user?.id, surveyData, level]);

  const handleSurveyComplete = () => {
    if (appSpace?.id && user?.id) {
      const completionKey = `survey_completed_${appSpace.id}_${user.id}`;
      localStorage.setItem(completionKey, "true");
    }
    setShowSurveyModal(false);
  };

  // Auto-select first channel
  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      // Select first waitlist channel if user is pending, otherwise first available
      const waitlistChannels = channels.filter(c => c.isWaitlistersOnly);

      if (level === "pending" && waitlistChannels.length > 0) {
        setSelectedChannel(waitlistChannels[0]);
      } else if (waitlistChannels.length > 0) {
        setSelectedChannel(waitlistChannels[0]);
      } else if (channels.length > 0) {
        setSelectedChannel(channels[0]);
      }
    }
  }, [channels, selectedChannel, level]);

  if (isLoadingAppSpace) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (!appSpace) {
    console.error(`[SpaceCommunity] Failed to load appspace ${slug}`, appSpaceError);

    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-white/[0.03] p-6 text-center">
          <h1 className="mb-2 text-2xl font-bold text-white">Community Not Found</h1>
          <p className="mb-6 text-sm text-white/70">
            We couldn't load this community right now. You can retry or return home.
          </p>
          <div className="grid gap-3">
            <button
              onClick={() => refetchAppSpace()}
              disabled={isRefetchingAppSpace}
              className="h-11 rounded-lg bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isRefetchingAppSpace ? "Retrying..." : "Retry"}
            </button>
            <button
              onClick={() => setLocation("/explore")}
              className="h-11 rounded-lg border border-white/20 text-sm font-medium text-white/80 hover:bg-white/[0.05]"
            >
              Explore Communities
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isSpectator = level === "spectator";
  const userStatus = getStatusFromAccessLevel(level, isFounder);
  const liveChatWidgetEnabled = !!user && !!appSpace && !isFounder && level === "approved";

  const handleJoinWaitlist = async () => {
    if (!user) {
      if (appSpace) {
        openPhoneAuthModal(slug!, appSpace.id);
      }
      return;
    }
    await joinWaitlistAndRefresh();
  };

  const joinWaitlistAndRefresh = async () => {
    if (!appSpace) return;
    try {
      const res = await fetch(`/api/appspaces/${appSpace.id}/join`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to join");
      queryClient.invalidateQueries({ queryKey: ["channels", appSpace.id, user?.id] });
    } catch (error) {
      console.error("Failed to join waitlist:", error);
    }
  };

  const handleChannelSelect = (channel: RealChannel) => {
    setSelectedChannel(channel);
    // Mark channel as read when selected
    if (user) {
      markChannelAsRead(channel.id);
    }
  };

  const handleCommunityClick = (community: { id: number; slug: string }) => {
    setLocation(`/space/${community.slug}/community`);
  };

  // Separate channels into community, waitlist, and members-only.
  // Community channels are public/unlocked and should show up for spectators (read-only preview).
  const communityChannels = channels.filter(c => !c.isLocked && !c.isWaitlistersOnly);
  const waitlistChannels = channels.filter(c => c.isWaitlistersOnly);
  const membersOnlyChannels = channels.filter(c => c.isLocked && !c.isWaitlistersOnly);

  // Build ContextPanel content
  const contextPanelContent = (
    <>
      {isLoadingChannels ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-white/50" />
        </div>
      ) : channels.length === 0 ? (
        <div className="text-center py-8 px-4">
          <p className="text-sm text-white/55">No channels available</p>
        </div>
      ) : (
        <>
          {/* Community Channels Section */}
          {communityChannels.length > 0 && (
            <>
              <SectionHeader title="Community" />
              {communityChannels.map((channel) => {
                const channelUnread = unreadCounts[channel.id] || 0;
                const isActive = selectedChannel?.id === channel.id;
                return (
                  <div
                    key={channel.id}
                    onClick={() => handleChannelSelect(channel)}
                    className={`flex items-center gap-2 h-11 px-2 rounded-lg cursor-pointer transition-all duration-200 group ${
                      isActive
                        ? "bg-white/[0.08] text-white/90"
                        : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <ChannelIcon
                      name={channel.name}
                      className={`h-4 w-4 ${isActive ? "text-white/90" : "text-white/45"}`}
                    />
                    <span
                      className={`flex-1 text-sm ${
                        isActive
                          ? "text-white/90 font-medium"
                          : "text-white/50 group-hover:text-white/70"
                      }`}
                    >
                      {channel.name}
                    </span>
                    {channelUnread > 0 && !isActive ? (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                        {channelUnread > 99 ? "99+" : channelUnread}
                      </span>
                    ) : isActive ? (
                      <div className="w-2 h-2 rounded-full bg-white/60" />
                    ) : null}
                  </div>
                );
              })}
            </>
          )}

          {/* Waitlist Channels Section */}
          {waitlistChannels.length > 0 && (
            <>
              <SectionHeader title="Waitlist" variant="waitlist" />
              {waitlistChannels.map((channel) => {
                const channelUnread = unreadCounts[channel.id] || 0;
                const isActive = selectedChannel?.id === channel.id;
                return (
                  <div
                    key={channel.id}
                    onClick={() => handleChannelSelect(channel)}
                    className={`flex items-center gap-2 h-11 px-2 rounded-lg cursor-pointer transition-all duration-200 group ${
                      isActive
                        ? "bg-amber-500/15 border-l-2 border-amber-400 text-amber-300"
                        : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <ChannelIcon
                      name={channel.name}
                      className={`h-4 w-4 ${
                        isActive ? "text-amber-300" : "text-white/45"
                      }`}
                    />
                    <span
                      className={`flex-1 text-sm ${
                        isActive
                          ? "text-amber-300 font-medium"
                          : "text-white/50 group-hover:text-white/70"
                      }`}
                    >
                      {channel.name}
                    </span>
                    {channelUnread > 0 && !isActive ? (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                        {channelUnread > 99 ? "99+" : channelUnread}
                      </span>
                    ) : isActive ? (
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                    ) : null}
                  </div>
                );
              })}
            </>
          )}

          {/* Members Only Section */}
          {membersOnlyChannels.length > 0 && (
            <>
              <SectionHeader
                title="Members Only"
                icon={<Lock className="w-3 h-3" />}
              />
              {membersOnlyChannels.map((channel) => {
                const channelUnread = unreadCounts[channel.id] || 0;
                const isActive = selectedChannel?.id === channel.id;
                return (
                  <div
                    key={channel.id}
                    onClick={() => handleChannelSelect(channel)}
                    className={`flex items-center gap-2 h-11 px-2 rounded-lg cursor-pointer transition-all duration-200 group ${
                      isActive
                        ? "bg-white/[0.08] text-white/90"
                        : "hover:bg-white/[0.04]"
                    } ${!canAccessLocked ? "opacity-60" : ""}`}
                    title={!canAccessLocked ? "This channel unlocks when you're approved" : undefined}
                  >
                    <ChannelIcon
                      name={channel.name}
                      className={`h-4 w-4 ${
                        isActive ? "text-white/90" : "text-white/45"
                      }`}
                    />
                    <span
                      className={`flex-1 text-sm ${
                        isActive
                          ? "text-white/90 font-medium"
                          : "text-white/50 group-hover:text-white/70"
                      }`}
                    >
                      {channel.name}
                    </span>
                    {!canAccessLocked ? (
                      <Lock className="h-3.5 w-3.5 text-yellow-500" />
                    ) : channelUnread > 0 && !isActive ? (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                        {channelUnread > 99 ? "99+" : channelUnread}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </>
  );

  // Context panel footer with status
  const contextPanelFooter = (
    <>
      {isSpectator && (
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <Clock className="h-4 w-4 text-violet-400" />
          <span className="text-xs text-violet-200/70">Spectator mode</span>
        </div>
      )}
      {memberStatus === "pending" && !isSpectator && (
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <Clock className="h-4 w-4 text-yellow-400" />
          <span className="text-xs text-yellow-200/70">On Waitlist</span>
        </div>
      )}
    </>
  );

  return (
    <>
      <AppLayout
        communities={communities}
        onCommunityClick={handleCommunityClick}
        mobileContextContent={contextPanelContent}
        contextPanel={
          <ContextPanel
            title={appSpace.name}
            logoUrl={appSpace.logoUrl}
            userStatus={userStatus}
            footer={contextPanelFooter}
            width="wide"
          >
            {contextPanelContent}
          </ContextPanel>
        }
      >
        <MainPane
          mobileTitle={selectedChannel?.name || appSpace.name}
          noPadding
          header={
            <div className="flex items-center justify-between w-full">
              {selectedChannel ? (
                <HeaderTitle
                  icon={<Hash className="h-4 w-4" />}
                  title={selectedChannel.name}
                  subtitle={selectedChannel.description || undefined}
                />
              ) : (
                <HeaderTitle title="Select a channel" />
              )}
              {/* Search Button */}
              <button
                onClick={() => setShowSearchModal(true)}
                className="flex items-center justify-center h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/70 transition-all"
                title="Search messages"
              >
                <Search className="h-4 w-4" />
              </button>
              {/* Founder Tools Button */}
              {isFounder && (
                <button
                  onClick={() => setLocation(`/space/${slug}/founder-tools`)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-violet-500/20 border border-amber-500/30 hover:border-amber-500/50 text-amber-300 hover:text-amber-200 text-sm font-medium transition-all"
                >
                  <Settings2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Manage Community</span>
                </button>
              )}
            </div>
          }
        >
          {selectedChannel ? (
            <ChatRoomView
              channel={selectedChannel}
              appSpaceId={appSpace.id}
              canChat={canChat && (!selectedChannel.isLocked || canAccessLocked)}
              isSpectator={isSpectator}
              canAccessLocked={canAccessLocked}
              onJoinWaitlist={handleJoinWaitlist}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-white/60">Select a channel to view messages</p>
            </div>
          )}
        </MainPane>

        {/* Member List Sidebar */}
        {appSpace && (
          <MemberListPanel
            appSpaceId={appSpace.id}
            founderId={appSpace.founderId}
            collapsed={isMembersPanelCollapsed}
            onToggleCollapsed={() => setIsMembersPanelCollapsed((prev) => !prev)}
          />
        )}
      </AppLayout>

      {/* Survey Response Modal */}
      {appSpace && (
        <SurveyResponseModal
          appSpaceId={appSpace.id}
          appSpaceName={appSpace.name}
          open={showSurveyModal}
          onComplete={handleSurveyComplete}
        />
      )}

      {/* Message Search Modal */}
      {appSpace && (
        <MessageSearch
          appSpaceId={appSpace.id}
          open={showSearchModal}
          onOpenChange={setShowSearchModal}
          onMessageClick={(channelId) => {
            // Find and select the channel
            const channel = channels.find(c => c.id === channelId);
            if (channel) {
              setSelectedChannel(channel);
            }
            setShowSearchModal(false);
          }}
        />
      )}

      {appSpace && (
        <LiveChatWidget
          appSpaceId={appSpace.id}
          enabled={liveChatWidgetEnabled}
        />
      )}
    </>
  );
}

export default function SpaceCommunityPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  // Fetch app space to get the ID
  const {
    data: appSpaceData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<{ appSpace: AppSpace }>({
    queryKey: ["appspace", slug, "public"],
    queryFn: async () => {
      const res = await fetch(`/api/appspaces/${slug}/public`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load app space");
      return res.json();
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (!appSpaceData?.appSpace) {
    console.error(`[SpaceCommunity] Failed to bootstrap appspace ${slug}`, error);

    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-white/[0.03] p-6 text-center">
          <h1 className="mb-2 text-2xl font-bold text-white">Community Not Found</h1>
          <p className="mb-6 text-sm text-white/70">
            This link might be outdated or the community may no longer exist.
          </p>
          <div className="grid gap-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-11 rounded-lg bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isFetching ? "Retrying..." : "Retry"}
            </button>
            <a
              href="/"
              className="h-11 rounded-lg border border-white/20 text-sm font-medium text-white/80 hover:bg-white/[0.05] flex items-center justify-center"
            >
              Go Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <SpaceCommunityContent />;
}
