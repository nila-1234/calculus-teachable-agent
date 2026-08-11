"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import LineRubricPanel, {
  StepPlacement,
  StepPlacementsState,
  StepReviewState,
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
  const router = useRouter();
  const query = useSearchParams().toString();
  const scenarioId = parseScenarioId(params.id);
  const scenario = scenarioId ? getScenario(scenarioId) : null;

  if (!scenarioId || !scenario) {
    return <main className="p-6">Scenario not found.</main>;
  }

  const { RUBRIC_OPTIONS, FINAL_AI_ANSWERS } = scenario.schema;

  const [question, setQuestion] = useState("");
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [placements, setPlacements] = useState<StepPlacementsState>({});
  const [reviewStates, setReviewStates] = useState<StepReviewState>({});
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
    next: Record<string, StepPlacement>
  ) => {
    setPlacements((prev) => ({ ...prev, [answerId]: next }));
  };

  // Bumped whenever a criterion is reset, so a nudge request that was already in flight can be
  // discarded instead of re-attaching a comment to an ungraded item.
  const commentRequestIds = useRef<Record<string, number>>({});

  const handleCriterionReset = (answerId: string, criterionId: string) => {
    const key = `${answerId}:${criterionId}`;
    commentRequestIds.current[key] = (commentRequestIds.current[key] ?? 0) + 1;

    setReviewStates((prev) => {
      const answerReview = prev[answerId];
      if (!answerReview || !(criterionId in answerReview.feedback)) return prev;

      const feedback = { ...answerReview.feedback };
      delete feedback[criterionId];
      return { ...prev, [answerId]: { ...answerReview, feedback } };
    });

    setComments((prev) => {
      if (!(criterionId in (prev[answerId] ?? {}))) return prev;
      const answerComments = { ...prev[answerId] };
      delete answerComments[criterionId];
      return { ...prev, [answerId]: answerComments };
    });

    setCommentsPending((prev) => {
      if (!(criterionId in (prev[answerId] ?? {}))) return prev;
      const answerPending = { ...prev[answerId] };
      delete answerPending[criterionId];
      return { ...prev, [answerId]: answerPending };
    });
  };

  const fetchNudgeComment = async (
    answerId: string,
    criterionId: string,
    criterionLabel: string,
    stepText: string,
    expectedStepText: string,
    feedbackItem: {
      status: "pass" | "fail" | null;
      expectedStatus: "pass" | "fail" | null;
      statusCorrect: boolean;
      placedStep: number | null;
      expectedStep: number;
      stepCorrect: boolean;
      feedback: string;
    }
  ) => {
    const answer = FINAL_AI_ANSWERS.find((item) => item.id === answerId);
    if (!answer) return;

    const requestKey = `${answerId}:${criterionId}`;
    const requestId = commentRequestIds.current[requestKey] ?? 0;
    const isStale = () => (commentRequestIds.current[requestKey] ?? 0) !== requestId;

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
          answerText: answer.steps.join("\n\n"),
          question,
          criterionLabel,
          stepText,
          expectedStepText,
          feedback: feedbackItem.feedback,
          userStatus: feedbackItem.status,
          expectedStatus: feedbackItem.expectedStatus,
          statusCorrect: feedbackItem.statusCorrect,
          placedStep: feedbackItem.placedStep,
          expectedStep: feedbackItem.expectedStep,
          stepCorrect: feedbackItem.stepCorrect,
        }),
      });
      const data = await res.json();

      if (isStale()) return;

      setComments((prev) => ({
        ...prev,
        [answerId]: { ...prev[answerId], [criterionId]: data.reply ?? "" },
      }));
    } catch {
      // Ignore comment errors; the pass/fail result above is unaffected.
    } finally {
      if (!isStale()) {
        setCommentsPending((prev) => ({
          ...prev,
          [answerId]: { ...prev[answerId], [criterionId]: false },
        }));
      }
    }
  };

  const handleComplete = () => {
    sessionStorage.setItem(`scenario:${scenarioId}:rubricCompleted`, "true");
    logEvent("grade_lines_completed", scenarioId, {});
    router.push(query ? `/scenarios?${query}` : "/scenarios");
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

      const feedbackList: StepReviewState[string]["feedback"][string][] = Array.isArray(
        data.feedback
      )
        ? data.feedback
        : [];

      const feedbackByCriterion: StepReviewState[string]["feedback"] = Object.fromEntries(
        feedbackList.map((item) => [item.criterionId, item])
      );

      setReviewStates((prev) => ({
        ...prev,
        [answerId]: { submitted: true, feedback: feedbackByCriterion },
      }));

      feedbackList
        .filter((item) => !item.correct)
        .forEach((item) => {
          const stepText =
            item.placedStep != null ? answer.steps[item.placedStep - 1] ?? "" : "";
          const expectedStepText = answer.steps[item.expectedStep - 1] ?? "";
          fetchNudgeComment(
            answerId,
            item.criterionId,
            item.criterion,
            stepText,
            expectedStepText,
            item
          );
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
            "You are the grader here. Drag each rubric item onto the exact step of the answer it applies to, then judge the AI student against that criterion: mark it pass if their step meets the criterion, fail if it does not.",
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
          onCriterionReset={handleCriterionReset}
          currentIndex={currentIndex}
          onCurrentIndexChange={setCurrentIndex}
          onComplete={handleComplete}
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
