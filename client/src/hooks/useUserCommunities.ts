import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

export interface UserCommunity {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  tagline: string | null;
  // Membership info
  isOwner: boolean;
  memberStatus: "approved" | "pending" | null;
}

interface UseUserCommunitiesResult {
  communities: UserCommunity[];
  ownedCommunities: UserCommunity[];
  joinedCommunities: UserCommunity[];
  isLoading: boolean;
  error: Error | null;
}

export function useUserCommunities(): UseUserCommunitiesResult {
  const { user } = useAuth();

  // Fetch user's own AppSpaces (communities they created)
  const {
    data: ownedData,
    isLoading: isLoadingOwned,
    error: ownedError,
  } = useQuery({
    queryKey: ["userAppSpaces"],
    queryFn: async () => {
      const res = await fetch("/api/users/me/appspaces", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch user AppSpaces");
      return res.json();
    },
    enabled: !!user,
  });

  // Fetch communities the user has joined (waitlist memberships)
  const {
    data: joinedData,
    isLoading: isLoadingJoined,
    error: joinedError,
  } = useQuery({
    queryKey: ["userMemberships"],
    queryFn: async () => {
      const res = await fetch("/api/users/me/memberships", { credentials: "include" });
      if (!res.ok) {
        // This endpoint might not exist yet, return empty
        if (res.status === 404) return { memberships: [] };
        throw new Error("Failed to fetch user memberships");
      }
      return res.json();
    },
    enabled: !!user,
  });

  const ownedAppSpaces = ownedData?.appSpaces || [];
  const joinedMemberships = joinedData?.memberships || [];

  // Transform owned communities
  const ownedCommunities: UserCommunity[] = ownedAppSpaces.map((space: any) => ({
    id: space.id,
    name: space.name,
    slug: space.slug,
    logoUrl: space.logoUrl,
    tagline: space.tagline,
    isOwner: true,
    memberStatus: null,
  }));

  // Transform joined communities (exclude owned ones)
  const ownedIds = new Set(ownedCommunities.map((c) => c.id));
  const joinedCommunities: UserCommunity[] = joinedMemberships
    .filter((m: any) => !ownedIds.has(m.appSpace?.id))
    .map((m: any) => ({
      id: m.appSpace?.id,
      name: m.appSpace?.name,
      slug: m.appSpace?.slug,
      logoUrl: m.appSpace?.logoUrl,
      tagline: m.appSpace?.tagline,
      isOwner: false,
      memberStatus: m.status as "approved" | "pending",
    }))
    .filter((c: UserCommunity) => c.id); // Filter out any with missing appSpace

  // Combine all communities (owned first, then joined)
  const communities = [...ownedCommunities, ...joinedCommunities];

  return {
    communities,
    ownedCommunities,
    joinedCommunities,
    isLoading: isLoadingOwned || isLoadingJoined,
    error: (ownedError || joinedError) as Error | null,
  };
}
