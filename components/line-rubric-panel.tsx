"use client";

import { useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  Cross2Icon,
  DragHandleDots2Icon,
  UpdateIcon,
} from "@radix-ui/react-icons";
import MathDisplay from "@/components/math-display";
import Button from "@/components/button";
import DiscussionPanel, { DiscussionMessage } from "@/components/discussion-panel";
import { FinalAiAnswer } from "@/lib/scenarios/types";
import type { CommentSpeaker } from "@/lib/grading-voice";
import { PLACEMENT_QUICK_REPLIES, PlacementFlow } from "@/lib/placement-flow";

export type { DiscussionMessage } from "@/components/discussion-panel";

export type GradeComment = {
  speaker: CommentSpeaker;
  text: string;
  pending: boolean;
};

// One criterion's placement or pass/fail discussion (discussion mode 2), driven by the
// decision tree in lib/placement-flow (reused as-is for pass/fail, see lib/status-flow).
// Lives across re-drags and re-marks, so the transcript and attempt count survive them.
export type FlowThread = {
  flow: PlacementFlow;
  messages: DiscussionMessage[];
  // True while a classify or explain call is in flight.
  pending: boolean;
  // Who the TA is talking to. Placement is always the professor; pass/fail depends on the mark.
  speaker: CommentSpeaker;
};

type FlowKind = "placement" | "status";

const PROFESSOR_NAME = "Prof. Phoenix";

const SPEAKER_STYLES: Record<
  CommentSpeaker,
  { bubble: string; avatar: string; initial: string }
> = {
  student: {
    bubble: "bg-white text-stone-700",
    avatar: "bg-lime-600 text-white",
    initial: "S",
  },
  professor: {
    bubble: "bg-white text-stone-700",
    avatar: "bg-stone-700 text-white",
    initial: "P",
  },
};

export type RubricCriterion = {
  id: string;
  label: string;
};

// Where the single active criterion currently stands. Drives the spotlight/dim
// treatment and the header status pill.
type Phase =
  | "place"
  | "checking"
  | "discuss-placement"
  | "mark"
  | "discuss-status"
  | "resolve-placement"
  | "resolve-status"
  | "done";

const PHASE_PILL: Partial<Record<Phase, { text: string; className: string }>> = {
  place: { text: "Place it on a step", className: "bg-lime-100 text-lime-700" },
  checking: { text: "Checking…", className: "bg-stone-100 text-stone-500" },
  "discuss-placement": { text: "Check step placement", className: "bg-amber-100 text-amber-700" },
  mark: { text: "Mark pass or fail", className: "bg-lime-100 text-lime-700" },
  "discuss-status": { text: "Check evaluation", className: "bg-amber-100 text-amber-700" },
  "resolve-placement": { text: "Check step placement", className: "bg-amber-100 text-amber-700" },
  "resolve-status": { text: "Mark it again", className: "bg-amber-100 text-amber-700" },
};

const DIM = "opacity-40 pointer-events-none";

export type StepPlacement = {
  criterionId: string;
  stepIndex: number;
  status: "pass" | "fail" | null;
};

// Keyed by answerId -> criterionId -> placement
export type StepPlacementsState = Record<string, Record<string, StepPlacement>>;

export type StepCriterionFeedback = {
  criterionId: string;
  criterion: string;
  placedStep: number | null;
  expectedStep: number;
  stepCorrect: boolean;
  status: "pass" | "fail" | null;
  expectedStatus: "pass" | "fail" | null;
  statusCorrect: boolean;
  correct: boolean;
  feedback: string;
};

export type StepAnswerReviewState = {
  submitted: boolean;
  feedback: Record<string, StepCriterionFeedback>;
};

// Keyed by answerId
export type StepReviewState = Record<string, StepAnswerReviewState>;

