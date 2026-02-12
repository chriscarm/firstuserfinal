import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { ProfileCompletionModal } from "@/components/ProfileCompletionModal";
import { PhoneAuthModal } from "@/components/PhoneAuthModal";
import { AppLayout, MainPane, HeaderTitle } from "@/components/layout";
import { useUserCommunities } from "@/hooks/useUserCommunities";
import { useLayout } from "@/contexts/LayoutContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Check,
  ChevronDown,
  Upload,
  Image as ImageIcon,
  GripVertical,
  Pencil,
  Trash2,
  Plus,
  X,
  Copy,
  Share2,
  AlertTriangle,
  ArrowLeft,
  User,
  Crop as CropIcon,
  MessageSquare,
  Eye,
  Settings,
} from "lucide-react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

type QuestionType = "short_text" | "long_text" | "multiple_choice" | "checkbox" | "rating";

interface SurveyQuestion {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
}

interface BadgeTier {
  id: string;
  name: string;
  label: string;
  positions: string;
  color: string;
  reward: string;
  enabled: boolean;
  required: boolean;
}

interface Founder {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  photoUrl?: string;
  linkedInUrl?: string;
}

interface WizardData {
  name: string;
  slug: string;
  tagline: string;
  icon: string;
  category: string;
  logoFile: File | null;
  shortDescription: string;
  longDescription: string;
  coverImage: File | null;
  screenshots: (File | null)[];
  problemTitle: string;
  problemDescription: string;
  solutionTitle: string;
  solutionDescription: string;
  solutionPoints: string[];
  founders: Founder[];
  surveyQuestions: SurveyQuestion[];
  badges: BadgeTier[];
}

const STEPS = ["Basic Info", "Problem", "Solution", "Founders", "Survey", "Badges"];

// Community Templates
interface CommunityTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  problemTitle: string;
  problemDescription: string;
  solutionTitle: string;
  solutionDescription: string;
  solutionPoints: string[];
  surveyQuestions: SurveyQuestion[];
}

const TEMPLATES: CommunityTemplate[] = [
  {
    id: "tech-startup",
    name: "Tech Startup",
    icon: "🚀",
    description: "Launch your SaaS product with early adopters",
    category: "Developer Tools",
    problemTitle: "The Problem",
    problemDescription: "Building a product without user feedback leads to wasted resources and features nobody wants.",
    solutionTitle: "The Solution",
    solutionDescription: "We're building a solution that addresses real user needs, validated by our early community.",
    solutionPoints: ["Early access to beta", "Direct founder feedback channel", "Shape the product roadmap"],
    surveyQuestions: [
      { id: "q1", text: "What's your biggest pain point in this space?", type: "long_text", required: true },
      { id: "q2", text: "How much would you pay monthly for this solution?", type: "multiple_choice", required: true },
      { id: "q3", text: "What features are most important to you?", type: "checkbox", required: false },
    ],
  },
  {
    id: "creator-community",
    name: "Creator Community",
    icon: "🎨",
    description: "Build a community around your creative brand",
    category: "Community Tools",
    problemTitle: "The Challenge",
    problemDescription: "Creators struggle to build meaningful connections with their audience beyond social media likes.",
    solutionTitle: "Your Exclusive Community",
    solutionDescription: "Join a tight-knit community of supporters who get exclusive access and direct connection.",
    solutionPoints: ["Behind-the-scenes content", "Direct creator interaction", "Early access to new releases"],
    surveyQuestions: [
      { id: "q1", text: "How did you discover my content?", type: "short_text", required: true },
      { id: "q2", text: "What content do you want to see more of?", type: "long_text", required: true },
      { id: "q3", text: "How often do you engage with creator content?", type: "multiple_choice", required: false },
    ],
  },
  {
    id: "gaming",
    name: "Gaming Community",
    icon: "🎮",
    description: "Unite gamers around your game or brand",
    category: "Community Tools",
    problemTitle: "The Problem",
    problemDescription: "Gaming communities are scattered across platforms, making it hard to build a dedicated fanbase.",
    solutionTitle: "Your Gaming Hub",
    solutionDescription: "A central place for dedicated players to connect, compete, and get exclusive rewards.",
    solutionPoints: ["Exclusive in-game rewards", "Early access to updates", "Community tournaments"],
    surveyQuestions: [
      { id: "q1", text: "What's your favorite game genre?", type: "multiple_choice", required: true },
      { id: "q2", text: "How many hours per week do you game?", type: "rating", required: true },
      { id: "q3", text: "What features would make this community valuable?", type: "long_text", required: false },
    ],
  },
  {
    id: "education",
    name: "Course/Education",
    icon: "📚",
    description: "Build a learning community around your expertise",
    category: "Education",
    problemTitle: "The Learning Gap",
    problemDescription: "Online courses lack community and accountability, leading to high dropout rates.",
    solutionTitle: "Learn Together",
    solutionDescription: "A community-driven learning experience where students support each other and learn together.",
    solutionPoints: ["Access to premium content", "Live Q&A sessions", "Peer learning groups"],
    surveyQuestions: [
      { id: "q1", text: "What's your current skill level in this area?", type: "multiple_choice", required: true },
      { id: "q2", text: "What's your biggest learning challenge?", type: "long_text", required: true },
      { id: "q3", text: "How much time can you dedicate to learning weekly?", type: "multiple_choice", required: false },
    ],
  },
];

const CATEGORIES = [
  "Developer Tools",
  "Productivity",
  "Community Tools",
  "E-commerce",
  "Education",
  "Other",
];

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "checkbox", label: "Checkbox" },
  { value: "rating", label: "Rating (1-5)" },
];

const initialQuestions: SurveyQuestion[] = [
  {
    id: "q1",
    text: "What's your biggest challenge with content creation?",
    type: "short_text",
    required: true,
  },
  {
    id: "q2",
    text: "How many pieces of content do you create per week?",
    type: "multiple_choice",
    required: true,
  },
  {
    id: "q3",
    text: "What tools do you currently use?",
    type: "short_text",
    required: false,
  },
];

