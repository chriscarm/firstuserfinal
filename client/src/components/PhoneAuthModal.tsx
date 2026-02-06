import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Phone, CheckCircle, User, Upload, ArrowLeft, AtSign, Mail } from "lucide-react";

type AuthMethod = "phone" | "email";
type Step = "choice" | "phone" | "email" | "verify" | "profile" | "username";

interface PhoneAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appSpaceSlug: string | null;
  appSpaceId: number | null;
}

function PhoneAuthContent({
  appSpaceSlug,
  appSpaceId,
  onClose,
  forcePhoneOnly = false,
}: {
  appSpaceSlug: string | null;
  appSpaceId: number | null;
  onClose: () => void;
  forcePhoneOnly?: boolean; // When true, skip choice step and go straight to phone (for community creation)
}) {
  const [, setLocation] = useLocation();
  const { setUser, pendingRedirectUrl, clearPendingRedirectUrl } = useAuth();
  const queryClient = useQueryClient();
  const [authMethod, setAuthMethod] = useState<AuthMethod>("phone");
  const [step, setStep] = useState<Step>(forcePhoneOnly ? "phone" : "choice");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [username, setUsername] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Debounced username availability check
  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    // Validate format first
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameAvailable(false);
      return;
    }

    if (username.length > 20) {
      setUsernameAvailable(false);
      return;
    }

    setUsernameChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/username/check?username=${encodeURIComponent(username)}`);
        const data = await res.json();
        setUsernameAvailable(data.available);
      } catch (err) {
        setUsernameAvailable(null);
      } finally {
        setUsernameChecking(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [username]);

  // Send OTP mutation
  const sendOtpMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const res = await fetch("/api/auth/phone/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: phoneNumber }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to send code");
      }
      return res.json();
    },
    onSuccess: () => {
      setStep("verify");
      setResendCooldown(45);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Verify OTP mutation (phone)
  const verifyOtpMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch("/api/auth/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Verification failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const hasCompletedProfile =
        !!data.user.firstName &&
        !!data.user.lastName &&
        !!data.user.username;

      if (hasCompletedProfile) {
        handleJoinAndRedirect(data.user);
        return;
      }

      // Always show profile step for waitlist join flow
      // Pre-fill with existing data if available
      if (data.user.firstName) setFirstName(data.user.firstName);
      if (data.user.lastName) setLastName(data.user.lastName);
      if (data.user.avatarUrl) setAvatarUrl(data.user.avatarUrl);
      if (data.user.username) {
        setUsername(data.user.username);
        setUsernameAvailable(true);
      }
      setStep("profile");
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Send email OTP mutation
  const sendEmailOtpMutation = useMutation({
    mutationFn: async (emailAddress: string) => {
      const res = await fetch("/api/auth/email/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: emailAddress }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to send code");
      }
      return res.json();
    },
    onSuccess: () => {
      setStep("verify");
      setResendCooldown(45);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Verify email OTP mutation
  const verifyEmailOtpMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch("/api/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Verification failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const hasCompletedProfile =
        !!data.user.firstName &&
        !!data.user.lastName &&
        !!data.user.username;

      if (hasCompletedProfile) {
        handleJoinAndRedirect(data.user);
        return;
      }

      // Pre-fill with existing data if available
      if (data.user.firstName) setFirstName(data.user.firstName);
      if (data.user.lastName) setLastName(data.user.lastName);
      if (data.user.avatarUrl) setAvatarUrl(data.user.avatarUrl);
      if (data.user.username) {
        setUsername(data.user.username);
        setUsernameAvailable(true);
      }
      setStep("profile");
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Upload avatar mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload avatar");
      return res.json();
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; avatarUrl?: string }) => {
      const res = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          displayName: `${data.firstName} ${data.lastName}`,
          avatarUrl: data.avatarUrl,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to update profile");
      }
      return res.json();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Set username mutation
  const setUsernameMutation = useMutation({
    mutationFn: async (usernameValue: string) => {
      const res = await fetch("/api/auth/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: usernameValue }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to set username");
      }
      return res.json();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Join waitlist mutation
  const joinWaitlistMutation = useMutation({
    mutationFn: async (spaceId: number) => {
      const res = await fetch(`/api/appspaces/${spaceId}/join`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        // If already joined, treat as success
        if (data.message === "Already joined this waitlist") {
          return { alreadyJoined: true };
        }
        throw new Error(data.message || "Failed to join waitlist");
      }
      return res.json();
    },
  });

  const handleJoinAndRedirect = async (userData: any) => {
    if (appSpaceId) {
      try {
        await joinWaitlistMutation.mutateAsync(appSpaceId);
      } catch (err) {
        // Continue even if join fails (might already be a member)
        console.error("Join waitlist error:", err);
      }
    }

    // Set user in context
    setUser(userData);

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ["appspace"] });
    queryClient.invalidateQueries({ queryKey: ["channels"] });

    // Close modal and redirect
    const targetPath = pendingRedirectUrl
      ? pendingRedirectUrl
      : appSpaceSlug
        ? `/space/${appSpaceSlug}/community`
        : "/explore";

    clearPendingRedirectUrl();
    onClose();
    setLocation(targetPath);
  };

  const handleAuthMethodChoice = (method: AuthMethod) => {
    setAuthMethod(method);
    setStep(method);
    setError(null);
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError("Please enter your phone number");
      return;
    }
    sendOtpMutation.mutate(phone);
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    sendEmailOtpMutation.mutate(email);
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }
    if (authMethod === "email") {
      verifyEmailOtpMutation.mutate(otp);
    } else {
      verifyOtpMutation.mutate(otp);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your first and last name");
      return;
    }

    try {
      let finalAvatarUrl = avatarUrl;

      // Upload avatar if selected
      if (avatarFile) {
        const uploadResult = await uploadAvatarMutation.mutateAsync(avatarFile);
        finalAvatarUrl = uploadResult.url;
      }

      // Update profile
      await updateProfileMutation.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        avatarUrl: finalAvatarUrl || undefined,
      });

      // Move to username step
      setError(null);
      setStep("username");
    } catch (err) {
      console.error("Profile update error:", err);
    }
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }

    if (username.length < 3 || username.length > 20) {
      setError("Username must be 3-20 characters");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError("Only letters, numbers, and underscores allowed");
      return;
    }

    if (!usernameAvailable) {
      setError("This username is not available");
      return;
    }

    try {
      const result = await setUsernameMutation.mutateAsync(username.trim());

      // Join waitlist and redirect
      await handleJoinAndRedirect(result.user);
    } catch (err) {
      console.error("Username set error:", err);
    }
  };

  const handleResendCode = () => {
    if (resendCooldown === 0) {
      if (authMethod === "email") {
        sendEmailOtpMutation.mutate(email);
      } else {
        sendOtpMutation.mutate(phone);
      }
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError("Please select an image file");
        return;
      }
      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        setError("Image must be less than 5MB");
        return;
      }
      setError(null);
      setAvatarFile(file);
      // Revoke old Object URL to prevent memory leak
      if (avatarUrl && avatarUrl.startsWith('blob:')) {
        URL.revokeObjectURL(avatarUrl);
      }
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setAvatarUrl(previewUrl);
    }
  };

  const isLoading =
    sendOtpMutation.isPending ||
    verifyOtpMutation.isPending ||
    sendEmailOtpMutation.isPending ||
    verifyEmailOtpMutation.isPending ||
    updateProfileMutation.isPending ||
    uploadAvatarMutation.isPending ||
    setUsernameMutation.isPending ||
    joinWaitlistMutation.isPending;

  return (
    <div className="space-y-6 px-1">
      {/* Step 0: Auth Method Choice */}
      {step === "choice" && (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <p className="text-sm text-white/60">
              Choose how you'd like to verify your account
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => handleAuthMethodChoice("phone")}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-violet-500/50 hover:bg-white/[0.08] transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-white group-hover:text-white/90">Continue with Phone</h3>
                <p className="text-xs text-white/50">Receive a verification code via SMS</p>
              </div>
            </button>

            <button
              onClick={() => handleAuthMethodChoice("email")}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-violet-500/50 hover:bg-white/[0.08] transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-white group-hover:text-white/90">Continue with Email</h3>
                <p className="text-xs text-white/50">Receive a verification code via email</p>
              </div>
            </button>
          </div>

          <p className="text-xs text-white/40 text-center pt-2">
            Phone verification is required to create communities
          </p>
        </div>
      )}

      {/* Step 1a: Phone Input */}
      {step === "phone" && (
        <form onSubmit={handlePhoneSubmit} className="space-y-4">
          {!forcePhoneOnly && (
            <button
              type="button"
              onClick={() => setStep("choice")}
              className="flex items-center gap-1 text-sm text-white/60 hover:text-white mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}

          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center">
              <Phone className="w-8 h-8 text-white" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              autoFocus
            />
            <p className="text-xs text-white/50">
              We'll send you a verification code via SMS
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.9) 0%, rgba(236, 72, 153, 0.9) 50%, rgba(139, 92, 246, 0.9) 100%)' }} className="w-full hover:opacity-90"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Code"
            )}
          </Button>
        </form>
      )}

      {/* Step 1b: Email Input */}
      {step === "email" && (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <button
            type="button"
            onClick={() => setStep("choice")}
            className="flex items-center gap-1 text-sm text-white/60 hover:text-white mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <Mail className="w-8 h-8 text-white" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              autoFocus
            />
            <p className="text-xs text-white/50">
              We'll send you a verification code via email
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Code"
            )}
          </Button>
        </form>
      )}

      {/* Step 2: OTP Verification */}
      {step === "verify" && (
        <form onSubmit={handleVerifySubmit} className="space-y-4">
          <button
            type="button"
            onClick={() => setStep(authMethod)}
            className="flex items-center gap-1 text-sm text-white/60 hover:text-white mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex justify-center mb-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              authMethod === "email"
                ? "bg-gradient-to-br from-blue-600 to-cyan-500"
                : "bg-gradient-to-br from-violet-600 to-fuchsia-500"
            }`}>
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
          </div>

          <div className="text-center mb-4">
            <p className="text-sm text-white/60">
              Enter the 6-digit code sent to
            </p>
            <p className="font-medium text-white">{authMethod === "email" ? email : phone}</p>
          </div>

          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={setOtp}
              className="gap-2"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="bg-white/5 border-white/10 text-white" />
                <InputOTPSlot index={1} className="bg-white/5 border-white/10 text-white" />
                <InputOTPSlot index={2} className="bg-white/5 border-white/10 text-white" />
                <InputOTPSlot index={3} className="bg-white/5 border-white/10 text-white" />
                <InputOTPSlot index={4} className="bg-white/5 border-white/10 text-white" />
                <InputOTPSlot index={5} className="bg-white/5 border-white/10 text-white" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2 text-center">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isLoading || otp.length !== 6}
            style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.9) 0%, rgba(236, 72, 153, 0.9) 50%, rgba(139, 92, 246, 0.9) 100%)' }} className="w-full hover:opacity-90"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify"
            )}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resendCooldown > 0 || (authMethod === "email" ? sendEmailOtpMutation.isPending : sendOtpMutation.isPending)}
              className="text-sm text-violet-400 hover:text-violet-300 disabled:text-white/30 disabled:cursor-not-allowed"
            >
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : "Resend code"}
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Profile Completion */}
      {step === "profile" && (
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Avatar className="w-20 h-20 border-2 border-white/10">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt="Profile" />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
                  <User className="w-10 h-10 text-white/70" />
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-violet-600 hover:bg-violet-500 cursor-pointer flex items-center justify-center transition-colors"
              >
                <Upload className="w-4 h-4 text-white" />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="text-center mb-4">
            <p className="text-sm text-white/60">
              Complete your profile to join the waitlist
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.9) 0%, rgba(236, 72, 153, 0.9) 50%, rgba(139, 92, 246, 0.9) 100%)' }} className="w-full hover:opacity-90"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </form>
      )}

      {/* Step 4: Username Selection */}
      {step === "username" && (
        <form onSubmit={handleUsernameSubmit} className="space-y-4">
          <button
            type="button"
            onClick={() => setStep("profile")}
            className="flex items-center gap-1 text-sm text-white/60 hover:text-white mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center">
              <AtSign className="w-8 h-8 text-white" />
            </div>
          </div>

          <div className="text-center mb-4">
            <p className="text-sm text-white/60">
              Choose a unique username for your profile
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username *</Label>
            <div className="relative">
              <Input
                id="username"
                type="text"
                placeholder="johndoe"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className={`bg-white/5 border-white/10 text-white placeholder:text-white/40 pr-10 ${
                  username.length >= 3 && usernameAvailable === true
                    ? "border-green-500/50"
                    : username.length >= 3 && usernameAvailable === false
                    ? "border-red-500/50"
                    : ""
                }`}
                autoFocus
              />
              {usernameChecking && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 animate-spin text-white/50" />
                </div>
              )}
              {!usernameChecking && username.length >= 3 && usernameAvailable === true && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
              )}
            </div>
            <p className="text-xs text-white/50">
              3-20 characters, letters, numbers, and underscores only
            </p>
            {username.length > 0 && username.length < 3 && (
              <p className="text-xs text-amber-400">Username must be at least 3 characters</p>
            )}
            {username.length >= 3 && usernameAvailable === false && (
              <p className="text-xs text-red-400">This username is not available</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isLoading || !usernameAvailable || username.length < 3}
            style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.9) 0%, rgba(236, 72, 153, 0.9) 50%, rgba(139, 92, 246, 0.9) 100%)' }} className="w-full hover:opacity-90"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Completing...
              </>
            ) : (
              "Complete & Join Waitlist"
            )}
          </Button>
        </form>
      )}
    </div>
  );
}

export function PhoneAuthModal({
  open,
  onOpenChange,
  appSpaceSlug,
  appSpaceId,
  forcePhoneOnly = false,
}: PhoneAuthModalProps & { forcePhoneOnly?: boolean }) {
  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-black border-white/[0.08] text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-center">
            {forcePhoneOnly ? "Phone Verification Required" : "Join the Waitlist"}
          </DialogTitle>
          <DialogDescription className="text-center text-white/60">
            {forcePhoneOnly
              ? "Verify your phone to create a community"
              : "Verify your account to continue"}
          </DialogDescription>
        </DialogHeader>
        <PhoneAuthContent
          appSpaceSlug={appSpaceSlug}
          appSpaceId={appSpaceId}
          onClose={handleClose}
          forcePhoneOnly={forcePhoneOnly}
        />
      </DialogContent>
    </Dialog>
  );
}
