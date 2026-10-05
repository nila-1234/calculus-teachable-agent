import { getTest } from "@/lib/tests/definitions";
import type { TestDefinition, TestItem } from "@/lib/tests/types";

/**
 * Pilot test forms for the counterbalancing study at /pilot.
 *
 * Form A reuses the pretest, form B the posttest, each with Question 1 grown
 * from one worked problem to FIVE: the original plus four short-answer
 * optimization items spanning four topics (particle motion, profit, fencing,
 * rectangle area). For each topic one test gets a "within-range" variant (the
 * optimum is an interior critical point) and the other the "on-the-edge"
 * variant (the critical point falls outside the allowed range, so the maximum
 * is at a boundary — the discriminating case).
 *
 * Built by extending Question 1 of the live tests and reusing Q2/Q3 unchanged,
 * so the pilot and the main study never drift apart on the shared questions.
 * These forms are only ever rendered inside the /pilot flow; the main study
 * keeps its one-item Question 1. Answers are verified numerically:
 * 324, 16, $45, $25, 400, 800, 96, 81.
 */

/** Pretest extras: particle (within), profit (within), fencing (edge), rectangle (edge). */
const PRE_Q1_EXTRA: TestItem[] = [
  {
    id: "1b",
    kind: "free-response",
    prompt:
      "A particle moves along a straight line. Its distance from the start at time \\(t\\) seconds is \\(d(t) = t^3 - 21t^2 + 144t\\) cm. What is the maximum distance the particle reaches during \\(0 \\le t \\le 8\\)? Give the distance in centimeters.",
    placeholder: "Maximum distance in cm…",
    reference:
      "324 cm, at t = 6 (an interior critical point; the endpoint t = 8 gives only 320).",
  },
  {
    id: "1c",
    kind: "free-response",
    prompt:
      "A company sells a product. If it charges \\(x\\) dollars per unit it sells \\(170 - 2x\\) units, and each unit costs $5 to make, so the daily profit is \\(P(x) = (170 - 2x)(x - 5)\\). Which price \\(x\\) maximizes profit, for \\(5 \\le x \\le 85\\)? Give the price in dollars.",
    placeholder: "Best price in dollars…",
    reference: "$45 (an interior critical point).",
  },
  {
    id: "1d",
    kind: "free-response",
    prompt:
      "A farmer builds a rectangular pen against a straight wall, fencing only the three sides not along the wall, using 60 m of fencing. With \\(x\\) the length of each side perpendicular to the wall, the area is \\(A(x) = x(60 - 2x)\\). Each perpendicular side must satisfy \\(20 \\le x \\le 30\\). What is the maximum possible area, in square meters?",
    placeholder: "Maximum area in m²…",
    reference:
      "400 m² (at x = 20; the critical point x = 15 is outside [20, 30], so the maximum is at the boundary).",
  },
  {
    id: "1e",
    kind: "free-response",
    prompt:
      "A rectangle has a perimeter of 40 cm, so if one side is \\(x\\) cm the area is \\(A(x) = x(20 - x)\\). A design requirement forces \\(12 \\le x \\le 18\\). What is the maximum possible area, in square centimeters?",
    placeholder: "Maximum area in cm²…",
    reference:
      "96 cm² (at x = 12; the critical point x = 10 is outside [12, 18], so the maximum is at the boundary).",
  },
];

/** Posttest extras: particle (edge), profit (edge), fencing (within), rectangle (within). */
const POST_Q1_EXTRA: TestItem[] = [
  {
    id: "1b",
    kind: "free-response",
    prompt:
      "A particle moves along a straight line. Its distance from the start at time \\(t\\) seconds is \\(d(t) = t^3 - 9t^2 + 24t\\) cm. What is the maximum distance the particle reaches during \\(0 \\le t \\le 1\\)? Give the distance in centimeters.",
    placeholder: "Maximum distance in cm…",
    reference:
      "16 cm, at t = 1 (the critical points t = 2 and t = 4 are outside [0, 1], so the maximum is at the boundary).",
  },
  {
    id: "1c",
    kind: "free-response",
    prompt:
      "A company sells a product. If it charges \\(x\\) dollars per unit it sells \\(120 - 2x\\) units, and each unit costs $10 to make, so the daily profit is \\(P(x) = (x - 10)(120 - 2x)\\). A price regulation requires \\(10 \\le x \\le 25\\). Which price \\(x\\) maximizes profit within that range? Give the price in dollars.",
    placeholder: "Best price in dollars…",
    reference:
      "$25 (the unconstrained best is x = 35, outside [10, 25], so the maximum is at the boundary x = 25).",
  },
  {
    id: "1d",
    kind: "free-response",
    prompt:
      "A farmer builds a rectangular pen against a straight wall, fencing only the three sides not along the wall, using 80 m of fencing. With \\(x\\) the length of each side perpendicular to the wall, the area is \\(A(x) = x(80 - 2x)\\), with \\(0 \\le x \\le 40\\). What is the maximum possible area, in square meters?",
    placeholder: "Maximum area in m²…",
    reference: "800 m² (an interior critical point, x = 20).",
  },
  {
    id: "1e",
    kind: "free-response",
    prompt:
      "A rectangle has a perimeter of 36 cm, so if one side is \\(x\\) cm the area is \\(A(x) = x(18 - x)\\), with \\(0 \\le x \\le 18\\). What is the maximum possible area, in square centimeters?",
    placeholder: "Maximum area in cm²…",
    reference: "81 cm² (an interior critical point, x = 9).",
  },
];

/** The numeric answer for each new item, for pilot grading (exact / tolerant match). */
export const PILOT_Q1_ANSWERS: Record<string, Record<string, number>> = {
  pretest: { "1b": 324, "1c": 45, "1d": 400, "1e": 96 },
  posttest: { "1b": 16, "1c": 25, "1d": 800, "1e": 81 },
};

/**
 * A single neutral title and intro for both forms. The pilot runs one test per
 * participant, so "Pre-Test" / "Post-Test" would be meaningless; identical text
 * on both forms also keeps the A/B assignment blinded. The intro drops the base
 * tests' "you can go back to revise" line — the pilot runner has no Back button.
 */
const PILOT_TEST_TITLE = "Optimization Problems";
const PILOT_TEST_INTRO = [
  "This test has three questions: a worked optimization problem, a multi-part modeling and grading exercise, and a problem where you review an AI's solution.",
  "Answer each part in order. Once you continue past a question you cannot change that answer, so finish each one before moving on.",
];

function withExtendedQ1(
  base: TestDefinition,
  extra: TestItem[]
): TestDefinition {
  const [q1, ...rest] = base.sections;
  return {
    ...base,
    title: PILOT_TEST_TITLE,
    intro: PILOT_TEST_INTRO,
    sections: [{ ...q1, items: [...q1.items, ...extra] }, ...rest],
  };
}

const mainPre = getTest("pretest");
const mainPost = getTest("posttest");

/** Form A — the pretest with a five-item Question 1. */
export const PILOT_PRE_TEST: TestDefinition | null = mainPre
  ? withExtendedQ1(mainPre, PRE_Q1_EXTRA)
  : null;

/** Form B — the posttest with a five-item Question 1. */
export const PILOT_POST_TEST: TestDefinition | null = mainPost
  ? withExtendedQ1(mainPost, POST_Q1_EXTRA)
  : null;

export type PilotForm = "A" | "B";

export function getPilotTest(form: PilotForm): TestDefinition | null {
  return form === "A" ? PILOT_PRE_TEST : PILOT_POST_TEST;
}
