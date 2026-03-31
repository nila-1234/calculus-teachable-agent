"use client";

import { SCENARIO } from "@/lib/prompts";

type ChoiceId = "A" | "B" | "C";

type Choice = {
  id: ChoiceId;
  text: string;
};

const CHOICES: Choice[] = [
  {
    id: "A",
    text: "Which weeks should be treated as especially important because the rate at which profit is changing is zero or is not defined?",
  },
  {
    id: "B",
    text: "Which weeks should be treated as especially important because the profit value itself is zero or is not defined?",
  },
  {
    id: "C",
    text: "Which weeks should be treated as especially important because the profit reaches a local high or a local low?",
  },
];

type AuthorQuestionPanelProps = {
  selectedChoice: ChoiceId | "";
  setSelectedChoice: (value: ChoiceId) => void;
  submitted: boolean;
  loading: boolean;
  onSubmit: () => void;
};

export default function AuthorQuestionPanel({
  selectedChoice,
  setSelectedChoice,
  submitted,
  loading,
  onSubmit,
}: AuthorQuestionPanelProps) {
  const isEmpty = !selectedChoice;
  const isDisabled = isEmpty || loading || submitted;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-red-200 bg-red-50 shadow-sm">
      <div className="rounded-t-2xl bg-red-100 px-6 py-4">
        <h1 className="text-xl font-semibold text-slate-900">Choose a Question</h1>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        <div className="rounded-2xl bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Scenario</h2>
          <p className="mt-3 whitespace-pre-line leading-7 text-slate-800">
            {SCENARIO}
          </p>

          <p className="mt-4 font-medium text-slate-900">
            Student task: Choose the question that best translates the team’s concern into mathematical language.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Question Choices</h2>

          <div className="mt-4 space-y-3">
            {CHOICES.map((choice) => {
              const isSelected = selectedChoice === choice.id;

              return (
                <label
                  key={choice.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border border-2 p-4 transition ${isSelected
                      ? "border-red-300 bg-red-100"
                      : "border-gray-200 bg-white hover:border-red-200 hover:bg-red-50"
                    } ${submitted ? "cursor-not-allowed opacity-90" : ""}`}
                >
                  <input
                    type="radio"
                    name="question-choice"
                    value={choice.id}
                    checked={isSelected}
                    onChange={() => setSelectedChoice(choice.id)}
                    disabled={loading || submitted}
                    className="mt-1 h-4 w-4 accent-red-400 transition hover:accent-red-500"
                  />

                  <div className="flex gap-2">
                    <span className="font-medium">{choice.id}.</span>
                    <span className="text-slate-800">
                      {choice.text}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={onSubmit}
              disabled={isDisabled}
              className="rounded-xl bg-red-300 px-5 py-2.5 font-medium text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            >
              {loading ? "Submitting..." : submitted ? "Submitted" : "Submit"}
            </button>

            {!loading && !submitted && isEmpty ? (
              <span className="text-sm text-slate-500">
                Select a question to continue.
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}