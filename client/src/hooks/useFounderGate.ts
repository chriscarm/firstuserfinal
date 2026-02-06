import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

export function useFounderGate() {
  const { user, openAuthModal } = useAuth();
  const [showGateModal, setShowGateModal] = useState(false);
  const [, navigate] = useLocation();

  const checkFounderAccess = (): boolean => {
    if (!user) {
      openAuthModal();
      return false;
    }
    if (!user.hasFounderAccess) {
      setShowGateModal(true);
      return false;
    }
    return true;
  };

  const handleCreateClick = () => {
    if (checkFounderAccess()) {
      navigate("/create");
    }
  };

  return {
    showGateModal,
    setShowGateModal,
    handleCreateClick,
    checkFounderAccess
  };
}
