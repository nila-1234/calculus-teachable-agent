import { NextRequest, NextResponse } from "next/server";
import getFirestore from "@/lib/firestore";
import { authorizeInstructor } from "@/lib/instructor-auth";
import { PILOT_Q1_ANSWERS } from "@/lib/pilot/tests";
import { SKILL_CHECK_ANSWERS } from "@/lib/surveys/eligibility";

/**
 * Instructor-only export of the pilot's data.
 *
 * Reads only the pilot_logs collection, so the main study's data is never
 * touched. One row per subject: assigned form, screening skill-check results,
 * the new Question-1 items graded numerically, the motivation answer, and the
 * difficulty survey. Token-gated like the main export; add ?format=csv for a
 * spreadsheet.
 */

export const dynamic = "force-dynamic";

type Ev = {
  subject_id?: string;
  prolific_pid?: string | null;
  prolific_study_id?: string | null;
  prolific_session_id?: string | null;
  event?: string;
  scenario_id?: string;
  timestamp?: string;
  data?: Record<string, unknown>;
};

function answersOf(ev: Ev | null): Record<string, unknown> {
  const a = ev?.data?.answers;
  return a && typeof a === "object" ? (a as Record<string, unknown>) : {};
}

function numberIn(value: unknown): number | null {
  const match = String(value ?? "")
    .replace(/,/g, "")
    .match(/-?\d+(\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : null;
}

/**
 * Flattens one test answer to a single readable string for a CSV cell. Keeps
 * every part a participant could have supplied (choice, matches, text, the
 * "Other" text and any explanation) rather than grading it — the raw dump the
 * instructor asked for.
 */
function flattenAnswer(a: unknown): string {
  if (a == null || typeof a !== "object") return String(a ?? "");
  const ans = a as Record<string, unknown>;
  const parts: string[] = [];
  if (ans.choiceId) parts.push(`choice:${ans.choiceId}`);
  if (ans.matches && typeof ans.matches === "object") {
    parts.push(
      Object.entries(ans.matches as Record<string, unknown>)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ")
    );
  }
  if (ans.text) parts.push(String(ans.text));
  if (ans.otherText) parts.push(`other:${ans.otherText}`);
  if (ans.explanation) parts.push(`why:${ans.explanation}`);
  return parts.join(" | ");
}

export async function GET(req: NextRequest) {
  const denied = authorizeInstructor(req);
  if (denied) return denied;

  try {
    const snap = await getFirestore().collection("pilot_logs").get();
    const events = snap.docs.map((d) => d.data() as Ev);

    const bySubject = new Map<string, Ev[]>();
    for (const e of events) {
      const s = String(e.subject_id ?? "");
      if (!s) continue;
      bySubject.set(s, [...(bySubject.get(s) ?? []), e]);
    }

    const rows = [...bySubject.entries()].map(([subject, evs]) => {
      const latest = (name: string, scenario?: string): Ev | null => {
        const matches = evs
          .filter(
            (e) =>
              e.event === name &&
              (scenario === undefined || e.scenario_id === scenario)
          )
          .sort((a, b) =>
            String(a.timestamp ?? "").localeCompare(String(b.timestamp ?? ""))
          );
        return matches.length ? matches[matches.length - 1] : null;
      };

      const testEv = latest("test_completed");
      const testKey = testEv?.scenario_id ?? "";
      const form =
        testKey === "posttest"
          ? "B"
          : testKey === "pretest"
            ? "A"
            : String(latest("pilot_form_assigned")?.data?.form ?? "");

      const screening = answersOf(latest("screening_completed"));
      const pre = answersOf(latest("survey_completed", "pre"));
      const difficulty = answersOf(latest("survey_completed", "post"));
      const testAnswers = answersOf(testEv);

      const algebraOk =
        screening.algebra_check === SKILL_CHECK_ANSWERS.algebra_check;
      const powerOk =
        screening.power_rule_check === SKILL_CHECK_ANSWERS.power_rule_check;

      // Grade the four new Q1 items by extracting a number and matching the key.
      const key = PILOT_Q1_ANSWERS[testKey] ?? {};
      const q1: Record<string, { given: string; correct: boolean }> = {};
      let q1Correct = 0;
      let q1Total = 0;
      for (const [itemId, expected] of Object.entries(key)) {
        q1Total += 1;
        const givenRaw = (testAnswers[itemId] as { text?: string })?.text ?? "";
        const num = numberIn(givenRaw);
        const correct = num !== null && Math.abs(num - expected) < 1e-6;
        q1[itemId] = { given: String(givenRaw), correct };
        if (correct) q1Correct += 1;
      }

      // The Prolific identifiers can ride on any event, so take the first
      // non-null value across the subject's events rather than only the test's.
      const firstNonNull = (pick: (e: Ev) => string | null | undefined) =>
        evs.map(pick).find((v) => v != null) ?? null;

      return {
        subject,
        prolific_pid: firstNonNull((e) => e.prolific_pid),
        prolific_study_id: firstNonNull((e) => e.prolific_study_id),
        prolific_session_id: firstNonNull((e) => e.prolific_session_id),
        form,
        test: testKey,
        completed_test: Boolean(testEv),
        completed_pilot: evs.some((e) => e.event === "pilot_completed"),
        screening_algebra_correct: algebraOk,
        screening_power_rule_correct: powerOk,
        q1_correct: q1Correct,
        q1_total: q1Total,
        q1,
        // Full, ungraded answer set for every test item (Q1 original + 1b–1e,
        // Q2, and the Q3 AI-conversation question). Captured from test_completed.
        test_answers: testAnswers,
        motivation: pre["why-study"] ?? null,
        motivation_other: pre["why-study-other"] ?? null,
        difficulty: difficulty.difficulty ?? null,
        confidence: difficulty.confidence ?? null,
        length: difficulty.length ?? null,
        unclear: difficulty.unclear ?? null,
        feedback: difficulty.feedback ?? null,
      };
    });

    const format = req.nextUrl.searchParams.get("format") ?? "json";
    if (format === "csv") {
      const cols = [
        "subject",
        "prolific_pid",
        "prolific_study_id",
        "prolific_session_id",
        "form",
        "test",
        "completed_test",
        "completed_pilot",
        "screening_algebra_correct",
        "screening_power_rule_correct",
        "q1_correct",
        "q1_total",
        "motivation",
        "difficulty",
        "confidence",
        "length",
      ];
      // One column per test item, across everyone, so the raw Q1/Q2/Q3 answers
      // (incl. the AI-conversation question) land in the spreadsheet. Sorted so
      // the columns are stable from one export to the next.
      const itemIds = [
        ...new Set(rows.flatMap((r) => Object.keys(r.test_answers ?? {}))),
      ].sort();
      const answerCols = itemIds.map((id) => `ans_${id}`);

      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const csv = [
        [...cols, ...answerCols].join(","),
        ...rows.map((r) => {
          const record = r as Record<string, unknown>;
          const answers = (r.test_answers ?? {}) as Record<string, unknown>;
          return [
            ...cols.map((c) => esc(record[c])),
            ...itemIds.map((id) => esc(flattenAnswer(answers[id]))),
          ].join(",");
        }),
      ].join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="pilot.csv"',
        },
      });
    }

    return NextResponse.json({ ok: true, count: rows.length, rows });
  } catch (err) {
    console.error("Pilot export failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
