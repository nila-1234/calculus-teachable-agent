import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import getFirestore from "@/lib/firestore";
import type { GradeResult } from "./grade";
import type { TestAnswers, TestId } from "./types";

/**
 * Persisted grades, so a submission is graded once rather than on every view.
 *
 * Re-grading on each load meant fresh model calls every time an instructor
 * opened the results: it cost money per view, and open-item verdicts could
 * differ between views, which makes a score a moving target rather than a fact.
 *
 * Kept in its own `grades` collection rather than alongside the event log, so a
 * cached grade can never be mistaken for something the participant did.
 */

const COLLECTION = "grades";

export type StoredGrade = {
  subject_id: string;
  test_id: TestId;
  /** Identifies the exact answers graded, so edits force a re-grade. */
  answers_hash: string;
  graded_at: FirebaseFirestore.Timestamp;
  result: GradeResult;
};

/** Stable across key order, so re-serialising the same answers matches. */
export function hashAnswers(answers: TestAnswers): string {
  const canonical = JSON.stringify(
    Object.keys(answers)
      .sort()
      .map((key) => [key, answers[key]])
  );
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

/**
 * One document per subject and test, so a re-grade overwrites in place rather
 * than accumulating. Subject ids are free text, and Firestore document ids
 * cannot contain "/", so they are encoded.
 */
function documentId(subjectId: string, testId: TestId): string {
  return `${encodeURIComponent(subjectId)}__${testId}`;
}

/**
 * The stored grade for these exact answers, or null when absent or stale.
 * A hash mismatch means the participant's answers changed since grading, so the
 * cached result no longer describes them and must not be reused.
 */
export async function readStoredGrade(
  subjectId: string,
  testId: TestId,
  answers: TestAnswers
): Promise<GradeResult | null> {
  try {
    const snapshot = await getFirestore()
      .collection(COLLECTION)
      .doc(documentId(subjectId, testId))
      .get();

    if (!snapshot.exists) return null;

    const stored = snapshot.data() as StoredGrade | undefined;
    if (!stored || stored.answers_hash !== hashAnswers(answers)) return null;

    return stored.result;
  } catch (err) {
    // A cache miss must never block grading — fall through to a fresh grade.
    console.error("Could not read stored grade:", err);
    return null;
  }
}

/**
 * Saves a grade for reuse. Incomplete results are deliberately not stored: a
 * partial grade from a model outage would otherwise be cached as if it were the
 * real score, and every later view would repeat it instead of retrying.
 */
export async function writeStoredGrade(
  subjectId: string,
  testId: TestId,
  answers: TestAnswers,
  result: GradeResult
): Promise<void> {
  if (!result.complete) return;

  try {
    await getFirestore()
      .collection(COLLECTION)
      .doc(documentId(subjectId, testId))
      .set({
        subject_id: subjectId,
        test_id: testId,
        answers_hash: hashAnswers(answers),
        graded_at: FieldValue.serverTimestamp(),
        result,
      });
  } catch (err) {
    // Failing to cache is not a failure to grade.
    console.error("Could not store grade:", err);
  }
}
