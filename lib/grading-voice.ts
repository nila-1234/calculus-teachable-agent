export type CommentSpeaker = "student" | "professor";

export type SpeakerAssignment = {
  speaker: CommentSpeaker;
  // Which mistakes this speaker's bubble should address, so two bubbles on the same
  // criterion don't repeat each other.
  coversStep: boolean;
  coversStatus: boolean;
};

type GradedItem = {
  stepCorrect: boolean;
  statusCorrect: boolean;
  status: "pass" | "fail" | null;
  expectedStatus: "pass" | "fail" | null;
};

// A student would point out that their correct work was marked Fail, but would never
// volunteer that they should have been failed — that correction, and any misplaced
// rubric item, belongs to the professor.
export function pickSpeakers(item: GradedItem): SpeakerAssignment[] {
  const stepWrong = !item.stepCorrect;
  const tooLenient =
    !item.statusCorrect && item.status === "pass" && item.expectedStatus === "fail";
  const tooHarsh =
    !item.statusCorrect && item.status === "fail" && item.expectedStatus === "pass";

  const assignments: SpeakerAssignment[] = [];

  if (stepWrong || tooLenient) {
    assignments.push({
      speaker: "professor",
      coversStep: stepWrong,
      coversStatus: tooLenient,
    });
  }

  if (tooHarsh) {
    assignments.push({ speaker: "student", coversStep: false, coversStatus: true });
  }

  return assignments;
}
