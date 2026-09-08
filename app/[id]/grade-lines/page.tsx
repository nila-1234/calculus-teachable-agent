"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import LineRubricPanel, {
  DiscussionMessage,
  GradeComment,
  StepPlacement,
  StepPlacementsState,
  StepReviewState,
  RubricCriterion,
} from "@/components/line-rubric-panel";
import { CommentSpeaker, pickChallengeSpeaker, pickSpeakers } from "@/lib/grading-voice";
import { getScenario } from "@/lib/scenarios/registry";
import AppHeader from "@/components/app-header";
import StepProgress from "@/components/step-progress";
import StepIntro from "@/components/step-intro";
import { parseScenarioId } from "@/lib/scenarios/utils";
import { logEvent } from "@/lib/logger";

// Chance that a correctly-graded criterion still gets challenged in discussion, so the
// TA sometimes has to defend a right call instead of only ever fixing wrong ones.
const CHALLENGE_RATE = 0.2;

function GradeLinesPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  // 1 = plain comment bubbles (previous setup), 2 = comment bubbles + the
  // "Reply" discussion drawer. Defaults to 2.
  const discussionMode = parseInt(searchParams.get("discussionMode") || "2", 10);
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
  const [comments, setComments] = useState<Record<string, Record<string, GradeComment[]>>>({});
  const [discussions, setDiscussions] = useState<
    Record<string, Record<string, Partial<Record<CommentSpeaker, DiscussionMessage[]>>>>
  >({});
  const [discussionPending, setDiscussionPending] = useState<
    Record<string, Record<string, Partial<Record<CommentSpeaker, boolean>>>>
  >({});
  // Keyed by answerId -> criterionId: true when the thread on this criterion was opened
  // as a random challenge to a correct grade, not a correction of a mistake. Read by the
  // comment/discussion API calls so they can voice doubt instead of asserting an error.
  const [challenges, setChallenges] = useState<Record<string, Record<string, boolean>>>({});

  // Patches one speaker's bubble on a criterion, leaving any other speaker's bubble alone.
  const patchComment = (
    answerId: string,
    criterionId: string,
    speaker: CommentSpeaker,
    patch: Partial<GradeComment>
  ) => {
    setComments((prev) => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        [criterionId]: (prev[answerId]?.[criterionId] ?? []).map((comment) =>
          comment.speaker === speaker ? { ...comment, ...patch } : comment
        ),
      },
    }));
  };

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
    },
    assignment: { speaker: CommentSpeaker; coversStep: boolean; coversStatus: boolean },
    challenge: boolean
  ) => {
    const answer = FINAL_AI_ANSWERS.find((item) => item.id === answerId);
    if (!answer) return;

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
          speaker: assignment.speaker,
          coversStep: assignment.coversStep,
          coversStatus: assignment.coversStatus,
          challenge,
        }),
      });
      const data = await res.json();

      patchComment(answerId, criterionId, assignment.speaker, {
        text: data.reply ?? "",
        pending: false,
      });
    } catch {
      // Ignore comment errors; the pass/fail result above is unaffected, and an empty
      // comment renders nothing rather than blocking the other speaker's bubble.
      patchComment(answerId, criterionId, assignment.speaker, { text: "", pending: false });
    }
  };

  const handleSendDiscussionMessage = async (
    answerId: string,
    criterionId: string,
    speaker: CommentSpeaker,
    text: string
  ) => {
    const answer = FINAL_AI_ANSWERS.find((item) => item.id === answerId);
    const criterionFeedback = reviewStates[answerId]?.feedback?.[criterionId];
    const openingComment = comments[answerId]?.[criterionId]?.find(
      (c) => c.speaker === speaker
    );
    if (!answer || !criterionFeedback || !openingComment) return;

    const challenge = challenges[answerId]?.[criterionId] ?? false;

    const priorMessages = discussions[answerId]?.[criterionId]?.[speaker] ?? [];
    const userMessage: DiscussionMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
    };

    setDiscussions((prev) => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        [criterionId]: {
          ...prev[answerId]?.[criterionId],
          [speaker]: [...priorMessages, userMessage],
        },
      },
    }));
    setDiscussionPending((prev) => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        [criterionId]: {
          ...prev[answerId]?.[criterionId],
          [speaker]: true,
        },
      },
    }));

    try {
      const res = await fetch("/api/grade-lines-discussion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speaker,
          answerTitle: answer.label,
          answerText: answer.steps.join("\n\n"),
          question,
          criterionLabel: criterionFeedback.criterion,
          stepText:
            criterionFeedback.placedStep != null
              ? answer.steps[criterionFeedback.placedStep - 1] ?? ""
              : "",
          feedback: criterionFeedback.feedback,
          userStatus: criterionFeedback.status,
          expectedStatus: criterionFeedback.expectedStatus,
          placedStep: criterionFeedback.placedStep,
          openingComment: openingComment.text,
          messages: priorMessages.map((m) => ({ role: m.role, text: m.text })),
          userMessage: text,
          challenge,
        }),
      });
      const data = await res.json();

      setDiscussions((prev) => ({
        ...prev,
        [answerId]: {
          ...prev[answerId],
          [criterionId]: {
            ...prev[answerId]?.[criterionId],
            [speaker]: [
              ...(prev[answerId]?.[criterionId]?.[speaker] ?? []),
              { id: `${speaker}-${Date.now()}`, role: speaker, text: data.reply ?? "" },
            ],
          },
        },
      }));
    } catch {
      // Ignore discussion errors; the TA's message stays in the thread either way.
    } finally {
      setDiscussionPending((prev) => ({
        ...prev,
        [answerId]: {
          ...prev[answerId],
          [criterionId]: {
            ...prev[answerId]?.[criterionId],
            [speaker]: false,
          },
        },
      }));
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

      const incorrect = feedbackList.filter((item) => !item.correct);
      // Even when the TA got it right, occasionally challenge the call anyway so they
      // have to defend a correct grade, not just fix wrong ones.
      const challenged = feedbackList.filter(
        (item) => item.correct && Math.random() < CHALLENGE_RATE
      );
      const threaded = [...incorrect, ...challenged];

      const assignmentsFor = (item: (typeof feedbackList)[number]) =>
        item.correct
          ? [{ speaker: pickChallengeSpeaker(item.status), coversStep: false, coversStatus: false }]
          : pickSpeakers(item);

      // A resubmit re-grades every criterion from scratch, so this answer's old threads
      // are replaced wholesale rather than merged — otherwise a criterion that was
      // incorrect (or challenged) last time but is now correct and unchallenged would
      // keep showing its stale comment/discussion from before the fix.
      setChallenges((prev) => ({
        ...prev,
        [answerId]: Object.fromEntries(challenged.map((item) => [item.criterionId, true])),
      }));

      setDiscussions((prev) => ({ ...prev, [answerId]: {} }));
      setDiscussionPending((prev) => ({ ...prev, [answerId]: {} }));

      // Seed every bubble as pending up front so both speakers on one criterion appear
      // together and keep a stable order while their replies come back independently.
      setComments((prev) => ({
        ...prev,
        [answerId]: Object.fromEntries(
          threaded.map((item) => [
            item.criterionId,
            assignmentsFor(item).map(({ speaker }) => ({
              speaker,
              text: "",
              pending: true,
            })),
          ])
        ),
      }));

      threaded.forEach((item) => {
        const stepText =
          item.placedStep != null ? answer.steps[item.placedStep - 1] ?? "" : "";
        const expectedStepText = answer.steps[item.expectedStep - 1] ?? "";

        assignmentsFor(item).forEach((assignment) => {
          fetchNudgeComment(
            answerId,
            item.criterionId,
            item.criterion,
            stepText,
            expectedStepText,
            item,
            assignment,
            item.correct
          );
        });
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
            "You are the grader here. Drag each rubric item onto the exact step of the answer it applies to, then judge the AI student against that criterion: mark it pass if their step meets the criterion, fail if it does not. Once you submit, the AI student or the professor will comment on any grading they disagree with.",
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
          discussions={discussions}
          discussionPending={discussionPending}
          onSendDiscussionMessage={handleSendDiscussionMessage}
          discussionMode={discussionMode}
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
