import { ANSWER_KEY, itemKey, type ItemKey } from "./answer-key";
import type { TestAnswers, TestId, TestItemAnswer } from "./types";

export type ItemScore = {
  itemId: string;
  kind: ItemKey["kind"];
  /** null for open items until a grader has judged them. */
  points: number | null;
  maxPoints: number;
  /** Present for closed-form items: what the participant picked. */
  given?: string;
  expected?: string;
  /** Per-row detail for matching items. */
  rows?: { rowId: string; given: string | null; expected: string; correct: boolean }[];
  needsGrading: boolean;
};

export type TestScore = {
  testId: TestId;
  items: ItemScore[];
  /** Deterministic points only; open items are excluded until graded. */
  autoPoints: number;
  autoMaxPoints: number;
  /** Total once every open item has been graded. */
  totalMaxPoints: number;
  ungraded: string[];
};

/**
 * Scores everything that can be scored without judgment: multiple-choice and
 * matching. Open responses are returned with points: null and flagged in
 * `ungraded` for a grader to fill in.
 *
 * Deterministic items are never sent to a model — a matching key is a lookup,
 * and routing it through an LLM would only add variance to a study measure.
 */
export function scoreTest(testId: TestId, answers: TestAnswers): TestScore {
  const keys = ANSWER_KEY[testId] ?? {};
  const items: ItemScore[] = [];

  for (const [itemId, key] of Object.entries(keys)) {
    const answer: TestItemAnswer | undefined = answers[itemId];
    items.push(scoreItem(itemId, key, answer));
  }

  items.sort((a, b) =>
    a.itemId.localeCompare(b.itemId, undefined, { numeric: true })
  );

  const closed = items.filter((item) => item.kind !== "open");

  return {
    testId,
    items,
    autoPoints: closed.reduce((sum, item) => sum + (item.points ?? 0), 0),
    autoMaxPoints: closed.reduce((sum, item) => sum + item.maxPoints, 0),
    totalMaxPoints: items.reduce((sum, item) => sum + item.maxPoints, 0),
    ungraded: items.filter((item) => item.needsGrading).map((item) => item.itemId),
  };
}

function scoreItem(
  itemId: string,
  key: ItemKey,
  answer: TestItemAnswer | undefined
): ItemScore {
  if (key.kind === "choice") {
    const given = answer?.choiceId;
    return {
      itemId,
      kind: "choice",
      points: given === key.correctChoiceId ? key.maxPoints : 0,
      maxPoints: key.maxPoints,
      given: given ?? undefined,
      expected: key.correctChoiceId,
      needsGrading: false,
    };
  }

  if (key.kind === "matching") {
    const given = answer?.matches ?? {};
    const rows = Object.entries(key.correctMatches).map(([rowId, expected]) => {
      const picked = given[rowId] ?? null;
      return { rowId, given: picked, expected, correct: picked === expected };
    });

    return {
      itemId,
      kind: "matching",
      // One point per correct row, so a partially correct match earns partial
      // credit rather than all-or-nothing.
      points: rows.filter((row) => row.correct).length,
      maxPoints: key.maxPoints,
      rows,
      needsGrading: false,
    };
  }

  return {
    itemId,
    kind: "open",
    points: null,
    maxPoints: key.maxPoints,
    needsGrading: true,
  };
}

/** Convenience for the analysis pass: flat per-item points keyed by item id. */
export function pointsByItem(score: TestScore): Record<string, number | null> {
  return Object.fromEntries(score.items.map((item) => [item.itemId, item.points]));
}

export { itemKey };
