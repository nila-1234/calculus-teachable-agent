// Decision tree for discussion mode 3 in /grade-lines: the templated feedback flow from the
// Figma board "Calculus TA Chat Flow" (see Diagrams/feedback_flow.mmd). One tree serves all
// three TA actions — placing a criterion on a step, marking it PASS, marking it FAIL — and the
// action only changes the wording (scenario 1x / 2x / 3x in lib/feedback-templates.ts).
//
// Mode 2 keeps the older "Are you sure?" tree in lib/placement-flow.ts; it is left untouched
// so the pilot logs can still be replayed (lib/tests/flow.ts).
//
// Every branch is decided here from facts the caller already has: whether the action was
// correct (from grading), the attempt count, a random number for sampling, and — after the
// TA explains — whether the LLM judged that explanation sufficient. The LLM never picks a
// branch beyond that one sufficient / insufficient call.
import {
  feedbackScenario,
  shouldSampleFeedback,
  type FeedbackAction,
  type FeedbackScenario,
  type FeedbackType,
} from "./feedback-templates";

export type FeedbackFlow =
  // The TA can drag (or mark). `attempt` is the number the next action will count as.
  // Same shape as PlacementFlow's "dragging", so the panel can treat both flows alike.
  | { kind: "dragging"; attempt: number }
  // Locked while the TA explains their reasoning in reply to the probe.
  | {
      kind: "chat";
      node: "explain";
      scenario: FeedbackScenario;
      attempt: number;
      correct: boolean;
    }
  // The criterion's placement (or mark) is final. "discussed": a sampled correct 1st attempt
  // that was probed. "unprobed": correct, but not sampled or not the 1st attempt.
  | { kind: "resolved"; how: "discussed" | "unprobed"; attempt: number };

export type FeedbackEvent =
  // The TA placed the criterion or marked the step. `rand` in [0, 1) decides sampling.
  | { type: "ACT"; action: FeedbackAction; correct: boolean; rand: number }
  // The LLM's verdict on the TA's explanation.
  | { type: "EXPLAIN"; sufficient: boolean };

// Say this template, filled for the current criterion (by code, or by the LLM when it has
// gaps code can't fill).
export type FeedbackEffect = { type: "say"; scenario: FeedbackScenario; feedback: FeedbackType };

export type FeedbackTransition = { next: FeedbackFlow; effects: FeedbackEffect[] };

export const INITIAL_FEEDBACK_FLOW: FeedbackFlow = { kind: "dragging", attempt: 1 };

// Pure: returns the next state and the lines to say, in order. An event that doesn't apply
// to the current state is a no-op.
export function transitionFeedback(flow: FeedbackFlow, event: FeedbackEvent): FeedbackTransition {
  const unchanged: FeedbackTransition = { next: flow, effects: [] };

  if (event.type === "ACT") {
    if (flow.kind !== "dragging") return unchanged;
    const { attempt } = flow;
    const scenario = feedbackScenario(event.action, event.correct, attempt);

    // Correct after the 1st attempt: no feedback, move on.
    if (!scenario) return { next: { kind: "resolved", how: "unprobed", attempt }, effects: [] };

    // a · correct 1st attempt: probed only when sampled (placement / PASS 10%, FAIL 50%).
    if (event.correct) {
      if (!shouldSampleFeedback(scenario, event.rand)) {
        return { next: { kind: "resolved", how: "unprobed", attempt }, effects: [] };
      }
      return {
        next: { kind: "chat", node: "explain", scenario, attempt, correct: true },
        effects: [{ type: "say", scenario, feedback: "probe" }],
      };
    }

    // c · wrong on the 2nd attempt or later: no probe. The answer is revealed, but the TA
    // still has to act again; another wrong action repeats c.
    if (scenario.endsWith("c")) {
      return {
        next: { kind: "dragging", attempt: attempt + 1 },
        effects: [{ type: "say", scenario, feedback: "insufficient_2nd" }],
      };
    }

    // b · wrong 1st attempt: always probed.
    return {
      next: { kind: "chat", node: "explain", scenario, attempt, correct: false },
      effects: [{ type: "say", scenario, feedback: "probe" }],
    };
  }

  if (flow.kind !== "chat") return unchanged;

  const effects: FeedbackEffect[] = [
    { type: "say", scenario: flow.scenario, feedback: event.sufficient ? "sufficient" : "insufficient" },
  ];
  // a moves on; b leaves the criterion open for another try.
  return flow.correct
    ? { next: { kind: "resolved", how: "discussed", attempt: flow.attempt }, effects }
    : { next: { kind: "dragging", attempt: flow.attempt + 1 }, effects };
}
