"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, Cross2Icon } from "@radix-ui/react-icons";
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

type GradePanelProps = {
  question?: string;
  rubric: RubricCriterion[];
  answers: readonly FinalAiAnswer[];
  reviewStates: Record<string, AnswerReviewState>;
  loadingAnswerId?: string | null;
  currentIndex: number;
  onCurrentIndexChange: (index: number) => void;
  onToggleResult: (answerId: string, criterionId: string, value: "pass" | "fail") => void;
  onSubmitAnswer: (answerId: string) => void;
  onComplete?: () => void;
  correctSample?: SampleAnswer;
};

export default function GradePanel({
  question,
  rubric,
  answers,
  reviewStates,
  loadingAnswerId,
  currentIndex,
  onCurrentIndexChange,
  onToggleResult,
  onSubmitAnswer,
  onComplete,
  correctSample,
}: GradePanelProps) {
  const [hintOpen, setHintOpen] = useState(false);
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  const currentAnswer = answers[currentIndex];
  const currentState = reviewStates[currentAnswer.id];

  const allFilled = rubric.every((criterion) => currentState?.results?.[criterion.id]);

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
        feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [currentAnswer.id, currentState?.submitted]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-stone-800">Evaluate this answer</h2>
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

      <div className="flex flex-col gap-5">
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
            <h3 className="text-base font-bold text-stone-800">Rubric</h3>
            {correctSample && <HintButton onClick={() => setHintOpen(true)} />}
          </div>

          <p className="mb-4 text-sm text-stone-500">
            Mark &ldquo;Pass&rdquo; only if the criterion is fully satisfied, and &ldquo;Fail&rdquo;
            if it is missing, incorrect, or incomplete.
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
                  className="flex flex-col gap-3 rounded-xl border border-stone-200 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
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
                  </div>

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
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-center">
            <Button onClick={() => onSubmitAnswer(currentAnswer.id)} disabled={!allFilled || isLoading}>
              {isLoading ? "Submitting..." : currentState?.submitted ? "Resubmit" : "Submit"}
            </Button>
          </div>
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
          onClick={() => onCurrentIndexChange(currentIndex - 1)}
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
          onClick={() => onCurrentIndexChange(currentIndex + 1)}
        >
          Next
          <ArrowRightIcon />
        </Button>
      </div>
    </div>
  );
}
