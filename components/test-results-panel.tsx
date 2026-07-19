"use client";

import { CheckIcon, Cross2Icon, QuestionMarkIcon } from "@radix-ui/react-icons";
import Button from "@/components/button";
import { GradedItem } from "@/lib/tests/types";

type TestResultsPanelProps = {
  results: GradedItem[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Heading for the summary row, e.g. "Pre-Test results". */
  title?: string;
};

const VERDICT_STYLES = {
  met: { badge: "bg-green-600", row: "text-stone-700" },
  not_met: { badge: "bg-red-600", row: "text-stone-700" },
  unverifiable: { badge: "bg-stone-400", row: "text-stone-500" },
} as const;

function VerdictIcon({ verdict }: { verdict: GradedItem["criteria"][number]["verdict"] }) {
  const style = VERDICT_STYLES[verdict];
  return (
    <span
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${style.badge}`}
    >
      {verdict === "met" ? (
        <CheckIcon className="text-white" width={12} height={12} />
      ) : verdict === "not_met" ? (
        <Cross2Icon className="text-white" width={12} height={12} />
      ) : (
        <QuestionMarkIcon className="text-white" width={12} height={12} />
      )}
    </span>
  );
}

export default function TestResultsPanel({
  results,
  loading,
  error,
  onRetry,
  title = "Your results",
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

      {results.map((result) => (
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

          <ul className="mt-3 space-y-2">
            {result.criteria.map((criterion) => (
              <li key={criterion.name} className="flex items-start gap-2">
                <VerdictIcon verdict={criterion.verdict} />
                <span className={`text-sm leading-5 ${VERDICT_STYLES[criterion.verdict].row}`}>
                  <span className="font-semibold">{criterion.name}:</span>{" "}
                  {criterion.comment}
                </span>
              </li>
            ))}
          </ul>

          {result.feedback && (
            <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-sm leading-6 text-stone-600">
              {result.feedback}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
