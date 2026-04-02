"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthorQuestionPanel from "../../components/author-question-panel";

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
    <main className="h-screen bg-plum-200 p-3 flex"
      style={{ backgroundColor: "var(--lime-8)" }}>
      <div className="flex-1 min-h-0">
        <AuthorQuestionPanel
          selectedChoice={selectedChoice}
          setSelectedChoice={setSelectedChoice}
          submitted={submitted}
          loading={loading}
          onSubmit={handleSubmit}
          onContinue={handleContinue}
          feedback={feedback}
        />
      </div>
    </main>
  );
}