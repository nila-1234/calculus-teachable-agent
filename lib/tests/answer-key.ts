import type { TestId } from "./types";

/**
 * Machine-readable answer key and grading rubrics for the pre/post tests.
 *
 * Sources — every entry below is transcribed from one of these, not inferred:
 *  - Pre-test:  "Notes / pre_Q1..pre_Q3" Google Doc, MS blocks. Q3 follows
 *               "Design 4 — Student–AI Conversation v2".
 *  - Post-test: "Calculus_Optimization_Post_Test_Answered.pdf" instructor
 *               answer key (Quick Answer Key + per-item Feedback sections).
 *
 * Kept separate from definitions.ts so the key can be diffed against those
 * sources without wading through presentation code, and so editing question
 * content never silently desynchronises the key.
 */

export type CriterionSpec = {
  id: string;
  /** What a grader checks. Phrased so it is markable met / not met. */
  description: string;
};

export type ItemKey =
  | { kind: "choice"; maxPoints: number; correctChoiceId: string }
  | {
      kind: "matching";
      maxPoints: number;
      /** matchRow id -> choice id. One point per correct row. */
      correctMatches: Record<string, string>;
    }
  | {
      kind: "open";
      maxPoints: number;
      criteria: CriterionSpec[];
      /** Constraints on grading, verbatim in spirit from the source key. */
      scoringNote?: string;
      /** Reference values a grader may check against. Not shown to students. */
      modelAnswer?: string;
    };

/**
 * Q1 criteria are identical across both tests: the post-test PDF's five
 * feedback requirements match the pre-test doc's five-point rubric.
 */
const q1Criteria: CriterionSpec[] = [
  { id: "model", description: "Models the three fenced sides correctly as a constraint equation." },
  { id: "one-variable", description: "Writes the area as a function of a single variable." },
  { id: "derivative", description: "Differentiates and solves for the critical value." },
  { id: "extremum", description: "Justifies that the critical point gives a maximum." },
  { id: "quantities", description: "Reports both dimensions and the maximum area." },
];

/**
 * Q2.2 is graded on the PRE-TEST rubric on both forms, by decision.
 *
 * The pre-test doc lists these five gradeable bullets; the post-test PDF states
 * four requirements that are a subset of them. Rather than grade the two forms
 * against different rubrics — which would make pre/post scores incomparable —
 * the pre-test rubric is authoritative and the post-test is matched to it.
 */
const q22Criteria: CriterionSpec[] = [
  { id: "derivative", description: "Identifies the derivative as the relevant calculus concept." },
  { id: "critical-point", description: "Identifies a critical point as the quantity to find." },
  { id: "definition", description: "Explains that a critical point occurs where the derivative is zero or undefined." },
  { id: "candidate-only", description: "States that a critical point is only a candidate, not automatically a maximum." },
  { id: "verify", description: "States that the candidate must be checked or confirmed to be a maximum." },
];

const q22ScoringNote =
  "Do not require the student to calculate the price. A zero derivative alone does not prove a maximum.";

/** Q2.3 uses the same purpose options and the same 3, 5, 1, 4 key on both forms. */
const q23Matches = {
  objective: "3",
  derivative: "5",
  "critical-point": "1",
  maximum: "4",
};

/** Q3.2 full credit requires all three moves, per both source keys. */
function q32Criteria(range: string, aiValue: string): CriterionSpec[] {
  return [
    { id: "names-constraint", description: `Explicitly references the ${range} requirement from the problem.` },
    { id: "identifies-conflict", description: `Identifies that the AI's recommendation of ${aiValue} violates that requirement.` },
    { id: "prompts-revision", description: "Asks the AI to reconsider or justify a recommendation within the allowed range." },
  ];
}

const q32ScoringNote =
  "The student need not compute the feasible optimum in the message. Vague skepticism (\"Are you sure?\") earns the third point only if the constraint is named explicitly.";

export const ANSWER_KEY: Record<TestId, Record<string, ItemKey>> = {
  pretest: {
    "1": {
      kind: "open",
      maxPoints: 5,
      criteria: q1Criteria,
      modelAnswer:
        "2x + y = 60, A(x) = x(60 − 2x) = 60x − 2x². A′(x) = 60 − 4x = 0 gives x = 15, y = 30. Maximum area 450 m².",
    },
    "2.1": { kind: "choice", maxPoints: 1, correctChoiceId: "C" },
    "2.2": {
      kind: "open",
      maxPoints: 5,
      criteria: q22Criteria,
      scoringNote: q22ScoringNote,
    },
    "2.3": { kind: "matching", maxPoints: 4, correctMatches: q23Matches },
    "2.4": { kind: "choice", maxPoints: 1, correctChoiceId: "A" },
    "3.1": { kind: "choice", maxPoints: 1, correctChoiceId: "C" },
    "3.2": {
      kind: "open",
      maxPoints: 3,
      criteria: q32Criteria("30 to 60 chairs per day", "25 chairs"),
      scoringNote: q32ScoringNote,
      modelAnswer:
        "C(x) is increasing for x > 25, so the feasible optimum is the left endpoint x = 30, at C(30) ≈ $28.33 per chair.",
    },
  },

  posttest: {
    "1": {
      kind: "open",
      maxPoints: 5,
      criteria: q1Criteria,
      modelAnswer:
        "2x + y = 80, A(x) = x(80 − 2x) = 80x − 2x². A′(x) = 80 − 4x = 0 gives x = 20, y = 40. Maximum area 800 m².",
    },
    "2.1": { kind: "choice", maxPoints: 1, correctChoiceId: "C" },
    "2.2": {
      kind: "open",
      maxPoints: 5,
      criteria: q22Criteria,
      scoringNote: q22ScoringNote,
    },
    "2.3": { kind: "matching", maxPoints: 4, correctMatches: q23Matches },
    "2.4": { kind: "choice", maxPoints: 1, correctChoiceId: "A" },
    "3.1": { kind: "choice", maxPoints: 1, correctChoiceId: "C" },
    "3.2": {
      kind: "open",
      maxPoints: 3,
      criteria: q32Criteria("90 to 120 posters per batch", "80 posters"),
      scoringNote: q32ScoringNote,
      modelAnswer:
        "C(x) is increasing for x > 80, so the feasible optimum is the left endpoint x = 90, at C(90) ≈ $12.06 per poster.",
    },
  },
};

export function itemKey(testId: TestId, itemId: string): ItemKey | null {
  return ANSWER_KEY[testId]?.[itemId] ?? null;
}

export function maxScore(testId: TestId): number {
  return Object.values(ANSWER_KEY[testId] ?? {}).reduce(
    (total, key) => total + key.maxPoints,
    0
  );
}
