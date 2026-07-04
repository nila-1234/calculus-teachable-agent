"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
import MathDisplay from "@/components/math-display";
import { FinalAiAnswer } from "@/lib/scenarios/types";
import Button from "@/components/button";
import TwoStateToggle from "@/components/two-state-toggle";
import HintButton from "@/components/hint-button";
import SampleAnswerModal from "@/components/sample-answer-modal";

export type RubricCriterion = {
  id: string;
  label: string;
};
type RubricCriterionFeedback = {
  criterionId: string;
  criterion: string;
  evaluation: "pass" | "fail" | "";
  correct: boolean;
  expectedEvaluation: "pass" | "fail" | null;
  feedback: string;
};

export type AnswerReviewState = {
  results: Record<string, "pass" | "fail" | "">;
  submitted: boolean;
  feedback: RubricCriterionFeedback[];
};

type SampleAnswer = {
  title: string;
  text: string;
};

type ApplyRubricPanelProps = {
  question?: string;
  rubric: RubricCriterion[];
  answers: readonly FinalAiAnswer[];
  reviewStates: Record<string, AnswerReviewState>;
  loadingAnswerId?: string | null;
  onToggleResult: (answerId: string, criterionId: string, value: "pass" | "fail") => void;
  onSubmitAnswer: (answerId: string) => void;
  mode?: number;
  onModeChange?: (mode: number) => void;
  explanations?: Record<string, Record<string, string>>;
  onExplanationChange?: (answerId: string, criterionId: string, value: string) => void;
  onExplanationBlur?: (answerId: string, criterionId: string, value: string) => void;
  onComplete?: () => void;
  correctSample?: SampleAnswer;
};

