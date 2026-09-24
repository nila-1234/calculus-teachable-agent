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

export type { DiscussionMessage } from "@/components/discussion-panel";

export type GradeComment = {
  speaker: CommentSpeaker;
  text: string;
  pending: boolean;
};

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
type Phase = "place" | "checking" | "mark" | "resolve-placement" | "resolve-status" | "done";

const PHASE_PILL: Partial<Record<Phase, { text: string; className: string }>> = {
  place: { text: "Place it on a step", className: "bg-lime-100 text-lime-700" },
  checking: { text: "Checking…", className: "bg-stone-100 text-stone-500" },
  mark: { text: "Mark pass or fail", className: "bg-lime-100 text-lime-700" },
  "resolve-placement": { text: "Check step placement", className: "bg-amber-100 text-amber-700" },
  "resolve-status": { text: "Reply to resolve", className: "bg-amber-100 text-amber-700" },
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
// and status are graded and discussed as two separate, sequential moments on the same
// criterion, so every comment/discussion map below is keyed by thread, not by criterion.
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
  // Keyed by answerId -> threadKey -> comments, in display order
  comments?: Record<string, Record<string, GradeComment[]>>;
  // Discussion-mode follow-up turns, keyed by answerId -> threadKey -> speaker.
  // The opening comment itself lives in `comments`.
  discussions?: Record<
    string,
    Record<string, Partial<Record<CommentSpeaker, DiscussionMessage[]>>>
  >;
  discussionPending?: Record<
    string,
    Record<string, Partial<Record<CommentSpeaker, boolean>>>
  >;
  // Keyed by answerId -> threadKey: true once the counterpart has conceded the point.
  resolvedThreads?: Record<string, Record<string, boolean>>;
  onSendDiscussionMessage?: (
    answerId: string,
    threadKey: string,
    speaker: CommentSpeaker,
    text: string
  ) => void;
  // 1 = plain comment bubbles (previous setup), 2 = comment bubbles + the
  // "Reply" discussion drawer. Defaults to 2.
  discussionMode?: number;
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
  discussions,
  discussionPending,
  resolvedThreads,
  onSendDiscussionMessage,
  discussionMode = 2,
  currentIndex,
  onCurrentIndexChange,
  onComplete,
}: LineRubricPanelProps) {
  const [dragCriterionId, setDragCriterionId] = useState<string | null>(null);
  const [dragOverStep, setDragOverStep] = useState<number | null>(null);
  const [dragOverBank, setDragOverBank] = useState(false);
  const [activeDiscussion, setActiveDiscussion] = useState<{
    key: string;
    speaker: CommentSpeaker;
  } | null>(null);

  const currentAnswer = answers[currentIndex];
  const steps = currentAnswer.steps;
  const currentPlacements = placements[currentAnswer.id] ?? {};
  const currentReview = reviewStates[currentAnswer.id];
  const isSubmitted = currentReview?.submitted ?? false;
  const currentGrading = gradingCriteria?.[currentAnswer.id] ?? {};
  const currentComments = comments?.[currentAnswer.id] ?? {};
  const currentDiscussions = discussions?.[currentAnswer.id] ?? {};
  const currentDiscussionPending = discussionPending?.[currentAnswer.id] ?? {};
  const currentResolved = resolvedThreads?.[currentAnswer.id] ?? {};

  const isThreadOpenAndUnresolved = (key: string) =>
    (currentComments[key]?.length ?? 0) > 0 && !(currentResolved[key] ?? false);

  // A challenge on an already-correct call can only be cleared through discussion — if
  // discussion isn't available in this mode, it can't block progress, since there's
  // nothing to fix and no way to resolve it.
  const canDiscuss = discussionMode === 2;

  // One phase (placement or status) is settled — and only then does it lock — once it's
  // actually right AND, if the professor or student challenged it anyway, that challenge
  // has been resolved. Being right isn't enough on its own to wave away an open challenge.
  // Being wrong is never settled by discussion alone — conceding in chat isn't the same
  // as fixing the call, so a mistake only clears once the TA actually redoes it (which
  // re-checks it, and re-checking a genuinely fixed call comes back correct).
  const isPhaseSettled = (correct: boolean, key: string): boolean =>
    correct ? !canDiscuss || !isThreadOpenAndUnresolved(key) : false;

  // A criterion is "done" — and only then does the TA get to touch a different one —
  // once its placement is settled and, in turn, its pass/fail call is settled too.
  const isCriterionComplete = (criterionId: string): boolean => {
    const feedback = currentReview?.feedback?.[criterionId];
    if (!feedback) return false;
    if (!isPhaseSettled(feedback.stepCorrect, `${criterionId}::placement`)) return false;
    if (feedback.status == null) return false;
    if (!isPhaseSettled(feedback.statusCorrect, `${criterionId}::status`)) return false;
    return true;
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
        : !isPhaseSettled(activeFeedback.stepCorrect, `${activeCriterionId}::placement`)
          ? isThreadPending(`${activeCriterionId}::placement`)
            ? "checking"
            : "resolve-placement"
          : activeFeedback.status == null
            ? "mark"
            : !isPhaseSettled(activeFeedback.statusCorrect, `${activeCriterionId}::status`)
              ? isThreadPending(`${activeCriterionId}::status`)
                ? "checking"
                : "resolve-status"
              : "done";

  const activeDiscussionComment = activeDiscussion
    ? currentComments[activeDiscussion.key]?.find((c) => c.speaker === activeDiscussion.speaker)
    : undefined;
  const activeDiscussionCriterion = activeDiscussion
    ? rubric.find((c) => c.id === activeDiscussion.key.split("::")[0])
    : undefined;
  const activeCounterpartLabel =
    activeDiscussion?.speaker === "professor" ? PROFESSOR_NAME : currentAnswer.label;

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
    setDragCriterionId(criterionId);
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
              {PHASE_PILL[phase] ? (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PHASE_PILL[phase]!.className}`}
                >
                  {PHASE_PILL[phase]!.text}
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
            You are grading this AI student&apos;s work.{" "}
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
                          const fullyGraded =
                            placementChecked && criterionFeedback.status != null;
                          const placementKey = `${criterion.id}::placement`;
                          const statusKey = `${criterion.id}::status`;
                          // A card only locks into its green/red verdict styling once
                          // both the placement and status calls are settled — graded
                          // alone isn't enough while a challenge on either is still open.
                          const isResolved =
                            fullyGraded &&
                            isPhaseSettled(criterionFeedback!.stepCorrect, placementKey) &&
                            isPhaseSettled(criterionFeedback!.statusCorrect, statusKey);
                          // Only the active criterion is ever interactive — every other
                          // placed card, by construction, is already done.
                          const isActive = criterion.id === activeCriterionId;
                          const lockedByOther = !isActive;
                          // The mark block shows for the active card once its placement is
                          // settled and it hasn't been marked yet — or, if the pass/fail call
                          // itself was actually wrong, so the TA can redo it. A wrong call
                          // can only be fixed by re-marking, never by conceding in discussion
                          // alone, and a correct call under an open challenge doesn't get the
                          // buttons back since there's nothing to redo.
                          const isStatusMistake =
                            phase === "resolve-status" && criterionFeedback?.statusCorrect === false;
                          const showMarkBlock = isActive && (phase === "mark" || isStatusMistake);

                          return (
                            <div
                              key={criterion.id}
                              draggable={!isGrading && !lockedByOther}
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
                                    AI Student {placement?.status === "fail" ? "Fail" : "Pass"}
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  disabled={isGrading || lockedByOther}
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
                                    ) : (
                                      <CheckIcon className="shrink-0 text-green-700" />
                                    )}
                                    <span>
                                      <span className="font-semibold">
                                        {isStatusMistake ? "That call was wrong." : "Placement confirmed."}
                                      </span>{" "}
                                      Does this step meet the criterion?
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      disabled={isGrading}
                                      onClick={() => setStatus(criterion.id, "pass")}
                                      className="h-10 rounded-lg border border-green-300 text-xs font-semibold text-green-700 transition-colors hover:bg-green-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      AI Student Pass
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isGrading}
                                      onClick={() => setStatus(criterion.id, "fail")}
                                      className="h-10 rounded-lg border border-red-300 text-xs font-semibold text-red-700 transition-colors hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      AI Student Fail
                                    </button>
                                  </div>
                                </div>
                              ) : null}

                              {[placementKey, statusKey].flatMap((key) =>
                                (currentComments[key] ?? [])
                                  .filter((comment) => comment.pending || comment.text)
                                  .map((comment) => {
                                    const style = SPEAKER_STYLES[comment.speaker];
                                    const name =
                                      comment.speaker === "professor"
                                        ? PROFESSOR_NAME
                                        : currentAnswer.label;

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
                                            {discussionMode === 2 ? (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setActiveDiscussion({
                                                    key,
                                                    speaker: comment.speaker,
                                                  })
                                                }
                                                className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-lime-700 hover:text-lime-900"
                                              >
                                                Respond
                                                {(currentDiscussions[key]?.[comment.speaker]
                                                  ?.length ?? 0) > 0
                                                  ? ` (${currentDiscussions[key]?.[comment.speaker]?.length})`
                                                  : ""}
                                                <ArrowRightIcon width={13} height={13} />
                                              </button>
                                            ) : null}
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

      {discussionMode === 2 && activeDiscussion && activeDiscussionComment ? (
        <DiscussionPanel
          open
          onClose={() => setActiveDiscussion(null)}
          counterpartLabel={activeCounterpartLabel}
          criterionLabel={activeDiscussionCriterion?.label ?? "this criterion"}
          openingComment={activeDiscussionComment.text}
          messages={currentDiscussions[activeDiscussion.key]?.[activeDiscussion.speaker] ?? []}
          pending={
            currentDiscussionPending[activeDiscussion.key]?.[activeDiscussion.speaker] ?? false
          }
          resolved={currentResolved[activeDiscussion.key] ?? false}
          onSend={(text) =>
            onSendDiscussionMessage?.(
              currentAnswer.id,
              activeDiscussion.key,
              activeDiscussion.speaker,
              text
            )
          }
        />
      ) : null}
    </div>
  );
}
