import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Check, Star, ClipboardList } from "lucide-react";

interface SurveyQuestion {
  id: number;
  questionText: string;
  questionType: string; // short_text, long_text, multiple_choice, checkbox, rating, text
  options: string | null;
  isRequired: boolean;
  displayOrder: number;
}

interface SurveyResponseModalProps {
  appSpaceId: number;
  appSpaceName: string;
  open: boolean;
  onComplete: () => void;
}

export function SurveyResponseModal({
  appSpaceId,
  appSpaceName,
  open,
  onComplete,
}: SurveyResponseModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, string | string[]>>({});
  const [showValidation, setShowValidation] = useState(false);

  // Fetch survey questions
  const { data: surveyData, isLoading: isLoadingQuestions } = useQuery({
    queryKey: ["survey", appSpaceId],
    queryFn: async () => {
      const res = await fetch(`/api/appspaces/${appSpaceId}/survey`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch survey");
      return res.json();
    },
    enabled: open && appSpaceId > 0,
  });

  const questions: SurveyQuestion[] = surveyData?.questions || [];
  const sortedQuestions = [...questions].sort((a, b) => a.displayOrder - b.displayOrder);

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const responseArray = Object.entries(responses).map(([questionId, responseText]) => ({
        questionId: parseInt(questionId),
        responseText: Array.isArray(responseText) ? responseText.join(", ") : responseText,
      }));

      const res = await fetch(`/api/appspaces/${appSpaceId}/survey/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ responses: responseArray }),
      });

      if (!res.ok) throw new Error("Failed to submit survey");
      return res.json();
    },
    onSuccess: () => {
      onComplete();
    },
  });

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setResponses({});
      setShowValidation(false);
    }
  }, [open]);

  if (!open) return null;

  // If no questions, auto-complete
  if (!isLoadingQuestions && sortedQuestions.length === 0) {
    onComplete();
    return null;
  }

  const currentQuestion = sortedQuestions[currentIndex];
  const isLastQuestion = currentIndex === sortedQuestions.length - 1;
  const progress = sortedQuestions.length > 0 ? ((currentIndex + 1) / sortedQuestions.length) * 100 : 0;

  // Parse options for multiple choice/checkbox questions
  let parsedOptions: string[] = [];
  if (currentQuestion?.options) {
    try {
      parsedOptions = JSON.parse(currentQuestion.options);
    } catch (e) {
      // If not JSON, try splitting by comma
      parsedOptions = currentQuestion.options.split(",").map(s => s.trim());
    }
  }

  const currentResponse = currentQuestion ? responses[currentQuestion.id] : "";
  const canProceed = !currentQuestion?.isRequired ||
    (Array.isArray(currentResponse) ? currentResponse.length > 0 : (currentResponse as string)?.trim().length > 0);

  const handleNext = async () => {
    if (!canProceed) {
      setShowValidation(true);
      return;
    }
    setShowValidation(false);

    if (isLastQuestion) {
      submitMutation.mutate();
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowValidation(false);
    }
  };

  const handleSkip = () => {
    if (isLastQuestion) {
      submitMutation.mutate();
    } else {
      setCurrentIndex(currentIndex + 1);
      setShowValidation(false);
    }
  };

  const renderQuestionInput = () => {
    if (!currentQuestion) return null;

    const type = currentQuestion.questionType;

    // Short text (single line)
    if (type === "short_text") {
      return (
        <div className="space-y-2">
          <Input
            value={(currentResponse as string) || ""}
            onChange={(e) =>
              setResponses({
                ...responses,
                [currentQuestion.id]: e.target.value,
              })
            }
            placeholder="Type your answer..."
            className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
            maxLength={500}
          />
          <div className="flex justify-between text-xs">
            {showValidation && currentQuestion.isRequired && !currentResponse && (
              <span className="text-amber-400">This question is required</span>
            )}
            <span className="text-white/40 ml-auto">
              {((currentResponse as string) || "").length}/500
            </span>
          </div>
        </div>
      );
    }

    // Long text / text (multi-line)
    if (type === "long_text" || type === "text") {
      return (
        <div className="space-y-2">
          <Textarea
            value={(currentResponse as string) || ""}
            onChange={(e) =>
              setResponses({
                ...responses,
                [currentQuestion.id]: e.target.value,
              })
            }
            placeholder="Type your answer..."
            className="bg-white/5 border-white/10 text-white placeholder:text-white/40 min-h-[120px] resize-none"
            maxLength={4000}
          />
          <div className="flex justify-between text-xs">
            {showValidation && currentQuestion.isRequired && !currentResponse && (
              <span className="text-amber-400">This question is required</span>
            )}
            <span className="text-white/40 ml-auto">
              {((currentResponse as string) || "").length}/4000
            </span>
          </div>
        </div>
      );
    }

    // Multiple choice (single select)
    if (type === "multiple_choice") {
      return (
        <div className="space-y-2">
          {parsedOptions.map((option, index) => {
            const isSelected = currentResponse === option;
            return (
              <button
                key={index}
                type="button"
                onClick={() =>
                  setResponses({
                    ...responses,
                    [currentQuestion.id]: option,
                  })
                }
                className={`w-full p-4 rounded-xl text-left transition-all duration-200 border ${
                  isSelected
                    ? "bg-violet-500/20 border-violet-500"
                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={isSelected ? "text-white font-medium" : "text-white/80"}>
                    {option}
                  </span>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
          {showValidation && currentQuestion.isRequired && !currentResponse && (
            <p className="text-amber-400 text-xs mt-2">Please select an option</p>
          )}
        </div>
      );
    }

    // Checkbox (multi-select)
    if (type === "checkbox") {
      const selectedOptions = Array.isArray(currentResponse) ? currentResponse : [];
      return (
        <div className="space-y-2">
          {parsedOptions.map((option, index) => {
            const isChecked = selectedOptions.includes(option);
            return (
              <div
                key={index}
                className={`flex items-center p-4 rounded-xl border transition-all cursor-pointer ${
                  isChecked
                    ? "bg-violet-500/20 border-violet-500"
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
                onClick={() => {
                  const newSelected = isChecked
                    ? selectedOptions.filter((o) => o !== option)
                    : [...selectedOptions, option];
                  setResponses({
                    ...responses,
                    [currentQuestion.id]: newSelected,
                  });
                }}
              >
                <Checkbox
                  checked={isChecked}
                  className="border-white/30 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                />
                <Label className="ml-3 text-white/80 cursor-pointer flex-1">{option}</Label>
              </div>
            );
          })}
          {showValidation && currentQuestion.isRequired && selectedOptions.length === 0 && (
            <p className="text-amber-400 text-xs mt-2">Please select at least one option</p>
          )}
        </div>
      );
    }

    // Rating (1-5 stars)
    if (type === "rating") {
      const rating = parseInt((currentResponse as string) || "0");
      return (
        <div className="space-y-4">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() =>
                  setResponses({
                    ...responses,
                    [currentQuestion.id]: star.toString(),
                  })
                }
                className="p-2 transition-transform hover:scale-110"
              >
                <Star
                  className={`w-10 h-10 transition-colors ${
                    star <= rating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-white/30 hover:text-white/50"
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-white/50 text-sm">
            {rating > 0 ? `${rating} out of 5` : "Click to rate"}
          </p>
          {showValidation && currentQuestion.isRequired && !currentResponse && (
            <p className="text-amber-400 text-xs text-center">Please select a rating</p>
          )}
        </div>
      );
    }

    // Default to text input
    return (
      <div className="space-y-2">
        <Textarea
          value={(currentResponse as string) || ""}
          onChange={(e) =>
            setResponses({
              ...responses,
              [currentQuestion.id]: e.target.value,
            })
          }
          placeholder="Type your answer..."
          className="bg-white/5 border-white/10 text-white placeholder:text-white/40 min-h-[120px] resize-none"
          maxLength={4000}
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-[500px] bg-black border-white/[0.08] text-white max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <DialogHeader className="pt-4">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center">
              <ClipboardList className="w-7 h-7 text-white" />
            </div>
          </div>
          <DialogTitle className="text-xl text-center">
            {isLoadingQuestions ? "Loading..." : `Welcome to ${appSpaceName}`}
          </DialogTitle>
          <DialogDescription className="text-center text-white/60">
            {isLoadingQuestions
              ? "Preparing your survey..."
              : `Please answer ${sortedQuestions.length} quick question${sortedQuestions.length !== 1 ? "s" : ""} to unlock chat access`}
          </DialogDescription>
        </DialogHeader>

        {isLoadingQuestions ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          </div>
        ) : currentQuestion ? (
          <div className="space-y-6 mt-4">
            <div className="text-center">
              <p className="text-white/50 text-sm mb-3">
                Question {currentIndex + 1} of {sortedQuestions.length}
              </p>
              <h3 className="text-lg font-medium text-white">
                {currentQuestion.questionText}
                {currentQuestion.isRequired && <span className="text-red-400 ml-1">*</span>}
              </h3>
            </div>

            {renderQuestionInput()}

            <div className="flex gap-3 pt-2">
              {currentIndex > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10"
                >
                  Back
                </Button>
              )}
              {!currentQuestion.isRequired && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkip}
                  disabled={submitMutation.isPending}
                  className="flex-1 text-white/60 hover:text-white hover:bg-white/5"
                >
                  Skip
                </Button>
              )}
              <Button
                type="button"
                onClick={handleNext}
                disabled={submitMutation.isPending}
                style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.9) 0%, rgba(236, 72, 153, 0.9) 50%, rgba(139, 92, 246, 0.9) 100%)' }}
                className="flex-1 hover:opacity-90"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : isLastQuestion ? (
                  "Complete"
                ) : (
                  "Next"
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
