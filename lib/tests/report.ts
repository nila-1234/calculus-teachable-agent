import type { GradeResult } from "./grade";
import type { FormId, TestAnswers, TestId } from "./types";

const formOf = (value: unknown): FormId | undefined =>
  value === "A" || value === "B" ? value : undefined;

export const TEST_IDS: TestId[] = ["pretest", "posttest"];

export type LogDoc = {
  subject_id?: string;
  session_id?: string;
  timestamp?: string;
  /** Per-browser event counter; orders events logged in the same millisecond. */
  seq?: number;
  event?: string;
  scenario_id?: string;
  env?: string;
  data?: Record<string, unknown>;
};

export type Submission = {
  subjectId: string;
  testId: TestId;
  submittedAt: string;
  answers: TestAnswers;
  /**
   * Counterbalanced design only: the version taken in this phase and the items
   * the participant was given (scored against exactly these). Absent for data
   * from before counterbalancing, which uses the original fixed tests.
   */
  form?: FormId;
  items?: string[];
};

/** The screening item that is the pre-test version's Q1a. */
const SCREENING_Q1A = "q1a";

export type GradedSubmission = {
  submission: Submission;
  result: GradeResult;
};

/**
 * Rebuilds each participant's answers from the log stream. Prefers the
 * `test_completed` event, which carries the whole answers object; falls back to
 * replaying individual `test_item_answered` events so a run that was abandoned
 * before the final item is still recoverable.
 */
export function collectSubmissions(docs: LogDoc[]): Submission[] {
  const completed = new Map<string, Submission>();
  const partial = new Map<string, Submission>();

  for (const doc of docs) {
    const subjectId = doc.subject_id || "unknown";
    const testId = doc.scenario_id as TestId;
    if (!TEST_IDS.includes(testId)) continue;

    const key = `${subjectId}::${testId}`;

    const form = formOf(doc.data?.form);

    if (doc.event === "test_completed") {
      const answers = doc.data?.answers as TestAnswers | undefined;
      if (answers && Object.keys(answers).length) {
        const existing = completed.get(key);
        // Keep the latest completion if a participant redid a test.
        if (!existing || (doc.timestamp ?? "") > existing.submittedAt) {
          const items = Array.isArray(doc.data?.items)
            ? (doc.data.items as unknown[]).map(String)
            : undefined;
          completed.set(key, {
            subjectId,
            testId,
            submittedAt: doc.timestamp ?? "",
            answers: { ...answers },
            ...(form ? { form, items } : {}),
          });
        }
      }
    }

    if (doc.event === "test_item_answered") {
      const itemId = doc.data?.item_id as string | undefined;
      const answer = doc.data?.answer;
      if (!itemId || answer === undefined) continue;

      const entry =
        partial.get(key) ??
        ({ subjectId, testId, submittedAt: "", answers: {} } as Submission);
      if (form) entry.form = form;
      entry.answers[itemId] = answer as TestAnswers[string];
      if ((doc.timestamp ?? "") > entry.submittedAt) {
        entry.submittedAt = doc.timestamp ?? "";
      }
      partial.set(key, entry);
    }
  }

  for (const [key, entry] of partial) {
    if (!completed.has(key)) completed.set(key, entry);
  }

  // Counterbalanced design: the pre-test version's Q1a is asked in screening.
  // It is that participant's pre-test Q1a, so it is graded as part of the
  // pre-test (item "1").
  const screeningQ1a = new Map<string, string>();
  for (const doc of docs) {
    if (doc.event !== "screening_completed") continue;
    const text = (doc.data?.answers as Record<string, unknown> | undefined)?.[SCREENING_Q1A];
    if (typeof text === "string" && text.trim() && doc.subject_id) {
      screeningQ1a.set(doc.subject_id, text);
    }
  }
  for (const entry of completed.values()) {
    if (entry.testId !== "pretest" || !entry.form) continue;
    const text = screeningQ1a.get(entry.subjectId);
    if (text && !entry.answers["1"]) {
      entry.answers["1"] = { text };
      if (entry.items && !entry.items.includes("1")) entry.items = ["1", ...entry.items];
    }
  }

  return [...completed.values()].sort(
    (a, b) =>
      a.subjectId.localeCompare(b.subjectId) || a.testId.localeCompare(b.testId)
  );
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  return (
    [
      columns.join(","),
      ...rows.map((row) => columns.map((c) => csvCell(row[c])).join(",")),
    ].join("\n") + "\n"
  );
}

/** One row per submission, with per-item points as columns. */
export function buildGradeReport(graded: GradedSubmission[]) {
  const itemIds = [
    ...new Set(graded.flatMap(({ result }) => result.items.map((i) => i.itemId))),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const rows = graded.map(({ submission, result }) => {
    const row: Record<string, unknown> = {
      subject_id: submission.subjectId,
      test_id: submission.testId,
      submitted_at: submission.submittedAt,
      total_points: result.totalPoints,
      max_points: result.totalMaxPoints,
      percent:
        Math.round((result.totalPoints / result.totalMaxPoints) * 1000) / 10,
      complete: result.complete,
      needs_review: result.needsReview.join(" "),
      grading_error: result.gradingError ?? "",
    };
    for (const id of itemIds) {
      row[`item_${id}`] = result.items.find((i) => i.itemId === id)?.points ?? "";
    }
    return row;
  });

  return {
    rows,
    columns: [
      "subject_id",
      "test_id",
      "submitted_at",
      "total_points",
      "max_points",
      "percent",
      "complete",
      "needs_review",
      "grading_error",
      ...itemIds.map((id) => `item_${id}`),
    ],
  };
}

/** Paired pre/post totals per subject, for the gain analysis. */
export function buildPairReport(graded: GradedSubmission[]) {
  const bySubject = new Map<string, Partial<Record<TestId, GradeResult>>>();
  for (const { submission, result } of graded) {
    const entry = bySubject.get(submission.subjectId) ?? {};
    entry[submission.testId] = result;
    bySubject.set(submission.subjectId, entry);
  }

  const rows = [...bySubject.entries()]
    .map(([subjectId, byTest]) => {
      const pre = byTest.pretest;
      const post = byTest.posttest;
      return {
        subject_id: subjectId,
        pre_points: pre?.totalPoints ?? "",
        post_points: post?.totalPoints ?? "",
        max_points: pre?.totalMaxPoints ?? post?.totalMaxPoints ?? "",
        gain: pre && post ? post.totalPoints - pre.totalPoints : "",
        both_complete: !!(pre?.complete && post?.complete),
      };
    })
    .sort((a, b) => a.subject_id.localeCompare(b.subject_id));

  return {
    rows,
    columns: [
      "subject_id",
      "pre_points",
      "post_points",
      "max_points",
      "gain",
      "both_complete",
    ],
  };
}
