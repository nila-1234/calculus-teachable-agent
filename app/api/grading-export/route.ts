import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import getFirestore from "@/lib/firestore";
import { gradeTest } from "@/lib/tests/grade";
import { readStoredGrade, writeStoredGrade } from "@/lib/tests/grade-store";
import {
  buildGradeReport,
  buildPairReport,
  collectSubmissions,
  toCsv,
  type GradedSubmission,
  type LogDoc,
} from "@/lib/tests/report";
import { buildInsights } from "@/lib/tests/insights";
import {
  buildAnswerSheet,
  buildEventSheet,
  buildSubjectSheet,
} from "@/lib/tests/export";

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

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authorize(req: NextRequest): NextResponse | null {
  const expected = process.env.GRADING_EXPORT_TOKEN?.trim();

  if (!expected) {
    return NextResponse.json(
      {
        error:
          "Grading export is disabled. Set GRADING_EXPORT_TOKEN in the environment to enable it.",
      },
      { status: 503 }
    );
  }

  const provided =
    req.headers.get("x-grading-token")?.trim() ||
    req.nextUrl.searchParams.get("token")?.trim() ||
    "";

  if (!provided || !tokenMatches(provided, expected)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  return null;
}

export async function GET(req: NextRequest) {
  const denied = authorize(req);
  if (denied) return denied;

  try {
    const format = req.nextUrl.searchParams.get("format") ?? "json";
    const subject = req.nextUrl.searchParams.get("subject");
    const env = req.nextUrl.searchParams.get("env");
    // Escape hatch: force a re-grade after changing the key or the rubric.
    const regrade = req.nextUrl.searchParams.has("regrade");

    // The whole event stream — survey, scenario and timing events all feed the
    // subject sheet, so filtering to test events here would silently empty it.
    let query: FirebaseFirestore.Query = getFirestore().collection("logs");
    if (subject) query = query.where("subject_id", "==", subject);
    if (env) query = query.where("env", "==", env);
    query = query.orderBy("timestamp", "asc");

    const snapshot = await query.get();
    const docs = snapshot.docs.map((doc) => doc.data() as LogDoc);

    const submissions = collectSubmissions(docs);

    // Grade once and reuse. A stored grade is only used when it was produced
    // from these exact answers; anything else is graded fresh and saved.
    const graded: GradedSubmission[] = [];
    let gradedFresh = 0;
    for (const submission of submissions) {
      const { subjectId, testId, answers } = submission;

      const cached = regrade
        ? null
        : await readStoredGrade(subjectId, testId, answers);

      if (cached) {
        graded.push({ submission, result: cached });
        continue;
      }

      const result = await gradeTest(testId, answers);
      await writeStoredGrade(subjectId, testId, answers, result);
      graded.push({ submission, result });
      gradedFresh += 1;
    }

    const stamp = new Date().toISOString().slice(0, 10);

    const sheets: Record<string, { report: { rows: Record<string, unknown>[]; columns: string[] }; name: string }> = {
      subjects: { report: buildSubjectSheet(docs, graded), name: `subjects-${stamp}.csv` },
      answers: { report: buildAnswerSheet(docs, graded), name: `answers-${stamp}.csv` },
      events: { report: buildEventSheet(docs), name: `events-${stamp}.csv` },
      grades: { report: buildGradeReport(graded), name: `grades-${stamp}.csv` },
      csv: { report: buildGradeReport(graded), name: `grades-${stamp}.csv` },
      pairs: { report: buildPairReport(graded), name: `pre-post-${stamp}.csv` },
    };

    // JSON shape of the same sheets, so the instructor analysis view can render
    // a table without parsing CSV on the client.
    if (format === "summary") {
      const incomplete = graded.filter(({ result }) => !result.complete);

      return NextResponse.json(
        {
          generatedAt: new Date().toISOString(),
          events: docs.length,
          submissions: graded.length,
          gradedFresh,
          allComplete: incomplete.length === 0,
          incomplete: incomplete.map(({ submission, result }) => ({
            subject_id: submission.subjectId,
            test_id: submission.testId,
            ungraded: result.ungraded,
            error: result.gradingError,
          })),
          subjects: buildSubjectSheet(docs, graded),
          pairs: buildPairReport(graded),
          insights: buildInsights(docs, graded),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (sheets[format]) {
      const { report, name: filename } = sheets[format];

      return new NextResponse(toCsv(report.rows, report.columns), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const incomplete = graded.filter(({ result }) => !result.complete);

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        submissions: graded.length,
        // Callers must check this before treating totals as scores.
        allComplete: incomplete.length === 0,
        incomplete: incomplete.map(({ submission, result }) => ({
          subject_id: submission.subjectId,
          test_id: submission.testId,
          ungraded: result.ungraded,
          error: result.gradingError,
        })),
        results: graded.map(({ submission, result }) => ({
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
