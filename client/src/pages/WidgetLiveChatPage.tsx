import { useSearch } from "wouter";
import { Loader2 } from "lucide-react";
import { LiveChatWidget } from "@/components/live/LiveChatWidget";
import { useAuth } from "@/lib/auth";

export default function WidgetLiveChatPage() {
  const search = useSearch();
  const { user, loading } = useAuth();
  const params = new URLSearchParams(search);
  const appSpaceId = Number(params.get("appSpaceId"));

  if (loading) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center p-4">
        <p className="text-sm text-white/70 text-center">
          Chat session not ready. Please reopen this widget from your app.
        </p>
      </div>
    );
  }

  if (!Number.isInteger(appSpaceId) || appSpaceId <= 0) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center p-4">
        <p className="text-sm text-white/70 text-center">
          Invalid widget configuration.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black p-2">
      <LiveChatWidget appSpaceId={appSpaceId} enabled forceOpen embedded />
    </div>
  );
}