const initialBadges: BadgeTier[] = [
  {
    id: "first",
    name: "1st Place",
    label: "1st",
    positions: "Position #1",
    color: "#f59e0b",
    reward: "Lifetime Pro + 1-on-1 call with founder + name in credits",
    enabled: true,
    required: true,
  },
  {
    id: "top10",
    name: "Top 10",
    label: "10¹",
    positions: "Positions #2-10",
    color: "#94a3b8",
    reward: "Lifetime Pro + logo featured on website",
    enabled: true,
    required: true,
  },
  {
    id: "top100",
    name: "Top 100",
    label: "10²",
    positions: "Positions #11-100",
    color: "#b45309",
    reward: "Lifetime Pro access",
    enabled: true,
    required: false,
  },
  {
    id: "top1000",
    name: "Top 1,000",
    label: "10³",
    positions: "Positions #101-1,000",
    color: "#3b82f6",
    reward: "50% off first year",
    enabled: true,
    required: false,
  },
  {
    id: "top10000",
    name: "Top 10,000",
    label: "10⁴",
    positions: "Positions #1,001-10,000",
    color: "rgba(255,255,255,0.2)",
    reward: "",
    enabled: false,
    required: false,
  },
];

const initialFounders: Founder[] = [
  {
    id: "f1",
    firstName: "",
    lastName: "",
    title: "",
  },
];

