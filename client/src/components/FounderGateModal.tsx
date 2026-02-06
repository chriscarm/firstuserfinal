import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface FounderGateModalProps {
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

export function FounderGateModal({ open, onOpenChange }: FounderGateModalProps) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [, navigate] = useLocation();

  const handleJoinWaitlist = () => {
    onOpenChange(false);
    navigate("/");
  };

  const handleMaybeLater = () => {
    onOpenChange(false);
  };

  const content = (
    <div className="space-y-6">
      <div className="h-1 w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full" />
      
      <div className="text-center text-4xl">
        😉
      </div>
      
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold text-white">
          We practice what we preach
        </h2>
        <p className="text-white/60 mt-3">
          FirstUser is built on FirstUser. Join our waitlist to get founder access — just like your future users will join yours.
        </p>
        <p className="text-white/40 text-sm mt-2">
          It only takes a minute. We'll notify you when you're in.
        </p>
      </div>
      
      <div className="flex flex-col gap-3">
        <Button
          onClick={handleJoinWaitlist}
          className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600"
        >
          Join the FirstUser Waitlist
        </Button>
        <Button
          onClick={handleMaybeLater}
          variant="ghost"
          className="w-full text-white/60 hover:text-white hover:bg-white/5"
        >
          Maybe Later
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-zinc-950 border-white/10">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Founder Access Required</DrawerTitle>
            <DrawerDescription>Join the waitlist to get founder access</DrawerDescription>
          </DrawerHeader>
          <div className="p-6 pb-10">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>Founder Access Required</DialogTitle>
          <DialogDescription>Join the waitlist to get founder access</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
