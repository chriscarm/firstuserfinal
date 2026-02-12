import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, User, Camera, ArrowRight } from "lucide-react";

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [finalReturnUrl, setFinalReturnUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/");
      return;
    }

    if (!loading && user) {
      // Get returnTo from multiple sources (localStorage, URL query param, or session)
      const storedReturnUrl = localStorage.getItem("auth_return_url");
      const urlParams = new URLSearchParams(searchString);
      const queryReturnUrl = urlParams.get("returnTo");
      const isNewOnboarding = localStorage.getItem("needs_onboarding") === "true";
      
      // Use the best available returnTo URL
      const effectiveReturnUrl = storedReturnUrl || queryReturnUrl;
      
      if (effectiveReturnUrl) {
        setFinalReturnUrl(effectiveReturnUrl);
        setNeedsOnboarding(true);
        // Store in localStorage as backup
        localStorage.setItem("auth_return_url", effectiveReturnUrl);
        localStorage.setItem("needs_onboarding", "true");
      } else if (isNewOnboarding) {
        // Already in onboarding flow but no URL - still show form
        setNeedsOnboarding(true);
      } else {
        // No return URL and no onboarding flag - direct visit, redirect home
        setLocation("/");
        return;
      }
      
      // Pre-fill with existing data
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      if (user.avatarUrl) {
        setProfilePhotoPreview(user.avatarUrl);
      }
    }
  }, [user, loading, setLocation, searchString]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      let avatarUrl = user?.avatarUrl;
      
      if (profilePhoto) {
        const formData = new FormData();
        formData.append("file", profilePhoto);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          avatarUrl = data.url;
        }
      }
      
      // Update profile
      const res = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          displayName: `${firstName.trim()} ${lastName.trim()}`,
          avatarUrl,
        }),
      });
      
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: ["auth-user"] });
        
        // Use the finalReturnUrl we already have
        const targetUrl = finalReturnUrl || localStorage.getItem("auth_return_url");
        
        // Try to auto-join the waitlist if we're going to a community page
        if (targetUrl && targetUrl.includes("/space/") && targetUrl.includes("/community")) {
          // Extract slug from URL like /space/firstuser/community
          const match = targetUrl.match(/\/space\/([^/]+)\/community/);
          if (match) {
            const slug = match[1];
            // Get appspace ID from slug and join
            try {
              const appSpaceRes = await fetch(`/api/appspaces/${slug}/public`, {
                credentials: "include",
              });
              if (appSpaceRes.ok) {
                const appSpaceData = await appSpaceRes.json();
                // Join the waitlist
                await fetch(`/api/appspaces/${appSpaceData.appSpace.id}/join`, {
                  method: "POST",
                  credentials: "include",
                });
              }
            } catch (joinError) {
              console.error("Failed to auto-join waitlist:", joinError);
            }
          }
        }
        
        // Clear onboarding flags and redirect
        localStorage.removeItem("auth_return_url");
        localStorage.removeItem("needs_onboarding");
        setLocation(targetUrl || "/");
      }
    } catch (error) {
      console.error("Profile update failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!user || !needsOnboarding) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white/90 mb-2">Welcome to FirstUser!</h1>
          <p className="text-white/60">Complete your profile to join the community</p>
        </div>
        
        <form onSubmit={handleSubmit} className="bg-white/5 border border-violet-500/20 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex flex-col items-center mb-8">
            <label className="cursor-pointer group relative">
              <div className="w-28 h-28 rounded-full bg-white/10 border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden group-hover:border-violet-500 transition-colors">
                {profilePhotoPreview ? (
                  <img src={profilePhotoPreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-white/40" />
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center border-2 border-void">
                <Camera className="w-4 h-4 text-white" />
              </div>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handlePhotoChange}
                className="hidden" 
              />
            </label>
            <span className="text-xs text-white/40 mt-3">Add a photo (optional)</span>
          </div>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-sm text-white/60 block mb-2">First Name *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter your first name"
                required
                className="w-full bg-white/5 border border-violet-500/20 rounded-xl px-4 py-3 text-white/90 placeholder-white/30 focus:outline-none focus:border-violet-500 transition-colors"
                data-testid="input-first-name"
              />
            </div>
            <div>
              <label className="text-sm text-white/60 block mb-2">Last Name *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter your last name"
                required
                className="w-full bg-white/5 border border-violet-500/20 rounded-xl px-4 py-3 text-white/90 placeholder-white/30 focus:outline-none focus:border-violet-500 transition-colors"
                data-testid="input-last-name"
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={!firstName.trim() || !lastName.trim() || isSubmitting}
            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
            data-testid="button-complete-profile"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
