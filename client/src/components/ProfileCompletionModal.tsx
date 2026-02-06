import { useState, useRef } from "react";
import { X, Upload, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function ProfileCompletionModal({
  isOpen,
  onClose,
  onComplete,
}: ProfileCompletionModalProps) {
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [title, setTitle] = useState(user?.title || "");
  const [linkedInUrl, setLinkedInUrl] = useState(user?.linkedInUrl || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let avatarUrl = user?.avatarUrl;

      // Upload avatar if new file selected
      if (avatarFile) {
        const formData = new FormData();
        formData.append("file", avatarFile);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (uploadRes.ok) {
          const uploadResult = await uploadRes.json();
          avatarUrl = uploadResult.url;
        }
      }

      // Update profile
      const profileRes = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          displayName: displayName || undefined,
          title: title || undefined,
          linkedInUrl: linkedInUrl || undefined,
          avatarUrl: avatarUrl || undefined,
        }),
      });

      if (profileRes.ok) {
        // Update local user state
        if (user) {
          setUser({
            ...user,
            displayName: displayName || user.displayName,
            title: title || user.title,
            linkedInUrl: linkedInUrl || user.linkedInUrl,
            avatarUrl: avatarUrl || user.avatarUrl,
          });
        }
        toast.success("Profile updated!");
        onComplete();
      } else {
        toast.error("Failed to update profile");
      }
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-0">
        <div className="glass-panel w-full max-w-md mx-auto md:rounded-2xl rounded-t-2xl md:relative fixed md:bottom-auto bottom-0 left-0 right-0">
          <div className="h-1 w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 md:rounded-t-2xl" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-white font-display">
                Complete Your Profile
              </h2>
              <p className="text-white/60">
                Add your photo and info so others can recognize you.
              </p>
            </div>

            {/* Avatar Upload */}
            <div className="flex justify-center">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative cursor-pointer group"
              >
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden group-hover:border-violet-500/50 transition-colors">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-white/30" />
                  )}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">
                  Display Name
                </label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your full name"
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">
                  Title (optional)
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Product Designer, Developer"
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">
                  LinkedIn URL (optional)
                </label>
                <Input
                  value={linkedInUrl}
                  onChange={(e) => setLinkedInUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className="glass-input"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full h-12 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Profile"
                )}
              </Button>
              <button
                onClick={handleSkip}
                disabled={isSaving}
                className="w-full py-3 rounded-xl font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
