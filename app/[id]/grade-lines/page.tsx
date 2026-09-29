"use client";

import { Suspense, useState } from "react";
import { useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import LineRubricPanel, {
  DiscussionMessage,
  GradeComment,
  FlowThread,
  StepPlacement,
  StepPlacementsState,
  StepCriterionFeedback,
  StepReviewState,
  RubricCriterion,
} from "@/components/line-rubric-panel";
import { CommentSpeaker, pickPlacementSpeaker, pickStatusSpeaker } from "@/lib/grading-voice";
import {
  INITIAL_PLACEMENT_FLOW,
  PlacementEffect,
  PlacementEvent,
  PlacementExplainSlot,
  ReplyLabel,
  placementLine,
  quickReplyLabel,
  transitionPlacement,
} from "@/lib/placement-flow";
import { statusLine, statusSpeaker } from "@/lib/status-flow";
import { getScenario } from "@/lib/scenarios/registry";
import { FinalAiAnswer } from "@/lib/scenarios/types";
import AppHeader from "@/components/app-header";
import StepProgress from "@/components/step-progress";
import StepIntro from "@/components/step-intro";
import { parseScenarioId } from "@/lib/scenarios/utils";
import { logEvent } from "@/lib/logger";

type CommentKind = "placement" | "status";

// Keyed by answerId -> criterionId.
type FlowThreads = Record<string, Record<string, FlowThread>>;
type FlowItems = Record<string, Record<string, StepCriterionFeedback>>;

// Placement and status are graded — and discussed — as two separate, sequential
// moments on the same criterion, so every thread is keyed by criterionId + which of the
// two it's about, rather than by criterionId alone.
const commentKey = (criterionId: string, kind: CommentKind) => `${criterionId}::${kind}`;

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
  // Bumped every time a criterion is (re-)graded, keyed by `${answerId}::${criterionId}`.
  // Dragging the same criterion again before its in-flight grade request resolves can
  // leave two requests racing — this lets a response tell whether it's still the latest
  // one for its criterion before touching state, so a stale reply can't clobber a fresher
  // result (or get the criterion mistakenly stuck as ungraded/undraggable).
  const gradeGenerationRef = useRef<Record<string, number>>({});
  // Discussion mode's two decision trees (placement, then pass/fail), one thread per
  // criterion each. Mirrored in a ref so the async dispatcher always transitions from the
  // latest flow state, not a stale render's.
  const [flowThreads, setFlowThreads] = useState<Record<CommentKind, FlowThreads>>({
    placement: {},
    status: {},
  });
  const flowThreadsRef = useRef<Record<CommentKind, FlowThreads>>({ placement: {}, status: {} });
  // The grading result of each criterion's latest drop (or mark) — that thread's lines and
  // explanations are about it.
  const flowItemsRef = useRef<Record<CommentKind, FlowItems>>({ placement: {}, status: {} });

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

  // Drops every comment bubble tied to a criterion, or
  // just the status-phase bubble when `kind` is given. Used whenever a criterion's
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
    assignment: { speaker: CommentSpeaker; coversStep: boolean; coversStatus: boolean }
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
    item: StepCriterionFeedback
  ) => {
    const key = commentKey(criterionId, kind);

    setComments((prev) => ({
      ...prev,
      [answerId]: { ...prev[answerId], [key]: [{ speaker, text: "", pending: true }] },
    }));

    const stepText = item.placedStep != null ? answer.steps[item.placedStep - 1] ?? "" : "";
    const expectedStepText = answer.steps[item.expectedStep - 1] ?? "";

    fetchNudgeComment(
      answerId,
      key,
      item.criterion,
      stepText,
      expectedStepText,
      item,
      { speaker, coversStep: kind === "placement", coversStatus: kind === "status" }
    );
  };

  const getFlowThread = (kind: CommentKind, answerId: string, criterionId: string): FlowThread =>
    flowThreadsRef.current[kind][answerId]?.[criterionId] ?? {
      flow: INITIAL_PLACEMENT_FLOW,
      messages: [],
      pending: false,
      speaker: "professor",
    };

  const updateFlowThread = (
    kind: CommentKind,
    answerId: string,
    criterionId: string,
    update: (thread: FlowThread) => FlowThread
  ) => {
    const byKind = flowThreadsRef.current[kind];
    const next = {
      ...flowThreadsRef.current,
      [kind]: {
        ...byKind,
        [answerId]: {
          ...byKind[answerId],
          [criterionId]: update(getFlowThread(kind, answerId, criterionId)),
        },
      },
    };
    flowThreadsRef.current = next;
    setFlowThreads(next);
  };

  // Forgets a criterion's pass/fail thread, e.g. once it's moved and has to be marked afresh.
  const dropStatusThread = (answerId: string, criterionId: string) => {
    if (!flowThreadsRef.current.status[answerId]?.[criterionId]) return;
    const forAnswer = { ...flowThreadsRef.current.status[answerId] };
    delete forAnswer[criterionId];
    const next = {
      ...flowThreadsRef.current,
      status: { ...flowThreadsRef.current.status, [answerId]: forAnswer },
    };
    flowThreadsRef.current = next;
    setFlowThreads(next);
  };

  const appendFlowMessage = (
    kind: CommentKind,
    answerId: string,
    criterionId: string,
    role: DiscussionMessage["role"],
    text: string
  ) => {
    updateFlowThread(kind, answerId, criterionId, (thread) => ({
      ...thread,
      messages: [
        ...thread.messages,
        { id: `${role}-${Date.now()}-${thread.messages.length}`, role, text },
      ],
    }));
  };

  const fetchFlowExplain = async (
    kind: CommentKind,
    speaker: CommentSpeaker,
    answer: FinalAiAnswer,
    item: StepCriterionFeedback,
    slot: PlacementExplainSlot,
    taMessage: string | undefined
  ): Promise<string> => {
    try {
      const res = await fetch("/api/placement-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot,
          kind,
          speaker,
          answerTitle: answer.label,
          answerText: answer.steps.join("\n\n"),
          question,
          criterionLabel: item.criterion,
          placedStep: item.placedStep,
          stepText: item.placedStep != null ? answer.steps[item.placedStep - 1] ?? "" : "",
          expectedStep: item.expectedStep,
          expectedStepText: answer.steps[item.expectedStep - 1] ?? "",
          userStatus: item.status,
          expectedStatus: item.expectedStatus,
          feedback: item.feedback,
          correct: kind === "status" ? item.statusCorrect : item.stepCorrect,
          taMessage,
        }),
      });
      const data = await res.json();
      return data.text ?? "";
    } catch {
      return "";
    }
  };

  const classifyFlowReply = async (questionText: string, reply: string) => {
    try {
      const res = await fetch("/api/placement-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: questionText, reply }),
      });
      const data = await res.json();
      return (data.label as ReplyLabel) ?? "unclear";
    } catch {
      return "unclear";
    }
  };

  const renderFlowLine = (
    kind: CommentKind,
    line: Extract<PlacementEffect, { type: "say" }>["line"],
    item: StepCriterionFeedback
  ) =>
    kind === "status"
      ? statusLine(line, {
          marked: item.status,
          expected: item.expectedStatus,
          placedStep: item.placedStep,
        })
      : placementLine(line, {
          criterionLabel: item.criterion,
          placedStep: item.placedStep,
          expectedStep: item.expectedStep,
        });

  // Advances one criterion's placement or pass/fail decision tree and runs the resulting
  // effects in order. Which branch is taken is decided entirely by transitionPlacement —
  // both trees share it (see lib/status-flow.ts).
  const dispatchFlow = async (
    kind: CommentKind,
    answerId: string,
    criterionId: string,
    event: PlacementEvent,
    taMessage?: string
  ) => {
    const answer = FINAL_AI_ANSWERS.find((entry) => entry.id === answerId);
    const item = flowItemsRef.current[kind][answerId]?.[criterionId];
    if (!answer || !item) return;

    const { flow: from, speaker } = getFlowThread(kind, answerId, criterionId);
    const { next, effects } = transitionPlacement(from, event);

    logEvent(`grade_lines_${kind}_transition`, scenarioId, {
      answer_id: answerId,
      criterion_id: criterionId,
      from,
      event,
      to: next,
    });

    updateFlowThread(kind, answerId, criterionId, (thread) => ({
      ...thread,
      flow: next,
      pending: true,
    }));

    for (const effect of effects) {
      if (effect.type === "say") {
        appendFlowMessage(kind, answerId, criterionId, speaker, renderFlowLine(kind, effect.line, item));
      } else {
        const text = await fetchFlowExplain(kind, speaker, answer, item, effect.slot, taMessage);
        if (text) appendFlowMessage(kind, answerId, criterionId, speaker, text);
      }
    }

    updateFlowThread(kind, answerId, criterionId, (thread) => ({ ...thread, pending: false }));
  };

  const handleFlowReply = async (
    kind: CommentKind,
    answerId: string,
    criterionId: string,
    text: string
  ) => {
    const thread = getFlowThread(kind, answerId, criterionId);
    if (thread.flow.kind !== "chat" || thread.pending) return;

    const lastQuestion =
      [...thread.messages].reverse().find((message) => message.role !== "user")?.text ?? "";
    appendFlowMessage(kind, answerId, criterionId, "user", text);

    // Only "Are you sure?" branches on what was said; the other questions move on whatever
    // the answer, so they skip classification entirely.
    let label: ReplyLabel | null = null;
    if (thread.flow.node === "askSure") {
      label = quickReplyLabel(text);
      if (!label) {
        updateFlowThread(kind, answerId, criterionId, (current) => ({ ...current, pending: true }));
        label = await classifyFlowReply(lastQuestion, text);
      }
    }

    await dispatchFlow(kind, answerId, criterionId, { type: "REPLY", label }, text);
  };

  // Records the grading result a drop or mark is being discussed about, then feeds that
  // drop or mark into its decision tree.
  const startFlowTurn = (
    kind: CommentKind,
    answerId: string,
    criterionId: string,
    item: StepCriterionFeedback,
    correct: boolean
  ) => {
    flowItemsRef.current = {
      ...flowItemsRef.current,
      [kind]: {
        ...flowItemsRef.current[kind],
        [answerId]: { ...flowItemsRef.current[kind][answerId], [criterionId]: item },
      },
    };
    dispatchFlow(kind, answerId, criterionId, { type: "DROP", correct });
  };

  // Runs immediately after a criterion is dropped on a step: checks placement only
  // (status isn't chosen yet). In discussion mode every drop starts the placement
  // decision tree; otherwise a misplacement just gets a one-off correction bubble.
  const handlePlacementResult = (
    answerId: string,
    answer: FinalAiAnswer,
    criterionId: string,
    item: StepCriterionFeedback
  ) => {
    if (discussionMode === 2) {
      startFlowTurn("placement", answerId, criterionId, item, item.stepCorrect);
      return;
    }

    if (item.stepCorrect) return;
    openThread(answerId, answer, criterionId, "placement", pickPlacementSpeaker(), item);
  };

  // Runs immediately after the TA marks pass/fail. In discussion mode every mark starts
  // (or continues) the pass/fail decision tree, voiced by whoever that mark concerns;
  // otherwise a wrong call just gets a one-off correction bubble. Decoupled from
  // placement, which was already settled in the previous step.
  const handleStatusResult = (
    answerId: string,
    answer: FinalAiAnswer,
    criterionId: string,
    item: StepCriterionFeedback
  ) => {
    if (discussionMode === 2) {
      if (!item.status) return;
      const speaker = statusSpeaker(item.status);
      updateFlowThread("status", answerId, criterionId, (thread) => ({ ...thread, speaker }));
      startFlowTurn("status", answerId, criterionId, item, item.statusCorrect);
      return;
    }

    const speaker = pickStatusSpeaker(item);
    if (!speaker) return;
    openThread(answerId, answer, criterionId, "status", speaker, item);
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
        dropStatusThread(answerId, criterionId);
        clearCriterionFeedback(answerId, criterionId);
        gradeCriterion(answerId, criterionId, { ...placement, status: null });
      } else if (justMarked) {
        // Switching directly from Pass to Fail (or vice versa) re-checks status, but the
        // old status thread has to be cleared first — if the new call needs no comment
        // (mode 1, and correct), nothing would otherwise overwrite the stale one left over
        // from the previous status. The pass/fail decision tree keeps going across re-marks.
        resetCriterionThreads(answerId, criterionId, "status");
        gradeCriterion(answerId, criterionId, placement);
      }
    });

    // Dragged back to the bank, or un-marked without moving: drop what no longer applies.
    Object.entries(prevForAnswer).forEach(([criterionId, prevPlacement]) => {
      const nextPlacement = next[criterionId];

      if (!nextPlacement) {
        resetCriterionThreads(answerId, criterionId);
        dropStatusThread(answerId, criterionId);
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

  // Dropping an unlocked item back on the step it's already on doesn't change placements,
  // but it's still a new answer to the placement question, so it's re-checked as a drop.
  const handlePlacementRedrop = (answerId: string, criterionId: string) => {
    const placement = placements[answerId]?.[criterionId];
    if (!placement) return;
    gradeCriterion(answerId, criterionId, { ...placement, status: null });
  };

  // Clicking the status that's already marked, after being asked to look again, is a fresh
  // answer too — "I'm keeping it" — so it's re-checked as a new mark.
  const handleStatusRemark = (answerId: string, criterionId: string) => {
    const placement = placements[answerId]?.[criterionId];
    if (!placement?.status) return;
    gradeCriterion(answerId, criterionId, placement);
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
          placementThreads={flowThreads.placement}
          onPlacementReply={(answerId, criterionId, text) =>
            handleFlowReply("placement", answerId, criterionId, text)
          }
          onPlacementRedrop={handlePlacementRedrop}
          statusThreads={flowThreads.status}
          onStatusReply={(answerId, criterionId, text) =>
            handleFlowReply("status", answerId, criterionId, text)
          }
          onStatusRemark={handleStatusRemark}
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
