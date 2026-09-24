import { getTest } from "./definitions";
import { findItem, formatAnswer } from "./format";
import type { GradedSubmission, LogDoc } from "./report";
import type { TestId } from "./types";

/**
 * Interpretation on top of the raw results: where time goes, which items are
 * missed, and which of the study's three assessment goals moved.
 *
 * Everything here is descriptive. With a pilot-sized sample these are
 * observations to look into, not findings — which is why every figure is
 * reported alongside the number of participants it came from.
 */

export type Goal = "procedural" | "communication" | "collaboration";

export const GOAL_LABELS: Record<Goal, string> = {
  procedural: "Procedural computation",
  communication: "Model communication & evaluation",
  collaboration: "Human–AI collaboration",
};

export const GOAL_DESCRIPTIONS: Record<Goal, string> = {
  procedural: "What conventional instruction already focuses on.",
  communication: "The higher-order skills this system is designed to train.",
  collaboration: "Real-world problem solving alongside an AI.",
};

/**
 * Item-to-goal mapping, taken verbatim from the post-test answer key:
 * "Q1 targets procedural optimization; Q2.1-Q2.4 target model construction,
 * mathematical communication, and evaluation; Q3.1-Q3.2 target real-world
 * human-AI collaboration."
 */
export function goalForItem(itemId: string): Goal {
  if (itemId === "1") return "procedural";
  if (itemId.startsWith("3.")) return "collaboration";
  return "communication";
}

/** How often each rubric criterion was met — why an open item is missed. */
export type CriterionStat = {
  id: string;
  metRate: number;
  notMet: number;
  unverifiable: number;
  n: number;
};

/** Which option people actually chose on a closed-form item. */
export type ChoiceStat = {
  choiceId: string;
  label: string;
  count: number;
  correct: boolean;
};

export type ItemResponse = {
  subjectId: string;
  testId: TestId;
  points: number | null;
  maxPoints: number;
  answer: string;
  verdicts: { id: string; verdict: string; comment: string }[];
};

export type ItemDetail = {
  prompts: Partial<Record<TestId, string>>;
  criteria: CriterionStat[];
  choices: ChoiceStat[];
  responses: ItemResponse[];
};

export type ItemStat = {
  itemId: string;
  goal: Goal;
  /** Mean proportion of available points, 0–1. */
  accuracy: number;
  meanPoints: number;
  maxPoints: number;
  /** How many graded submissions this is averaged over. */
  n: number;
  /** Median seconds spent, or null when it could not be measured. */
  medianSeconds: number | null;
  timedN: number;
  /** Everything needed to answer "why is this one missed?" */
  detail: ItemDetail;
};

export type GoalStat = {
  goal: Goal;
  preAccuracy: number | null;
  postAccuracy: number | null;
  /** Percentage points, post minus pre. */
  gain: number | null;
  maxPoints: number;
  pairedN: number;
};

