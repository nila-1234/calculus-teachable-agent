import { createHash } from "node:crypto";
import getMongoClient from "@/lib/mongodb";
import type { GradeResult } from "./grade";
import type { TestAnswers, TestId } from "./types";

/**
 * Persisted grades, so a submission is graded once rather than on every view.
 *
 * Re-grading on each load meant fresh model calls every time an instructor
 * opened the results: it cost money per view, and open-item verdicts could
 * differ between views, which makes a score a moving target rather than a fact.
 *
 * PORTING NOTE: this is the only piece of grade caching that touches the
 * database directly. On merge with the Firestore migration, replace the two
 * helpers below with a `grades` collection read/write — the cache key and the
 * staleness check are storage-agnostic and should not need to change.
 */

const COLLECTION = "grades";

export type StoredGrade = {
  _id: string;
  subject_id: string;
  test_id: TestId;
  /** Identifies the exact answers graded, so edits force a re-grade. */
  answers_hash: string;
  graded_at: Date;
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

function cacheKey(subjectId: string, testId: TestId): string {
  return `${subjectId}::${testId}`;
}

async function collection() {
  const dbName = process.env.MONGODB_DB;
  if (!dbName) throw new Error("MONGODB_DB is not set");
  const client = await getMongoClient();
  return client.db(dbName).collection<StoredGrade>(COLLECTION);
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
    const stored = await (await collection()).findOne({
      _id: cacheKey(subjectId, testId),
    });

    if (!stored) return null;
    if (stored.answers_hash !== hashAnswers(answers)) return null;

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
    await (await collection()).updateOne(
      { _id: cacheKey(subjectId, testId) },
      {
        $set: {
          subject_id: subjectId,
          test_id: testId,
          answers_hash: hashAnswers(answers),
          graded_at: new Date(),
          result,
        },
      },
      { upsert: true }
    );
  } catch (err) {
    // Failing to cache is not a failure to grade.
    console.error("Could not store grade:", err);
  }
}