// A thread key is `${criterionId}::placement` or `${criterionId}::status` — placement
// and status are graded and commented on as two separate, sequential moments on the same
// criterion, so the comment map below is keyed by thread, not by criterion.
type LineRubricPanelProps = {
  question?: string;
  rubric: RubricCriterion[];
  answers: readonly FinalAiAnswer[];
  placements: StepPlacementsState;
  onPlacementsChange: (answerId: string, placements: Record<string, StepPlacement>) => void;
  reviewStates: StepReviewState;
  // Keyed by answerId -> criterionId: true while that criterion's placement or status
  // check is in flight.
  gradingCriteria?: Record<string, Record<string, boolean>>;
  // Mode 1 only: one-off correction bubbles, keyed by answerId -> threadKey, in display order.
  comments?: Record<string, Record<string, GradeComment[]>>;
  // 1 = one-off correction bubbles (previous setup), 2 = every drop and every pass/fail
  // mark is discussed through its decision tree. Defaults to 2.
  discussionMode?: number;
  // Discussion mode only: each criterion's placement and pass/fail decision trees, keyed
  // by answerId -> criterionId, plus the TA's replies into them.
  placementThreads?: Record<string, Record<string, FlowThread>>;
  onPlacementReply?: (answerId: string, criterionId: string, text: string) => void;
  // An unlocked item dropped back on the step it's already on — still a fresh answer.
  onPlacementRedrop?: (answerId: string, criterionId: string) => void;
  statusThreads?: Record<string, Record<string, FlowThread>>;
  onStatusReply?: (answerId: string, criterionId: string, text: string) => void;
  // The already-marked status clicked again after a retry — still a fresh answer.
  onStatusRemark?: (answerId: string, criterionId: string) => void;
  currentIndex: number;
  onCurrentIndexChange: (index: number) => void;
  // Called from the last answer once every criterion in every answer has been graded.
  onComplete?: () => void;
};

