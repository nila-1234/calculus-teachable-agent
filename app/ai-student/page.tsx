"use client";

import { useEffect, useState } from "react";
import AiStudentPanel from "../../components/ai-student-panel";

type AiStudentAnswer = {
  label: string;
  text: string;
  correct: boolean;
};

export type RubricRow = {
  id: string;
  criteria: string;
  score: "Pass" | "Fail" | "";
};

type ChoiceId = "A" | "B" | "C" | "";

function createRubricRowId() {
  return `rubric-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const INITIAL_RUBRIC_ROWS: RubricRow[] = [
  { id: createRubricRowId(), criteria: "", score: ""},
  { id: createRubricRowId(), criteria: "", score: ""},
  { id: createRubricRowId(), criteria: "", score: ""},
];

export default function AiStudentPage() {
  const [question, setQuestion] = useState("");
  const [selectedChoice, setSelectedChoice] = useState<ChoiceId>("");
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [aiAnswers, setAiAnswers] = useState<AiStudentAnswer[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [rubricRows, setRubricRows] = useState<RubricRow[]>(INITIAL_RUBRIC_ROWS);

  useEffect(() => {
    const savedQuestion = sessionStorage.getItem("studentQuestion") || "";
    const savedChoice = (sessionStorage.getItem("selectedChoice") || "") as ChoiceId;

    setQuestion(savedQuestion);
    setSelectedChoice(savedChoice);

    if (!savedQuestion) return;

    const loadAnswers = async () => {
      try {
        setLoadingAnswers(true);

        const res = await fetch("/api/ai-student-answers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentQuestion: savedQuestion,
            selectedChoice: savedChoice,
          }),
        });

        const data = await res.json();
        setAiAnswers(Array.isArray(data.answers) ? data.answers : []);
      } finally {
        setLoadingAnswers(false);
      }
    };

    loadAnswers();
  }, []);

  const hasAnyRubricContent = rubricRows.some(
    (row) => row.criteria.trim() || row.score.trim()
  );

  const handleSubmit = async () => {
    if (!hasAnyRubricContent || loadingFeedback || submitted) return;

    try {
      setLoadingFeedback(true);

      const humanAssignedRubric = {
        rows: rubricRows
          .filter(
            (row) =>
              row.criteria.trim() || row.score.trim()
          )
          .map((row) => ({
            criteria: row.criteria.trim(),
            score: row.score.trim(),
          })),
      };

      const res = await fetch("/api/evaluate-rubric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentQuestion: question,
          selectedChoice,
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
    <main
      className="h-screen p-3 flex"
      style={{ backgroundColor: "var(--lime-8)" }}
    >
      <div className="flex-1 min-h-0">
        <AiStudentPanel
          question={question}
          rubricRows={rubricRows}
          setRubricRows={setRubricRows}
          submitted={submitted}
          loading={loadingFeedback}
          aiAnswer={aiAnswers[0]?.text || ""}
          answersLoading={loadingAnswers}
          onSubmit={handleSubmit}
          feedback={feedback}
        />
      </div>
    </main>
  );
}