export default function ApplyRubricPanel({
  question,
  rubric,
  answers,
  reviewStates,
  loadingAnswerId,
  onToggleResult,
  onSubmitAnswer,
  mode = 1,
  onModeChange,
  explanations = {},
  onExplanationChange,
  onExplanationBlur,
  onComplete,
  correctSample,
}: ApplyRubricPanelProps) {
  const isMode2 = mode === 2;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hintOpen, setHintOpen] = useState(false);
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  const currentAnswer = answers[currentIndex];
  const currentState = reviewStates[currentAnswer.id];

  const allFilled = rubric.every(
    (criterion) => currentState?.results?.[criterion.id]
  );

  const isLoading = loadingAnswerId === currentAnswer.id;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < answers.length - 1;

  const completedCount = useMemo(
    () => answers.filter((a) => reviewStates[a.id]?.submitted).length,
    [answers, reviewStates]
  );

  const allSubmitted = completedCount === answers.length && answers.length > 0;

  useEffect(() => {
    if (currentState?.submitted && feedbackRef.current) {
      requestAnimationFrame(() => {
        feedbackRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [currentAnswer.id, currentState?.submitted]);

  const templateColumns = isMode2
    ? "minmax(160px,1.1fr) auto minmax(160px,1fr) minmax(160px,1.3fr)"
    : "minmax(160px,1.4fr) auto minmax(160px,1.6fr)";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-lg bg-stone-100 p-1">
          <button
            type="button"
            onClick={() => onModeChange?.(1)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === 1 ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Standard
          </button>
          <button
            type="button"
            onClick={() => onModeChange?.(2)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === 2 ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Self-Explanation
          </button>
        </div>

        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Answer {currentIndex + 1} of {answers.length} · {completedCount} submitted
        </span>
      </div>

      {question && (
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-400">
            Question
          </span>
          <div className="whitespace-pre-wrap text-base leading-7 text-stone-700">
            <MathDisplay text={question} />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-stone-800">{currentAnswer.label}</h3>
          {currentState?.submitted ? (
            <span className="rounded-full bg-lime-50 px-2.5 py-1 text-xs font-semibold text-lime-700">
              Submitted
            </span>
          ) : (
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-500">
              Not submitted
            </span>
          )}
        </div>
        <div className="whitespace-pre-wrap text-sm leading-7 text-stone-700">
          <MathDisplay text={currentAnswer.text} />
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-stone-800">Evaluate this answer</h3>
            {correctSample && <HintButton onClick={() => setHintOpen(true)} />}
          </div>
        </div>

        <p className="mb-4 text-sm text-stone-500">
          Review the AI answer above and evaluate it against each selected criterion. Mark
          &ldquo;Pass&rdquo; only if the criterion is fully satisfied, and &ldquo;Fail&rdquo; if it is
          missing, incorrect, or incomplete.
        </p>

        <div className="flex flex-col gap-3">
          {rubric.map((criterion) => {
            const selectedValue = currentState?.results?.[criterion.id] ?? "";
            const criterionFeedback = Array.isArray(currentState?.feedback)
              ? currentState.feedback.find((item) => item.criterionId === criterion.id)
              : undefined;

            return (
              <div
                key={criterion.id}
                className="grid items-center gap-4 rounded-xl border border-stone-200 px-4 py-3"
                style={{ gridTemplateColumns: templateColumns }}
              >
                <div className="text-sm font-medium text-stone-800">
                  <MathDisplay text={criterion.label} />
                </div>

                <TwoStateToggle
                  value={selectedValue}
                  onChange={(value) => onToggleResult(currentAnswer.id, criterion.id, value)}
                  disabled={isLoading}
                  positive={{ value: "pass", label: "Pass" }}
                  negative={{ value: "fail", label: "Fail" }}
                />

                {isMode2 ? (
                  <textarea
                    placeholder="Explain your reasoning…"
                    value={explanations[currentAnswer.id]?.[criterion.id] || ""}
                    onChange={(e) =>
                      onExplanationChange?.(currentAnswer.id, criterion.id, e.target.value)
                    }
                    onBlur={(e) =>
                      onExplanationBlur?.(currentAnswer.id, criterion.id, e.target.value)
                    }
                    disabled={isLoading}
                    className="min-h-[44px] w-full resize-none rounded-lg border-2 border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 transition-colors focus:outline-none focus:border-lime-600 focus:ring-4 focus:ring-lime-50 disabled:bg-stone-50 disabled:opacity-60"
                  />
                ) : null}

                {currentState?.submitted ? (
                  <div
                    className={`flex items-start gap-2 text-sm ${
                      criterionFeedback?.correct ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {isLoading ? (
                      <span className="text-stone-500">Loading feedback...</span>
                    ) : (
                      <>
                        {criterionFeedback?.correct ? (
                          <CheckIcon className="mt-0.5 shrink-0" width={18} height={18} />
                        ) : (
                          <Cross2Icon className="mt-0.5 shrink-0" width={18} height={18} />
                        )}
                        <div>
                          {criterionFeedback?.feedback ? (
                            <MathDisplay text={criterionFeedback.feedback} />
                          ) : (
                            "No feedback returned for this criterion."
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-center">
          <Button
            onClick={() => onSubmitAnswer(currentAnswer.id)}
            disabled={!allFilled || isLoading}
          >
            {isLoading ? "Submitting..." : currentState?.submitted ? "Resubmit" : "Submit"}
          </Button>
        </div>
      </div>

      {correctSample && (
        <SampleAnswerModal
          open={hintOpen}
          onClose={() => setHintOpen(false)}
          title={correctSample.title}
          text={correctSample.text}
        />
      )}

      <div ref={feedbackRef} className="flex items-center justify-between">
        <Button
          variant="secondary"
          disabled={!hasPrevious}
          onClick={() => setCurrentIndex((prev) => prev - 1)}
        >
          <ArrowLeftIcon />
          Previous
        </Button>

        <Button disabled={!allSubmitted} onClick={() => onComplete?.()}>
          <CheckIcon />
          Complete Submission
        </Button>

        <Button
          variant="secondary"
          disabled={!hasNext}
          onClick={() => setCurrentIndex((prev) => prev + 1)}
        >
          Next
          <ArrowRightIcon />
        </Button>
      </div>
    </div>
  );
}
