"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import LineRubricPanel, {
  GradingDisputesState,
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
import type { ScenarioModule } from "@/lib/scenarios/types";
import { logEvent } from "@/lib/logger";

function GradeLinesPageContent() {
  const params = useParams();
  const query = useSearchParams().toString();
  const scenarioId = parseScenarioId(params.id);
  const scenario = scenarioId ? getScenario(scenarioId) : null;

  if (!scenarioId || !scenario) {
    return <main className="p-6">Scenario not found.</main>;
  }

  return <GradeLinesScenarioPage scenarioId={scenarioId} scenario={scenario} query={query} />;
}

function GradeLinesScenarioPage({
  scenarioId,
  scenario,
  query,
}: {
  scenarioId: number;
  scenario: ScenarioModule;
  query: string;
}) {
  const router = useRouter();
  const { RUBRIC_OPTIONS, FINAL_AI_ANSWERS } = scenario.schema;

  const [question, setQuestion] = useState("");
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [placements, setPlacements] = useState<StepPlacementsState>({});
  const [reviewStates, setReviewStates] = useState<StepReviewState>({});
  const [loadingAnswerId, setLoadingAnswerId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [disputes, setDisputes] = useState<GradingDisputesState>({});

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

  // Bumped whenever a criterion is reset, so an in-flight dialogue turn cannot
  // be attached to a grading state that the learner has since changed.
  const disputeRequestIds = useRef<Record<string, number>>({});

  const handleCriterionReset = (answerId: string, criterionId: string) => {
    const key = `${answerId}:${criterionId}`;
    disputeRequestIds.current[key] = (disputeRequestIds.current[key] ?? 0) + 1;

    setReviewStates((prev) => {
      const answerReview = prev[answerId];
      if (!answerReview || !(criterionId in answerReview.feedback)) return prev;

      const feedback = { ...answerReview.feedback };
      delete feedback[criterionId];
      return { ...prev, [answerId]: { ...answerReview, feedback } };
    });

    setDisputes((prev) => {
      if (!(criterionId in (prev[answerId] ?? {}))) return prev;
      const answerDisputes = { ...prev[answerId] };
      delete answerDisputes[criterionId];
      return { ...prev, [answerId]: answerDisputes };
    });
  };

  const requestDisputeTurn = async (
    answerId: string,
    criterionId: string,
    criterionLabel: string,
    feedbackItem: {
      status: "pass" | "fail" | null;
      expectedStatus: "pass" | "fail" | null;
      placedStep: number | null;
      expectedStep: number;
      feedback: string;
    },
    turn:
      | { kind: "start" }
      | {
          kind: "continue";
          userMessage: string;
          history: GradingDisputesState[string][string]["messages"];
        },
  ) => {
    const answer = FINAL_AI_ANSWERS.find((item) => item.id === answerId);
    if (
      !answer ||
      feedbackItem.status == null ||
      feedbackItem.expectedStatus == null ||
      feedbackItem.placedStep == null ||
      feedbackItem.status === feedbackItem.expectedStatus
    ) {
      return;
    }

    const requestKey = `${answerId}:${criterionId}`;
    const requestId = disputeRequestIds.current[requestKey] ?? 0;
    const isStale = () => (disputeRequestIds.current[requestKey] ?? 0) !== requestId;
    const speaker = feedbackItem.expectedStatus === "pass" ? "ai-student" : "professor";
    const existingMessages = turn.kind === "continue" ? turn.history : [];

    setDisputes((prev) => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        [criterionId]: {
          speaker,
          status: "continue",
          recommendedMark: feedbackItem.expectedStatus!,
          reasoningFocus:
            turn.kind === "continue"
              ? "respond-to-user"
              : speaker === "ai-student"
                ? "criterion-satisfaction"
                : "criterion-gap",
          evidenceStep: {
            number: feedbackItem.expectedStep,
            quote: answer.steps[feedbackItem.expectedStep - 1]?.slice(0, 240) ?? "",
          },
          messages: existingMessages,
          pending: true,
        },
      },
    }));

    try {
      const res = await fetch("/api/grade-lines-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: {
            id: scenarioId,
            text: scenario.schema.SCENARIO_PLACEHOLDER,
          },
          question: question || scenario.schema.QUESTION_PLACEHOLDER,
          answer: {
            id: answer.id,
            label: answer.label,
            steps: answer.steps,
          },
          criterion: { id: criterionId, label: criterionLabel },
          placement: {
            userStep: feedbackItem.placedStep,
            expectedStep: feedbackItem.expectedStep,
          },
          marks: {
            userMark: feedbackItem.status,
            expectedMark: feedbackItem.expectedStatus,
          },
          gradingRationale: feedbackItem.feedback,
          history: existingMessages.map((message) => ({
            speaker: message.role === "user" ? "user" : speaker,
            message: message.text,
          })),
          turn: {
            kind: turn.kind,
            number: existingMessages.filter((message) => message.role !== "user").length + 1,
            currentSpeaker: speaker,
            ...(turn.kind === "continue" ? { userMessage: turn.userMessage } : {}),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Dispute request failed.");

      if (isStale()) return;

      setDisputes((prev) => {
        const current = prev[answerId]?.[criterionId];
        if (!current) return prev;
        return {
          ...prev,
          [answerId]: {
            ...prev[answerId],
            [criterionId]: {
              ...current,
              speaker: data.speaker,
              status: data.status,
              recommendedMark: data.recommendedMark,
              reasoningFocus: data.reasoningFocus,
              evidenceStep: data.evidenceStep,
              messages: [
                ...current.messages,
                {
                  id: `${speaker}-${criterionId}-${Date.now()}`,
                  role: data.speaker,
                  text: data.message,
                },
              ],
              pending: false,
            },
          },
        };
      });
    } catch {
      if (!isStale()) {
        setDisputes((prev) => {
          const current = prev[answerId]?.[criterionId];
          if (!current) return prev;
          return {
            ...prev,
            [answerId]: {
              ...prev[answerId],
              [criterionId]: { ...current, pending: false },
            },
          };
        });
      }
    }
  };

  const handleSendDisputeMessage = (
    answerId: string,
    criterionId: string,
    text: string,
  ) => {
    const dispute = disputes[answerId]?.[criterionId];
    const feedbackItem = reviewStates[answerId]?.feedback[criterionId];
    const criterion = rubric.find((item) => item.id === criterionId);
    if (
      !dispute ||
      !feedbackItem ||
      !criterion ||
      dispute.pending ||
      dispute.status === "resolved"
    ) {
      return;
    }

    const history = [
      ...dispute.messages,
      { id: `user-${criterionId}-${Date.now()}`, role: "user" as const, text },
    ];
    requestDisputeTurn(answerId, criterionId, criterion.label, feedbackItem, {
      kind: "continue",
      userMessage: text,
      history,
    });
  };

  const handleEndDispute = (answerId: string, criterionId: string) => {
    disputeRequestIds.current[`${answerId}:${criterionId}`] =
      (disputeRequestIds.current[`${answerId}:${criterionId}`] ?? 0) + 1;
    setDisputes((prev) => {
      const current = prev[answerId]?.[criterionId];
      if (!current) return prev;
      return {
        ...prev,
        [answerId]: {
          ...prev[answerId],
          [criterionId]: { ...current, status: "resolved", pending: false },
        },
      };
    });
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
        .filter(
          (item) =>
            !item.statusCorrect &&
            item.status != null &&
            item.expectedStatus != null,
        )
        .forEach((item) => {
          requestDisputeTurn(
            answerId,
            item.criterionId,
            item.criterion,
            item,
            { kind: "start" },
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
            "You are the grader here. Drag each rubric item onto the exact step of the answer it applies to, then judge the AI student against that criterion: mark AI Pass if their step meets the criterion, AI Fail if it does not.",
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
          disputes={disputes}
          onSendDisputeMessage={handleSendDisputeMessage}
          onEndDispute={handleEndDispute}
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
