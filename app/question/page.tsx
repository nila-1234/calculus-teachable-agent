"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthorQuestionPanel from "../../components/author-question-panel";
import FeedbackCard from "../../components/feedback-card";

const QUESTION_CHOICES = {
  A: "Which weeks should be treated as especially important because the rate at which profit is changing is zero or is not defined?",
  B: "Which weeks should be treated as especially important because the profit value itself is zero or is not defined?",
  C: "Which weeks should be treated as especially important because the profit reaches a local high or a local low?",
} as const;

type ChoiceId = keyof typeof QUESTION_CHOICES;

export default function QuestionPage() {
  const router = useRouter();

  const [selectedChoice, setSelectedChoice] = useState<ChoiceId | "">("");
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedChoice || loading || submitted) return;

    const selectedQuestion = QUESTION_CHOICES[selectedChoice];

    try {
      setLoading(true);

      const res = await fetch("/api/evaluate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedChoice,
          selectedQuestion,
        }),
      });

      const data = await res.json();
      setFeedback(data.feedback ?? "No feedback returned.");
      setSubmitted(true);
    } catch {
      setFeedback("Something went wrong while generating feedback.");
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!selectedChoice) return;

    const selectedQuestion = QUESTION_CHOICES[selectedChoice];

    sessionStorage.setItem("studentQuestion", selectedQuestion);
    sessionStorage.setItem("selectedChoice", selectedChoice);

    router.push("/ai-student");
  };

  return (
    <main className="min-h-screen bg-red-200 p-3">
      {/* <div className="grid min-h-[calc(100vh-1.5rem)] grid-cols-1 gap-3 lg:grid-cols-[1.15fr_0.85fr]"> */}
      <div className="grid min-h-[calc(100vh-1.5rem)] grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">

        <div className="flex min-h-0 flex-col gap-3">
          <AuthorQuestionPanel
            selectedChoice={selectedChoice}
            setSelectedChoice={setSelectedChoice}
            submitted={submitted}
            loading={loading}
            onSubmit={handleSubmit}
          />

          {submitted && selectedChoice === "A" ? (
            <div className="rounded-2xl bg-red-50 px-6 py-4 shadow-sm">
              <button
                type="button"
                onClick={handleContinue}
                className="w-full rounded-xl bg-red-300 px-5 py-3 font-medium text-white transition hover:bg-red-400"
              >
                Continue
              </button>
            </div>
          ) : null}
        </div>

        <div className="min-h-0">
          <FeedbackCard
            title="Feedback"
            text={feedback}
            loading={loading}
            emptyMessage="Submit your selected question to receive AI feedback."
          />
        </div>
      </div>
    </main>
  );
}