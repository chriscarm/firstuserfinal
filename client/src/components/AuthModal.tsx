import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Phone, Sparkles } from "lucide-react";
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

  const renderContent = (mobile: boolean) => (
    <div className={`relative ${mobile ? "px-5 pb-6 pt-4" : "px-7 pb-7 pt-6"}`}>
      <div className={`mx-auto max-w-[380px] text-center ${mobile ? "pt-8" : "pt-7"}`}>
        <div className={`mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-[0_8px_24px_rgba(139,92,246,0.28)] ${mobile ? "mb-5 h-16 w-16" : "mb-5 h-[72px] w-[72px]"}`}>
          <Sparkles className={`${mobile ? "h-8 w-8" : "h-9 w-9"} text-white`} />
        </div>
        <h2 className={`font-display font-bold text-white tracking-tight ${mobile ? "text-[2rem] mb-2 leading-tight" : "text-[2.4rem] mb-3 leading-[1.08]"}`}>
          Welcome to FirstUser
        </h2>
        <p className={`${mobile ? "text-white/65 text-base mb-6 leading-relaxed max-w-[320px] mx-auto" : "text-white/65 text-[1.05rem] mb-7 leading-relaxed max-w-[350px] mx-auto"}`}>
          Sign in to join communities, chat with founders, and get early access to amazing apps.
        </p>

        <Button
          onClick={handleSignIn}
          className={`w-full rounded-xl bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 text-white font-semibold tracking-[0.01em] shadow-[0_10px_28px_rgba(236,72,153,0.26)] transition-all duration-200 hover:brightness-105 hover:shadow-[0_14px_30px_rgba(236,72,153,0.3)] ${mobile ? "h-12 text-base" : "h-12 text-base"}`}
        >
          <Phone className={`${mobile ? "h-4 w-4 mr-2.5" : "h-4 w-4 mr-2.5"}`} />
          Continue with Phone
        </Button>

        <p className={`${mobile ? "mt-4 text-xs leading-relaxed max-w-[320px] mx-auto text-white/45" : "mt-5 text-xs leading-relaxed max-w-[350px] mx-auto text-white/42"}`}>
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
          <div className="pb-5">
            {renderContent(true)}
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
        {renderContent(false)}
      </DialogContent>
    </Dialog>
  );
}
