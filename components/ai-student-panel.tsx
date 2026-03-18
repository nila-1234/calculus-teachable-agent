"use client";

import MathDisplay from "@/components/math-display";

export type RubricRow = {
  id: string;
  criteria: string;
  score: string;
  remarks: string;
};

export type HumanAssignedRubric = {
  rows: RubricRow[];
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

  function createRubricRowId() {
    return `rubric-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

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
        <h1 className="text-xl font-semibold text-slate-900">Evaluation</h1>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        <div className="rounded-2xl bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Your Question</h2>
          <div className="mt-2">
            {question ? (
              <MathDisplay text={question} />
            ) : (
              <p className="text-slate-500">No question submitted yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-red-100 p-5">
          <h2 className="text-lg font-semibold text-slate-900">AI Student Answer</h2>

          {answersLoading ? (
            <div className="mt-3 flex items-center gap-3 text-sm text-slate-600">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              <span>Solving...</span>
            </div>
          ) : (
            <div className="mt-3 whitespace-pre-wrap text-slate-800">
              {aiAnswer || "No AI student answer available yet."}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Your Rubric</h2>
            <button
              type="button"
              onClick={addRow}
              disabled={loading || submitted}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add row
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Criteria
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700 w-32">
                    Score
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Remarks
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 w-20" />
                </tr>
              </thead>

              <tbody>
                {rubricRows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="border-b border-slate-200 p-2">
                      <input
                        type="text"
                        value={row.criteria}
                        onChange={(e) =>
                          updateRow(row.id, "criteria", e.target.value)
                        }
                        disabled={loading || submitted}
                        placeholder="e.g. Correctness of solution"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                      />
                    </td>

                    <td className="border-b border-slate-200 p-2">
                      <input
                        type="text"
                        value={row.score}
                        onChange={(e) =>
                          updateRow(row.id, "score", e.target.value)
                        }
                        disabled={loading || submitted}
                        placeholder="Score /5"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                      />
                    </td>

                    <td className="border-b border-slate-200 p-2">
                      <textarea
                        value={row.remarks}
                        onChange={(e) =>
                          updateRow(row.id, "remarks", e.target.value)
                        }
                        disabled={loading || submitted}
                        placeholder="Why this score?"
                        rows={3}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                      />
                    </td>

                    <td className="border-b border-slate-200 p-2 text-right">
                      {/* <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={loading || submitted || rubricRows.length === 1}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Remove
                      </button> */}

                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={loading || submitted || rubricRows.length === 1}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 8.586 4.707 3.293a1 1 0 0 0-1.414 1.414L8.586 10l-5.293 5.293a1 1 0 1 0 1.414 1.414L10 11.414l5.293 5.293a1 1 0 0 0 1.414-1.414L11.414 10l5.293-5.293a1 1 0 0 0-1.414-1.414L10 8.586Z"
                            clipRule="evenodd"
                          />
                        </svg>
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
              className="rounded-xl bg-slate-900 px-5 py-2.5 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              {loading
                ? "Submitting..."
                : submitted
                  ? "Submitted"
                  : "Submit"}
            </button>

            {!loading && !submitted && !hasAnyRubricContent ? (
              <span className="text-sm text-slate-500">
                Fill in at least one rubric row to continue.
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}