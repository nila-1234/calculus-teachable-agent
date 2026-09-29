// Deterministic decision tree for the step-placement discussion in /grade-lines
// (see drag_drop_feedback_flow.mmd). Every branch is decided here from two facts: whether
// the drop was actually correct (known from grading) and what the TA answered. The LLM
// never decides a branch — it only turns a free-text answer to "Are you sure?" into a
// yes/no/unclear label, and writes the text of a few professor lines.

// After this many drops of the same item, the professor tells the TA the correct step
// instead of just asking them to look again. The TA still moves the item themselves.
export const MAX_PLACEMENT_ATTEMPTS = 2;

// A second unclear answer to "Are you sure?" counts as "no" rather than re-asking forever.
const MAX_UNCLEAR_REPLIES = 1;

// The professor question the TA is currently answering.
export type PlacementNode =
  | "askSure" // "Are you sure?"            -> answer is classified yes / no / unclear
  | "askWhy" // "Why is this the right place?" (wrong drop only) -> free text, never judged
  | "askUnsure" // "What are you unsure about?" -> free text, never judged
  | "consider"; // "Consider this: [concept]"   -> free text, never judged

export type ReplyLabel = "yes" | "no" | "unclear";

export type PlacementFlow =
  // Item can be dragged. `attempt` is the number the next drop will count as. Once
  // `revealed`, the TA has been told the step and the next drop there is accepted.
  | { kind: "dragging"; attempt: number; revealed?: boolean }
  // Item is locked while the TA answers the professor.
  | { kind: "chat"; node: PlacementNode; attempt: number; correct: boolean; unclear: number }
  // Placement is final: either the TA stood by a correct drop, or moved it where they were told.
  | { kind: "resolved"; how: "accepted" | "revealed"; attempt: number };

export type PlacementEvent =
  | { type: "DROP"; correct: boolean }
  // `label` is only read at `askSure`; every other node takes the reply as-is.
  | { type: "REPLY"; label: ReplyLabel | null };

// Fixed professor lines, rendered by `placementLine`.
export type PlacementLineId =
  | "askSure"
  | "askWhy"
  | "askUnsureCorrect"
  | "askUnsureIncorrect"
  | "clarify"
  | "lookAgain"
  | "revealedPlaced"
  | "revealedWrongStep";

// Professor lines written by the LLM, grounded in the rubric's reasoning.
export type PlacementExplainSlot = "affirm" | "hint" | "reveal";

export type PlacementEffect =
  | { type: "say"; line: PlacementLineId }
  | { type: "explain"; slot: PlacementExplainSlot };

export const INITIAL_PLACEMENT_FLOW: PlacementFlow = { kind: "dragging", attempt: 1 };

export type PlacementTransition = { next: PlacementFlow; effects: PlacementEffect[] };

// The TA didn't stand by a correct drop, or stood by / abandoned a wrong one: they get
// another drag. Once they've used up their attempts, that drag comes with the answer.
function retryOrReveal(attempt: number): PlacementTransition {
  if (attempt < MAX_PLACEMENT_ATTEMPTS) {
    return {
      next: { kind: "dragging", attempt: attempt + 1 },
      effects: [{ type: "say", line: "lookAgain" }],
    };
  }
  return {
    next: { kind: "dragging", attempt: attempt + 1, revealed: true },
    effects: [{ type: "explain", slot: "reveal" }],
  };
}

// Pure: returns the next state and the side effects the caller should run, in order.
// An event that doesn't apply to the current state is a no-op.
export function transitionPlacement(
  flow: PlacementFlow,
  event: PlacementEvent
): PlacementTransition {
  const unchanged: PlacementTransition = { next: flow, effects: [] };

  if (event.type === "DROP") {
    if (flow.kind !== "dragging") return unchanged;
    // They already know where it goes, so there's nothing left to question — just check
    // they actually put it there.
    if (flow.revealed) {
      return event.correct
        ? {
            next: { kind: "resolved", how: "revealed", attempt: flow.attempt },
            effects: [{ type: "say", line: "revealedPlaced" }],
          }
        : { next: flow, effects: [{ type: "say", line: "revealedWrongStep" }] };
    }
    return {
      next: {
        kind: "chat",
        node: "askSure",
        attempt: flow.attempt,
        correct: event.correct,
        unclear: 0,
      },
      effects: [{ type: "say", line: "askSure" }],
    };
  }

  if (flow.kind !== "chat") return unchanged;

  switch (flow.node) {
    case "askSure": {
      const label =
        event.label === "unclear" && flow.unclear >= MAX_UNCLEAR_REPLIES
          ? "no"
          : (event.label ?? "unclear");

      if (label === "unclear") {
        return {
          next: { ...flow, unclear: flow.unclear + 1 },
          effects: [{ type: "say", line: "clarify" }],
        };
      }
      if (label === "yes") {
        // Standing by a correct drop is enough on its own — no need to justify it.
        if (flow.correct) {
          return {
            next: { kind: "resolved", how: "accepted", attempt: flow.attempt },
            effects: [{ type: "explain", slot: "affirm" }],
          };
        }
        return { next: { ...flow, node: "askWhy" }, effects: [{ type: "say", line: "askWhy" }] };
      }
      return {
        next: { ...flow, node: "askUnsure" },
        effects: [
          { type: "say", line: flow.correct ? "askUnsureCorrect" : "askUnsureIncorrect" },
        ],
      };
    }

    // Only reached from an incorrect drop the TA stood by.
    case "askWhy":
      return {
        next: { ...flow, node: "consider" },
        effects: [{ type: "explain", slot: "hint" }],
      };

    case "askUnsure":
    case "consider":
      return retryOrReveal(flow.attempt);
  }
}

// Only "Are you sure?" has a classified answer, so only it offers one-click replies.
// These map straight to a label without an LLM call.
export const PLACEMENT_QUICK_REPLIES: { text: string; label: ReplyLabel }[] = [
  { text: "Yes, I'm sure", label: "yes" },
  { text: "No, I'm not sure", label: "no" },
];

export function quickReplyLabel(text: string): ReplyLabel | null {
  return PLACEMENT_QUICK_REPLIES.find((reply) => reply.text === text)?.label ?? null;
}

type LineContext = { criterionLabel: string; placedStep: number | null; expectedStep: number };

// The question is always phrased the same way, so "yes" always means "I'm keeping it".
export function placementLine(line: PlacementLineId, ctx: LineContext): string {
  const step = ctx.placedStep ?? "?";
  switch (line) {
    case "askSure":
      return `Are you sure "${ctx.criterionLabel}" belongs on step ${step}?`;
    case "askWhy":
      return `Why do you think step ${step} is the right place for it?`;
    case "askUnsureCorrect":
      return "What about your placement are you unsure about?";
    case "askUnsureIncorrect":
      return "Then what do you think is not right, and why?";
    case "clarify":
      return `Just to check — are you keeping it on step ${step}? A yes or no is fine.`;
    case "lookAgain":
      return "Take another look at the steps and drag it to wherever you think it fits best.";
    case "revealedPlaced":
      return "That's the one — good.";
    case "revealedWrongStep":
      return `That's step ${step} — drag it to step ${ctx.expectedStep}.`;
  }
}
