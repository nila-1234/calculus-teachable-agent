import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import getFirestore from "@/lib/firestore";
import { authorizeInstructor } from "@/lib/instructor-auth";
import { PILOT_Q1_ANSWERS } from "@/lib/pilot/tests";
import {
  SKILL_CHECK_ANSWERS,
  evaluateEligibility,
} from "@/lib/surveys/eligibility";
import type { SurveyAnswers } from "@/lib/surveys/types";
import { resolveGraderClient } from "@/lib/tests/grading-model";

/**
 * Instructor-only AI read of the pilot: does the pretest (Form A) and the
 * posttest (Form B) have the same difficulty?
 *
 * Builds one record per FULL-FLOW completer (reached pilot_completed) — math
 * background and actual results — then asks the configured model to judge
 * difficulty equivalence while accounting for who happened to take each form.
 * Token-gated and reads only pilot_logs, like the export.
 */

export const dynamic = "force-dynamic";

type Ev = {
  subject_id?: string;
  prolific_pid?: string | null;
  event?: string;
  scenario_id?: string;
  timestamp?: string;
  data?: Record<string, unknown>;
};

function answersOf(ev: Ev | null): Record<string, unknown> {
  const a = ev?.data?.answers;
  return a && typeof a === "object" ? (a as Record<string, unknown>) : {};
}

function allNumbers(value: unknown): number[] {
  return [
    ...String(value ?? "")
      .replace(/,/g, "")
      .matchAll(/-?\d+(\.\d+)?/g),
  ].map((m) => Number.parseFloat(m[0]));
}

type Participant = {
  form: string;
  highest_math: unknown;
  calculus_courses: unknown;
  calc_history: unknown;
  algebra_check_ok: boolean;
  power_rule_check_ok: boolean;
  would_be_screened_out: boolean;
  screen_out_reasons: string[];
  new_q1_score: string;
  new_q1_items: Record<string, boolean>;
  rubric_total: number | null;
  rubric_max: number | null;
  rubric_items: Record<string, string> | null;
  q3_ai_choice: string | null;
  q3_ai_correct: boolean;
  self_difficulty: unknown;
  self_confidence: unknown;
};

