"use client";

import MathDisplay from "@/components/math-display";
import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, CheckIcon, Cross2Icon } from "@radix-ui/react-icons";
import { RubricOption } from "@/lib/scenarios/types";
import Button from "@/components/button";
import IncludeExcludeToggle from "@/components/include-exclude-toggle";

export type RubricDecision = "include" | "exclude";

type SampleAnswer = {
  title: string;
  text: string;
};

type CreateRubricPanelProps = {
  question: string;
  correctSample: SampleAnswer;
  incorrectSample?: SampleAnswer;
  rubricOptions: readonly RubricOption[];
  rubricDecisions: Record<string, RubricDecision>;
  submitted: boolean;
  isPerfect: boolean;
  allCriteriaDecided: boolean;
  onSetRubricDecision: (id: string, decision: RubricDecision) => void;
  onTryAgain: () => void;
  onContinue: () => void;
  onSubmit: () => void;
};

export default function CreateRubricPanel({
  question,
  correctSample,
  incorrectSample,
  rubricOptions,
  rubricDecisions,
  submitted,
  isPerfect,
  allCriteriaDecided,
  onSetRubricDecision,
  onContinue,
  onSubmit,
  onTryAgain,
}: CreateRubricPanelProps) {
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const [hintOpen, setHintOpen] = useState(false);

  useEffect(() => {
    if (submitted && feedbackRef.current) {
      feedbackRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [submitted]);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-400">
          Question
        </span>
        <div className="whitespace-pre-wrap text-base leading-7 text-stone-700">
          <MathDisplay text={question} />
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-stone-800">Select rubric criteria</h3>
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Include / exclude each
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {rubricOptions.map((option) => {
            const decision = rubricDecisions[option.id];
            const included = decision === "include";
            const excluded = decision === "exclude";

            const isCorrectDecision =
              (option.correct && included) || (!option.correct && excluded);

            return (
              <div
                key={option.id}
                className="grid grid-cols-[minmax(160px,1.4fr)_auto_1.6fr] items-center gap-4 rounded-xl border border-stone-200 px-4 py-3"
              >
                <div className="text-sm font-medium text-stone-800">
                  <MathDisplay text={option.label} />
                </div>

                <IncludeExcludeToggle
                  value={decision}
                  onChange={(value) => onSetRubricDecision(option.id, value)}
                  disabled={submitted}
                />

                {submitted ? (
                  <div
                    className={`flex items-start gap-2 text-sm ${
                      isCorrectDecision ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {isCorrectDecision ? (
                      <CheckIcon className="mt-0.5 shrink-0" width={18} height={18} />
                    ) : (
                      <Cross2Icon className="mt-0.5 shrink-0" width={18} height={18} />
                    )}
                    <div>
                      <MathDisplay
                        text={`${isCorrectDecision ? "Correct" : "Incorrect"}: ${option.feedback}`}
                      />
                    </div>
                  </div>
                ) : (
                  <div />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setHintOpen(true)}
            className="text-sm font-semibold text-stone-500 underline decoration-stone-300 underline-offset-4 hover:text-stone-700"
          >
            Show hint
          </button>

          <Button onClick={onSubmit} disabled={!allCriteriaDecided || submitted}>
            {submitted ? "Submitted" : "Submit"}
          </Button>
        </div>
      </div>

      {hintOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setHintOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-stone-800">Sample answers</h3>
            <p className="mt-1 text-sm text-stone-500">
              {incorrectSample
                ? "Look at the following sample answers. The first solution would be completely correct, and the second would be incorrect. Use these to guide your understanding of the correct approach."
                : "Look at the following sample answer, which would be completely correct. Use it to guide your understanding of the correct approach."}
            </p>

            <div className={`mt-4 grid grid-cols-1 gap-4 ${incorrectSample ? "lg:grid-cols-2" : ""}`}>
              <div className="rounded-xl border border-stone-200 p-4">
                <h4 className="mb-2 text-sm font-bold text-stone-800">{correctSample.title}</h4>
                <div className="whitespace-pre-wrap text-sm leading-7 text-stone-700">
                  <MathDisplay text={correctSample.text} />
                </div>
              </div>
              {incorrectSample && (
                <div className="rounded-xl border border-stone-200 p-4">
                  <h4 className="mb-2 text-sm font-bold text-stone-800">{incorrectSample.title}</h4>
                  <div className="whitespace-pre-wrap text-sm leading-7 text-stone-700">
                    <MathDisplay text={incorrectSample.text} />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setHintOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {submitted && (
        <div ref={feedbackRef} className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                isPerfect ? "bg-green-600" : "bg-red-600"
              }`}
            >
              {isPerfect ? (
                <CheckIcon className="text-white" width={14} height={14} />
              ) : (
                <Cross2Icon className="text-white" width={14} height={14} />
              )}
            </div>
            <h3 className="text-base font-bold text-stone-800">
              {isPerfect ? "Perfect!" : "Not quite!"}
            </h3>
          </div>

          <p className="mt-3 text-sm leading-7 text-stone-600">
            {isPerfect
              ? "Perfect! You included all essential criteria."
              : "Not quite. Review the feedback for each criterion and try again."}
          </p>

          <div className="mt-4 flex justify-center">
            {isPerfect ? (
              <Button onClick={onContinue}>
                Continue
                <ArrowRightIcon />
              </Button>
            ) : (
              <Button variant="secondary" onClick={onTryAgain}>
                Try Again
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
