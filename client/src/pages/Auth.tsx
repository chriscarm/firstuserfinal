import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";

export default function Auth() {
  const { openAuthModal, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      setLocation("/explore");
    } else {
      openAuthModal();
    }
  }, [user, openAuthModal, setLocation]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 font-display text-4xl font-bold text-white md:text-5xl">
          Welcome to <span className="text-gradient">FirstUser</span>
        </h1>
        <p className="text-lg text-white/50">
          Join communities. Earn badges. Be legendary.
        </p>
      </div>
    </div>
  );
}
