import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Loader2, ArrowRight, Sparkles, AlertCircle } from "lucide-react";

interface JoinContextResponse {
  app: {
    publicAppId: string;
    appSpaceId: number;
    appSpaceSlug: string;
    appSpaceName: string;
    appSpaceTagline: string | null;
  };
  continueUrl: string;
  modes: {
    redirectEnabled: boolean;
    embeddedEnabled: boolean;
  };
}

export default function IntegrationJoinPage() {
  const params = useParams<{ publicAppId: string }>();
  const publicAppId = String(params?.publicAppId || "").trim();

  const joinQuery = useQuery<JoinContextResponse>({
    queryKey: ["integration-join-context", publicAppId],
    queryFn: async () => {
      const res = await fetch(`/api/integration/public/${publicAppId}/join-context`, {
        credentials: "include",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to load join flow");
      }
      return res.json();
    },
    enabled: !!publicAppId,
  });

  if (joinQuery.isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (joinQuery.isError || !joinQuery.data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center space-y-4">
          <AlertCircle className="h-8 w-8 text-amber-300 mx-auto" />
          <h1 className="text-xl font-semibold">Join Link Expired Or Invalid</h1>
          <p className="text-sm text-white/65">
            This join link may have expired. Ask the app founder for a fresh invite link.
          </p>
          <button
            onClick={() => joinQuery.refetch()}
            className="w-full h-11 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { app, continueUrl } = joinQuery.data;

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 space-y-5">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-violet-200 bg-violet-500/15 border border-violet-400/25 rounded-full px-3 py-1">
          <Sparkles className="h-3.5 w-3.5" />
          FirstUser Hosted Join
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{app.appSpaceName}</h1>
          <p className="text-sm text-white/70">
            {app.appSpaceTagline || "Join the waitlist in one simple flow."}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/70 space-y-2">
          <p>1. Verify your account.</p>
          <p>2. Join this app&apos;s waitlist and community.</p>
          <p>3. If approved, you&apos;ll receive one-click access.</p>
        </div>
        <button
          onClick={() => window.location.assign(continueUrl)}
          className="w-full h-11 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium inline-flex items-center justify-center gap-2"
        >
          Continue To Waitlist
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
