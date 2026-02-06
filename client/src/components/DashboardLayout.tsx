import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { 
  Home, 
  Compass, 
  User, 
  Settings, 
  Wrench, 
  Menu, 
  X,
  Crown
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  founderOnly?: boolean;
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: <Home className="h-5 w-5" /> },
    { href: "/explore", label: "Explore", icon: <Compass className="h-5 w-5" /> },
    { href: "/profile", label: "Profile", icon: <User className="h-5 w-5" /> },
    { href: "/settings", label: "Settings", icon: <Settings className="h-5 w-5" /> },
    { href: "/founder-tools", label: "Founder Tools", icon: <Wrench className="h-5 w-5" />, founderOnly: true },
  ];

  const filteredNavItems = navItems.filter(
    item => !item.founderOnly || user?.hasFounderAccess
  );
  const userLabel = user?.username || user?.email || "User";
  const userInitial = user?.username?.[0] || user?.email?.[0] || "U";

  return (
    <div className="min-h-screen bg-void">
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-void/80 backdrop-blur-xl border-b border-violet-500/10 z-50 flex items-center justify-between px-4">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <Menu className="h-6 w-6 text-white" />
          )}
        </button>
        <span className="text-white font-medium">FirstUser</span>
        <div className="w-10" />
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-void/80 backdrop-blur-sm z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 z-50 transition-transform duration-300",
          "bg-void/60 backdrop-blur-xl border-r border-violet-500/10",
          "md:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full pt-14 md:pt-0">
          {/* Logo/Header */}
          <div className="h-14 flex items-center px-4 border-b border-white/10">
            <span className="text-lg font-semibold text-white">FirstUser</span>
            {user?.hasFounderAccess && (
              <div className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30">
                <Crown className="h-3 w-3 text-amber-400" />
                <span className="text-[10px] font-medium text-amber-400">FOUNDER</span>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-3 space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer",
                      isActive
                        ? "bg-violet-600/20 text-violet-400 border border-violet-500/30"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {item.icon}
                    <span className="font-medium">{item.label}</span>
                    {item.founderOnly && (
                      <Crown className="h-3.5 w-3.5 text-amber-400 ml-auto" />
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* User Info */}
          {user && (
            <div className="p-4 border-t border-white/10">
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                  {userInitial.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {userLabel}
                  </p>
                  {user.hasFounderAccess && (
                    <p className="text-xs text-amber-400">Founder Access</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:pl-64 pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
