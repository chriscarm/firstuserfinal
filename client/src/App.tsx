import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { BadgeCelebrationProvider } from "@/lib/BadgeCelebrationContext";
import { ChatProvider } from "@/components/chat";
import { NotificationProvider } from "@/components/notifications";
import { LayoutProvider } from "@/contexts/LayoutContext";
import { useUncelebratedBadges } from "@/hooks/useUncelebratedBadges";
import { AuthModal } from "@/components/AuthModal";
import { PhoneAuthModal } from "@/components/PhoneAuthModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeModeSwitcher } from "@/components/ThemeModeSwitcher";
import { ThemeProvider, useThemeMode } from "@/lib/theme";
import NotFound from "@/pages/not-found";
import FirstUserLandingPage from "@/pages/FirstUserLandingPage";
import SpaceLandingPage from "@/pages/SpaceLandingPage";
import SpaceCommunityPage from "@/pages/SpaceCommunityPage";
import StyleGuide from "@/pages/StyleGuide";
import Explore from "@/pages/Explore";
import CreateSpace from "@/pages/CreateSpace";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import FounderToolsPage from "@/pages/FounderToolsPage";
import Messages from "@/pages/Messages";
import WidgetLiveChatPage from "@/pages/WidgetLiveChatPage";
import IntegrationJoinPage from "@/pages/IntegrationJoinPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={FirstUserLandingPage} />
      <Route path="/style-guide" component={StyleGuide} />
      <Route path="/explore" component={Explore} />
      <Route path="/join/:publicAppId" component={IntegrationJoinPage} />
      <Route path="/create">
        <ProtectedRoute requirePhoneVerified>
          <CreateSpace />
        </ProtectedRoute>
      </Route>
      <Route path="/space/:slug" component={SpaceLandingPage} />
      <Route path="/space/:slug/community" component={SpaceCommunityPage} />
      <Route path="/space/:slug/founder-tools">
        <ProtectedRoute requireFounder>
          <FounderToolsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/auth" component={Auth} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/founder-tools">
        <ProtectedRoute requireFounder>
          <FounderToolsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/messages">
        <ProtectedRoute>
          <Messages />
        </ProtectedRoute>
      </Route>
      <Route path="/widget/live-chat" component={WidgetLiveChatPage} />
      <Route path="/profile">
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthModalOpen, closeAuthModal, phoneAuthState, closePhoneAuthModal } = useAuth();
  const { mode } = useThemeMode();
  useUncelebratedBadges();

  return (
    <>
      <SonnerToaster position="top-center" theme={mode === "light" ? "light" : "dark"} />
      <Router />
      <ThemeModeSwitcher />
      <AuthModal
        open={isAuthModalOpen}
        onOpenChange={(open) => {
          if (!open) closeAuthModal();
        }}
      />
      <PhoneAuthModal
        open={phoneAuthState.isOpen}
        onOpenChange={(open) => {
          if (!open) closePhoneAuthModal();
        }}
        appSpaceSlug={phoneAuthState.appSpaceSlug}
        appSpaceId={phoneAuthState.appSpaceId}
      />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ChatProvider>
            <NotificationProvider>
              <LayoutProvider>
                <BadgeCelebrationProvider>
                  <TooltipProvider>
                    <AppContent />
                  </TooltipProvider>
                </BadgeCelebrationProvider>
              </LayoutProvider>
            </NotificationProvider>
          </ChatProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
