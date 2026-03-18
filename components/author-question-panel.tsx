"use client";

import MathInput from "./math-input";
import { SCENARIO, STUDENT_TASK } from "@/lib/prompts";

type AuthorQuestionPanelProps = {
  question: string;
  setQuestion: (value: string) => void;
  submitted: boolean;
  loading: boolean;
  onSubmit: () => void;
};

export default function AuthorQuestionPanel({
  question,
  setQuestion,
  submitted,
  loading,
  onSubmit,
}: AuthorQuestionPanelProps) {
  const isEmpty = !question.trim();
  const isDisabled = isEmpty || loading || submitted;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-red-200 bg-red-50 shadow-sm">
      <div className="rounded-t-2xl bg-red-100 px-6 py-4">
        <h1 className="text-xl font-semibold text-slate-900">Create a Question</h1>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        <div className="rounded-2xl bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Scenario</h2>
          <p className="mt-3 whitespace-pre-line text-slate-800">
            {SCENARIO}
          </p>
          <p className="mt-4 whitespace-pre-line text-slate-800">
            {STUDENT_TASK}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Question</h2>

          <div className="mt-4">
            <MathInput
              label=""
              value={question}
              onChange={setQuestion}
              placeholder="Write your question here..."
            />
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={onSubmit}
              disabled={isDisabled}
              className="rounded-xl bg-red-300 px-5 py-2.5 font-medium 
              text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            >
              {loading
                ? "Submitting..."
                : submitted
                  ? "Submitted"
                  : "Submit"}
            </button>

            {!loading && !submitted && isEmpty ? (
              <span className="text-sm text-slate-500">
                Enter a question to continue.
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}