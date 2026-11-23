import getFirestore from "@/lib/firestore";
import { rehydrateLog } from "@/lib/log-rehydrate";
import { gradeTest } from "./grade";
import { readStoredGrade, writeStoredGrade } from "./grade-store";
import { collectSubmissions, type GradedSubmission, type LogDoc, type Submission } from "./report";
import { fullFlowSubjects } from "./export";
import { cohortSubjects, dropTestRuns, filterTeamTests } from "./cohort";

/**
 * Server-side data access for the results views: loading the study cohort out
 * of `logs`, and grading submissions with the stored-grade cache.
 *
 * Shared by /api/grading-export (the dashboard) and /api/log (grading a run
 * the moment it finishes), so both grade the same way and share one cache.
 */

/** Firestore caps an `in` filter at 30 values. */
const IN_LIMIT = 30;

const byTime = (a: LogDoc, b: LogDoc) =>
  (a.timestamp ?? "").localeCompare(b.timestamp ?? "") || (a.seq ?? 0) - (b.seq ?? 0);

/** Every logged event of the given subjects, oldest first. */
export async function loadSubjectsLogs(subjects: string[]): Promise<LogDoc[]> {
  const db = getFirestore();
  const chunks: string[][] = [];
  for (let i = 0; i < subjects.length; i += IN_LIMIT) {
    chunks.push(subjects.slice(i, i + IN_LIMIT));
  }
  const snapshots = await Promise.all(
    chunks.map((chunk) => db.collection("logs").where("subject_id", "in", chunk).get())
  );
  return snapshots
    .flatMap((snap) => snap.docs.map((doc) => rehydrateLog(doc.data()) as LogDoc))
    .sort(byTime);
}

/**
 * The study cohort's events: everyone screened at or after `start`, with ALL of
 * their events (including the few logged on the welcome page just before
 * screening).
 *
 * Two small queries rather than one scan of `logs`: first the screening events
 * since the start, which name the cohort, then just those subjects' events.
 * Earlier participants are never read.
 */
export async function loadStudyCohort(
  start: string,
  { includeTeamTests }: { includeTeamTests: boolean }
): Promise<LogDoc[]> {
  const screened = await getFirestore()
    .collection("logs")
    .where("event", "==", "form_assigned")
    .where("timestamp", ">=", start)
    .get();

  const screenedDocs = filterTeamTests(
    dropTestRuns(screened.docs.map((doc) => rehydrateLog(doc.data()) as LogDoc)),
    includeTeamTests
  );
  const subjects = [...cohortSubjects(screenedDocs, start)];
  if (!subjects.length) return [];

  return loadSubjectsLogs(subjects);
}

/**
 * Grades each submission once and reuses the stored grade after that. A stored
 * grade is used only when it was produced from these exact answers.
 */
export async function gradeSubmissions(
  submissions: Submission[],
  { regrade = false }: { regrade?: boolean } = {}
): Promise<{ graded: GradedSubmission[]; gradedFresh: number }> {
  const graded: GradedSubmission[] = [];
  let gradedFresh = 0;

  for (const submission of submissions) {
    const { subjectId, testId, answers } = submission;

    const cached = regrade ? null : await readStoredGrade(subjectId, testId, answers);
    if (cached) {
      graded.push({ submission, result: cached });
      continue;
    }

    // The participant's version and items, when counterbalanced (else the fixed tests).
    const result = await gradeTest(testId, answers, {
      form: submission.form,
      items: submission.items,
    });
    await writeStoredGrade(subjectId, testId, answers, result);
    graded.push({ submission, result });
    gradedFresh += 1;
  }

  return { graded, gradedFresh };
}

/**
 * Grades one participant's pre- and post-test — but only once they have
 * finished the whole run, so someone who stops partway is never graded.
 *
 * Called in the background by /api/log when the post-survey arrives. Returns
 * what happened, for the server log.
 */
export async function gradeFinishedRun(subjectId: string): Promise<string> {
  const docs = await loadSubjectsLogs([subjectId]);

  if (!fullFlowSubjects(docs).has(subjectId)) {
    return `${subjectId}: not graded — the run is missing a step`;
  }

  const submissions = collectSubmissions(docs).filter((s) => s.subjectId === subjectId);
  const { graded, gradedFresh } = await gradeSubmissions(submissions);
  const incomplete = graded.filter((g) => !g.result.complete);

  return incomplete.length
    ? `${subjectId}: graded ${gradedFresh} test(s), ${incomplete.length} incomplete (${incomplete
        .map((g) => g.result.gradingError ?? g.result.ungraded.join(","))
        .join("; ")}) — the dashboard retries on its next load`
    : `${subjectId}: graded ${gradedFresh} test(s) fresh, ${graded.length - gradedFresh} already stored`;
}
