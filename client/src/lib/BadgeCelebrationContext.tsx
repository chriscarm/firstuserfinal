import { createContext, useContext, useState, type ReactNode } from "react";
import { BadgeCelebrationModal } from "../components/BadgeCelebrationModal";
import { type BadgeTier } from "./badges";

interface BadgeCelebration {
  badgeTier: BadgeTier;
  appName: string;
  appLogo?: string;
  reward?: string;
}

interface BadgeCelebrationContextType {
  showCelebration: (celebration: BadgeCelebration) => void;
  hideCelebration: () => void;
}

const BadgeCelebrationContext = createContext<BadgeCelebrationContextType | null>(null);

export function BadgeCelebrationProvider({ children }: { children: ReactNode }) {
  const [celebration, setCelebration] = useState<BadgeCelebration | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const showCelebration = (data: BadgeCelebration) => {
    setCelebration(data);
    setIsOpen(true);
  };

  const hideCelebration = () => {
    setIsOpen(false);
    setTimeout(() => setCelebration(null), 300);
  };

  return (
    <BadgeCelebrationContext.Provider value={{ showCelebration, hideCelebration }}>
      {children}
      {celebration && (
        <BadgeCelebrationModal
          isOpen={isOpen}
          onClose={hideCelebration}
          badgeTier={celebration.badgeTier}
          appName={celebration.appName}
          appLogo={celebration.appLogo}
          reward={celebration.reward}
        />
      )}
    </BadgeCelebrationContext.Provider>
  );
}

export function useBadgeCelebration() {
  const context = useContext(BadgeCelebrationContext);
  if (!context) {
    throw new Error("useBadgeCelebration must be used within BadgeCelebrationProvider");
  }
  return context;
}
