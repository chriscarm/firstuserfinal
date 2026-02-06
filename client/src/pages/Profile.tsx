import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Award, MessageCircle, Users, Loader2, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { getBadgeTierFromPosition, getBadgeColors } from "@/lib/badges";

interface ProfileData {
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    hasFounderAccess: boolean;
    createdAt: string;
  };
  badges: Array<{
    id: number;
    customBadgeId: number;
    userId: string;
    awardedBy: string;
    reason: string | null;
    createdAt: string;
    badgeName: string;
    badgeIcon: string;
  }>;
  memberships: Array<{
    id: number;
    appSpaceId: number;
    position: number;
    status: string;
    joinedAt: string;
    appSpaceName: string;
    appSpaceSlug: string;
  }>;
}

export default function Profile() {
  const { user: authUser, loading: authLoading } = useAuth();

  const { data: profileData, isLoading: profileLoading } = useQuery<ProfileData>({
    queryKey: ["profile", authUser?.id],
    queryFn: async () => {
      const res = await fetch(`/api/users/${authUser!.id}/profile`);
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: !!authUser?.id,
  });

  const isLoading = authLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="relative min-h-screen bg-black overflow-hidden flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="relative min-h-screen bg-black overflow-hidden flex items-center justify-center">
        <p className="text-white/60">Please log in to view your profile.</p>
      </div>
    );
  }

  const user = profileData?.user;
  const badges = profileData?.badges || [];
  const memberships = profileData?.memberships || [];

  const memberSince = user?.createdAt 
    ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "Unknown";

  const stats = [
    { label: "Waitlists Joined", value: memberships.length, icon: Users },
    { label: "Badges Earned", value: badges.length, icon: Award },
    { label: "Messages Sent", value: 0, icon: MessageCircle },
  ];

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-6 pb-24">
        <Link href="/dashboard" data-testid="link-back">
          <button className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl text-white/50 transition-colors hover:bg-white/5">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>

        <div className="mb-8 flex flex-col items-center text-center">
          <div
            className="mb-4 h-32 w-32 rounded-lg bg-white/[0.02] border border-white/[0.08] flex items-center justify-center overflow-hidden"
            data-testid="img-avatar"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" />
            ) : (
              <User className="h-16 w-16 text-white/30" />
            )}
          </div>

          <div className="mb-2 flex items-center gap-2">
            <span className="text-xl font-bold text-white" data-testid="text-username">
              @{user?.username || "anonymous"}
            </span>
            {user?.hasFounderAccess && (
              <Badge variant="first" data-testid="badge-tier">Founder</Badge>
            )}
          </div>

          {memberships.length > 0 && (
            <p className="mb-1 text-sm text-white/60" data-testid="text-position">
              Position: #{memberships[0].position} on {memberships[0].appSpaceName}
            </p>
          )}
          <p className="mb-3 text-sm text-white/60" data-testid="text-member-since">
            Member since: {memberSince}
          </p>

          <Badge
            variant="active"
            className="px-3 py-1"
            data-testid="badge-status"
          >
            Active
          </Badge>
        </div>

        <div className="mb-8 grid grid-cols-3 gap-3">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="flex flex-col items-center rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-[20px]"
              data-testid={`card-stat-${index}`}
            >
              <stat.icon className="mb-2 h-5 w-5 text-white/50" />
              <span className="text-2xl font-bold text-white" data-testid={`text-stat-value-${index}`}>
                {stat.value}
              </span>
              <span className="text-center text-xs text-white/60">{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-white">Custom Badges</h2>
          {badges.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 backdrop-blur-[20px]">
              <Award className="mb-3 h-12 w-12 text-white/20" />
              <p className="text-white/60">No badges earned yet</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {badges.map((badge, index) => (
                <div
                  key={badge.id}
                  className="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-[20px]"
                  data-testid={`card-custom-badge-${index}`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/[0.05] text-2xl">
                    {badge.badgeIcon}
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-white">{badge.badgeName}</span>
                    {badge.reason && (
                      <p className="text-sm text-white/60">{badge.reason}</p>
                    )}
                    <p className="mt-1 text-xs text-white/40">
                      Earned {new Date(badge.createdAt).toLocaleDateString("en-US", { 
                        month: "short", 
                        day: "numeric", 
                        year: "numeric" 
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-white">Waitlist Memberships</h2>
          {memberships.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 backdrop-blur-[20px]">
              <Users className="mb-3 h-12 w-12 text-white/20" />
              <p className="text-white/60">No waitlists joined yet</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {memberships.map((membership, index) => {
                const tier = getBadgeTierFromPosition(membership.position);
                const tierColors = getBadgeColors(tier);

                return (
                  <Link
                    key={membership.id}
                    href={`/space/${membership.appSpaceSlug}`}
                    data-testid={`card-badge-${index}`}
                  >
                    <div className="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-[20px] transition-colors hover:bg-white/[0.04]">
                      <div className="h-12 w-12 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-lg font-bold text-white/70">
                        {membership.appSpaceName[0]?.toUpperCase() || '?'}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            {membership.appSpaceName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-white/60">
                          <span>#{membership.position}</span>
                          <span>·</span>
                          <Badge 
                            variant={tier === "first" ? "first" : tier === "silver" ? "silver" : tier === "bronze" ? "bronze" : "default"} 
                            className="text-[9px]"
                          >
                            {tierColors.label}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-white/40">
                          Joined {new Date(membership.joinedAt).toLocaleDateString("en-US", { 
                            month: "short", 
                            day: "numeric", 
                            year: "numeric" 
                          })}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <Button
          variant="outline"
          className="w-full"
          data-testid="button-edit-profile"
        >
          Edit Profile
        </Button>
      </div>
    </div>
  );
}
