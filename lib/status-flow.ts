// Pass/fail discussion in /grade-lines (see status_feedback_flow.mmd). Its decision tree is
// node-for-node the same as the placement one, so it runs on the same reducer: a pass/fail
// mark is sent as a DROP, and `correct` is whether the mark matches the ground truth. Only
// the wording and who's speaking differ, and those live here.
import type { CommentSpeaker } from "./grading-voice";
import type { PlacementLineId } from "./placement-flow";

export type StatusMark = "pass" | "fail";

// Fixed per mark, never by correctness, so who speaks doesn't give the answer away. A
// student would only second-guess being marked Fail — they'd never invite doubt on a Pass —
// so a professor is the one who double-checks a Pass for rigor instead.
export function statusSpeaker(marked: StatusMark): CommentSpeaker {
  return marked === "fail" ? "student" : "professor";
}

type StatusLineContext = {
  marked: StatusMark | null;
  expected: StatusMark | null;
  placedStep: number | null;
};

const upper = (status: StatusMark | null) => (status ?? "?").toUpperCase();

// The question is always phrased the same way, so "yes" always means "I'm keeping it".
export function statusLine(line: PlacementLineId, ctx: StatusLineContext): string {
  const step = ctx.placedStep ?? "?";
  const verb = ctx.marked === "fail" ? "misses" : "meets";
  switch (line) {
    case "askSure":
      return `Are you sure this is a ${upper(ctx.marked)}?`;
    case "askWhy":
      return `Why do you think step ${step} ${verb} the criterion?`;
    case "askUnsureCorrect":
      return "What about the call are you unsure about?";
    case "askUnsureIncorrect":
      return "Then what do you think is off, and why?";
    case "clarify":
      return `Just to check — are you keeping it as a ${upper(ctx.marked)}? A yes or no is fine.`;
    case "lookAgain":
      return "Take another look and mark it the way you think is right.";
    case "revealedPlaced":
      return "That's it — thanks.";
    case "revealedWrongStep":
      return `It should be a ${upper(ctx.expected)} — re-mark it.`;
  }
}
