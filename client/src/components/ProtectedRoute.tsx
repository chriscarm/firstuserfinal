import { useEffect } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export function ProtectedRoute({
  children,
  requireFounder = false,
  requirePhoneVerified = false,
}: {
  children: React.ReactNode;
  requireFounder?: boolean;
  requirePhoneVerified?: boolean;
}) {
  const { user, loading, openAuthModal } = useAuth();
  const [location] = useLocation();

  // If user is not authenticated, open auth modal with current path as redirect
  useEffect(() => {
    if (!loading && !user) {
      openAuthModal(location);
    }
  }, [loading, user, location, openAuthModal]);

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!user) {
    // Show a minimal loading state while auth modal opens
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (requireFounder && !user.hasFounderAccess) {
    return <Redirect to="/dashboard" />;
  }

  // Check phone verification requirement (for /create route)
  if (requirePhoneVerified && !user.phoneVerified) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-violet-500/20 flex items-center justify-center">
            <Phone className="h-8 w-8 text-violet-400" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Phone Verification Required</h1>
          <p className="text-white/60">
            To create a waitlist, you need to verify your phone number. This helps us maintain a trusted creator community.
          </p>
          <div className="flex flex-col gap-3">
            <Link href="/settings">
              <Button className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600">
                Verify Phone in Settings
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" className="w-full text-white/60">
                Go to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
