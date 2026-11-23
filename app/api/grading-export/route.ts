import { NextRequest, NextResponse } from "next/server";
import getFirestore from "@/lib/firestore";
import { authorizeInstructor } from "@/lib/instructor-auth";
import {
  buildPairReport,
  collectSubmissions,
  toCsv,
  type LogDoc,
} from "@/lib/tests/report";
import { buildInsights } from "@/lib/tests/insights";
import { buildFlowSummary } from "@/lib/tests/flow";
import { buildEventSheet, fullFlowSubjects } from "@/lib/tests/export";
import {
  buildAnswersSheet,
  buildParticipantsSheet,
  buildScreeningSheet,
} from "@/lib/tests/study-export";
import { rehydrateLog } from "@/lib/log-rehydrate";
import { dropTestRuns, filterTeamTests, isCohort, studyStart } from "@/lib/tests/cohort";
import { gradeSubmissions, loadStudyCohort } from "@/lib/tests/study-data";
import { splitScreeningQ1a } from "@/lib/tests/screening-q1a";

/**
 * Instructor-only grading export.
 *
 * Grades are never returned to a participant: this endpoint refuses every
 * request unless GRADING_EXPORT_TOKEN is set in the environment AND the caller
 * presents it. It fails closed — an unset token disables the endpoint entirely
 * rather than leaving it open, so forgetting to configure it cannot expose
 * scores.
 *
 * Nothing in the participant flow links to or calls this.
 */

export const dynamic = "force-dynamic";
// The backstop grading of finished-but-ungraded runs needs LLM round-trips.
export const maxDuration = 300;

/** The events that mark a step finished — what the dashboard's figures change on. */
const MILESTONE_EVENTS = [
  "form_assigned",
  "screening_completed",
  "consent_given",
  "survey_completed",
  "test_completed",
  "condition_assigned",
  "lesson_completed",
  "grade_lines_completed",
];


