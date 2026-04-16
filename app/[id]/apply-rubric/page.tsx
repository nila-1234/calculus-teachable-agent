"use client";

import { useEffect, useState } from "react";
import ApplyRubricPanel, {
  AnswerReviewState,
  RubricCriterion,
} from "@/components/apply-rubric-panel";
import { RUBRIC_OPTIONS, FINAL_AI_ANSWERS } from "@/lib/scenarios/1/question-schema";

export default function ApplyRubricPage() {
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [reviewStates, setReviewStates] = useState<
    Record<string, AnswerReviewState>
  >({});
  const [loadingAnswerId, setLoadingAnswerId] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("selectedRubricIds");
    const ids: string[] = raw ? JSON.parse(raw) : [];

    const selectedRubric = ids.map((id) => {
      const match = RUBRIC_OPTIONS.find((option) => option.id === id);
      return {
        id,
        label: match?.label || id,
      };
    });

    setRubric(selectedRubric);

    const initialReviewStates = Object.fromEntries(
      FINAL_AI_ANSWERS.map((answer) => [
        answer.id,
        {
          results: Object.fromEntries(
            selectedRubric.map((criterion) => [criterion.id, ""])
          ) as Record<string, "pass" | "fail" | "">,
          submitted: false,
          feedback: "",
        },
      ])
    );

    setReviewStates(initialReviewStates);
  }, []);

  const handleToggleResult = (
    answerId: string,
    criterionId: string,
    value: "pass" | "fail"
  ) => {
    setReviewStates((prev) => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        results: {
          ...prev[answerId].results,
          [criterionId]: value,
        },
      },
    }));
  };

  const handleSubmitAnswer = async (answerId: string) => {
    const review = reviewStates[answerId];
    const answer = FINAL_AI_ANSWERS.find((item) => item.id === answerId);

    if (!review || !answer) return;

    try {
      setLoadingAnswerId(answerId);

      const res = await fetch("/api/apply-rubric-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answerId,
          answerTitle: answer.title,
          answerText: answer.text,
          rubric,
          results: review.results,
        }),
      });

      const data = await res.json();

      setReviewStates((prev) => {
        const next = {
          ...prev,
          [answerId]: {
            ...prev[answerId],
            submitted: true,
            feedback: data.feedback ?? "No feedback returned.",
          },
        };

        sessionStorage.setItem("appliedRubricResults", JSON.stringify(next));
        return next;
      });
    } catch {
      setReviewStates((prev) => {
        const next = {
          ...prev,
          [answerId]: {
            ...prev[answerId],
            submitted: true,
            feedback: "Something went wrong while generating feedback.",
          },
        };

        sessionStorage.setItem("appliedRubricResults", JSON.stringify(next));
        return next;
      });
    } finally {
      setLoadingAnswerId(null);
    }
  };

  return (
    <main
      className="h-screen p-3"
      style={{ backgroundColor: "var(--lime-8)" }}
    >
      <div className="h-full min-h-0">
        <ApplyRubricPanel
          rubric={rubric}
          answers={FINAL_AI_ANSWERS}
          reviewStates={reviewStates}
          loadingAnswerId={loadingAnswerId}
          onToggleResult={handleToggleResult}
          onSubmitAnswer={handleSubmitAnswer}
        />
      </div>
    </main>
  );
}