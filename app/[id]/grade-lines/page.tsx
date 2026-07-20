"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import LineRubricPanel, {
  LinePlacement,
  LinePlacementsState,
  LineReviewState,
  RubricCriterion,
} from "@/components/line-rubric-panel";
import { getScenario } from "@/lib/scenarios/registry";
import AppHeader from "@/components/app-header";
import StepProgress from "@/components/step-progress";
import StepIntro from "@/components/step-intro";
import { parseScenarioId } from "@/lib/scenarios/utils";
import { logEvent } from "@/lib/logger";

function GradeLinesPageContent() {
  const params = useParams();
  const scenarioId = parseScenarioId(params.id);
  const scenario = scenarioId ? getScenario(scenarioId) : null;

  if (!scenarioId || !scenario) {
    return <main className="p-6">Scenario not found.</main>;
  }

  const { RUBRIC_OPTIONS, FINAL_AI_ANSWERS } = scenario.schema;

  const [question, setQuestion] = useState("");
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [placements, setPlacements] = useState<LinePlacementsState>({});
  const [reviewStates, setReviewStates] = useState<LineReviewState>({});
  const [loadingAnswerId, setLoadingAnswerId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [comments, setComments] = useState<Record<string, Record<string, string>>>({});
  const [commentsPending, setCommentsPending] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    setQuestion(sessionStorage.getItem(`scenario:${scenarioId}:studentQuestion`) || "");
  }, [scenarioId]);

  useEffect(() => {
    const raw = sessionStorage.getItem(`scenario:${scenarioId}:selectedRubricIds`);
    const ids: string[] = raw ? JSON.parse(raw) : RUBRIC_OPTIONS.map((option) => option.id);

    const selectedRubric = ids.map((id) => {
      const match = RUBRIC_OPTIONS.find((option) => option.id === id);
      return { id, label: match?.label || id };
    });

    setRubric(selectedRubric);
  }, [RUBRIC_OPTIONS, scenarioId]);

  const handlePlacementsChange = (
    answerId: string,
    next: Record<string, LinePlacement>
  ) => {
    setPlacements((prev) => ({ ...prev, [answerId]: next }));
  };

  const splitIntoLines = (text: string) =>
    text
      .split("\n\n")
      .map((line) => line.trim())
      .filter(Boolean);

  const fetchNudgeComment = async (
    answerId: string,
    criterionId: string,
    criterionLabel: string,
    lineText: string,
    feedbackItem: {
      status: "pass" | "fail" | null;
      expectedStatus: "pass" | "fail" | null;
      statusCorrect: boolean;
      placedLine: number | null;
      expectedLines: number[];
      lineCorrect: boolean;
    }
  ) => {
    const answer = FINAL_AI_ANSWERS.find((item) => item.id === answerId);
    if (!answer) return;

    setCommentsPending((prev) => ({
      ...prev,
      [answerId]: { ...prev[answerId], [criterionId]: true },
    }));

    try {
      const res = await fetch("/api/grade-lines-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answerTitle: answer.label,
          answerText: answer.text,
          question,
          criterionLabel,
          lineText,
          userStatus: feedbackItem.status,
          expectedStatus: feedbackItem.expectedStatus,
          statusCorrect: feedbackItem.statusCorrect,
          placedLine: feedbackItem.placedLine,
          expectedLines: feedbackItem.expectedLines,
          lineCorrect: feedbackItem.lineCorrect,
        }),
      });
      const data = await res.json();

      setComments((prev) => ({
        ...prev,
        [answerId]: { ...prev[answerId], [criterionId]: data.reply ?? "" },
      }));
    } catch {
      // Ignore comment errors; the pass/fail result above is unaffected.
    } finally {
      setCommentsPending((prev) => ({
        ...prev,
        [answerId]: { ...prev[answerId], [criterionId]: false },
      }));
    }
  };

  const handleSubmitAnswer = async (answerId: string) => {
    const answer = FINAL_AI_ANSWERS.find((item) => item.id === answerId);
    const answerPlacements = placements[answerId];

    if (!answer || !answerPlacements) return;

    logEvent("grade_lines_submitted", scenarioId, {
      answer_id: answerId,
      placements: answerPlacements,
    });

    try {
      setLoadingAnswerId(answerId);

      const res = await fetch("/api/grade-lines-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId,
          answerId,
          answerTitle: answer.label,
          rubric: rubric.map((criterion) => ({
            criterionId: criterion.id,
            criterion: criterion.label,
          })),
          rubricFit: answer.rubricFit,
          placements: answerPlacements,
        }),
      });

      const data = await res.json();

      const feedbackList: LineReviewState[string]["feedback"][string][] = Array.isArray(
        data.feedback
      )
        ? data.feedback
        : [];

      const feedbackByCriterion: LineReviewState[string]["feedback"] = Object.fromEntries(
        feedbackList.map((item) => [item.criterionId, item])
      );

      setReviewStates((prev) => ({
        ...prev,
        [answerId]: { submitted: true, feedback: feedbackByCriterion },
      }));

      const lines = splitIntoLines(answer.text);
      feedbackList
        .filter((item) => !item.correct)
        .forEach((item) => {
          const lineText =
            item.placedLine != null ? lines[item.placedLine - 1] ?? "" : "";
          fetchNudgeComment(answerId, item.criterionId, item.criterion, lineText, item);
        });
    } catch {
      setReviewStates((prev) => ({
        ...prev,
        [answerId]: { submitted: true, feedback: {} },
      }));
    } finally {
      setLoadingAnswerId(null);
    }
  };

  return (
    <main className="min-h-screen bg-stone-100">
      <AppHeader />
      <div className="mx-auto max-w-7xl p-3 py-6 sm:px-6">
        <StepProgress currentStep={2} scenarioId={scenarioId} />
        <StepIntro
          className="max-w-7xl"
          eyebrow="Your task"
          title="Step 3 · Evaluate AI student answers"
          paragraphs={[
            "Before applying your rubric to real student answers, test it with sample solutions. You asked AI to role-play as students and generate several responses.",
            "Drag each rubric item onto the exact line of the answer it applies to, then mark that line pass or fail.",
          ]}
        />

        <LineRubricPanel
          question={question}
          rubric={rubric}
          answers={FINAL_AI_ANSWERS}
          placements={placements}
          onPlacementsChange={handlePlacementsChange}
          reviewStates={reviewStates}
          loadingAnswerId={loadingAnswerId}
          onSubmitAnswer={handleSubmitAnswer}
          comments={comments}
          commentsPending={commentsPending}
          currentIndex={currentIndex}
          onCurrentIndexChange={setCurrentIndex}
        />
      </div>
    </main>
  );
}

export default function GradeLinesPage() {
  return (
    <Suspense>
      <GradeLinesPageContent />
    </Suspense>
  );
}