export async function GET(req: NextRequest) {
  const denied = authorizeInstructor(req);
  if (denied) return denied;

  try {
    const format = req.nextUrl.searchParams.get("format") ?? "json";
    const subject = req.nextUrl.searchParams.get("subject");
    const env = req.nextUrl.searchParams.get("env");
    // Escape hatch: force a re-grade after changing the key or the rubric.
    const regrade = req.nextUrl.searchParams.has("regrade");

    // ?cohort=study: the new study's recruits only (screened since STUDY_START).
    // ?tests=1 also shows the team's own test- runs, which are otherwise hidden.
    const cohort = req.nextUrl.searchParams.get("cohort");
    const isStudy = isCohort(cohort);
    const includeTeamTests = req.nextUrl.searchParams.get("tests") === "1";

    // ?format=status: a cheap fingerprint for the dashboard's auto-refresh. Count
    // aggregations only — no documents are read — so polling it costs almost
    // nothing. The dashboard reloads the full summary only when it changes.
    // Counts milestones (a step finished) rather than every event, so a
    // participant clicking through a step doesn't trigger a reload each poll.
    if (format === "status") {
      const db = getFirestore();
      const start = studyStart();
      const [events, grades] = await Promise.all([
        db
          .collection("logs")
          .where("event", "in", MILESTONE_EVENTS)
          .where("timestamp", ">=", start)
          .count()
          .get(),
        db.collection("grades").count().get(),
      ]);
      return NextResponse.json(
        {
          start,
          fingerprint: `${events.data().count}:${grades.data().count}`,
          checkedAt: new Date().toISOString(),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    let docs: LogDoc[];
    if (isStudy) {
      docs = await loadStudyCohort(studyStart(), { includeTeamTests });
      if (subject) docs = docs.filter((d) => d.subject_id === subject);
      if (env) docs = docs.filter((d) => d.env === env);
    } else {
      // The whole event stream — survey, scenario and timing events all feed the
      // subject sheet, so filtering to test events here would silently empty it.
      let query: FirebaseFirestore.Query = getFirestore().collection("logs");
      if (subject) query = query.where("subject_id", "==", subject);
      if (env) query = query.where("env", "==", env);
      query = query.orderBy("timestamp", "asc");

      const snapshot = await query.get();
      // Claude's test runs (pid claude-test-…) and the team's test- runs are
      // fake data: never in the all-participants results.
      docs = filterTeamTests(
        dropTestRuns(snapshot.docs.map((doc) => rehydrateLog(doc.data()) as LogDoc)),
        false
      );
    }

    // The study grades only runs that finished every step: someone who stops
    // partway is never graded. (The all-participants view keeps grading every
    // submitted test, as before.) Finished runs are normally graded already, by
    // /api/log when the post-survey arrives; this is the backstop for any that
    // failed there, and otherwise just reads the stored grades.
    const finished = isStudy ? fullFlowSubjects(docs) : null;
    const submissions = collectSubmissions(docs).filter(
      (s) => !finished || finished.has(s.subjectId)
    );
    const { graded: fullGrades, gradedFresh } = await gradeSubmissions(submissions, { regrade });

    // Screening Q1a is graded with the pre-test but only that side has it, so it
    // is taken out of every pre/post figure and reported on its own. `graded`
    // below is the comparable set; `fullGrades` is kept for the "not fully
    // graded" list (so a Q1a the grader missed is still flagged) and the raw
    // JSON export.
    const { comparable: graded, screeningQ1a } = splitScreeningQ1a(fullGrades);

    const stamp = new Date().toISOString().slice(0, 10);
    const flow = buildFlowSummary(docs);
    const insights = buildInsights(docs, graded);

    // Per-arm views so lesson (control) and agent can be analysed separately.
    const armBySubject = new Map<string, string>();
    for (const d of docs) {
      if (d.event === "condition_assigned") {
        const c = (d.data as Record<string, unknown> | undefined)?.condition;
        if (typeof c === "string" && d.subject_id) {
          armBySubject.set(d.subject_id, c);
        }
      }
    }
    const viewForArm = (arm: string) => {
      const subs = new Set(
        [...armBySubject]
          .filter(([, c]) => c === arm)
          .map(([s]) => s)
      );
      const d = docs.filter((x) => x.subject_id && subs.has(x.subject_id));
      const g = graded.filter((x) => subs.has(x.submission.subjectId));
      return { insights: buildInsights(d, g), flow: buildFlowSummary(d) };
    };
    const armViews = { lesson: viewForArm("lesson"), agent: viewForArm("agent") };
    const screeningQ1aWithArm = screeningQ1a.map((q) => ({
      ...q,
      arm: armBySubject.get(q.subjectId) ?? null,
    }));

    // JSON shape of the same sheets, so the instructor analysis view can render
    // a table without parsing CSV on the client.
    if (format === "summary") {
      const incomplete = fullGrades.filter(({ result }) => !result.complete);

      return NextResponse.json(
        {
          generatedAt: new Date().toISOString(),
          ...(isStudy ? { studyStart: studyStart(), includeTeamTests } : {}),
          events: docs.length,
          submissions: fullGrades.length,
          gradedFresh,
          allComplete: incomplete.length === 0,
          incomplete: incomplete.map(({ submission, result }) => ({
            subject_id: submission.subjectId,
            test_id: submission.testId,
            ungraded: result.ungraded,
            error: result.gradingError,
          })),
          pairs: buildPairReport(graded),
          insights,
          flow,
          armViews,
          screeningQ1a: screeningQ1aWithArm,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // The study's exports: participants.csv, answers.csv, screening.csv, plus
    // the raw event log. Each is built only when asked for.
    const sheet = (() => {
      switch (format) {
        case "participants":
          return { report: buildParticipantsSheet(docs, graded, flow), name: `participants-${stamp}.csv` };
        case "answers": {
          // Response seconds, from the per-item insights.
          const seconds = new Map<string, number>();
          for (const item of insights.items)
            for (const r of item.detail.responses)
              if (r.seconds != null) seconds.set(`${r.subjectId}::${r.testId}::${item.itemId}`, r.seconds);
          const report = buildAnswersSheet(docs, graded, fullGrades, collectSubmissions(docs), flow, seconds);
          // ?flagged=1: flagged answers of eligible participants only — the same
          // rule as the dashboard's AI-use flags list.
          if (req.nextUrl.searchParams.get("flagged") === "1") {
            const eligible = new Set(
              flow.screeningOutcomes.people.filter((p) => p.outcome === "eligible").map((p) => p.subjectId)
            );
            report.rows = report.rows.filter(
              (r) => r.flagged === "yes" && eligible.has(String(r.participant_id))
            );
            return { report, name: `flagged-answers-${stamp}.csv` };
          }
          return { report, name: `answers-${stamp}.csv` };
        }
        case "screening":
          return { report: buildScreeningSheet(flow.screeningOutcomes, fullGrades), name: `screening-${stamp}.csv` };
        case "events":
          return { report: buildEventSheet(docs), name: `events-${stamp}.csv` };
        default:
          return null;
      }
    })();

    if (sheet) {
      return new NextResponse(toCsv(sheet.report.rows, sheet.report.columns), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${sheet.name}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const incomplete = fullGrades.filter(({ result }) => !result.complete);

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        submissions: fullGrades.length,
        // Callers must check this before treating totals as scores.
        allComplete: incomplete.length === 0,
        incomplete: incomplete.map(({ submission, result }) => ({
          subject_id: submission.subjectId,
          test_id: submission.testId,
          ungraded: result.ungraded,
          error: result.gradingError,
        })),
        results: fullGrades.map(({ submission, result }) => ({
          subject_id: submission.subjectId,
          test_id: submission.testId,
          submitted_at: submission.submittedAt,
          answers: submission.answers,
          result,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Grading export failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
