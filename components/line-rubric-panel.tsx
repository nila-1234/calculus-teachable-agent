"use client";

import { useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChatBubbleIcon,
  CheckIcon,
  Cross2Icon,
  DragHandleDots2Icon,
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
  // has been resolved. Being right isn't enough on its own to wave away an open
  // challenge; being wrong always needs either a fix or a resolution, discussion or not.
  const isPhaseSettled = (correct: boolean, key: string): boolean =>
    correct ? !canDiscuss || !isThreadOpenAndUnresolved(key) : !isThreadOpenAndUnresolved(key);

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

  const inProgressCriterionId =
    rubric.find(
      (criterion) => currentPlacements[criterion.id] && !isCriterionComplete(criterion.id)
    )?.id ?? null;

  const activeDiscussionComment = activeDiscussion
    ? currentComments[activeDiscussion.key]?.find((c) => c.speaker === activeDiscussion.speaker)
    : undefined;
  const activeDiscussionCriterion = activeDiscussion
    ? rubric.find((c) => c.id === activeDiscussion.key.split("::")[0])
    : undefined;
  const activeCounterpartLabel =
    activeDiscussion?.speaker === "professor" ? "Professor" : currentAnswer.label;

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
    if (criterionId) assignToStep(criterionId, stepIndex);
    setDragOverStep(null);
    setDragCriterionId(null);
  };

  const handleBankDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const criterionId = e.dataTransfer.getData("text/plain") || dragCriterionId;
    if (criterionId) unassign(criterionId);
    setDragOverBank(false);
    setDragCriterionId(null);
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
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-stone-800">{currentAnswer.label}</h3>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                isSubmitted ? "bg-lime-50 text-lime-700" : "bg-stone-100 text-stone-500"
              }`}
            >
              {gradedCount} of {rubric.length} graded
            </span>
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

          <div className="flex flex-col gap-2">
            {steps.map((step, stepIndex) => {
              const stepPlacements = placementsByStep(stepIndex);
              const isDragOver = dragOverStep === stepIndex;

              return (
                <div
                  key={stepIndex}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverStep(stepIndex);
                  }}
                  onDragLeave={() => setDragOverStep((prev) => (prev === stepIndex ? null : prev))}
                  onDrop={handleStepDrop(stepIndex)}
                  className={`flex gap-3 rounded-xl border-2 border-dashed p-3 transition-colors ${
                    isDragOver
                      ? "border-lime-500 bg-lime-50"
                      : "border-transparent hover:border-stone-200"
                  }`}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-500">
                    {stepIndex + 1}
                  </div>

                  <div className="flex-1">
                    <div className="text-sm leading-7 text-stone-700">
                      <MathDisplay text={step} />
                    </div>

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
                          // While a different criterion is in progress (a misplacement or
                          // a challenge still needs fixing or resolving), every other
                          // criterion is locked — only the one in progress stays live.
                          const lockedByOther =
                            inProgressCriterionId != null &&
                            inProgressCriterionId !== criterion.id;
                          // Pass/Fail only make sense once the placement is settled:
                          // actually right, and any challenge to it has been resolved
                          // (not just correct underneath).
                          const placementOk =
                            placementChecked &&
                            isPhaseSettled(criterionFeedback!.stepCorrect, placementKey);

                          return (
                            <div
                              key={criterion.id}
                              draggable={!isGrading && !lockedByOther}
                              onDragStart={handleDragStart(criterion.id)}
                              onDragEnd={handleDragEnd}
                              className={`flex flex-col gap-1.5 rounded-xl px-3.5 py-3 text-xs shadow-sm ${
                                fullyGraded
                                  ? criterionFeedback!.correct
                                    ? "bg-green-50"
                                    : "bg-red-50"
                                  : "bg-stone-50"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {fullyGraded ? (
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
                                {placementOk ? (
                                  <div className="inline-flex shrink-0 gap-1">
                                    <button
                                      type="button"
                                      disabled={isGrading || lockedByOther}
                                      onClick={() => setStatus(criterion.id, "pass")}
                                      title={
                                        lockedByOther
                                          ? "Finish the criterion in progress before grading this one"
                                          : undefined
                                      }
                                      className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                        placement?.status === "pass"
                                          ? "bg-stone-300 text-slate-800"
                                          : "bg-white text-stone-500 hover:border-stone-300"
                                      }`}
                                    >
                                      AI Student Pass
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isGrading || lockedByOther}
                                      onClick={() => setStatus(criterion.id, "fail")}
                                      title={
                                        lockedByOther
                                          ? "Finish the criterion in progress before grading this one"
                                          : undefined
                                      }
                                      className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                        placement?.status === "fail"
                                          ? "bg-stone-300 text-slate-800"
                                          : "bg-white text-stone-500 hover:border-stone-300"
                                      }`}
                                    >
                                      AI Student Fail
                                    </button>
                                  </div>
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

                              {[placementKey, statusKey].flatMap((key) =>
                                (currentComments[key] ?? [])
                                  .filter((comment) => comment.pending || comment.text)
                                  .map((comment) => {
                                    const style = SPEAKER_STYLES[comment.speaker];
                                    const name =
                                      comment.speaker === "professor"
                                        ? "Professor"
                                        : currentAnswer.label;

                                    return (
                                      <div
                                        key={key}
                                        className={`ml-5 flex items-start gap-2 rounded-xl px-3.5 py-3 text-xs shadow-sm ${style.bubble}`}
                                      >
                                        <span
                                          title={name}
                                          aria-label={name}
                                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${style.avatar}`}
                                        >
                                          {style.initial}
                                        </span>
                                        {comment.pending ? (
                                          <span className="italic opacity-80">
                                            {name} is thinking...
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
                                                className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-lime-700 hover:text-lime-900"
                                              >
                                                <ChatBubbleIcon width={15} height={15} />
                                                Reply
                                                {(currentDiscussions[key]?.[comment.speaker]
                                                  ?.length ?? 0) > 0
                                                  ? ` (${currentDiscussions[key]?.[comment.speaker]?.length})`
                                                  : ""}
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
            className={`h-fit rounded-xl border-2 border-dashed p-4 shadow-sm transition-colors ${
              dragOverBank ? "border-lime-500 bg-lime-50" : "border-stone-200 bg-white"
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
                {unassigned.map((criterion) => (
                  <div
                    key={criterion.id}
                    draggable={!inProgressCriterionId}
                    onDragStart={handleDragStart(criterion.id)}
                    onDragEnd={handleDragEnd}
                    title={
                      inProgressCriterionId
                        ? "Finish the criterion in progress before starting another"
                        : undefined
                    }
                    className={`flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-700 transition-colors ${
                      inProgressCriterionId
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-grab active:cursor-grabbing"
                    } ${dragCriterionId === criterion.id ? "opacity-40" : ""}`}
                  >
                    <DragHandleDots2Icon className="mt-0.5 shrink-0 text-stone-400" />
                    <MathDisplay text={criterion.label} />
                  </div>
                ))}
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
          forceReply
          onClose={() => setActiveDiscussion(null)}
          counterpartLabel={activeCounterpartLabel}
          criterionLabel={activeDiscussionCriterion?.label ?? "this criterion"}
          openingComment={activeDiscussionComment.text}
          messages={currentDiscussions[activeDiscussion.key]?.[activeDiscussion.speaker] ?? []}
          pending={
            currentDiscussionPending[activeDiscussion.key]?.[activeDiscussion.speaker] ?? false
          }
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
