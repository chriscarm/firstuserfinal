import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { X, Phone, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);
  return matches;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const { openPhoneAuthModal, closeAuthModal, pendingRedirectUrl } = useAuth();

  const getAppSpaceSlugFromRedirect = (redirectUrl: string | null): string | null => {
    if (!redirectUrl) return null;
    const match = redirectUrl.match(/^\/space\/([^/]+)/);
    return match?.[1] || null;
  };

  const handleSignIn = () => {
    const slugFromRedirect = getAppSpaceSlugFromRedirect(pendingRedirectUrl);
    openPhoneAuthModal(slugFromRedirect, null);
    closeAuthModal(true);
  };

  const renderContent = () => (
    <div className="relative p-6">
      <button
        onClick={() => onOpenChange(false)}
        className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors"
        data-testid="button-close-auth"
      >
        <X className="w-4 h-4 text-white/70" />
      </button>

      <div className="text-center pt-4">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-display font-bold text-white mb-2">
          Welcome to FirstUser
        </h2>
        <p className="text-white/60 mb-6">
          Sign in to join communities, chat with founders, and get early access to amazing apps.
        </p>

        <Button
          onClick={handleSignIn}
          className="w-full h-12 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white font-medium"
        >
          <Phone className="w-4 h-4 mr-2" />
          Continue with Phone
        </Button>

        <p className="text-xs text-white/40 mt-4">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-[#0a0510] border-white/10">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Sign In</DrawerTitle>
            <DrawerDescription>Sign in to FirstUser</DrawerDescription>
          </DrawerHeader>
          <div className="pb-8">
            {renderContent()}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0510] border-white/10 sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Sign In</DialogTitle>
          <DialogDescription>Sign in to FirstUser</DialogDescription>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
