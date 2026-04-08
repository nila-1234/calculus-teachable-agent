"use client";

import { useEffect, useState } from "react";
import ApplyRubricPanel, {
  AnswerEvaluation,
  RubricCriterion,
} from "@/components/apply-rubric-panel";
import { RUBRIC_OPTIONS } from "@/lib/question-schema";
import { APPLY_RUBRIC_ANSWERS } from "@/lib/apply-rubric-schema";

export default function ApplyRubricPage() {
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [answers, setAnswers] = useState<AnswerEvaluation[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("selectedRubricIds");
    const ids: string[] = raw ? JSON.parse(raw) : [];

    setRubric(
      ids.map((id) => {
        const match = RUBRIC_OPTIONS.find((option) => option.id === id);
        return {
          id,
          label: match?.label || id,
        };
      })
    );

    setAnswers(
      APPLY_RUBRIC_ANSWERS.map((answer) => ({
        ...answer,
        results: {},
      }))
    );
  }, []);

  const handleToggleResult = (
    answerId: string,
    criterionId: string,
    value: "pass" | "fail"
  ) => {
    if (submitted) return;

    setAnswers((prev) =>
      prev.map((answer) =>
        answer.id === answerId
          ? {
            ...answer,
            results: {
              ...answer.results,
              [criterionId]: value,
            },
          }
          : answer
      )
    );
  };

  const handleSubmit = () => {
    sessionStorage.setItem("appliedRubricResults", JSON.stringify(answers));
    setFeedback(
      "Placeholder feedback"
    );
    setSubmitted(true);
  };

  return (
    <main
      className="min-h-screen p-3 overflow-y-auto"
      style={{ backgroundColor: "var(--lime-8)" }}
    >
      <div className="flex-1 min-h-0">
        <ApplyRubricPanel
          rubric={rubric}
          answers={answers}
          submitted={submitted}
          feedback={feedback}
          onToggleResult={handleToggleResult}
          onSubmit={handleSubmit}
        />
      </div>
    </main>
  );
}