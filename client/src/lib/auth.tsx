import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";

export interface UserData {
  id: string;
  username: string | null;
  email: string | null;
  hasFounderAccess?: boolean;
  phone?: string | null;
  phoneVerified?: boolean;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  title?: string | null;
  linkedInUrl?: string | null;
}

interface PhoneAuthState {
  isOpen: boolean;
  appSpaceSlug: string | null;
  appSpaceId: number | null;
}

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  setUser: (userData: UserData | null) => void;
  logout: () => Promise<void>;
  isAuthModalOpen: boolean;
  openAuthModal: (redirectUrl?: string) => void;
  closeAuthModal: (preserveRedirect?: boolean) => void;
  pendingRedirectUrl: string | null;
  clearPendingRedirectUrl: () => void;
  // Phone auth modal state
  phoneAuthState: PhoneAuthState;
  openPhoneAuthModal: (appSpaceSlug?: string | null, appSpaceId?: number | null) => void;
  closePhoneAuthModal: (preserveRedirect?: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingRedirectUrl, setPendingRedirectUrl] = useState<string | null>(null);
  const [phoneAuthState, setPhoneAuthState] = useState<PhoneAuthState>({
    isOpen: false,
    appSpaceSlug: null,
    appSpaceId: null,
  });

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });
        if (res.ok) {
          const userData = await res.json();
          setUserState(userData);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  const setUser = useCallback((userData: UserData | null) => {
    setUserState(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      setUserState(null);
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
    }
  }, []);

  const openAuthModal = useCallback((redirectUrl?: string) => {
    if (redirectUrl && redirectUrl.trim()) {
      setPendingRedirectUrl(redirectUrl);
    } else {
      setPendingRedirectUrl(null);
    }
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback((preserveRedirect: boolean = false) => {
    setIsAuthModalOpen(false);
    if (!preserveRedirect) {
      setPendingRedirectUrl(null);
    }
  }, []);

  const clearPendingRedirectUrl = useCallback(() => {
    setPendingRedirectUrl(null);
  }, []);

  const openPhoneAuthModal = useCallback((appSpaceSlug?: string | null, appSpaceId?: number | null) => {
    setPhoneAuthState({
      isOpen: true,
      appSpaceSlug: appSpaceSlug ?? null,
      appSpaceId: appSpaceId ?? null,
    });
  }, []);

  const closePhoneAuthModal = useCallback((preserveRedirect: boolean = false) => {
    setPhoneAuthState({
      isOpen: false,
      appSpaceSlug: null,
      appSpaceId: null,
    });
    if (!preserveRedirect) {
      setPendingRedirectUrl(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        setUser,
        logout,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        pendingRedirectUrl,
        clearPendingRedirectUrl,
        phoneAuthState,
        openPhoneAuthModal,
        closePhoneAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
