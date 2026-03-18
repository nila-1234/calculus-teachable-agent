"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthorQuestionPanel from "../../components/author-question-panel";
import FeedbackCard from "../../components/feedback-card";

export default function QuestionPage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!question.trim() || loading || submitted) return;

    try {
      setLoading(true);

      const res = await fetch("/api/evaluate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentQuestion: question }),
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
    sessionStorage.setItem("studentQuestion", question);
    router.push("/ai-student");
  };

  return (
    <main className="min-h-screen bg-red-200 p-3">
      <div className="grid min-h-[calc(100vh-1.5rem)] grid-cols-1 gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="flex rounded-2xl min-h-0 flex-col gap-3">
          <AuthorQuestionPanel
            question={question}
            setQuestion={setQuestion}
            submitted={submitted}
            loading={loading}
            onSubmit={handleSubmit}
          />

          {submitted ? (
            // <div className="rounded-2xl bg-red-50 px-6 py-4 shadow-sm">
            //   <button
            //     type="button"
            //     onClick={handleContinue}
            //     className="rounded-xl bg-slate-900 px-5 py-2.5 font-medium text-white transition hover:bg-slate-800"
            //   >
            //     Continue
            //   </button>
            // </div>
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
            emptyMessage="Submit your question to receive AI feedback."
          />
        </div>
      </div>
    </main>
  );
}