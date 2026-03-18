"use client";

import { useEffect, useState } from "react";
import AiStudentPanel from "../../components/ai-student-panel";
import FeedbackCard from "../../components/feedback-card";

type AiStudentAnswer = {
  label: string;
  text: string;
  correct: boolean;
};

export type RubricRow = {
  id: string;
  criteria: string;
  score: string;
  remarks: string;
};

function createRubricRowId() {
  return `rubric-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const INITIAL_RUBRIC_ROWS: RubricRow[] = [
  { id: createRubricRowId(), criteria: "", score: "", remarks: "" },
  { id: createRubricRowId(), criteria: "", score: "", remarks: "" },
  { id: createRubricRowId(), criteria: "", score: "", remarks: "" },
];

export default function AiStudentPage() {
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [aiAnswers, setAiAnswers] = useState<AiStudentAnswer[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [rubricRows, setRubricRows] = useState<RubricRow[]>(INITIAL_RUBRIC_ROWS);

  useEffect(() => {
    const savedQuestion = sessionStorage.getItem("studentQuestion") || "";
    setQuestion(savedQuestion);

    if (!savedQuestion) return;

    const loadAnswers = async () => {
      try {
        setLoadingAnswers(true);

        const res = await fetch("/api/ai-student-answers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentQuestion: savedQuestion }),
        });

        const data = await res.json();
        setAiAnswers(data.answers || []);
      } finally {
        setLoadingAnswers(false);
      }
    };

    loadAnswers();
  }, []);

  const hasAnyRubricContent = rubricRows.some(
    (row) => row.criteria.trim() || row.score.trim() || row.remarks.trim()
  );

  const handleSubmit = async () => {
    if (!hasAnyRubricContent || loadingFeedback || submitted) return;

    try {
      setLoadingFeedback(true);

      const humanAssignedRubric = {
        rows: rubricRows
          .filter(
            (row) =>
              row.criteria.trim() || row.score.trim() || row.remarks.trim()
          )
          .map((row) => ({
            criteria: row.criteria.trim(),
            score: row.score.trim(),
            remarks: row.remarks.trim(),
          })),
      };

      const res = await fetch("/api/evaluate-rubric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentQuestion: question,
          "human-assigned-rubric": humanAssignedRubric,
        }),
      });

      const data = await res.json();
      setFeedback(data.feedback ?? "No feedback returned.");
      setSubmitted(true);
    } catch {
      setFeedback("Something went wrong while generating feedback.");
    } finally {
      setLoadingFeedback(false);
    }
  };

  return (
    <main className="min-h-screen bg-red-200 p-3">
      <div className="grid min-h-[calc(100vh-1.5rem)] grid-cols-1 gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="min-h-0">
          <AiStudentPanel
            question={question}
            rubricRows={rubricRows}
            setRubricRows={setRubricRows}
            submitted={submitted}
            loading={loadingFeedback}
            aiAnswer={aiAnswers[0]?.text || ""}
            answersLoading={loadingAnswers}
            onSubmit={handleSubmit}
          />
        </div>

        <div className="min-h-0">
          <FeedbackCard
            title="Rubric Feedback"
            text={feedback}
            loading={loadingFeedback}
            emptyMessage="Submit your rubric to receive AI feedback."
          />
        </div>
      </div>
    </main>
  );
}