import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import AppSpaceLandingPage from "@/components/AppSpaceLandingPage";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export default function SpaceLandingPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch public appSpace data
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["appspace", slug, "public"],
    queryFn: async () => {
      const res = await fetch(`/api/appspaces/${slug}/public`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!slug,
  });

  const appSpaceId = data?.appSpace?.id;

  // Check membership status if user is logged in and we have appSpaceId
  const { data: membershipData, isLoading: membershipLoading } = useQuery<{
    memberStatus: string | null;
    isFounder: boolean;
  }>({
    queryKey: ["membership", appSpaceId, user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/channels`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch membership");
      return res.json();
    },
    enabled: !!appSpaceId && !!user,
  });

  // Redirect members to community page
  useEffect(() => {
    if (!membershipData || !slug) return;

    const { memberStatus, isFounder } = membershipData;
    const isMember = isFounder || memberStatus === "approved" || memberStatus === "pending";

    if (isMember) {
      setLocation(`/space/${slug}/community`);
    }
  }, [membershipData, slug, setLocation]);

  // Show loading while fetching appSpace, auth, or membership data
  const isCheckingAccess = isLoading || authLoading || (!!user && !!appSpaceId && membershipLoading);

  if (isCheckingAccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (error || !data) {
    console.error(`[SpaceLanding] Failed to load appspace ${slug}`, error);

    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-white/[0.03] p-6 text-center">
          <h1 className="mb-2 text-2xl font-bold text-white">AppSpace Not Found</h1>
          <p className="mb-6 text-sm text-white/70">
            We couldn't find this waitlist page. It may have moved or been removed.
          </p>
          <div className="grid gap-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-11 rounded-lg bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isFetching ? "Retrying..." : "Retry"}
            </button>
            <button
              onClick={() => setLocation("/explore")}
              className="h-11 rounded-lg border border-white/20 text-sm font-medium text-white/80 hover:bg-white/[0.05]"
            >
              Explore Communities
            </button>
            <button
              onClick={() => setLocation("/")}
              className="h-11 rounded-lg border border-white/20 text-sm font-medium text-white/80 hover:bg-white/[0.05]"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If user is a member, we're redirecting - show loading to prevent flash
  if (membershipData) {
    const { memberStatus, isFounder } = membershipData;
    const isMember = isFounder || memberStatus === "approved" || memberStatus === "pending";
    if (isMember) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      );
    }
  }

  return (
    <AppSpaceLandingPage
      appSpace={data.appSpace}
      activeUsers={data.activeUsers}
      waitlistUsers={data.waitlistUsers}
      stats={data.stats}
    />
  );
}
