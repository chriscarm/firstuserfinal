import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Mail, MessageCircle, Plus } from "lucide-react";
import { AppLayout, ContextPanel, HeaderTitle, MainPane } from "@/components/layout";
import { useLayout } from "@/contexts/LayoutContext";
import { useUserCommunities } from "@/hooks/useUserCommunities";
import { DMChat, DMList, DMProvider } from "@/components/dm";

interface ChannelsMeta {
  memberStatus: "pending" | "approved" | null;
  isFounder: boolean;
}

function getUserStatus(memberStatus: ChannelsMeta["memberStatus"], isFounder: boolean) {
  if (isFounder) return "owner" as const;
  if (memberStatus === "approved") return "member" as const;
  if (memberStatus === "pending") return "waitlist" as const;
  return null;
}

export default function Messages() {
  const [, setLocation] = useLocation();
  const { communities, isLoading } = useUserCommunities();
  const { setViewMode } = useLayout();
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(null);

  useEffect(() => {
    setViewMode("messages");
  }, [setViewMode]);

  useEffect(() => {
    if (!communities.length) {
      setSelectedCommunityId(null);
      return;
    }

    if (selectedCommunityId && communities.some((community) => community.id === selectedCommunityId)) {
      return;
    }

    setSelectedCommunityId(communities[0].id);
  }, [communities, selectedCommunityId]);

  const selectedCommunity = useMemo(
    () => communities.find((community) => community.id === selectedCommunityId) ?? null,
    [communities, selectedCommunityId]
  );

  const { data: channelsMeta, isLoading: isLoadingMeta } = useQuery<ChannelsMeta>({
    queryKey: ["channels-meta", selectedCommunityId],
    queryFn: async () => {
      if (!selectedCommunityId) {
        return { memberStatus: null, isFounder: false };
      }

      const response = await fetch(`/api/appspaces/${selectedCommunityId}/channels`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load messaging permissions");
      }

      const data = await response.json();
      return {
        memberStatus: data.memberStatus ?? null,
        isFounder: !!data.isFounder,
      };
    },
    enabled: !!selectedCommunityId,
  });

  const canDM = !!channelsMeta && (channelsMeta.isFounder || channelsMeta.memberStatus === "approved");
  const effectiveCanDM = isLoadingMeta ? true : canDM;
  const statusBadge = getUserStatus(channelsMeta?.memberStatus ?? null, !!channelsMeta?.isFounder);

  const handleCommunityNav = (community: { id: number; slug: string }) => {
    setLocation(`/space/${community.slug}/community`);
  };

  const inboxContextContent = (
    <>
      <div className="space-y-2 px-1 pb-3">
        <label className="text-xs font-medium text-white/70">Community</label>
        <select
          value={selectedCommunityId ?? ""}
          onChange={(event) => setSelectedCommunityId(Number(event.target.value))}
          className="w-full h-11 rounded-lg bg-white/[0.04] border border-white/[0.12] px-3 text-sm text-white/90 focus:outline-none focus:border-violet-400/50"
          data-testid="messages-community-selector"
        >
          {communities.map((community) => (
            <option key={community.id} value={community.id} className="bg-black text-white">
              {community.name}
            </option>
          ))}
        </select>
      </div>

      {isLoadingMeta ? (
        <div className="px-3 py-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-white/50" />
        </div>
      ) : (
        <DMList canDM={canDM} />
      )}
    </>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (communities.length === 0) {
    return (
      <AppLayout communities={[]} showContextPanel={false}>
        <MainPane
          mobileTitle="Messages"
          header={(
            <HeaderTitle
              icon={<Mail className="h-5 w-5" />}
              title="Messages"
              subtitle="Direct conversations unlock once you join communities"
            />
          )}
        >
          <div className="max-w-lg mx-auto py-16 text-center">
            <MessageCircle className="h-14 w-14 mx-auto mb-5 text-white/40" />
            <h2 className="text-2xl font-display font-bold text-white mb-3">No communities yet</h2>
            <p className="text-white/70 mb-6">
              Join or create a community first, then your inbox will appear here.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/explore">
                <a className="inline-flex items-center justify-center h-11 px-5 rounded-lg border border-white/20 text-white/85 hover:bg-white/[0.04]">
                  Explore Communities
                </a>
              </Link>
              <Link href="/create">
                <a className="inline-flex items-center justify-center h-11 px-5 rounded-lg bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 text-white font-medium">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Community
                </a>
              </Link>
            </div>
          </div>
        </MainPane>
      </AppLayout>
    );
  }

  return (
    <DMProvider appSpaceId={selectedCommunityId}>
      <AppLayout
        communities={communities}
        onCommunityClick={(community) => handleCommunityNav(community)}
        mobileContextContent={inboxContextContent}
        contextPanel={
          <ContextPanel
            title="Messages"
            subtitle={selectedCommunity?.name || "Select community"}
            logoUrl={selectedCommunity?.logoUrl || null}
            userStatus={statusBadge}
            width="wide"
          >
            {inboxContextContent}
          </ContextPanel>
        }
      >
        <MainPane
          mobileTitle="Messages"
          noPadding
          header={(
            <HeaderTitle
              icon={<Mail className="h-5 w-5" />}
              title="Inbox"
              subtitle={selectedCommunity ? `Community: ${selectedCommunity.name}` : "Select a community"}
            />
          )}
        >
          <div className="h-full flex flex-col">
            {!isLoadingMeta && !canDM && selectedCommunity && (
              <div className="mx-4 mt-4 rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100/90">
                You can browse conversations now. Sending DMs unlocks after you are approved in this community.
              </div>
            )}
            <div className="flex-1 min-h-0">
              <DMChat canDM={effectiveCanDM} />
            </div>
          </div>
        </MainPane>
      </AppLayout>
    </DMProvider>
  );
}
