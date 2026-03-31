"use client";

import MathDisplay from "@/components/math-display";

export type RubricRow = {
  id: string;
  criteria: string;
  score: string;
  remarks: string;
};

type AiStudentPanelProps = {
  question: string;
  rubricRows: RubricRow[];
  setRubricRows: React.Dispatch<React.SetStateAction<RubricRow[]>>;
  submitted: boolean;
  loading: boolean;
  aiAnswer?: string;
  answersLoading?: boolean;
  onSubmit: () => void;
};

const CRITERIA_OPTIONS = [
  "completeness",
  "accuracy",
  // "correctness",
  "explanation",
  "relevance",
] as const;

const SCORE_OPTIONS = ["0", "1", "2", "3", "4", "5"] as const;

function createRubricRowId() {
  return `rubric-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function AiStudentPanel({
  question,
  rubricRows,
  setRubricRows,
  submitted,
  loading,
  aiAnswer,
  answersLoading = false,
  onSubmit,
}: AiStudentPanelProps) {
  const hasAnyRubricContent = rubricRows.some(
    (row) => row.criteria.trim() || row.score.trim() || row.remarks.trim()
  );

  const isDisabled = !hasAnyRubricContent || loading || submitted;

  const updateRow = (
    rowId: string,
    field: keyof Omit<RubricRow, "id">,
    value: string
  ) => {
    setRubricRows((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      )
    );
  };

  const addRow = () => {
    setRubricRows((prev) => [
      ...prev,
      {
        id: createRubricRowId(),
        criteria: "",
        score: "",
        remarks: "",
      },
    ]);
  };

  const removeRow = (rowId: string) => {
    setRubricRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-red-200 bg-red-50 shadow-sm">
      <div className="rounded-t-2xl bg-red-100 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Evaluate AI Student</h1>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        <div className="rounded-2xl bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">Your Question</h2>
          <div className="mt-3">
            {question ? (
              <MathDisplay text={question} />
            ) : (
              <p className="text-gray-500">No question submitted yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">AI Student Answer</h2>

          {answersLoading ? (
            <div className="mt-4 flex items-center gap-3 text-sm text-gray-600">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
              <span>Solving...</span>
            </div>
          ) : (
            <div className="mt-3 text-gray-800">
              {aiAnswer ? (
                <MathDisplay text={aiAnswer} />
              ) : (
                <p className="text-gray-500">No AI student answer available yet.</p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Your Rubric</h2>
            <button
              type="button"
              onClick={addRow}
              disabled={loading || submitted}
              className="rounded-xl border-2 border-red-200 bg-red-100 px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
            >
              Add Row
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-red-100">
                <tr>
                  <th className="border-b border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">
                    Criteria
                  </th>
                  <th className="w-40 border-b border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">
                    Score
                  </th>
                  <th className="border-b border-gray-200 px-4 py-3 text-left font-semibold text-gray-900">
                    Remarks
                  </th>
                  <th className="w-24 border-b border-gray-200 px-4 py-3" />
                </tr>
              </thead>

              <tbody>
                {rubricRows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="border-b border-gray-200 p-2">
                      <select
                        value={row.criteria}
                        onChange={(e) =>
                          updateRow(row.id, "criteria", e.target.value)
                        }
                        disabled={loading || submitted}
                        className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-gray-900 outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100 disabled:bg-gray-50"
                      >
                        <option value="">Select criterion</option>
                        {CRITERIA_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option.charAt(0).toUpperCase() + option.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="border-b border-gray-200 p-2">
                      <select
                        value={row.score}
                        onChange={(e) =>
                          updateRow(row.id, "score", e.target.value)
                        }
                        disabled={loading || submitted}
                        className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-gray-900 outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100 disabled:bg-gray-50"
                      >
                        <option value="">Select score</option>
                        {SCORE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="border-b border-gray-200 p-2">
                      <textarea
                        value={row.remarks}
                        onChange={(e) =>
                          updateRow(row.id, "remarks", e.target.value)
                        }
                        disabled={loading || submitted}
                        placeholder="Add remarks here..."
                        rows={3}
                        className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-gray-900 outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100 disabled:bg-gray-50"
                      />
                    </td>

                    <td className="border-b border-gray-200 p-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={loading || submitted || rubricRows.length === 1}
                        className="rounded-xl px-3 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-400"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={onSubmit}
              disabled={isDisabled}
              className="rounded-xl bg-red-300 px-5 py-2.5 font-medium text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
            >
              {loading
                ? "Submitting..."
                : submitted
                  ? "Submitted"
                  : "Submit"}
            </button>

            {!loading && !submitted && !hasAnyRubricContent ? (
              <span className="text-sm text-gray-500">
                Fill in at least one rubric row to continue.
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}