export default function LineRubricPanel({
  question,
  rubric,
  answers,
  placements,
  onPlacementsChange,
  reviewStates,
  gradingCriteria,
  comments,
  discussionMode = 2,
  placementThreads,
  onPlacementReply,
  onPlacementRedrop,
  statusThreads,
  onStatusReply,
  onStatusRemark,
  currentIndex,
  onCurrentIndexChange,
  onComplete,
}: LineRubricPanelProps) {
  const [dragCriterionId, setDragCriterionId] = useState<string | null>(null);
  const [dragOverStep, setDragOverStep] = useState<number | null>(null);
  const [dragOverBank, setDragOverBank] = useState(false);
  // A discussion the TA reopened from its card.
  const [activeDiscussion, setActiveDiscussion] = useState<{
    criterionId: string;
    kind: FlowKind;
  } | null>(null);
  // Keyed by `${answerId}::${criterionId}::${kind}`: how many messages the TA had seen
  // when they last closed that discussion. New messages past this reopen it by themselves.
  const [flowSeen, setFlowSeen] = useState<Record<string, number>>({});

  const currentAnswer = answers[currentIndex];
  const steps = currentAnswer.steps;
  const currentPlacements = placements[currentAnswer.id] ?? {};
  const currentReview = reviewStates[currentAnswer.id];
  const isSubmitted = currentReview?.submitted ?? false;
  const currentGrading = gradingCriteria?.[currentAnswer.id] ?? {};
  const currentComments = comments?.[currentAnswer.id] ?? {};
  const currentFlowThreads: Record<FlowKind, Record<string, FlowThread>> = {
    placement: placementThreads?.[currentAnswer.id] ?? {},
    status: statusThreads?.[currentAnswer.id] ?? {},
  };

  const canDiscuss = discussionMode === 2;

  // In discussion mode, a call (placement, then pass/fail) is settled only by its decision
  // tree reaching the end — and that closing line having arrived — since every drop and
  // every mark is questioned, right or wrong. Otherwise it's settled once it's right: a
  // wrong call only clears when the TA redoes it and the re-check comes back correct.
  const isFlowSettled = (kind: FlowKind, criterionId: string, correct: boolean): boolean => {
    if (!canDiscuss) return correct;
    const thread = currentFlowThreads[kind][criterionId];
    return thread?.flow.kind === "resolved" && !thread.pending;
  };
  const isPlacementSettled = (criterionId: string, feedback: StepCriterionFeedback) =>
    isFlowSettled("placement", criterionId, feedback.stepCorrect);
  const isStatusSettled = (criterionId: string, feedback: StepCriterionFeedback) =>
    feedback.status != null && isFlowSettled("status", criterionId, feedback.statusCorrect);

  // The item stays put (or the call stays marked) while the TA is answering, and once
  // it's final.
  const isFlowLocked = (kind: FlowKind, criterionId: string): boolean =>
    canDiscuss && (currentFlowThreads[kind][criterionId]?.flow.kind ?? "dragging") !== "dragging";
  const isPlacementLocked = (criterionId: string) => isFlowLocked("placement", criterionId);

  // A criterion is "done" — and only then does the TA get to touch a different one —
  // once its placement is settled and, in turn, its pass/fail call is settled too.
  const isCriterionComplete = (criterionId: string): boolean => {
    const feedback = currentReview?.feedback?.[criterionId];
    if (!feedback) return false;
    if (!isPlacementSettled(criterionId, feedback)) return false;
    return isStatusSettled(criterionId, feedback);
  };

  // Exactly one criterion is ever actionable, chosen by rubric order — everything before
  // it is done, everything after it waits its turn.
  const activeCriterionId = rubric.find((criterion) => !isCriterionComplete(criterion.id))?.id ?? null;
  const activePlacement = activeCriterionId ? currentPlacements[activeCriterionId] : undefined;
  const activeFeedback = activeCriterionId
    ? currentReview?.feedback?.[activeCriterionId]
    : undefined;
  const activeIsGrading = activeCriterionId ? (currentGrading[activeCriterionId] ?? false) : false;
  const activeStepIndex = activePlacement?.stepIndex ?? null;

  // True while a thread's opening comment is still being fetched — the pill and mark
  // block hold at "checking" until that comment has actually arrived, so the verdict
  // doesn't flash in ahead of the note explaining it.
  const isThreadPending = (key: string) => (currentComments[key] ?? []).some((c) => c.pending);

  const phase: Phase = !activeCriterionId
    ? "done"
    : !activePlacement
      ? "place"
      : activeIsGrading || !activeFeedback
        ? "checking"
        : !isPlacementSettled(activeCriterionId, activeFeedback)
          ? canDiscuss
            ? currentFlowThreads.placement[activeCriterionId]?.flow.kind === "dragging"
              ? "resolve-placement"
              : "discuss-placement"
            : isThreadPending(`${activeCriterionId}::placement`)
              ? "checking"
              : "resolve-placement"
          : activeFeedback.status == null
            ? "mark"
            : !isStatusSettled(activeCriterionId, activeFeedback)
              ? canDiscuss
                ? currentFlowThreads.status[activeCriterionId]?.flow.kind === "dragging"
                  ? "resolve-status"
                  : "discuss-status"
                : isThreadPending(`${activeCriterionId}::status`)
                  ? "checking"
                  : "resolve-status"
              : "done";

  const speakerName = (speaker: CommentSpeaker) =>
    speaker === "professor" ? PROFESSOR_NAME : currentAnswer.label;

  // Pass/fail is talked through with whoever that mark concerns, so the pill names them.
  const activeStatusSpeaker = activeCriterionId
    ? currentFlowThreads.status[activeCriterionId]?.speaker
    : undefined;
  const phasePill =
    phase === "discuss-status"
      ? {
          text: `Answer ${activeStatusSpeaker === "student" ? currentAnswer.label : "the professor"}`,
          className: "bg-amber-100 text-amber-700",
        }
      : PHASE_PILL[phase];

  // A discussion opens by itself while the TA owes an answer, and whenever the other side
  // has said something the TA hasn't seen yet (e.g. the closing line). It can also be
  // reopened from the card. Pass/fail comes after placement, so it takes precedence.
  const flowSeenKey = (criterionId: string, kind: FlowKind) =>
    `${currentAnswer.id}::${criterionId}::${kind}`;
  const needsAttention = (kind: FlowKind, criterionId: string) => {
    const thread = currentFlowThreads[kind][criterionId];
    return (
      thread != null &&
      (thread.flow.kind === "chat" ||
        thread.messages.length > (flowSeen[flowSeenKey(criterionId, kind)] ?? 0))
    );
  };
  // Not just the active criterion: resolving a call completes it and moves on, but its
  // closing line should stay up until the TA closes it themselves.
  const autoOpen: { criterionId: string; kind: FlowKind } | null = !canDiscuss
    ? null
    : rubric
        .flatMap((criterion) =>
          (["status", "placement"] as const).map((kind) => ({ criterionId: criterion.id, kind }))
        )
        .find(({ criterionId, kind }) => needsAttention(kind, criterionId)) ?? null;
  const openDiscussion = activeDiscussion ?? autoOpen;
  const openThread = openDiscussion
    ? currentFlowThreads[openDiscussion.kind][openDiscussion.criterionId]
    : undefined;

  const closeDiscussion = () => {
    if (openDiscussion) {
      setFlowSeen((prev) => ({
        ...prev,
        [flowSeenKey(openDiscussion.criterionId, openDiscussion.kind)]:
          openThread?.messages.length ?? 0,
      }));
    }
    setActiveDiscussion(null);
  };

  const gradedCount = rubric.filter(
    (criterion) => currentReview?.feedback?.[criterion.id]?.status != null
  ).length;

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < answers.length - 1;
  const allSubmitted = answers.every((answer) => reviewStates[answer.id]?.submitted);

  const unassigned = rubric.filter((criterion) => !currentPlacements[criterion.id]);
  const placementsByStep = (stepIndex: number) =>
    rubric.filter((criterion) => currentPlacements[criterion.id]?.stepIndex === stepIndex);

  const updatePlacements = (next: Record<string, StepPlacement>) => {
    onPlacementsChange(currentAnswer.id, next);
  };

  const assignToStep = (criterionId: string, stepIndex: number) => {
    const existing = currentPlacements[criterionId];
    // Moving a criterion to a different step invalidates its earlier checks, so it's
    // placement-checked again (and has to be marked pass/fail again too).
    const moved = existing != null && existing.stepIndex !== stepIndex;

    // Dropping an unlocked item back where it already sits changes nothing in placements,
    // but after a retry it's still a new answer, so it's checked again as a drop.
    const flow = currentFlowThreads.placement[criterionId]?.flow;
    if (existing && !moved) {
      if (canDiscuss && flow?.kind === "dragging" && flow.attempt > 1) {
        onPlacementRedrop?.(currentAnswer.id, criterionId);
      }
      return;
    }

    updatePlacements({
      ...currentPlacements,
      [criterionId]: {
        criterionId,
        stepIndex,
        status: moved ? null : existing?.status ?? null,
      },
    });
  };

  const unassign = (criterionId: string) => {
    const next = { ...currentPlacements };
    delete next[criterionId];
    updatePlacements(next);
  };

  const setStatus = (criterionId: string, status: "pass" | "fail") => {
    const existing = currentPlacements[criterionId];
    if (!existing) return;

    // In discussion mode a mark is never undone, only answered again: clicking the same
    // one after a retry means "I'm keeping it", and is checked again as a new mark.
    if (canDiscuss && existing.status === status) {
      const flow = currentFlowThreads.status[criterionId]?.flow;
      if (flow?.kind === "dragging" && flow.attempt > 1) {
        onStatusRemark?.(currentAnswer.id, criterionId);
      }
      return;
    }

    updatePlacements({
      ...currentPlacements,
      [criterionId]: {
        ...existing,
        status: existing.status === status ? null : status,
      },
    });
  };

  const handleDragStart = (criterionId: string) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", criterionId);
    // Deferred: drop hints shift the card, and Chrome aborts a drag whose source moves.
    requestAnimationFrame(() => setDragCriterionId(criterionId));
  };

  const handleDragEnd = () => {
    setDragCriterionId(null);
    setDragOverStep(null);
    setDragOverBank(false);
  };

  const handleStepDrop = (stepIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const criterionId = e.dataTransfer.getData("text/plain") || dragCriterionId;
    setDragOverStep(null);
    setDragCriterionId(null);
    // Moving a criterion to a different step unmounts its card from one step's list and
    // mounts a fresh one in another's — different parents, so React can't preserve the
    // DOM node just via key. Doing that in the same tick as the drop can remove the
    // dragged element before the browser fires its native "dragend" on it, which leaves
    // the browser's drag session stuck and breaks the next real drag gesture. Deferring
    // the mutation one tick lets "dragend" land first.
    if (criterionId) setTimeout(() => assignToStep(criterionId, stepIndex), 0);
  };

  const handleBankDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const criterionId = e.dataTransfer.getData("text/plain") || dragCriterionId;
    setDragOverBank(false);
    setDragCriterionId(null);
    if (criterionId) setTimeout(() => unassign(criterionId), 0);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-stone-800">Step-by-step rubric mapping</h2>
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Answer {currentIndex + 1} of {answers.length}
        </span>
      </div>

      {question && (
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-400">
            Question
          </span>
          <div className="whitespace-pre-wrap text-base leading-7 text-stone-700">
            <MathDisplay text={question} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-stone-800">{currentAnswer.label}</h3>
            <div className="flex items-center gap-2">
              {phasePill ? (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${phasePill.className}`}
                >
                  {phasePill.text}
                </span>
              ) : null}
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isSubmitted ? "bg-lime-50 text-lime-700" : "bg-stone-100 text-stone-500"
                  }`}
              >
                {gradedCount} of {rubric.length} graded
              </span>
            </div>
          </div>

          <p className="mb-4 text-sm text-stone-500">
            You are grading this student&apos;s work.{" "}
            <span className="font-semibold text-stone-600">Drag all</span>{" "}
            rubric items onto the steps they apply to. As soon as you place one,
            you&apos;ll see whether the placement is right; once it&apos;s placed, mark{" "}
            <span className="font-semibold text-stone-600">
              Pass
            </span>{" "}
            if the step satisfies it or <span className="font-semibold text-stone-600">Fail</span>{" "}
            if it does not, and you&apos;ll see whether that call is right too. The AI student or
            the professor may comment on or challenge either decision.
          </p>

          <div className="flex select-none flex-col gap-2">
            {steps.map((step, stepIndex) => {
              const stepPlacements = placementsByStep(stepIndex);
              const isDragOver = dragOverStep === stepIndex;
              // Every step is a valid drop target while the active criterion still needs
              // placing or re-placing (a wrong first guess has to be movable to any other
              // step, not just stuck wherever it landed); once it's correctly placed, only
              // its own step stays bright.
              const needsPlacement = phase === "place" || phase === "resolve-placement";
              const isStepDimmed = !needsPlacement && activeStepIndex !== stepIndex;
              // Skip the hint on the step the active criterion is already (wrongly) sitting
              // on — that step's card makes the drop target obvious without it. And only
              // show it once something is actually being dragged, not just sitting there
              // unplaced in the bank.
              const showDropHint =
                needsPlacement && activeStepIndex !== stepIndex && dragCriterionId != null;

              return (
                <div
                  key={stepIndex}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverStep(stepIndex);
                  }}
                  onDragLeave={() => setDragOverStep((prev) => (prev === stepIndex ? null : prev))}
                  onDrop={handleStepDrop(stepIndex)}
                  className={`flex gap-3 rounded-xl border-2 border-dashed p-3 transition-colors transition-opacity ${isDragOver
                      ? "border-lime-500 bg-lime-50"
                      : "border-transparent hover:border-stone-200"
                    } ${isStepDimmed ? DIM : ""}`}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-500">
                    {stepIndex + 1}
                  </div>

                  <div className="flex-1">
                    <div className="text-sm leading-7 text-stone-700">
                      <MathDisplay text={step} />
                    </div>

                    {showDropHint ? (
                      <div className="mt-2 rounded-lg border border-dashed border-stone-300 py-2 text-center text-xs font-medium text-stone-400">
                        {isDragOver ? "Release to place" : "↓ Drop the highlighted rubric here"}
                      </div>
                    ) : null}

                    {stepPlacements.length > 0 ? (
                      <div className="mt-1 flex flex-col gap-2">
                        {stepPlacements.map((criterion) => {
                          const placement = currentPlacements[criterion.id];
                          const criterionFeedback = currentReview?.feedback?.[criterion.id];
                          const isGrading = currentGrading[criterion.id] ?? false;
                          // Placement has been checked once feedback exists at all — its
                          // `status` field is only non-null once the status phase has
                          // also run.
                          const placementChecked = criterionFeedback != null;
                          const placementKey = `${criterion.id}::placement`;
                          const statusKey = `${criterion.id}::status`;
                          // A card only shows its green/red verdict once both the placement
                          // and status calls are settled — in discussion mode, showing it
                          // any earlier would give away the answer the discussion is asking for.
                          const isResolved =
                            placementChecked &&
                            isPlacementSettled(criterion.id, criterionFeedback) &&
                            isStatusSettled(criterion.id, criterionFeedback);
                          const fullyGraded =
                            placementChecked &&
                            criterionFeedback.status != null &&
                            (!canDiscuss || isResolved);
                          // Only the active criterion is ever interactive — every other
                          // placed card, by construction, is already done.
                          const isActive = criterion.id === activeCriterionId;
                          const lockedByOther = !isActive;
                          const placementLocked = isPlacementLocked(criterion.id);
                          // The latest thing each side of this card's discussions said, shown
                          // on the card with a way back into the conversation.
                          const flowBubbles = (["placement", "status"] as const).flatMap((kind) => {
                            const thread = currentFlowThreads[kind][criterion.id];
                            const last = [...(thread?.messages ?? [])]
                              .reverse()
                              .find((message) => message.role !== "user");
                            return canDiscuss && thread && last
                              ? [
                                  {
                                    kind,
                                    speaker: thread.speaker,
                                    text: last.text,
                                    resolved: thread.flow.kind === "resolved" && !thread.pending,
                                  },
                                ]
                              : [];
                          });
                          // The mark block shows for the active card once its placement is
                          // settled and it hasn't been marked yet, or when the TA is asked to
                          // mark it again: after a retry in discussion mode, or after a wrong
                          // call otherwise.
                          const isRemark = phase === "resolve-status";
                          const showMarkBlock = isActive && (phase === "mark" || isRemark);
                          // Only outside discussion mode does being asked again mean it was wrong.
                          const isStatusMistake = isRemark && !canDiscuss;

                          return (
                            <div
                              key={criterion.id}
                              draggable={!isGrading && !lockedByOther && !placementLocked}
                              onDragStart={handleDragStart(criterion.id)}
                              onDragEnd={handleDragEnd}
                              className={`flex select-none flex-col gap-1.5 rounded-xl px-3.5 py-3 text-xs shadow-sm transition-opacity ${isResolved
                                  ? criterionFeedback!.correct
                                    ? "bg-green-50"
                                    : "bg-red-50"
                                  : "bg-stone-50"
                                } ${lockedByOther ? DIM : ""}`}
                            >
                              <div className="flex items-center gap-2">
                                {isGrading ? (
                                  <UpdateIcon className="shrink-0 animate-spin text-stone-400" />
                                ) : fullyGraded ? (
                                  criterionFeedback!.correct ? (
                                    <CheckIcon className="shrink-0 text-green-700" />
                                  ) : (
                                    <Cross2Icon className="shrink-0 text-red-700" />
                                  )
                                ) : (
                                  <DragHandleDots2Icon className="shrink-0 text-stone-400" />
                                )}
                                <span className="flex-1 font-medium text-stone-700">
                                  <MathDisplay text={criterion.label} />
                                </span>
                                {isGrading ? (
                                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                                    Checking...
                                  </span>
                                ) : null}
                                {fullyGraded ? (
                                  <span
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${criterionFeedback!.correct
                                        ? "bg-green-100 text-green-700"
                                        : "bg-red-100 text-red-700"
                                      }`}
                                  >
                                    {currentAnswer.label} {placement?.status === "fail" ? "Fail" : "Pass"}
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  disabled={isGrading || lockedByOther || placementLocked}
                                  onClick={() => unassign(criterion.id)}
                                  className="shrink-0 text-stone-400 transition-colors hover:text-stone-600 disabled:cursor-not-allowed disabled:opacity-50"
                                  aria-label="Remove rubric item from this step"
                                >
                                  <Cross2Icon />
                                </button>
                              </div>

                              {showMarkBlock ? (
                                <div className="animate-fade-in-slide flex flex-col gap-2 border-t border-stone-200 pt-2.5">
                                  <div className="flex items-center gap-1.5 text-xs text-stone-600">
                                    {isStatusMistake ? (
                                      <Cross2Icon className="shrink-0 text-red-700" />
                                    ) : isRemark ? null : (
                                      <CheckIcon className="shrink-0 text-green-700" />
                                    )}
                                    <span>
                                      <span className="font-semibold">
                                        {isStatusMistake
                                          ? "That call was wrong."
                                          : isRemark
                                            ? "Take another look."
                                            : "Placement confirmed."}
                                      </span>{" "}
                                      Does this step meet the criterion?
                                      {isRemark && canDiscuss
                                        ? " Click your current mark again to keep it."
                                        : ""}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      disabled={isGrading}
                                      onClick={() => setStatus(criterion.id, "pass")}
                                      className={`h-10 rounded-lg border border-green-300 text-xs font-semibold transition-colors hover:bg-green-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${placement?.status === "pass" ? "bg-green-600 text-white" : "text-green-700"}`}
                                    >
                                      {currentAnswer.label} Passes this Criterion
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isGrading}
                                      onClick={() => setStatus(criterion.id, "fail")}
                                      className={`h-10 rounded-lg border border-red-300 text-xs font-semibold transition-colors hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${placement?.status === "fail" ? "bg-red-600 text-white" : "text-red-700"}`}
                                    >
                                      {currentAnswer.label} Fails this Criterion
                                    </button>
                                  </div>
                                </div>
                              ) : null}

                              {flowBubbles.map((bubble) => (
                                <div
                                  key={bubble.kind}
                                  className={`ml-5 flex items-start gap-2 rounded-xl px-3.5 py-3 text-xs shadow-sm ${SPEAKER_STYLES[bubble.speaker].bubble} ${bubble.resolved ? "opacity-50" : ""}`}
                                >
                                  <div className="flex-1">
                                    <span className="font-semibold">{speakerName(bubble.speaker)}</span>{" "}
                                    has a comment for you.
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActiveDiscussion({
                                          criterionId: criterion.id,
                                          kind: bubble.kind,
                                        })
                                      }
                                      disabled={bubble.resolved}
                                      className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-lime-700 hover:text-lime-900 disabled:cursor-not-allowed disabled:hover:text-lime-700"
                                    >
                                      Respond
                                      <ArrowRightIcon width={13} height={13} />
                                    </button>
                                  </div>
                                </div>
                              ))}

                              {[placementKey, statusKey].flatMap((key) =>
                                (currentComments[key] ?? [])
                                  .filter((comment) => comment.pending || comment.text)
                                  .map((comment) => {
                                    const style = SPEAKER_STYLES[comment.speaker];
                                    const name = speakerName(comment.speaker);

                                    return (
                                      <div
                                        key={key}
                                        className={`ml-5 flex items-start gap-2 rounded-xl px-3.5 py-3 text-xs shadow-sm ${style.bubble}`}
                                      >
                                        {comment.pending ? (
                                          <UpdateIcon className="mt-0.5 shrink-0 animate-spin text-stone-400" />
                                        ) : (
                                          <span
                                            title={name}
                                            aria-label={name}
                                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${style.avatar}`}
                                          >
                                            {style.initial}
                                          </span>
                                        )}
                                        {comment.pending ? (
                                          <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                                            Checking...
                                          </span>
                                        ) : (
                                          <div className="flex-1">
                                            <span className="font-semibold">{name}: </span>
                                            <MathDisplay
                                              text={comment.text}
                                              className="inline text-xs"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverBank(true);
            }}
            onDragLeave={() => setDragOverBank(false)}
            onDrop={handleBankDrop}
            className={`h-fit select-none rounded-xl border-2 border-dashed p-4 shadow-sm transition-colors ${dragOverBank ? "border-lime-500 bg-lime-50" : "border-stone-200 bg-white"
              }`}
          >
            <span className="mb-3 block text-xs font-bold uppercase tracking-wider text-stone-400">
              Drag rubrics to the appropriate step
            </span>

            {unassigned.length === 0 ? (
              <p className="text-xs text-stone-400">
                All rubric items are placed. Drag one back here to unassign it.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {unassigned.map((criterion) => {
                  const isActive = criterion.id === activeCriterionId;

                  return (
                    <div
                      key={criterion.id}
                      draggable={isActive}
                      onDragStart={handleDragStart(criterion.id)}
                      onDragEnd={handleDragEnd}
                      title={
                        isActive
                          ? undefined
                          : "Finish the criterion in progress before starting another"
                      }
                      className={`flex select-none flex-col gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-stone-700 transition-colors transition-opacity ${isActive
                          ? "cursor-grab border-lime-500 bg-lime-50 active:cursor-grabbing animate-pulse-ring"
                          : `cursor-not-allowed border-stone-200 bg-stone-50 ${DIM}`
                        } ${dragCriterionId === criterion.id ? "opacity-40" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        <DragHandleDots2Icon className="mt-0.5 shrink-0 text-stone-400" />
                        <MathDisplay text={criterion.label} />
                      </div>
                      {isActive ? (
                        <span className="ml-5 inline-flex w-fit items-center gap-1 rounded-full bg-lime-100 px-2 py-0.5 text-[10px] font-semibold text-lime-700">
                          → Start here — drag to its step
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          disabled={!hasPrevious}
          onClick={() => onCurrentIndexChange(currentIndex - 1)}
        >
          <ArrowLeftIcon />
          Previous
        </Button>

        {!hasNext && onComplete ? (
          <Button
            variant="secondary"
            disabled={!allSubmitted}
            onClick={onComplete}
            title={
              allSubmitted
                ? undefined
                : "Grade every criterion on every answer before finishing this scenario"
            }
          >
            Continue to scenarios
            <ArrowRightIcon />
          </Button>
        ) : (
          <Button
            variant="secondary"
            disabled={!hasNext}
            onClick={() => onCurrentIndexChange(currentIndex + 1)}
          >
            Next
            <ArrowRightIcon />
          </Button>
        )}
      </div>

      {canDiscuss && openDiscussion && openThread ? (
        <DiscussionPanel
          open
          onClose={closeDiscussion}
          counterpartLabel={speakerName(openThread.speaker)}
          speakerNames={{ professor: PROFESSOR_NAME, student: currentAnswer.label }}
          criterionLabel={
            rubric.find((c) => c.id === openDiscussion.criterionId)?.label ?? "this criterion"
          }
          messages={openThread.messages}
          pending={openThread.pending}
          closable={openThread.flow.kind !== "chat"}
          quickReplies={
            openThread.flow.kind === "chat" && openThread.flow.node === "askSure"
              ? PLACEMENT_QUICK_REPLIES.map((reply) => reply.text)
              : []
          }
          inputDisabledReason={
            openThread.flow.kind === "dragging"
              ? openDiscussion.kind === "status"
                ? "Close this and mark it again to try again"
                : "Close this and drag the item to try again"
              : openThread.flow.kind === "resolved"
                ? openDiscussion.kind === "status"
                  ? "This call is settled"
                  : "Placement is settled"
                : undefined
          }
          resolved={openThread.flow.kind === "resolved"}
          resolvedNote={
            openDiscussion.kind === "status"
              ? "Call confirmed. Close this to move on to the next criterion."
              : "Placement confirmed. Close this to mark pass or fail."
          }
          onSend={(text) =>
            (openDiscussion.kind === "status" ? onStatusReply : onPlacementReply)?.(
              currentAnswer.id,
              openDiscussion.criterionId,
              text
            )
          }
        />
      ) : null}
    </div>
  );
}
