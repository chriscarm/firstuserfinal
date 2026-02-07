import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AppSpaceLandingPage from "@/components/AppSpaceLandingPage";
import { Loader2 } from "lucide-react";
import { getHomepageAppSpaceSlug } from "@/lib/appConfig";

export default function FirstUserLandingPage() {
  const [, setLocation] = useLocation();
  const homepageSlug = getHomepageAppSpaceSlug();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["appspace", homepageSlug, "public"],
    queryFn: async () => {
      const res = await fetch(`/api/appspaces/${homepageSlug}/public`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (error || !data) {
    console.error("[Homepage] Failed to load landing appspace", error);

    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-white/[0.03] p-6 text-center">
          <h1 className="mb-2 text-2xl font-bold text-white">Home Is Taking A Break</h1>
          <p className="mb-6 text-sm text-white/70">
            We couldn't load the community homepage right now. You can retry or head to discover.
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
              Go To Discover
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppSpaceLandingPage
      appSpace={data.appSpace}
      activeUsers={data.activeUsers}
      waitlistUsers={data.waitlistUsers}
      stats={data.stats}
      goldenTicket={data.goldenTicket}
    />
  );
}
