"use client";

import { Suspense, useState } from "react";
import { useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import LineRubricPanel, {
  DiscussionMessage,
  GradeComment,
  StepPlacement,
  StepPlacementsState,
  StepCriterionFeedback,
  StepReviewState,
  RubricCriterion,
} from "@/components/line-rubric-panel";
import {
  CommentSpeaker,
  pickChallengeSpeaker,
  pickPlacementChallengeSpeaker,
  pickPlacementSpeaker,
  pickStatusSpeaker,
} from "@/lib/grading-voice";
import { getScenario } from "@/lib/scenarios/registry";
import { FinalAiAnswer } from "@/lib/scenarios/types";
import AppHeader from "@/components/app-header";
import StepProgress from "@/components/step-progress";
import StepIntro from "@/components/step-intro";
import { parseScenarioId } from "@/lib/scenarios/utils";
import { logEvent } from "@/lib/logger";

// Chance that a correctly-graded criterion still gets challenged in discussion, so the
// TA sometimes has to defend a right call instead of only ever fixing wrong ones. Split
// by persona since the professor (rigor-checking a Pass, or a placement) and the student
// (second-guessing their own Fail) shouldn't necessarily challenge equally often.
const PROFESSOR_CHALLENGE_RATE = 1;
const STUDENT_CHALLENGE_RATE = 1;

type CommentKind = "placement" | "status";

// Placement and status are graded — and discussed — as two separate, sequential
// moments on the same criterion, so every thread is keyed by criterionId + which of the
// two it's about, rather than by criterionId alone.
const commentKey = (criterionId: string, kind: CommentKind) => `${criterionId}::${kind}`;

const parseCommentKey = (key: string): { criterionId: string; kind: CommentKind } => {
  const separatorIndex = key.lastIndexOf("::");
  return {
    criterionId: key.slice(0, separatorIndex),
    kind: key.slice(separatorIndex + 2) === "placement" ? "placement" : "status",
  };
};

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
  // Keyed by answerId -> criterionId: true while that criterion's placement or status
  // check is in flight.
  const [gradingCriteria, setGradingCriteria] = useState<Record<string, Record<string, boolean>>>(
    {}
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  // Keyed by answerId -> commentKey(criterionId, kind) -> comments, in display order.
  const [comments, setComments] = useState<Record<string, Record<string, GradeComment[]>>>({});
  const [discussions, setDiscussions] = useState<
    Record<string, Record<string, Partial<Record<CommentSpeaker, DiscussionMessage[]>>>>
  >({});
  const [discussionPending, setDiscussionPending] = useState<
    Record<string, Record<string, Partial<Record<CommentSpeaker, boolean>>>>
  >({});
  // Keyed by answerId -> commentKey: true when that thread was opened as a random
  // challenge to a correct grade, not a correction of a mistake. Read by the
  // comment/discussion API calls so they can voice doubt instead of asserting an error.
  const [challenges, setChallenges] = useState<Record<string, Record<string, boolean>>>({});
  // Keyed by answerId -> commentKey: true once the counterpart has conceded the point in
  // discussion. The TA can't move past a mistake or challenge thread until it's either
  // fixed at the source (a fresh, clean regrade) or resolved this way.
  const [resolvedThreads, setResolvedThreads] = useState<Record<string, Record<string, boolean>>>(
    {}
  );
  // Bumped every time a criterion is (re-)graded, keyed by `${answerId}::${criterionId}`.
  // Dragging the same criterion again before its in-flight grade request resolves can
  // leave two requests racing — this lets a response tell whether it's still the latest
  // one for its criterion before touching state, so a stale reply can't clobber a fresher
  // result (or get the criterion mistakenly stuck as ungraded/undraggable).
  const gradeGenerationRef = useRef<Record<string, number>>({});

  // Patches one speaker's bubble on a thread, leaving any other speaker's bubble alone.
  const patchComment = (
    answerId: string,
    key: string,
    speaker: CommentSpeaker,
    patch: Partial<GradeComment>
  ) => {
    setComments((prev) => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        [key]: (prev[answerId]?.[key] ?? []).map((comment) =>
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

  // Drops every thread (comment + discussion + challenge flag) tied to a criterion, or
  // just the status-phase thread when `kind` is given. Used whenever a criterion's
  // placement or status changes and its old feedback no longer applies.
  const resetCriterionThreads = (answerId: string, criterionId: string, kind?: CommentKind) => {
    const keys = kind
      ? [commentKey(criterionId, kind)]
      : [commentKey(criterionId, "placement"), commentKey(criterionId, "status")];

    const dropKeys = <T,>(record: Record<string, T> | undefined) => {
      const next = { ...record };
      keys.forEach((key) => delete next[key]);
      return next;
    };

    setComments((prev) => ({ ...prev, [answerId]: dropKeys(prev[answerId]) }));
    setDiscussions((prev) => ({ ...prev, [answerId]: dropKeys(prev[answerId]) }));
    setDiscussionPending((prev) => ({ ...prev, [answerId]: dropKeys(prev[answerId]) }));
    setChallenges((prev) => ({ ...prev, [answerId]: dropKeys(prev[answerId]) }));
    setResolvedThreads((prev) => ({ ...prev, [answerId]: dropKeys(prev[answerId]) }));
  };

  const clearCriterionFeedback = (answerId: string, criterionId: string) => {
    setReviewStates((prev) => {
      const prevAnswer = prev[answerId];
      if (!prevAnswer?.feedback?.[criterionId]) return prev;
      const nextFeedback = { ...prevAnswer.feedback };
      delete nextFeedback[criterionId];
      return { ...prev, [answerId]: { submitted: false, feedback: nextFeedback } };
    });
  };

  // Un-marking pass/fail (without moving the criterion) keeps the placement check that
  // already ran and just drops the status half of it.
  const clearCriterionStatus = (answerId: string, criterionId: string) => {
    setReviewStates((prev) => {
      const prevAnswer = prev[answerId];
      const existing = prevAnswer?.feedback?.[criterionId];
      if (!existing) return prev;
      const nextFeedback = {
        ...prevAnswer.feedback,
        [criterionId]: { ...existing, status: null, statusCorrect: false, correct: false },
      };
      return { ...prev, [answerId]: { submitted: false, feedback: nextFeedback } };
    });
  };

  const fetchNudgeComment = async (
    answerId: string,
    key: string,
    criterionLabel: string,
    stepText: string,
    expectedStepText: string,
    feedbackItem: StepCriterionFeedback,
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

      patchComment(answerId, key, assignment.speaker, {
        text: data.reply ?? "",
        pending: false,
      });
    } catch {
      // Ignore comment errors; the pass/fail result above is unaffected, and an empty
      // comment renders nothing rather than blocking the other speaker's bubble.
      patchComment(answerId, key, assignment.speaker, { text: "", pending: false });
    }
  };

  // Seeds a pending bubble for one thread, then kicks off the LLM call that fills it in.
  const openThread = (
    answerId: string,
    answer: FinalAiAnswer,
    criterionId: string,
    kind: CommentKind,
    speaker: CommentSpeaker,
    item: StepCriterionFeedback,
    challenge: boolean
  ) => {
    const key = commentKey(criterionId, kind);

    setComments((prev) => ({
      ...prev,
      [answerId]: { ...prev[answerId], [key]: [{ speaker, text: "", pending: true }] },
    }));

    if (challenge) {
      setChallenges((prev) => ({
        ...prev,
        [answerId]: { ...prev[answerId], [key]: true },
      }));
    }

    const stepText = item.placedStep != null ? answer.steps[item.placedStep - 1] ?? "" : "";
    const expectedStepText = answer.steps[item.expectedStep - 1] ?? "";

    fetchNudgeComment(
      answerId,
      key,
      item.criterion,
      stepText,
      expectedStepText,
      item,
      { speaker, coversStep: kind === "placement", coversStatus: kind === "status" },
      challenge
    );
  };

  // Runs immediately after a criterion is dropped on a step: checks placement only
  // (status isn't chosen yet), and either corrects a misplacement or occasionally
  // challenges a correct one.
  const handlePlacementResult = (
    answerId: string,
    answer: FinalAiAnswer,
    criterionId: string,
    item: StepCriterionFeedback
  ) => {
    const needsCorrection = !item.stepCorrect;
    // Placement challenges are always raised by the professor (see pickPlacementChallengeSpeaker).
    const challenge = !needsCorrection && Math.random() < PROFESSOR_CHALLENGE_RATE;
    if (!needsCorrection && !challenge) return;

    const speaker = needsCorrection ? pickPlacementSpeaker() : pickPlacementChallengeSpeaker();
    openThread(answerId, answer, criterionId, "placement", speaker, item, challenge);
  };

  // Runs immediately after the TA marks pass/fail: checks the status call and either
  // corrects it or occasionally challenges a correct one. Decoupled from placement, which
  // was already checked (and possibly discussed) in the previous step.
  const handleStatusResult = (
    answerId: string,
    answer: FinalAiAnswer,
    criterionId: string,
    item: StepCriterionFeedback
  ) => {
    const mistakeSpeaker = pickStatusSpeaker(item);
    // Status challenges go to the professor for a correct Pass, or the student for a
    // correct Fail (see pickChallengeSpeaker) — roll against that persona's own rate.
    const challengeSpeaker = mistakeSpeaker ? null : pickChallengeSpeaker(item.status);
    const challengeRate =
      challengeSpeaker === "student" ? STUDENT_CHALLENGE_RATE : PROFESSOR_CHALLENGE_RATE;
    const challenge = !mistakeSpeaker && Math.random() < challengeRate;
    const speaker = mistakeSpeaker ?? (challenge ? challengeSpeaker : null);
    if (!speaker) return;

    openThread(answerId, answer, criterionId, "status", speaker, item, challenge);
  };

  // Grades one criterion in isolation — called automatically right after it's dropped on
  // a step (placement check, status left null) and again right after it's marked
  // pass/fail (status check), rather than waiting for the whole answer to be submitted.
  const gradeCriterion = async (
    answerId: string,
    criterionId: string,
    placement: StepPlacement
  ) => {
    const answer = FINAL_AI_ANSWERS.find((item) => item.id === answerId);
    const criterion = rubric.find((item) => item.id === criterionId);
    if (!answer || !criterion) return;

    const phase: CommentKind = placement.status == null ? "placement" : "status";
    const generationKey = `${answerId}::${criterionId}`;
    const generation = (gradeGenerationRef.current[generationKey] ?? 0) + 1;
    gradeGenerationRef.current[generationKey] = generation;
    const isLatest = () => gradeGenerationRef.current[generationKey] === generation;

    logEvent("grade_lines_criterion_graded", scenarioId, {
      answer_id: answerId,
      criterion_id: criterionId,
      phase,
      placement,
    });

    setGradingCriteria((prev) => ({
      ...prev,
      [answerId]: { ...prev[answerId], [criterionId]: true },
    }));

    try {
      const res = await fetch("/api/grade-lines-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId,
          answerId,
          answerTitle: answer.label,
          rubric: [{ criterionId, criterion: criterion.label }],
          rubricFit: answer.rubricFit,
          placements: { [criterionId]: placement },
        }),
      });

      const data = await res.json();
      const item: StepCriterionFeedback | undefined = Array.isArray(data.feedback)
        ? data.feedback[0]
        : undefined;
      // A newer drag for this same criterion fired its own grade request while this one
      // was in flight — that request owns the criterion's state now, so let this stale
      // reply fall on the floor instead of overwriting it.
      if (!item || !isLatest()) return;

      setReviewStates((prev) => {
        const prevAnswer = prev[answerId] ?? { submitted: false, feedback: {} };
        const nextFeedback = { ...prevAnswer.feedback, [criterionId]: item };
        const submitted =
          rubric.length > 0 && rubric.every((c) => nextFeedback[c.id]?.status != null);
        return { ...prev, [answerId]: { submitted, feedback: nextFeedback } };
      });

      if (phase === "placement") {
        handlePlacementResult(answerId, answer, criterionId, item);
      } else {
        handleStatusResult(answerId, answer, criterionId, item);
      }
    } catch {
      // Silently drop: the placement/status the TA chose is still reflected locally,
      // only the automatic feedback for it is missing on a request failure.
    } finally {
      if (isLatest()) {
        setGradingCriteria((prev) => ({
          ...prev,
          [answerId]: { ...prev[answerId], [criterionId]: false },
        }));
      }
    }
  };

  const handlePlacementsChange = (answerId: string, next: Record<string, StepPlacement>) => {
    const prevForAnswer = placements[answerId] ?? {};
    setPlacements((prev) => ({ ...prev, [answerId]: next }));

    // Newly placed, or moved to a different step: the old check (if any) no longer
    // applies, so drop it and re-check placement from scratch.
    Object.entries(next).forEach(([criterionId, placement]) => {
      const prevPlacement = prevForAnswer[criterionId];
      const moved = !prevPlacement || prevPlacement.stepIndex !== placement.stepIndex;
      const justMarked =
        !moved && placement.status != null && placement.status !== prevPlacement?.status;

      if (moved) {
        resetCriterionThreads(answerId, criterionId);
        clearCriterionFeedback(answerId, criterionId);
        gradeCriterion(answerId, criterionId, { ...placement, status: null });
      } else if (justMarked) {
        // Switching directly from Pass to Fail (or vice versa) re-checks status, but the
        // old status thread has to be cleared first — if the new call needs no comment
        // (correct, and the challenge roll doesn't fire), nothing would otherwise
        // overwrite the stale one left over from the previous status.
        resetCriterionThreads(answerId, criterionId, "status");
        gradeCriterion(answerId, criterionId, placement);
      }
    });

    // Dragged back to the bank, or un-marked without moving: drop what no longer applies.
    Object.entries(prevForAnswer).forEach(([criterionId, prevPlacement]) => {
      const nextPlacement = next[criterionId];

      if (!nextPlacement) {
        resetCriterionThreads(answerId, criterionId);
        clearCriterionFeedback(answerId, criterionId);
      } else if (
        prevPlacement.status != null &&
        nextPlacement.status == null &&
        prevPlacement.stepIndex === nextPlacement.stepIndex
      ) {
        resetCriterionThreads(answerId, criterionId, "status");
        clearCriterionStatus(answerId, criterionId);
      }
    });
  };

  const handleSendDiscussionMessage = async (
    answerId: string,
    key: string,
    speaker: CommentSpeaker,
    text: string
  ) => {
    const { criterionId, kind } = parseCommentKey(key);
    const answer = FINAL_AI_ANSWERS.find((item) => item.id === answerId);
    const criterionFeedback = reviewStates[answerId]?.feedback?.[criterionId];
    const openingComment = comments[answerId]?.[key]?.find((c) => c.speaker === speaker);
    if (!answer || !criterionFeedback || !openingComment) return;

    const challenge = challenges[answerId]?.[key] ?? false;

    const priorMessages = discussions[answerId]?.[key]?.[speaker] ?? [];
    const userMessage: DiscussionMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
    };

    setDiscussions((prev) => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        [key]: {
          ...prev[answerId]?.[key],
          [speaker]: [...priorMessages, userMessage],
        },
      },
    }));
    setDiscussionPending((prev) => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        [key]: {
          ...prev[answerId]?.[key],
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
          expectedStep: criterionFeedback.expectedStep,
          coversStep: kind === "placement",
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
          [key]: {
            ...prev[answerId]?.[key],
            [speaker]: [
              ...(prev[answerId]?.[key]?.[speaker] ?? []),
              { id: `${speaker}-${Date.now()}`, role: speaker, text: data.reply ?? "" },
            ],
          },
        },
      }));

      // A challenge thread (the call was already correct) can be resolved by conceding in
      // chat — there's nothing to fix. A real mistake thread never can: it only clears by
      // actually redoing the call (drag to re-place, re-mark pass/fail), which drops this
      // whole thread via resetCriterionThreads anyway. Conceding in chat isn't a substitute
      // for that, so a non-challenge thread's "resolved" from the model is ignored here.
      if (data.resolved === true && challenge) {
        setResolvedThreads((prev) => ({
          ...prev,
          [answerId]: { ...prev[answerId], [key]: true },
        }));
      }
    } catch {
      // Ignore discussion errors; the TA's message stays in the thread either way.
    } finally {
      setDiscussionPending((prev) => ({
        ...prev,
        [answerId]: {
          ...prev[answerId],
          [key]: {
            ...prev[answerId]?.[key],
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
            "You are the grader here. Drag a rubric item onto the exact step of the answer it applies to — you'll immediately find out if the placement is right. Once it's placed, mark it pass if the student's step meets the criterion, fail if it does not, and you'll immediately find out if that call is right too. The AI student or the professor may jump in to comment or challenge either decision as you go.",
          ]}
        />

        <LineRubricPanel
          question={question}
          rubric={rubric}
          answers={FINAL_AI_ANSWERS}
          placements={placements}
          onPlacementsChange={handlePlacementsChange}
          reviewStates={reviewStates}
          gradingCriteria={gradingCriteria}
          comments={comments}
          discussions={discussions}
          discussionPending={discussionPending}
          resolvedThreads={resolvedThreads}
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
