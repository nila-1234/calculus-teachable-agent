import type { GradedCriterion } from "./grade";
import type { GradedSubmission } from "./report";
import type { FormId } from "./types";

/**
 * Screening Q1a, kept out of the pre/post comparison.
 *
 * On the counterbalanced design, Q1a (the 5-point worked problem) is asked once,
 * in screening (it doubles as the AI-use check), and is graded as part of the
 * pre-test. The post-test has no Q1a. Counting it would make the pre-test out
 * of 27 and the post-test out of 22, so every pre/post total, gain and
 * per-goal accuracy would be skewed by an item only one side has.
 *
 * So the analysis reads each A/B pre-test grade with Q1a taken out — both tests
 * are then out of the same points over the same items — and reports Q1a on its
 * own as a screening baseline. Stored grades are untouched: this is applied when
 * results are read, so it never costs a re-grade.
 *
 * The legacy fixed tests (no `form`) asked Q1a in both tests and are left as is.
 */

/** The item id Q1a is graded under. */
export const SCREENING_Q1A_ITEM = "1";

export type ScreeningQ1aGrade = {
  subjectId: string;
  /** The pre-test version whose Q1a was asked. */
  form: FormId | null;
  answer: string;
  points: number | null;
  maxPoints: number;
  criteria: GradedCriterion[];
  /** False while the grader has not judged it (e.g. a model outage). */
  graded: boolean;
  needsReview: boolean;
};

export function splitScreeningQ1a(graded: GradedSubmission[]): {
  /** The pre/post grades with screening Q1a removed: comparable across tests. */
  comparable: GradedSubmission[];
  screeningQ1a: ScreeningQ1aGrade[];
} {
  const screeningQ1a: ScreeningQ1aGrade[] = [];

  const comparable = graded.map((g): GradedSubmission => {
    const { submission, result } = g;
    if (submission.testId !== "pretest" || !submission.form) return g;

    const item = result.items.find((i) => i.itemId === SCREENING_Q1A_ITEM);
    if (!item) return g;

    const open = result.openItems.find((i) => i.itemId === SCREENING_Q1A_ITEM);
    const answer = submission.answers[SCREENING_Q1A_ITEM];
    screeningQ1a.push({
      subjectId: submission.subjectId,
      form: submission.form,
      answer: answer?.text ?? "",
      points: item.points,
      maxPoints: item.maxPoints,
      criteria: open?.criteria ?? [],
      graded: !item.needsGrading,
      needsReview: result.needsReview.includes(SCREENING_Q1A_ITEM),
    });

    const notQ1a = (id: string) => id !== SCREENING_Q1A_ITEM;
    const ungraded = result.ungraded.filter(notQ1a);
    const { [SCREENING_Q1A_ITEM]: _q1a, ...answers } = submission.answers;
    void _q1a;

    return {
      submission: {
        ...submission,
        answers,
        ...(submission.items ? { items: submission.items.filter(notQ1a) } : {}),
      },
      result: {
        ...result,
        items: result.items.filter((i) => notQ1a(i.itemId)),
        openItems: result.openItems.filter((i) => notQ1a(i.itemId)),
        totalPoints: result.totalPoints - (item.points ?? 0),
        totalMaxPoints: result.totalMaxPoints - item.maxPoints,
        ungraded,
        // An ungraded Q1a no longer blocks the comparable score. It is still
        // reported (the dashboard's "not fully graded" list reads the full grade).
        complete: ungraded.length === 0,
        needsReview: result.needsReview.filter(notQ1a),
      },
    };
  });

  screeningQ1a.sort((a, b) => a.subjectId.localeCompare(b.subjectId));
  return { comparable, screeningQ1a };
}
