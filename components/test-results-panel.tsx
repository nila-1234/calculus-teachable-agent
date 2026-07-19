"use client";

import Button from "@/components/button";
import MathDisplay from "@/components/math-display";
import { formatStudentAnswer, toMathPreview } from "@/lib/tests/format";
import { GradedItem, TestAnswers, TestDefinition } from "@/lib/tests/types";

type TestResultsPanelProps = {
  results: GradedItem[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Heading for the summary row, e.g. "Pre-Test results". */
  title?: string;
  /** Test definition + answers: shows each question and the student's answer. */
  test?: TestDefinition | null;
  answers?: TestAnswers | null;
};

export default function TestResultsPanel({
  results,
  loading,
  error,
  onRetry,
  title = "Your results",
  test,
  answers,
}: TestResultsPanelProps) {
  if (loading) {
    return (
      <div className="mt-4 flex items-center justify-center gap-3 rounded-xl border-2 border-stone-200 bg-white p-6 shadow-sm">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-200 border-t-lime-600" />
        <span className="text-sm font-medium text-stone-600">
          Grading your answers…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border-2 border-stone-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm leading-6 text-stone-600">{error}</p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try grading again
        </Button>
      </div>
    );
  }

  if (!results) return null;

  const allItems = test?.sections.flatMap((section) => section.items) ?? [];
  const totalPoints = results.reduce((sum, r) => sum + r.points, 0);
  const totalMax = results.reduce((sum, r) => sum + r.maxPoints, 0);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between rounded-xl border-2 border-stone-200 bg-white px-5 py-4 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
          {title}
        </span>
        <span className="rounded-full bg-lime-50 px-3 py-1 text-sm font-bold text-lime-700">
          {totalPoints} / {totalMax} points
        </span>
      </div>

      {results.map((result) => {
        const item = allItems.find((i) => i.id === result.itemId);
        const studentAnswer =
          item && answers ? formatStudentAnswer(item, answers) : null;

        return (
          <div
            key={result.itemId}
            className="rounded-xl border-2 border-stone-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Question {result.itemId}
              </p>
              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600">
                {result.points} / {result.maxPoints}
              </span>
            </div>

            {item && (
              <MathDisplay
                text={item.prompt}
                className="mt-2 text-sm font-medium leading-6 text-stone-800"
              />
            )}

            {studentAnswer && (
              <div className="mt-3 rounded-lg border-2 border-stone-100 bg-stone-50 px-3 py-2">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-stone-400">
                  Your answer
                </p>
                <MathDisplay
                  text={toMathPreview(studentAnswer)}
                  className="text-sm leading-6 text-stone-700"
                />
              </div>
            )}

            <div className="mt-3 rounded-lg border-2 border-lime-100 bg-lime-50 px-3 py-2">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-lime-700">
                Feedback
              </p>
              <p className="text-sm leading-6 text-stone-700">{result.feedback}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
