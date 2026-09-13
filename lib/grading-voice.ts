export type CommentSpeaker = "student" | "professor";

// Step placement and pass/fail status are graded — and discussed — as two separate,
// sequential moments (drag first, mark second), so speaker selection is split the same
// way rather than picking one set of bubbles for a criterion as a whole.

// A misplaced criterion is always caught by the professor — a student wouldn't
// second-guess where the TA attached a criterion, only whether the pass/fail call is
// fair to their own work.
export function pickPlacementSpeaker(): CommentSpeaker {
  return "professor";
}

// Even a correctly-placed criterion is sometimes challenged just to make the TA defend
// the placement. Same reasoning as above: only the professor would raise that doubt.
export function pickPlacementChallengeSpeaker(): CommentSpeaker {
  return "professor";
}

type StatusItem = {
  status: "pass" | "fail" | null;
  expectedStatus: "pass" | "fail" | null;
  statusCorrect: boolean;
};

// A student would point out that their correct work was marked Fail (too harsh), but
// would never volunteer that they should have been failed (too lenient) — that
// correction belongs to the professor. Returns null when the status is actually correct.
export function pickStatusSpeaker(item: StatusItem): CommentSpeaker | null {
  if (item.statusCorrect) return null;
  const tooHarsh = item.status === "fail" && item.expectedStatus === "pass";
  return tooHarsh ? "student" : "professor";
}

// For a criterion the TA actually graded correctly, we sometimes have someone voice
// doubt anyway, so the TA has to defend (not just fix) their call. A student would only
// ever second-guess being marked Fail — they'd never invite doubt on a Pass — so a
// professor is the one who double-checks a Pass for rigor instead.
export function pickChallengeSpeaker(status: "pass" | "fail" | null): CommentSpeaker {
  return status === "fail" ? "student" : "professor";
}
