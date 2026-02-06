import { useState } from "react";
import { X, Check } from "lucide-react";

interface SurveyQuestion {
  id: number;
  questionText: string;
  questionType: string;
  options: string | null;
  isRequired: boolean;
  displayOrder: number;
}

interface SurveyFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  questions: SurveyQuestion[];
  appSpaceId: number;
}

export function SurveyFlow({
  isOpen,
  onClose,
  onComplete,
  questions,
  appSpaceId,
}: SurveyFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  if (!isOpen || questions.length === 0) return null;

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const progress = ((currentIndex + 1) / questions.length) * 100;

  let parsedOptions: string[] = [];
  if (currentQuestion.options) {
    try {
      parsedOptions = JSON.parse(currentQuestion.options);
    } catch (e) {
      console.warn("Failed to parse survey options:", e);
    }
  }

  const currentResponse = responses[currentQuestion.id] || "";
  const canProceed = !currentQuestion.isRequired || currentResponse.trim().length > 0;

  const handleNext = async () => {
    if (!canProceed) {
      setShowValidation(true);
      return;
    }
    setShowValidation(false);
    if (isLastQuestion) {
      setIsSubmitting(true);
      try {
        const responseArray = Object.entries(responses).map(([questionId, responseText]) => ({
          questionId: parseInt(questionId),
          responseText,
        }));

        await fetch(`/api/appspaces/${appSpaceId}/survey/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ responses: responseArray }),
        });

        onComplete();
      } catch (error) {
        console.error("Failed to submit survey:", error);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSkip = () => {
    if (isLastQuestion) {
      handleNext();
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-lg mx-4 overflow-hidden">
        <div className="h-1 bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 space-y-6">
          <div className="text-center">
            <p className="text-white/50 text-sm mb-2">
              Question {currentIndex + 1} of {questions.length}
            </p>
            <h2 className="text-xl font-bold text-white font-display">
              {currentQuestion.questionText}
            </h2>
          </div>

          <div className="space-y-3">
            {currentQuestion.questionType === "text" ? (
              <div className="space-y-2">
                <textarea
                  value={currentResponse}
                  onChange={(e) =>
                    setResponses({
                      ...responses,
                      [currentQuestion.id]: e.target.value,
                    })
                  }
                  placeholder="Type your answer..."
                  className="glass-input w-full min-h-[120px] resize-none p-4 rounded-xl"
                  maxLength={4000}
                />
                <div className="flex justify-between text-xs">
                  {showValidation && currentQuestion.isRequired && !currentResponse.trim() && (
                    <span className="text-amber-400">This question is required</span>
                  )}
                  <span className="text-white/40 ml-auto">
                    {currentResponse.length}/4000
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {parsedOptions.map((option: string, index: number) => {
                  const isSelected = currentResponse === option;
                  return (
                    <button
                      key={index}
                      onClick={() =>
                        setResponses({
                          ...responses,
                          [currentQuestion.id]: option,
                        })
                      }
                      className={`w-full p-4 rounded-xl text-left transition-all duration-200 ${
                        isSelected
                          ? "bg-violet-500/20 border-2 border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.3)]"
                          : "glass-panel hover:bg-white/5 hover:border-white/20"
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
            )}
          </div>

          <div className="flex gap-3 pt-4">
            {!currentQuestion.isRequired && (
              <button
                onClick={handleSkip}
                disabled={isSubmitting}
                className="flex-1 py-3 rounded-xl font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                Skip
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={isSubmitting}
              className="flex-1 btn-gradient py-3 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : isLastQuestion ? (
                "Submit"
              ) : (
                "Next"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