const SYSTEM_PROMPT = `You are a measurement/assessment analyst reviewing a calculus-optimization assessment pilot. You help the research team decide whether the SCREENING and the PRETEST are working.

Context:
- Participants are screened before the test. The intended population is learners around Calculus I / high-school level: not past Calculus II, not currently taking calculus, and passing two skill checks (a basic algebra expression and a power-rule derivative). Advanced students and those who fail the skill checks are screened out.
- The test has: new Q1 items (four short numeric optimization problems, right/wrong), Q1a (a full show-your-work optimization), Q2.1 (choose the revenue model + explain, graded as a whole out of 3), Q2.2 (explain the method, /5), Q2.3 (matching, /4), Q2.4 (interpret the domain, MC /1), Q3.1 (whether to question the AI, MC /1, C correct), Q3.2 (rebut the AI using the constraint, /3). Total 22 per form.
- Each participant record includes: assigned form, self-reported background, the two skill checks, whether the current rule WOULD screen them out (and why), their numeric-Q1 score, their full rubric score (total/max and per-item points), their Q3 choice, and self-reported difficulty/confidence. (Form A = pretest, Form B = posttest.)

Answer these questions, each as its own short section, grounded in the data:
1. SCREENING — is it faithful, overly strict, or overly loose? Did the people the rule would keep actually perform well, and did those it would screen out actually do poorly? Call out any mismatch (e.g., a kept participant who scored near zero, or a screened-out one who did fine).
2. PRETEST COVERAGE — is it capturing what we want? Which items discriminate between stronger and weaker participants? Which are too easy (near-ceiling, everyone right) or too hard (near-floor, nobody right)? Where are scores clustered per item (floor/ceiling/bimodal)? Which items, if any, should be made harder or easier, and why?
3. OTHER CONSIDERATIONS — data-quality or design issues to watch: likely AI-written or very low-effort responses, the very small sample, MC items that are guessable, redundant items, or anything else notable.

Be concrete and cite the specific participants/items. Use plain prose and short lists; no preamble. Note the small sample as a caveat, not a reason to say nothing.`;

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

    // AI rubric scores, if they have been computed (see /api/pilot-grade).
    const gradeDoc = (await getFirestore().doc("pilot_meta/grades").get()).data();
    const gradeScores = (gradeDoc?.scores ?? {}) as Record<
      string,
      {
        total?: number;
        max?: number;
        items?: Record<string, { points?: number | null; max?: number }>;
      }
    >;

    const rows: { subject: string; p: Participant }[] = [];
    for (const [subject, evs] of bySubject) {
      // Skip preview/test runs, and anyone who did not finish the whole flow.
      if (evs.some((e) => e.prolific_pid === "test")) continue;
      if (!evs.some((e) => e.event === "pilot_completed")) continue;

      const latest = (name: string, scen?: string): Ev | null => {
        const m = evs
          .filter(
            (e) => e.event === name && (scen === undefined || e.scenario_id === scen)
          )
          .sort((a, b) =>
            String(a.timestamp ?? "").localeCompare(String(b.timestamp ?? ""))
          );
        return m.length ? m[m.length - 1] : null;
      };

      const testEv = latest("test_completed");
      const testKey = testEv?.scenario_id ?? "";
      const form = testKey === "posttest" ? "B" : testKey === "pretest" ? "A" : "";
      if (!form) continue;

      const screening = answersOf(latest("screening_completed"));
      const testAnswers = answersOf(testEv);
      const diff = answersOf(latest("survey_completed", "post"));

      const key = PILOT_Q1_ANSWERS[testKey] ?? {};
      const items: Record<string, boolean> = {};
      let correct = 0;
      let total = 0;
      for (const [id, expected] of Object.entries(key)) {
        total += 1;
        const given = (testAnswers[id] as { text?: string })?.text ?? "";
        const ok = allNumbers(given).some((n) => Math.abs(n - expected) < 1e-6);
        items[id] = ok;
        if (ok) correct += 1;
      }

      const q3 = (testAnswers["3.1"] as { choiceId?: string })?.choiceId ?? null;

      const elig = evaluateEligibility(screening as SurveyAnswers);
      const g = gradeScores[subject];
      const rubricItems = g?.items
        ? Object.fromEntries(
            Object.entries(g.items).map(([id, v]) => [
              id,
              `${v.points ?? "?"}/${v.max ?? "?"}`,
            ])
          )
        : null;

      rows.push({
        subject,
        p: {
          form,
          highest_math: screening["highest-math"] ?? null,
          calculus_courses: screening["calculus-courses"] ?? null,
          calc_history: screening["calc_history"] ?? null,
          algebra_check_ok:
            screening.algebra_check === SKILL_CHECK_ANSWERS.algebra_check,
          power_rule_check_ok:
            screening.power_rule_check === SKILL_CHECK_ANSWERS.power_rule_check,
          would_be_screened_out: !elig.eligible,
          screen_out_reasons: elig.reasons,
          new_q1_score: `${correct}/${total}`,
          new_q1_items: items,
          rubric_total: g?.total ?? null,
          rubric_max: g?.max ?? null,
          rubric_items: rubricItems,
          q3_ai_choice: q3,
          q3_ai_correct: q3 === "C",
          self_difficulty: diff.difficulty ?? null,
          self_confidence: diff.confidence ?? null,
        },
      });
    }

    // Sort by subject so the fingerprint is stable regardless of read order.
    rows.sort((a, b) => a.subject.localeCompare(b.subject));
    const participants = rows.map((r) => r.p);
    const formA = participants.filter((p) => p.form === "A");
    const formB = participants.filter((p) => p.form === "B");

    if (participants.length === 0) {
      return NextResponse.json({
        ok: true,
        counts: { A: 0, B: 0 },
        analysis: "No completed participants yet.",
        model: null,
        cached: false,
      });
    }

    // Fingerprint the exact dataset the analysis is about. Recompute with the
    // model only when this changes; otherwise serve the cached text, so a plain
    // page refresh costs no tokens.
    const fingerprint = createHash("sha1")
      .update(JSON.stringify(rows))
      .digest("hex");

    const cacheRef = getFirestore().doc("pilot_meta/ai_analysis");
    const force = req.nextUrl.searchParams.get("force") === "1";

    if (!force) {
      const cached = (await cacheRef.get()).data();
      if (cached && cached.fingerprint === fingerprint) {
        return NextResponse.json({
          ok: true,
          cached: true,
          fingerprint,
          counts: { A: formA.length, B: formB.length },
          model: cached.model ?? null,
          analysis: cached.analysis ?? "",
          updated_at: cached.updated_at ?? null,
        });
      }
    }

    const user = `Pilot data — ${participants.length} full-flow completers (Form A = pretest, Form B = posttest; A n=${formA.length}, B n=${formB.length}).

${JSON.stringify(participants, null, 2)}

Review this assessment pilot and answer the three questions (screening faithful/strict/loose; pretest coverage and item difficulty/discrimination/clustering; other considerations). Ground every claim in the specific participants and items above.`;

    const client = resolveGraderClient();
    const analysis = await client.complete(SYSTEM_PROMPT, user);
    const updated_at = new Date().toISOString();

    // Store so the next refresh on the same data serves this without a model call.
    await cacheRef.set({
      fingerprint,
      analysis,
      model: client.label,
      counts: { A: formA.length, B: formB.length },
      updated_at,
    });

    return NextResponse.json({
      ok: true,
      cached: false,
      fingerprint,
      counts: { A: formA.length, B: formB.length },
      model: client.label,
      analysis,
      updated_at,
    });
  } catch (err) {
    console.error("Pilot AI analysis failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
