import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import getFirestore from "../lib/firestore";
import { gradeTest } from "../lib/tests/grade";
import { maxScore } from "../lib/tests/answer-key";
import {
  buildGradeReport,
  buildPairReport,
  collectSubmissions,
  toCsv,
  type GradedSubmission,
  type LogDoc,
} from "../lib/tests/report";

/**
 * Instructor-side grading. Reads completed tests out of the logs collection,
 * grades them, and writes results to exports/.
 *
 * Nothing here runs in the participant's browser and no route exposes it, so a
 * participant cannot see their score during or after a session.
 */

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes("--subject") ? args[args.indexOf("--subject") + 1] : null;
  const envFilter = args.includes("--env") ? args[args.indexOf("--env") + 1] : null;
  const dryRun = args.includes("--dry-run");

  let query: FirebaseFirestore.Query = getFirestore()
    .collection("logs")
    .where("event", "in", ["test_completed", "test_item_answered"]);
  if (only) query = query.where("subject_id", "==", only);
  if (envFilter) query = query.where("env", "==", envFilter);
  query = query.orderBy("timestamp", "asc");

  const docs = (await query.get()).docs.map((doc) => doc.data() as LogDoc);

  const submissions = collectSubmissions(docs);
  if (!submissions.length) {
    console.log("No test submissions found in the logs.");
    return;
  }

  console.log(
    `Found ${submissions.length} submission(s). Pre-test max ${maxScore(
      "pretest"
    )}, post-test max ${maxScore("posttest")}.\n`
  );

  if (dryRun) {
    // Deterministic items only; no model calls, no cost.
    for (const s of submissions) {
      console.log(
        `  ${s.subjectId} / ${s.testId}: ${Object.keys(s.answers).length} item(s) answered`
      );
    }
    console.log("\n--dry-run: nothing graded, no files written.");
    return;
  }

  const results: GradedSubmission[] = [];
  for (const submission of submissions) {
    process.stdout.write(`Grading ${submission.subjectId} / ${submission.testId}... `);
    const result = await gradeTest(submission.testId, submission.answers);
    results.push({ submission, result });
    console.log(
      result.complete
        ? `${result.totalPoints}/${result.totalMaxPoints}`
        : `INCOMPLETE ${result.totalPoints}/${result.totalMaxPoints} (${result.gradingError ?? "ungraded: " + result.ungraded.join(",")})`
    );
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(process.cwd(), "exports");
  await fs.mkdir(outDir, { recursive: true });

  // Full detail, including every criterion verdict and comment.
  const detailPath = path.join(outDir, `grades-${stamp}.json`);
  await fs.writeFile(
    detailPath,
    JSON.stringify(
      results.map(({ submission, result }) => ({
        subject_id: submission.subjectId,
        test_id: submission.testId,
        submitted_at: submission.submittedAt,
        answers: submission.answers,
        result,
      })),
      null,
      2
    ),
    "utf8"
  );

  // Report shapes come from lib/tests/report.ts, shared with the grading
  // export endpoint so the two can never drift apart.
  const grades = buildGradeReport(results);
  const gradesPath = path.join(outDir, `grades-${stamp}.csv`);
  await fs.writeFile(gradesPath, toCsv(grades.rows, grades.columns), "utf8");

  const pairs = buildPairReport(results);
  const pairsPath = path.join(outDir, `pre-post-${stamp}.csv`);
  await fs.writeFile(pairsPath, toCsv(pairs.rows, pairs.columns), "utf8");

  console.log(`\nWrote:`);
  for (const p of [detailPath, gradesPath, pairsPath]) {
    console.log(`  ${path.relative(process.cwd(), p)}`);
  }

  const incomplete = results.filter(({ result }) => !result.complete);
  if (incomplete.length) {
    console.warn(
      `\nWARNING: ${incomplete.length} submission(s) are NOT fully graded and must not be treated as scores.`
    );
  }
  const review = results.filter(({ result }) => result.needsReview.length);
  if (review.length) {
    console.warn(
      `${review.length} submission(s) have criteria the grader could not judge — see needs_review.`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
