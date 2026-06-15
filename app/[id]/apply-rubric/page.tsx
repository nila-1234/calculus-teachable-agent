"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ApplyRubricPanel, {
  AnswerReviewState,
  RubricCriterion,
} from "@/components/apply-rubric-panel";
import { getScenario } from "@/lib/scenarios/registry";
import { parseScenarioId } from "@/lib/scenarios/utils";
import { logEvent } from "@/lib/logger";

function ApplyRubricPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const mode = parseInt(searchParams.get("applyRubricMode") || "1", 10);

  const scenarioId = parseScenarioId(params.id);
  const scenario = scenarioId ? getScenario(scenarioId) : null;

  if (!scenarioId || !scenario) {
    return <main className="p-6">Scenario not found.</main>;
  }

  const { RUBRIC_OPTIONS, FINAL_AI_ANSWERS } = scenario.schema;

  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [reviewStates, setReviewStates] = useState<Record<string, AnswerReviewState>>({});
  const [loadingAnswerId, setLoadingAnswerId] = useState<string | null>(null);
  // explanations[answerId][criterionId] = explanation text
  const [explanations, setExplanations] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    const raw = sessionStorage.getItem(`scenario:${scenarioId}:selectedRubricIds`);
    const ids: string[] = raw ? JSON.parse(raw) : [];

    const selectedRubric = ids.map((id) => {
      const match = RUBRIC_OPTIONS.find((option) => option.id === id);
      return { id, label: match?.label || id };
    });

    setRubric(selectedRubric);

    const initialReviewStates: Record<string, AnswerReviewState> = Object.fromEntries(
      FINAL_AI_ANSWERS.map((answer) => [
        answer.id,
        {
          results: Object.fromEntries(
            selectedRubric.map((criterion) => [criterion.id, ""])
          ) as Record<string, "" | "pass" | "fail">,
          submitted: false,
          feedback: [],
        },
      ])
    );

    setReviewStates(initialReviewStates);
  }, [RUBRIC_OPTIONS, FINAL_AI_ANSWERS, scenarioId]);

  const handleToggleResult = (answerId: string, criterionId: string, value: "pass" | "fail") => {
    logEvent("apply_rubric_toggle", scenarioId, {
      answer_id: answerId,
      criterion_id: criterionId,
      value,
    });
    setReviewStates((prev) => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        results: { ...prev[answerId].results, [criterionId]: value },
      },
    }));
  };

  const handleModeChange = (newMode: number) => {
    router.replace(`/${scenarioId}/apply-rubric?applyRubricMode=${newMode}`);
  };

  const handleComplete = () => {
    sessionStorage.setItem(`scenario:${scenarioId}:rubricCompleted`, "true");
    router.push("/");
  };

  const handleExplanationChange = (answerId: string, criterionId: string, value: string) => {
    setExplanations((prev) => ({
      ...prev,
      [answerId]: { ...prev[answerId], [criterionId]: value },
    }));
  };

  const handleExplanationBlur = (answerId: string, criterionId: string, value: string) => {
    logEvent("apply_rubric_explanation_blur", scenarioId, {
      answer_id: answerId,
      criterion_id: criterionId,
      explanation: value,
    });
  };

  const handleSubmitAnswer = async (answerId: string) => {
    const review = reviewStates[answerId];
    const answer = FINAL_AI_ANSWERS.find((item) => item.id === answerId);

    if (!review || !answer) return;

    logEvent("apply_rubric_submitted", scenarioId, {
      answer_id: answerId,
      results: review.results,
      mode,
    });

    const rubricWithReviews = rubric.map((criterion) => ({
      criterionId: criterion.id,
      criterion: criterion.label,
      evaluation: review.results[criterion.id],
    }));

    try {
      setLoadingAnswerId(answerId);

      const res = await fetch("/api/apply-rubric-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId,
          answerId,
          answerTitle: answer.label,
          answerText: answer.text,
          rubric: rubricWithReviews,
          results: review.results,
          rubricFit: answer.rubricFit,
          explanations: explanations[answerId] ?? {},
        }),
      });

      const data = await res.json();

      logEvent("apply_rubric_feedback_received", scenarioId, {
        answer_id: answerId,
        feedback: Array.isArray(data.feedback) ? data.feedback : [],
      });

      setReviewStates((prev) => {
        const next = {
          ...prev,
          [answerId]: {
            ...prev[answerId],
            submitted: true,
            feedback: Array.isArray(data.feedback) ? data.feedback : [],
          },
        };

        sessionStorage.setItem(
          `scenario:${scenarioId}:appliedRubricResults`,
          JSON.stringify(next)
        );
        return next;
      });
    } catch {
      setReviewStates((prev) => {
        const next = {
          ...prev,
          [answerId]: { ...prev[answerId], submitted: true, feedback: [] },
        };

        sessionStorage.setItem(
          `scenario:${scenarioId}:appliedRubricResults`,
          JSON.stringify(next)
        );
        return next;
      });
    } finally {
      setLoadingAnswerId(null);
    }
  };

  return (
    <main
      className="min-h-screen p-3 overflow-y-auto"
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
          mode={mode}
          onModeChange={handleModeChange}
          explanations={explanations}
          onExplanationChange={handleExplanationChange}
          onExplanationBlur={handleExplanationBlur}
          onComplete={handleComplete}
        />
      </div>
    </main>
  );
}

export default function ApplyRubricPage() {
  return (
    <Suspense>
      <ApplyRubricPageContent />
    </Suspense>
  );
}