export default function CreateSpace() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [showTemplateSelection, setShowTemplateSelection] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);

  // Check if user needs phone verification to create a community
  const needsPhoneVerification = user && !user.phoneVerified;
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState<Partial<SurveyQuestion>>({
    text: "",
    type: "short_text",
    required: false,
  });
  const [draggedQuestionId, setDraggedQuestionId] = useState<string | null>(null);
  const [newSolutionPoint, setNewSolutionPoint] = useState("");

  const [wizardData, setWizardData] = useState<WizardData>({
    name: "",
    slug: "",
    tagline: "",
    icon: "🚀",
    category: "",
    logoFile: null,
    shortDescription: "",
    longDescription: "",
    coverImage: null,
    screenshots: [null, null, null, null, null],
    problemTitle: "The Problem",
    problemDescription: "",
    solutionTitle: "The Solution",
    solutionDescription: "",
    solutionPoints: [],
    founders: initialFounders,
    surveyQuestions: initialQuestions,
    badges: initialBadges,
  });

  const takenSlugs = ["storyflow"];
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Layout and navigation hooks
  const { communities } = useUserCommunities();
  const { setViewMode, setActiveCommunityId } = useLayout();

  // Cropping state
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Draft auto-save state
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const draftLoadedRef = useRef(false);

  // Set discover view mode on mount
  useEffect(() => {
    setViewMode("discover");
  }, [setViewMode]);

  // Cleanup Object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  // Load existing draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      if (!user || draftLoadedRef.current) return;
      draftLoadedRef.current = true;

      try {
        const res = await fetch("/api/appspaces/draft", {
          credentials: "include",
        });
        if (res.ok) {
          const { draft } = await res.json();
          if (draft?.data) {
            // Restore wizard state from draft
            setWizardData(prev => ({
              ...prev,
              ...draft.data,
              // Don't restore file objects, they need to be re-uploaded
              logoFile: null,
              coverImage: null,
              screenshots: [null, null, null, null, null],
            }));
            if (draft.data.currentStep !== undefined) {
              setCurrentStep(draft.data.currentStep);
            }
            if (draft.data.logoPreview) {
              setLogoPreview(draft.data.logoPreview);
            }
            setHasDraft(true);
            setLastSaved(new Date(draft.updatedAt));
          }
        }
      } catch (error) {
        console.error("Failed to load draft:", error);
      }
    };

    loadDraft();
  }, [user]);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!user || showSuccess) return;

    const saveDraft = async () => {
      // Only save if there's meaningful data
      if (!wizardData.name && !wizardData.tagline && !wizardData.problemDescription) {
        return;
      }

      setIsSavingDraft(true);
      setDraftSaveError(null);
      try {
        const draftData = {
          ...wizardData,
          currentStep,
          logoPreview,
          // Don't save file objects
          logoFile: undefined,
          coverImage: undefined,
          screenshots: undefined,
        };

        const res = await fetch("/api/appspaces/draft", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: draftData }),
        });
        if (!res.ok) {
          throw new Error("Failed to save draft");
        }
        setHasDraft(true);
        setLastSaved(new Date());
      } catch (error) {
        console.error("Failed to save draft:", error);
        setDraftSaveError("Failed to save draft. Your progress may not be saved.");
      } finally {
        setIsSavingDraft(false);
      }
    };

    // Save immediately on meaningful changes, then every 30 seconds
    const timeoutId = setTimeout(saveDraft, 30000);

    return () => clearTimeout(timeoutId);
  }, [user, wizardData, currentStep, logoPreview, showSuccess]);

  // Delete draft
  const deleteDraft = useCallback(async () => {
    try {
      await fetch("/api/appspaces/draft", {
        method: "DELETE",
        credentials: "include",
      });
      setHasDraft(false);
      setLastSaved(null);
    } catch (error) {
      console.error("Failed to delete draft:", error);
    }
  }, []);

  // Create draft community object for NavRail preview
  const draftCommunity = {
    id: -1,  // Special ID for draft
    name: wizardData.name || "New",
    slug: "draft",
    logoUrl: logoPreview,
  };

  // Pre-populate the first founder with the current user's profile info
  useEffect(() => {
    if (user && wizardData.founders.length > 0 && !wizardData.founders[0].firstName) {
      setWizardData(prev => ({
        ...prev,
        founders: prev.founders.map((f, i) =>
          i === 0 ? {
            ...f,
            firstName: (user as any).firstName || "",
            lastName: (user as any).lastName || "",
            title: user.title || "",
            photoUrl: user.avatarUrl || undefined,
            linkedInUrl: user.linkedInUrl || undefined,
          } : f
        ),
      }));
    }
  }, [user]);

  // Initialize crop with centered square aspect ratio
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        1, // 1:1 aspect ratio for logo
        width,
        height
      ),
      width,
      height
    );
    setCrop(crop);
  }, []);

  // Generate cropped image from the completed crop
  const generateCroppedImage = useCallback(async () => {
    if (!completedCrop || !imageRef.current) return;

    const image = imageRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Set canvas size to the crop dimensions
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = completedCrop.width * scaleX * pixelRatio;
    canvas.height = completedCrop.height * scaleY * pixelRatio;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY
    );

    // Convert to blob and create file
    return new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, 'image/png', 1);
    });
  }, [completedCrop]);

  const handleLogoSelect = (file: File) => {
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result as string);
        setShowCropModal(true);
        setCrop(undefined);
        setCompletedCrop(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropConfirm = async () => {
    const croppedBlob = await generateCroppedImage();
    if (croppedBlob) {
      // Create a File from the blob for upload
      const croppedFile = new File([croppedBlob], 'logo.png', { type: 'image/png' });
      updateWizardData("logoFile", croppedFile);

      // Revoke old Object URL to prevent memory leak
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview);
      }

      // Create preview URL for display
      const previewUrl = URL.createObjectURL(croppedBlob);
      setLogoPreview(previewUrl);
    }
    setShowCropModal(false);
    setImageToCrop(null);
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    setImageToCrop(null);
    setCrop(undefined);
    setCompletedCrop(null);
    // Reset file input
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleLogoSelect(file);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleLogoSelect(file);
  };

  const isSlugTaken = takenSlugs.includes(wizardData.slug.toLowerCase());
  const isSlugValid = wizardData.slug.length > 0 && !isSlugTaken;

  const updateWizardData = <K extends keyof WizardData>(
    key: K,
    value: WizardData[K]
  ) => {
    setWizardData((prev) => ({ ...prev, [key]: value }));
  };

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
    setWizardData((prev) => ({ ...prev, name: name.slice(0, 50), slug }));
  };

  const handleSlugChange = (slug: string) => {
    const cleanSlug = slug
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "")
      .slice(0, 50);
    updateWizardData("slug", cleanSlug);
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0:
        return wizardData.name.length > 0 && isSlugValid;
      case 1:
        return true;
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Before final submission, check if profile needs completion
      if (user && (!user.avatarUrl || !user.displayName)) {
        setShowProfileCompletion(true);
        return;
      }
      handleLaunch();
    }
  };

  const handleProfileComplete = async () => {
    setShowProfileCompletion(false);

    // Fetch latest user data to get updated profile
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const updatedUser = await res.json();
        // Refresh founder data with updated user info
        setWizardData(prev => ({
          ...prev,
          founders: prev.founders.map((f, i) =>
            i === 0 ? {
              ...f,
              firstName: f.firstName || updatedUser.firstName || "",
              lastName: f.lastName || updatedUser.lastName || "",
              title: f.title || updatedUser.title || "",
              photoUrl: f.photoUrl || updatedUser.avatarUrl || undefined,
              linkedInUrl: f.linkedInUrl || updatedUser.linkedInUrl || undefined,
            } : f
          ),
        }));
      }
    } catch (error) {
      // Continue anyway
    }

    // After profile completion, proceed to launch
    handleLaunch();
  };

  // Apply template to wizard data
  const applyTemplate = (template: CommunityTemplate | null) => {
    if (template) {
      setWizardData(prev => ({
        ...prev,
        icon: template.icon,
        category: template.category,
        problemTitle: template.problemTitle,
        problemDescription: template.problemDescription,
        solutionTitle: template.solutionTitle,
        solutionDescription: template.solutionDescription,
        solutionPoints: template.solutionPoints,
        surveyQuestions: template.surveyQuestions,
      }));
    }
    setShowTemplateSelection(false);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    } else {
      // Go back to template selection
      setShowTemplateSelection(true);
    }
  };

  const handleLaunch = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Upload logo if provided
      let logoUrl = null;
      if (wizardData.logoFile) {
        const formData = new FormData();
        formData.append("file", wizardData.logoFile);

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload logo");
        }

        const uploadResult = await uploadResponse.json();
        logoUrl = uploadResult.url;
      }

      const submitData = {
        name: wizardData.name,
        slug: wizardData.slug,
        tagline: wizardData.tagline,
        description: wizardData.shortDescription || wizardData.tagline || "No description provided",
        icon: wizardData.icon,
        category: wizardData.category,
        logoUrl: logoUrl,
        problemTitle: wizardData.problemTitle,
        problemDescription: wizardData.problemDescription,
        solutionTitle: wizardData.solutionTitle,
        solutionDescription: wizardData.solutionDescription,
        solutionPoints: JSON.stringify(wizardData.solutionPoints),
        founders: JSON.stringify(wizardData.founders),
        tierRewards: JSON.stringify(wizardData.badges.filter(b => b.enabled).map(b => ({
          tier: b.label,
          label: b.name,
          reward: b.reward,
        }))),
      };

      const response = await fetch("/api/appspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create app space");
      }

      // Delete draft on successful creation
      await deleteDraft();
      setShowSuccess(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(`firstuser.co/${wizardData.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addQuestion = () => {
    if (!newQuestion.text) return;
    const question: SurveyQuestion = {
      id: `q${Date.now()}`,
      text: newQuestion.text,
      type: newQuestion.type || "short_text",
      required: newQuestion.required || false,
    };
    updateWizardData("surveyQuestions", [
      ...wizardData.surveyQuestions,
      question,
    ]);
    setNewQuestion({ text: "", type: "short_text", required: false });
    setIsAddingQuestion(false);
  };

  const updateQuestion = (id: string, updates: Partial<SurveyQuestion>) => {
    updateWizardData(
      "surveyQuestions",
      wizardData.surveyQuestions.map((q) =>
        q.id === id ? { ...q, ...updates } : q
      )
    );
  };

  const deleteQuestion = (id: string) => {
    updateWizardData(
      "surveyQuestions",
      wizardData.surveyQuestions.filter((q) => q.id !== id)
    );
  };

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    const questions = [...wizardData.surveyQuestions];
    const [removed] = questions.splice(fromIndex, 1);
    questions.splice(toIndex, 0, removed);
    updateWizardData("surveyQuestions", questions);
  };

  const updateBadge = (id: string, updates: Partial<BadgeTier>) => {
    updateWizardData(
      "badges",
      wizardData.badges.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
  };

  const getQuestionTypeLabel = (type: QuestionType) => {
    return QUESTION_TYPES.find((t) => t.value === type)?.label || type;
  };

  const addSolutionPoint = () => {
    if (!newSolutionPoint.trim()) return;
    updateWizardData("solutionPoints", [...wizardData.solutionPoints, newSolutionPoint.trim()]);
    setNewSolutionPoint("");
  };

  const removeSolutionPoint = (index: number) => {
    updateWizardData(
      "solutionPoints",
      wizardData.solutionPoints.filter((_, i) => i !== index)
    );
  };

  const updateFounder = (id: string, updates: Partial<Founder>) => {
    updateWizardData(
      "founders",
      wizardData.founders.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const addFounder = () => {
    const newFounder: Founder = {
      id: `f${Date.now()}`,
      firstName: (user as any)?.firstName || "",
      lastName: (user as any)?.lastName || "",
      title: user?.title || "",
      photoUrl: user?.avatarUrl || undefined,
      linkedInUrl: user?.linkedInUrl || undefined,
    };
    updateWizardData("founders", [...wizardData.founders, newFounder]);
  };

  const removeFounder = (id: string) => {
    if (wizardData.founders.length <= 1) return;
    updateWizardData(
      "founders",
      wizardData.founders.filter((f) => f.id !== id)
    );
  };

  // Handle community click from NavRail
  const handleCommunityClick = (community: { id: number; slug: string }) => {
    setViewMode("community");
    setActiveCommunityId(community.id);
    setLocation(`/space/${community.slug}/community`);
  };

  return (
    <>
      {/* Success Modal - Outside AppLayout so it can overlay everything */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-sm animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-10px`,
                  backgroundColor: ["#f59e0b", "#22c55e", "#7c3aed", "#d946ef", "#3b82f6"][
                    Math.floor(Math.random() * 5)
                  ],
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                }}
              />
            ))}
          </div>

          <div
            className="glass-panel p-8 max-w-lg w-full relative z-10"
            data-testid="modal-success"
          >
            <div className="text-center mb-6">
              <h2 className="text-3xl font-display font-bold text-white/90 mb-2">
                Your AppSpace is Live!
              </h2>
              <p className="text-white/60">
                Here's what to do next to get your community started.
              </p>
            </div>

            {/* Community URL */}
            <div className="glass-panel p-4 mb-6 flex items-center justify-between gap-3">
              <span className="text-white/90 font-mono text-sm truncate">
                firstuser.co/{wizardData.slug}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyUrl}
                data-testid="button-copy-url"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Onboarding Checklist */}
            <div className="bg-white/[0.03] rounded-xl p-4 mb-6 space-y-3">
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-3">
                Get Started Checklist
              </h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://firstuser.co/${wizardData.slug}`);
                  handleCopyUrl();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left group"
              >
                <div className="w-6 h-6 rounded-full border-2 border-violet-500/50 flex items-center justify-center flex-shrink-0 group-hover:border-violet-500">
                  <Share2 className="w-3 h-3 text-violet-400" />
                </div>
                <div className="flex-1">
                  <span className="text-sm text-white/90 font-medium">Share your community link</span>
                  <p className="text-xs text-white/40">Invite friends, post on social media</p>
                </div>
              </button>
              <button
                onClick={() => setLocation(`/space/${wizardData.slug}/community`)}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left group"
              >
                <div className="w-6 h-6 rounded-full border-2 border-amber-500/50 flex items-center justify-center flex-shrink-0 group-hover:border-amber-500">
                  <MessageSquare className="w-3 h-3 text-amber-400" />
                </div>
                <div className="flex-1">
                  <span className="text-sm text-white/90 font-medium">Create your first announcement</span>
                  <p className="text-xs text-white/40">Welcome your early community members</p>
                </div>
              </button>
              <button
                onClick={() => setLocation(`/space/${wizardData.slug}`)}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left group"
              >
                <div className="w-6 h-6 rounded-full border-2 border-emerald-500/50 flex items-center justify-center flex-shrink-0 group-hover:border-emerald-500">
                  <Eye className="w-3 h-3 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <span className="text-sm text-white/90 font-medium">View your landing page</span>
                  <p className="text-xs text-white/40">See how it looks to visitors</p>
                </div>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="secondary"
                className="flex-1 h-11"
                onClick={() => setLocation(`/space/${wizardData.slug}/founder-tools`)}
                data-testid="button-founder-tools"
              >
                <Settings className="h-4 w-4 mr-2" />
                Founder Tools
              </Button>
              <Button
                className="flex-1 h-11"
                onClick={() => setLocation(`/space/${wizardData.slug}/community`)}
                data-testid="button-go-community"
              >
                Enter Community
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Image Crop Modal */}
      {showCropModal && imageToCrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel p-6 max-w-lg w-full" data-testid="modal-crop">
            <h3 className="text-xl font-display font-bold text-white/90 mb-4">
              Crop Your Logo
            </h3>
            <p className="text-white/60 text-sm mb-4">
              Drag to adjust the crop area. The logo will be displayed as a square.
            </p>
            <div className="flex justify-center mb-4 bg-black/30 rounded-lg p-2">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop={false}
              >
                <img
                  ref={imageRef}
                  src={imageToCrop}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  className="max-h-[400px] max-w-full"
                />
              </ReactCrop>
            </div>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1 h-11"
                onClick={handleCropCancel}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11"
                onClick={handleCropConfirm}
                disabled={!completedCrop}
              >
                <CropIcon className="h-4 w-4 mr-2" />
                Apply Crop
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Phone Verification Modal for email-only users */}
      <PhoneAuthModal
        open={showPhoneVerification}
        onOpenChange={setShowPhoneVerification}
        appSpaceSlug={null}
        appSpaceId={null}
        forcePhoneOnly={true}
      />

      {/* Phone Verification Required Gate */}
      {needsPhoneVerification && !showPhoneVerification ? (
        <AppLayout
          communities={communities}
          onCommunityClick={handleCommunityClick}
          showContextPanel={false}
        >
          <MainPane
            mobileTitle="Verify Phone"
            header={
              <HeaderTitle
                title="Phone Verification Required"
                subtitle="To create a community, you need to verify your phone number"
              />
            }
          >
            <div className="max-w-lg mx-auto px-4 md:px-6 py-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-2xl font-display font-bold text-white mb-3">
                Phone Verification Required
              </h1>
              <p className="text-white/60 mb-6">
                To create and manage a community on FirstUser, we need to verify your phone number. This helps us prevent spam and ensures a safe experience for all users.
              </p>
              <Button
                onClick={() => setShowPhoneVerification(true)}
                className="w-full max-w-xs h-12"
                style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.9) 0%, rgba(236, 72, 153, 0.9) 50%, rgba(139, 92, 246, 0.9) 100%)' }}
              >
                Verify Phone Number
              </Button>
              <p className="text-xs text-white/40 mt-4">
                Already have a phone-verified account? Sign out and sign back in with your phone number.
              </p>
            </div>
          </MainPane>
        </AppLayout>
      ) : showTemplateSelection ? (
        <AppLayout
          communities={communities}
          onCommunityClick={handleCommunityClick}
          showContextPanel={false}
        >
          <MainPane
            mobileTitle="Choose Template"
            header={
              <HeaderTitle
                title="Create Community"
                subtitle="Choose a template to get started"
              />
            }
          >
            <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-display font-bold text-white mb-2">
                  How do you want to start?
                </h1>
                <p className="text-white/60">
                  Choose a template to pre-fill your community, or start from scratch.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                {/* Start Blank Option */}
                <button
                  onClick={() => applyTemplate(null)}
                  className="group p-6 rounded-2xl border-2 border-dashed border-white/20 hover:border-violet-500/50 bg-white/[0.02] hover:bg-violet-500/5 transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl mb-4 group-hover:bg-violet-500/20 transition-colors">
                    <Plus className="w-6 h-6 text-white/50 group-hover:text-violet-400" />
                  </div>
                  <h3 className="font-semibold text-white mb-1">Start Blank</h3>
                  <p className="text-sm text-white/50">
                    Build your community from scratch with full customization.
                  </p>
                </button>

                {/* Template Options */}
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => applyTemplate(template)}
                    className="group p-6 rounded-2xl border border-white/10 hover:border-violet-500/50 bg-white/[0.02] hover:bg-violet-500/5 transition-all text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center text-2xl mb-4 group-hover:from-violet-500/30 group-hover:to-fuchsia-500/30 transition-colors">
                      {template.icon}
                    </div>
                    <h3 className="font-semibold text-white mb-1">{template.name}</h3>
                    <p className="text-sm text-white/50">
                      {template.description}
                    </p>
                  </button>
                ))}
              </div>

              {/* Resume Draft Button */}
              {hasDraft && (
                <div className="text-center">
                  <button
                    onClick={() => setShowTemplateSelection(false)}
                    className="text-violet-400 hover:text-violet-300 text-sm font-medium"
                  >
                    Or continue with your saved draft
                  </button>
                </div>
              )}
            </div>
          </MainPane>
        </AppLayout>
      ) : (
      <AppLayout
        communities={communities}
        draftCommunity={draftCommunity}
        onCommunityClick={handleCommunityClick}
        showContextPanel={false}
      >
        <MainPane
          mobileTitle={STEPS[currentStep]}
          header={
            <HeaderTitle
              title="Create Community"
              subtitle={`Step ${currentStep + 1} of ${STEPS.length}: ${STEPS[currentStep]}`}
            />
          }
        >
          {/* Step Indicator */}
          <div className="px-4 md:px-6 pb-6 pt-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-center gap-1 md:gap-2 flex-wrap">
              {STEPS.map((step, index) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`
                      w-4 h-4 md:w-6 md:h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
                      ${
                        index < currentStep
                          ? "bg-[#22c55e] text-white"
                          : index === currentStep
                          ? "bg-gradient-to-br from-[#7c3aed] to-[#d946ef] text-white"
                          : "border-2 border-white/20 text-white/40"
                      }
                    `}
                    data-testid={`step-dot-${index}`}
                  >
                    {index < currentStep ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <span className="hidden md:inline">{index + 1}</span>
                    )}
                  </div>

                  <span
                    className={`hidden lg:block ml-2 text-sm font-medium ${
                      index <= currentStep ? "text-white/90" : "text-white/40"
                    }`}
                  >
                    {step}
                  </span>

                  {index < STEPS.length - 1 && (
                    <div
                      className={`w-4 md:w-8 h-0.5 mx-1 md:mx-2 ${
                        index < currentStep
                          ? "bg-gradient-to-r from-[#7c3aed] to-[#d946ef]"
                          : "bg-white/20"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="md:hidden text-center mt-4">
              <span className="text-white/90 font-medium">
                Step {currentStep + 1}: {STEPS[currentStep]}
              </span>
            </div>

            {/* Draft Status Indicator */}
            {(hasDraft || draftSaveError) && (
              <div className="mt-4 flex flex-col items-center gap-2">
                {draftSaveError ? (
                  <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{draftSaveError}</span>
                    <button
                      onClick={() => setDraftSaveError(null)}
                      className="ml-2 text-white/40 hover:text-white/60"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      {isSavingDraft ? (
                        <>
                          <div className="w-3 h-3 border border-white/30 border-t-white/70 rounded-full animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : lastSaved ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Draft saved {lastSaved.toLocaleTimeString()}</span>
                        </>
                      ) : null}
                    </div>
                    <button
                      onClick={deleteDraft}
                      className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
                    >
                      Discard draft
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 px-4 md:px-6 pb-32">
          <div className="max-w-2xl mx-auto">
            <div className="glass-panel p-6 md:p-8">
              {currentStep === 0 && (
                <div className="space-y-6" data-testid="step-basic-info">
                  <div>
                    <h2 className="text-2xl font-display font-bold text-white/90 mb-2">
                      Basic Info
                    </h2>
                    <p className="text-white/60 text-sm">
                      Let's start with the essentials for your AppSpace.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="name" className="text-white/90">
                        App Name <span className="text-red-400">*</span>
                      </Label>
                      <span className="text-xs text-white/40">
                        {wizardData.name.length}/50
                      </span>
                    </div>
                    <Input
                      id="name"
                      value={wizardData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="My Awesome App"
                      maxLength={50}
                      data-testid="input-app-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slug" className="text-white/90">
                      URL Slug <span className="text-red-400">*</span>
                    </Label>
                    <div className="flex items-center gap-0">
                      <div className="h-11 px-4 flex items-center bg-white/5 border border-r-0 border-white/10 rounded-l-xl text-white/60 text-sm">
                        firstuser.co/
                      </div>
                      <div className="flex-1 relative">
                        <Input
                          id="slug"
                          value={wizardData.slug}
                          onChange={(e) => handleSlugChange(e.target.value)}
                          placeholder="my-app"
                          className="rounded-l-none"
                          data-testid="input-slug"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/40">
                        This cannot be changed later
                      </span>
                      {wizardData.slug && (
                        <span
                          className={`text-xs flex items-center gap-1 ${
                            isSlugTaken ? "text-red-400" : "text-green-400"
                          }`}
                          data-testid="slug-status"
                        >
                          {isSlugTaken ? (
                            <>
                              <X className="h-3 w-3" /> Already taken
                            </>
                          ) : (
                            <>
                              <Check className="h-3 w-3" /> Available
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="tagline" className="text-white/90">
                        Tagline
                      </Label>
                      <span className="text-xs text-white/40">
                        {wizardData.tagline.length}/100
                      </span>
                    </div>
                    <Textarea
                      id="tagline"
                      value={wizardData.tagline}
                      onChange={(e) =>
                        updateWizardData("tagline", e.target.value.slice(0, 100))
                      }
                      placeholder="A short description that appears under your app name..."
                      className="glass-input min-h-[60px] resize-none"
                      maxLength={100}
                      data-testid="input-tagline"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/90">Logo</Label>
                    <input
                      type="file"
                      ref={logoInputRef}
                      onChange={handleLogoChange}
                      accept="image/*"
                      className="hidden"
                      data-testid="input-logo-file"
                    />
                    <div
                      onClick={() => logoInputRef.current?.click()}
                      onDrop={handleLogoDrop}
                      onDragOver={(e) => e.preventDefault()}
                      className="w-32 h-32 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-violet-500/50 transition-colors overflow-hidden"
                      data-testid="upload-logo"
                    >
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-white/40 mb-2" />
                          <span className="text-xs text-white/40 text-center px-2">
                            Click or drag & drop
                          </span>
                        </>
                      )}
                    </div>
                    {logoPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          // Revoke Object URL to prevent memory leak
                          if (logoPreview.startsWith('blob:')) {
                            URL.revokeObjectURL(logoPreview);
                          }
                          setLogoPreview(null);
                          updateWizardData("logoFile", null);
                          if (logoInputRef.current) logoInputRef.current.value = "";
                        }}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove logo
                      </button>
                    )}
                  </div>
                </div>
              )}

              {currentStep === 1 && (
                <div className="space-y-6" data-testid="step-problem">
                  <div>
                    <h2 className="text-2xl font-display font-bold text-white/90 mb-2">
                      The Problem
                    </h2>
                    <p className="text-white/60 text-sm">
                      Describe the problem your app solves.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="problemTitle" className="text-white/90">
                      Section Title
                    </Label>
                    <Input
                      id="problemTitle"
                      value={wizardData.problemTitle}
                      onChange={(e) => updateWizardData("problemTitle", e.target.value)}
                      placeholder="The Problem"
                      data-testid="input-problem-title"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="problemDescription" className="text-white/90">
                        Problem Description
                      </Label>
                      <span className="text-xs text-white/40">
                        {wizardData.problemDescription.length}/1000
                      </span>
                    </div>
                    <Textarea
                      id="problemDescription"
                      value={wizardData.problemDescription}
                      onChange={(e) =>
                        updateWizardData("problemDescription", e.target.value.slice(0, 1000))
                      }
                      placeholder="Describe the problem your users face. What pain points are they experiencing? What challenges do they deal with daily?"
                      className="glass-input min-h-[150px] resize-none"
                      maxLength={1000}
                      data-testid="input-problem-description"
                    />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6" data-testid="step-solution">
                  <div>
                    <h2 className="text-2xl font-display font-bold text-white/90 mb-2">
                      The Solution
                    </h2>
                    <p className="text-white/60 text-sm">
                      Explain how your app solves the problem.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="solutionTitle" className="text-white/90">
                      Section Title
                    </Label>
                    <Input
                      id="solutionTitle"
                      value={wizardData.solutionTitle}
                      onChange={(e) => updateWizardData("solutionTitle", e.target.value)}
                      placeholder="The Solution"
                      data-testid="input-solution-title"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="solutionDescription" className="text-white/90">
                        Solution Description
                      </Label>
                      <span className="text-xs text-white/40">
                        {wizardData.solutionDescription.length}/1000
                      </span>
                    </div>
                    <Textarea
                      id="solutionDescription"
                      value={wizardData.solutionDescription}
                      onChange={(e) =>
                        updateWizardData("solutionDescription", e.target.value.slice(0, 1000))
                      }
                      placeholder="Explain how your app addresses the problem. What makes your solution unique?"
                      className="glass-input min-h-[120px] resize-none"
                      maxLength={1000}
                      data-testid="input-solution-description"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-white/90">Solution Points</Label>
                    <p className="text-xs text-white/50">
                      Add key features or benefits of your solution
                    </p>
                    
                    {wizardData.solutionPoints.length > 0 && (
                      <div className="space-y-2">
                        {wizardData.solutionPoints.map((point, index) => (
                          <div
                            key={index}
                            className="glass-panel p-3 flex items-center justify-between gap-3"
                            data-testid={`solution-point-${index}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-xs text-violet-300">
                                {index + 1}
                              </div>
                              <span className="text-white/90 text-sm">{point}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-400 hover:text-red-300"
                              onClick={() => removeSolutionPoint(index)}
                              data-testid={`remove-solution-point-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Input
                        value={newSolutionPoint}
                        onChange={(e) => setNewSolutionPoint(e.target.value)}
                        placeholder="Add a solution point..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addSolutionPoint();
                          }
                        }}
                        data-testid="input-new-solution-point"
                      />
                      <Button
                        variant="secondary"
                        onClick={addSolutionPoint}
                        disabled={!newSolutionPoint.trim()}
                        data-testid="button-add-solution-point"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6" data-testid="step-founders">
                  <div>
                    <h2 className="text-2xl font-display font-bold text-white/90 mb-2">
                      Founders
                    </h2>
                    <p className="text-white/60 text-sm">
                      Introduce the team behind your app.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {wizardData.founders.map((founder, index) => (
                      <div
                        key={founder.id}
                        className="glass-panel p-4"
                        data-testid={`founder-card-${index}`}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 border-2 border-violet-500/50 flex items-center justify-center text-xl font-bold text-white/90 flex-shrink-0 overflow-hidden"
                          >
                            {founder.photoUrl ? (
                              <img
                                src={founder.photoUrl}
                                alt={`${founder.firstName} ${founder.lastName}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              founder.firstName?.[0]?.toUpperCase() || "?"
                            )}
                          </div>

                          <div className="flex-1 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs text-white/60">First Name</Label>
                                <Input
                                  value={founder.firstName}
                                  onChange={(e) =>
                                    updateFounder(founder.id, { firstName: e.target.value })
                                  }
                                  placeholder="John"
                                  data-testid={`input-founder-firstname-${index}`}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-white/60">Last Name</Label>
                                <Input
                                  value={founder.lastName}
                                  onChange={(e) =>
                                    updateFounder(founder.id, { lastName: e.target.value })
                                  }
                                  placeholder="Doe"
                                  data-testid={`input-founder-lastname-${index}`}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-white/60">Title</Label>
                              <Input
                                value={founder.title}
                                onChange={(e) =>
                                  updateFounder(founder.id, { title: e.target.value })
                                }
                                placeholder="CEO & Founder"
                                data-testid={`input-founder-title-${index}`}
                              />
                            </div>
                          </div>

                          {wizardData.founders.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 text-red-400 hover:text-red-300 flex-shrink-0"
                              onClick={() => removeFounder(founder.id)}
                              data-testid={`button-remove-founder-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="secondary"
                    className="w-full h-11"
                    onClick={addFounder}
                    data-testid="button-add-founder"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Founder
                  </Button>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-6" data-testid="step-survey">
                  <div>
                    <h2 className="text-2xl font-display font-bold text-white/90 mb-2">
                      Survey Questions
                    </h2>
                    <p className="text-white/60 text-sm">
                      Collect insights from your waitlist members.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {wizardData.surveyQuestions.map((question, index) => (
                      <div
                        key={question.id}
                        className={`glass-panel p-4 flex items-start gap-3 transition-all ${
                          draggedQuestionId === question.id
                            ? "opacity-50 scale-95"
                            : ""
                        }`}
                        draggable
                        onDragStart={() => setDraggedQuestionId(question.id)}
                        onDragEnd={() => setDraggedQuestionId(null)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (draggedQuestionId && draggedQuestionId !== question.id) {
                            const fromIndex = wizardData.surveyQuestions.findIndex(
                              (q) => q.id === draggedQuestionId
                            );
                            if (fromIndex !== index) {
                              moveQuestion(fromIndex, index);
                            }
                          }
                        }}
                        data-testid={`question-card-${index}`}
                      >
                        <div className="cursor-grab text-white/40 hover:text-white/70 h-11 flex items-center">
                          <GripVertical className="h-5 w-5" />
                        </div>

                        {editingQuestion === question.id ? (
                          <div className="flex-1 space-y-3">
                            <Input
                              value={question.text}
                              onChange={(e) =>
                                updateQuestion(question.id, { text: e.target.value })
                              }
                              className="w-full"
                              data-testid={`input-edit-question-${index}`}
                            />
                            <div className="flex flex-wrap gap-3">
                              <Select
                                value={question.type}
                                onValueChange={(val) =>
                                  updateQuestion(question.id, {
                                    type: val as QuestionType,
                                  })
                                }
                              >
                                <SelectTrigger
                                  className="glass-input h-11 w-40"
                                  data-testid={`select-edit-type-${index}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="glass-panel border-white/10">
                                  {QUESTION_TYPES.map((type) => (
                                    <SelectItem
                                      key={type.value}
                                      value={type.value}
                                      className="text-white/90 focus:bg-white/10"
                                    >
                                      {type.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={question.required}
                                  onCheckedChange={(checked) =>
                                    updateQuestion(question.id, { required: checked })
                                  }
                                  data-testid={`switch-edit-required-${index}`}
                                />
                                <span className="text-sm text-white/70">
                                  Required
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => setEditingQuestion(null)}
                                data-testid={`button-save-edit-${index}`}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingQuestion(null)}
                                data-testid={`button-cancel-edit-${index}`}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <p className="text-white/90 text-sm mb-2 break-words">
                                {question.text}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="glass" className="text-xs">
                                  {getQuestionTypeLabel(question.type)}
                                </Badge>
                                {question.required && (
                                  <Badge
                                    className="text-xs bg-red-500/20 border-red-500/30 text-red-300"
                                  >
                                    Required
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11"
                                onClick={() => setEditingQuestion(question.id)}
                                data-testid={`button-edit-question-${index}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 text-red-400 hover:text-red-300"
                                onClick={() => deleteQuestion(question.id)}
                                data-testid={`button-delete-question-${index}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {isAddingQuestion ? (
                    <div className="glass-panel p-4 space-y-3" data-testid="new-question-form">
                      <Input
                        value={newQuestion.text || ""}
                        onChange={(e) =>
                          setNewQuestion({ ...newQuestion, text: e.target.value })
                        }
                        placeholder="Enter your question..."
                        data-testid="input-new-question"
                      />
                      <div className="flex flex-wrap gap-3">
                        <Select
                          value={newQuestion.type}
                          onValueChange={(val) =>
                            setNewQuestion({
                              ...newQuestion,
                              type: val as QuestionType,
                            })
                          }
                        >
                          <SelectTrigger
                            className="glass-input h-11 w-40"
                            data-testid="select-new-question-type"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="glass-panel border-white/10">
                            {QUESTION_TYPES.map((type) => (
                              <SelectItem
                                key={type.value}
                                value={type.value}
                                className="text-white/90 focus:bg-white/10"
                              >
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={newQuestion.required || false}
                            onCheckedChange={(checked) =>
                              setNewQuestion({ ...newQuestion, required: checked })
                            }
                            data-testid="switch-new-question-required"
                          />
                          <span className="text-sm text-white/70">
                            Required
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={addQuestion}
                          disabled={!newQuestion.text}
                          data-testid="button-save-new-question"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setIsAddingQuestion(false);
                            setNewQuestion({
                              text: "",
                              type: "short_text",
                              required: false,
                            });
                          }}
                          data-testid="button-cancel-new-question"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      className="w-full h-11"
                      onClick={() => setIsAddingQuestion(true)}
                      data-testid="button-add-question"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Question
                    </Button>
                  )}
                </div>
              )}

              {currentStep === 5 && (
                <div className="space-y-6" data-testid="step-badges">
                  <div>
                    <h2 className="text-2xl font-display font-bold text-white/90 mb-2">
                      Tier Rewards
                    </h2>
                    <p className="text-white/60 text-sm">
                      Define rewards for your top waitlist members.
                    </p>
                  </div>

                  <div
                    className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20"
                    data-testid="warning-badges"
                  >
                    <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-200">
                      Badges are permanent and cannot be revoked once awarded.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {wizardData.badges.map((badge, index) => (
                      <div
                        key={badge.id}
                        className={`glass-panel p-4 transition-opacity ${
                          !badge.enabled ? "opacity-50" : ""
                        }`}
                        data-testid={`badge-card-${index}`}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                            style={{
                              backgroundColor:
                                badge.id === "top10000"
                                  ? "rgba(255,255,255,0.1)"
                                  : `${badge.color}20`,
                              border: `2px solid ${badge.color}`,
                              color:
                                badge.id === "first" || badge.id === "top100"
                                  ? badge.color
                                  : badge.id === "top10000"
                                  ? "rgba(255,255,255,0.6)"
                                  : "#fff",
                            }}
                          >
                            {badge.label}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div>
                                <h3 className="text-white/90 font-semibold">
                                  {badge.name}
                                </h3>
                                <p className="text-xs text-white/50">
                                  {badge.positions}
                                </p>
                              </div>
                              {!badge.required && (
                                <Switch
                                  checked={badge.enabled}
                                  onCheckedChange={(checked) =>
                                    updateBadge(badge.id, { enabled: checked })
                                  }
                                  data-testid={`switch-badge-${index}`}
                                />
                              )}
                            </div>
                            <Textarea
                              value={badge.reward}
                              onChange={(e) =>
                                updateBadge(badge.id, { reward: e.target.value })
                              }
                              placeholder="Describe the reward..."
                              className={`glass-input min-h-[60px] resize-none text-sm ${
                                !badge.enabled ? "opacity-50 pointer-events-none" : ""
                              }`}
                              disabled={!badge.enabled}
                              data-testid={`input-badge-reward-${index}`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

          {/* Fixed Bottom Navigation */}
          <div className="fixed bottom-0 left-0 right-0 md:left-[60px] bg-black/80 backdrop-blur-md border-t border-white/5 p-4 z-20">
            <div className="max-w-2xl mx-auto">
              {submitError && (
                <div className="mb-3 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
                  {submitError}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                {currentStep > 0 && (
                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    disabled={isSubmitting}
                    className="h-11 sm:flex-1"
                    data-testid="button-back"
                  >
                    Back
                  </Button>
                )}
                <Button
                  onClick={handleNext}
                  disabled={!canProceed() || isSubmitting}
                  className={`h-11 ${currentStep === 0 ? "w-full" : "sm:flex-1"}`}
                  data-testid="button-next"
                >
                  {isSubmitting ? "Creating..." : currentStep === STEPS.length - 1 ? "Launch AppSpace" : "Next"}
                </Button>
              </div>
            </div>
          </div>
        </MainPane>
      </AppLayout>
      )}

      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti linear forwards;
        }
      `}</style>

      <ProfileCompletionModal
        isOpen={showProfileCompletion}
        onClose={() => setShowProfileCompletion(false)}
        onComplete={handleProfileComplete}
      />
    </>
  );
}
