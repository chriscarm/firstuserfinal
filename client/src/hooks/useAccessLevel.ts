import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

export type AccessLevel = "spectator" | "pending" | "approved" | "founder";

interface UseAccessLevelResult {
  level: AccessLevel;
  canChat: boolean;
  canDM: boolean;
  canAccessLocked: boolean;
  isLoading: boolean;
  memberStatus: string | null;
}

export function useAccessLevel(appSpaceId: number | null): UseAccessLevelResult {
  const { user } = useAuth();

  // Fetch membership status for this app space
  const { data, isLoading } = useQuery<{
    channels: any[];
    memberStatus: string | null;
    isFounder: boolean;
  }>({
    queryKey: ["channels", appSpaceId, user?.id],
    queryFn: async () => {
      if (!appSpaceId) return { channels: [], memberStatus: null, isFounder: false };
      const res = await fetch(`/api/appspaces/${appSpaceId}/channels`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch channels");
      return res.json();
    },
    enabled: !!appSpaceId,
  });

  const result = useMemo((): UseAccessLevelResult => {
    if (isLoading) {
      return {
        level: "spectator",
        canChat: false,
        canDM: false,
        canAccessLocked: false,
        isLoading: true,
        memberStatus: null,
      };
    }

    // Not logged in = spectator
    if (!user) {
      return {
        level: "spectator",
        canChat: false,
        canDM: false,
        canAccessLocked: false,
        isLoading: false,
        memberStatus: null,
      };
    }

    const isFounder = data?.isFounder || false;
    const memberStatus = data?.memberStatus || null;

    // Founder has full access
    if (isFounder) {
      return {
        level: "founder",
        canChat: true,
        canDM: true,
        canAccessLocked: true,
        isLoading: false,
        memberStatus,
      };
    }

    // Approved member has full access
    if (memberStatus === "approved") {
      return {
        level: "approved",
        canChat: true,
        canDM: true,
        canAccessLocked: true,
        isLoading: false,
        memberStatus,
      };
    }

    // Pending member can chat in waitlist channels but not DM or access locked
    if (memberStatus === "pending") {
      return {
        level: "pending",
        canChat: true, // Can chat in waitlist channels
        canDM: false,
        canAccessLocked: false,
        isLoading: false,
        memberStatus,
      };
    }

    // Logged in but not a member = spectator with account
    return {
      level: "spectator",
      canChat: false,
      canDM: false,
      canAccessLocked: false,
      isLoading: false,
      memberStatus: null,
    };
  }, [user, data, isLoading]);

  return result;
}