export type Insights = {
  participants: number;
  pairedParticipants: number;
  items: ItemStat[];
  slowest: ItemStat[];
  hardest: ItemStat[];
  goals: GoalStat[];
  /** True when the sample is too small to read anything into. */
  underpowered: boolean;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Seconds spent per test item.
 *
 * Derived from the gap between consecutive test_item_answered events, with the
 * first item measured from test_started. Each question is a separate screen, so
 * this is genuinely per-question rather than per-page.
 *
 * Gaps beyond the ceiling are dropped: a participant who walks away mid-test
 * would otherwise register as having thought about one question for an hour.
 */
const MAX_ITEM_SECONDS = 30 * 60;

function secondsPerItem(docs: LogDoc[]): Map<string, number[]> {
  const perItem = new Map<string, number[]>();

  const bySession = new Map<string, LogDoc[]>();
  for (const doc of docs) {
    if (doc.event !== "test_item_answered" && doc.event !== "test_started") continue;
    const key = `${doc.subject_id ?? ""}::${doc.scenario_id ?? ""}`;
    bySession.set(key, [...(bySession.get(key) ?? []), doc]);
  }

  for (const list of bySession.values()) {
    const ordered = [...list].sort((a, b) =>
      (a.timestamp ?? "").localeCompare(b.timestamp ?? "")
    );

    let previous: string | null =
      ordered.find((d) => d.event === "test_started")?.timestamp ?? null;

    for (const doc of ordered) {
      if (doc.event !== "test_item_answered") continue;
      const itemId = doc.data?.item_id as string | undefined;
      if (!itemId || !doc.timestamp) continue;

      if (previous) {
        const seconds = (Date.parse(doc.timestamp) - Date.parse(previous)) / 1000;
        if (seconds > 0 && seconds <= MAX_ITEM_SECONDS) {
          perItem.set(itemId, [...(perItem.get(itemId) ?? []), seconds]);
        }
      }
      previous = doc.timestamp;
    }
  }

  return perItem;
}

function accuracyByItem(graded: GradedSubmission[], testId?: TestId) {
  const points = new Map<string, { total: number; max: number; n: number }>();

  for (const { submission, result } of graded) {
    if (testId && submission.testId !== testId) continue;
    if (!result.complete) continue; // partial grades would understate accuracy

    for (const item of result.items) {
      if (item.points === null) continue;
      const entry = points.get(item.itemId) ?? { total: 0, max: 0, n: 0 };
      entry.total += item.points;
      entry.max += item.maxPoints;
      entry.n += 1;
      points.set(item.itemId, entry);
    }
  }

  return points;
}

/**
 * Everything behind a single item: what was asked, how each criterion fared,
 * which options people picked, and every individual answer.
 *
 * The criterion breakdown is the point of this — an aggregate says Q2.2 is
 * missed, but only the per-criterion rates say *which part* people fail.
 */
/**
 * Generous enough not to truncate a real answer, but bounded: the detail for
 * every item ships with the summary, so payload grows with participants times
 * items times tests.
 */
const MAX_ANSWER_CHARS = 2000;

function buildItemDetail(
  itemId: string,
  graded: GradedSubmission[]
): ItemDetail {
  const prompts: Partial<Record<TestId, string>> = {};
  for (const testId of ["pretest", "posttest"] as TestId[]) {
    const test = getTest(testId);
    const found = test ? findItem(test, itemId) : null;
    if (found) prompts[testId] = found.item.prompt;
  }

  const criterionTally = new Map<
    string,
    { met: number; notMet: number; unverifiable: number }
  >();
  const choiceTally = new Map<string, { count: number; correct: boolean }>();
  const responses: ItemResponse[] = [];

  for (const { submission, result } of graded) {
    const scored = result.items.find((i) => i.itemId === itemId);
    if (!scored) continue;

    const open = result.openItems.find((i) => i.itemId === itemId);
    for (const criterion of open?.criteria ?? []) {
      const entry =
        criterionTally.get(criterion.id) ?? { met: 0, notMet: 0, unverifiable: 0 };
      if (criterion.verdict === "met") entry.met += 1;
      else if (criterion.verdict === "not_met") entry.notMet += 1;
      else entry.unverifiable += 1;
      criterionTally.set(criterion.id, entry);
    }

    if (scored.kind === "choice" && scored.given) {
      const entry = choiceTally.get(scored.given) ?? {
        count: 0,
        correct: scored.given === scored.expected,
      };
      entry.count += 1;
      choiceTally.set(scored.given, entry);
    }

    const test = getTest(submission.testId);
    const found = test ? findItem(test, itemId) : null;

    responses.push({
      subjectId: submission.subjectId,
      testId: submission.testId,
      points: scored.points,
      maxPoints: scored.maxPoints,
      answer: (found
        ? formatAnswer(found.item, submission.answers[itemId])
        : JSON.stringify(submission.answers[itemId] ?? null)
      ).slice(0, MAX_ANSWER_CHARS),
      verdicts:
        open?.criteria.map((c) => ({
          id: c.id,
          verdict: c.verdict,
          comment: c.comment,
        })) ?? [],
    });
  }

  const criteria: CriterionStat[] = [...criterionTally.entries()].map(
    ([id, t]) => {
      const n = t.met + t.notMet + t.unverifiable;
      return {
        id,
        metRate: n > 0 ? t.met / n : 0,
        notMet: t.notMet,
        unverifiable: t.unverifiable,
        n,
      };
    }
  );

  const choices: ChoiceStat[] = [...choiceTally.entries()]
    .map(([choiceId, t]) => {
      // Show the option text rather than a bare letter.
      const test = getTest("pretest");
      const found = test ? findItem(test, itemId) : null;
      const label =
        found?.item.choices?.find((c) => c.id === choiceId)?.text ?? choiceId;
      return { choiceId, label, count: t.count, correct: t.correct };
    })
    .sort((a, b) => b.count - a.count);

  return { prompts, criteria, choices, responses };
}

export function buildInsights(
  docs: LogDoc[],
  graded: GradedSubmission[]
): Insights {
  const timing = secondsPerItem(docs);
  const overall = accuracyByItem(graded);

  const items: ItemStat[] = [...overall.entries()]
    .map(([itemId, { total, max, n }]) => {
      const seconds = timing.get(itemId) ?? [];
      return {
        itemId,
        goal: goalForItem(itemId),
        accuracy: max > 0 ? total / max : 0,
        meanPoints: n > 0 ? total / n : 0,
        maxPoints: n > 0 ? max / n : 0,
        n,
        medianSeconds: median(seconds),
        timedN: seconds.length,
        detail: buildItemDetail(itemId, graded),
      };
    })
    .sort((a, b) => a.itemId.localeCompare(b.itemId, undefined, { numeric: true }));

  const pre = accuracyByItem(graded, "pretest");
  const post = accuracyByItem(graded, "posttest");

  const subjects = new Map<string, Set<TestId>>();
  for (const { submission, result } of graded) {
    if (!result.complete) continue;
    const seen = subjects.get(submission.subjectId) ?? new Set<TestId>();
    seen.add(submission.testId);
    subjects.set(submission.subjectId, seen);
  }
  const pairedParticipants = [...subjects.values()].filter(
    (seen) => seen.has("pretest") && seen.has("posttest")
  ).length;

  const goals: GoalStat[] = (
    ["procedural", "communication", "collaboration"] as Goal[]
  ).map((goal) => {
    const sum = (source: typeof pre) => {
      let total = 0;
      let max = 0;
      for (const [itemId, entry] of source) {
        if (goalForItem(itemId) !== goal) continue;
        total += entry.total;
        max += entry.max;
      }
      return max > 0 ? { accuracy: total / max, max } : null;
    };

    const preStat = sum(pre);
    const postStat = sum(post);

    return {
      goal,
      preAccuracy: preStat?.accuracy ?? null,
      postAccuracy: postStat?.accuracy ?? null,
      gain:
        preStat && postStat
          ? (postStat.accuracy - preStat.accuracy) * 100
          : null,
      maxPoints: postStat?.max ?? preStat?.max ?? 0,
      pairedN: pairedParticipants,
    };
  });

  const timed = items.filter((i) => i.medianSeconds !== null);

  return {
    participants: subjects.size,
    pairedParticipants,
    items,
    slowest: [...timed]
      .sort((a, b) => (b.medianSeconds ?? 0) - (a.medianSeconds ?? 0))
      .slice(0, 3),
    hardest: [...items].sort((a, b) => a.accuracy - b.accuracy).slice(0, 3),
    goals,
    // Below this, per-item figures are one or two people's answers and any
    // ordering between them is noise.
    underpowered: pairedParticipants < 5,
  };
}
