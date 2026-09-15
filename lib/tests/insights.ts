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
