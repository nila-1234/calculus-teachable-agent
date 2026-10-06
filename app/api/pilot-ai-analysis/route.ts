import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import getFirestore from "@/lib/firestore";
import { authorizeInstructor } from "@/lib/instructor-auth";
import { PILOT_Q1_ANSWERS } from "@/lib/pilot/tests";
import { SKILL_CHECK_ANSWERS } from "@/lib/surveys/eligibility";
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
  new_q1_score: string;
  new_q1_items: Record<string, boolean>;
  q3_ai_choice: string | null;
  q3_ai_correct: boolean;
  self_difficulty: unknown;
  self_confidence: unknown;
};

const SYSTEM_PROMPT = `You are a measurement/psychometrics analyst for an educational-research pilot on calculus optimization.

The study has two test forms: Form A is the PRETEST and Form B is the POSTTEST. They are meant to be of EQUAL difficulty so pre/post score changes reflect learning, not form differences. Each form's "new Question 1" has four short optimization items spanning the same four topics (particle motion, profit, fencing area, rectangle area); each topic appears as a "within-range" variant on one form and an "on-the-edge" variant (optimum at a domain boundary) on the other.

You are given, per participant: assigned form, self-reported math background (highest level, # calculus courses, calculus history), two screening skill checks (algebra, power rule), their score on the four new Q1 items (and which items), their choice on the Q3 "should the student question the AI?" item (C is correct) and whether it was correct, and self-reported difficulty/confidence.

Your job: judge whether Form A and Form B are of equivalent difficulty. Critically, the two groups may differ in ability, so DO NOT just compare raw mean scores — compare like with like by conditioning on math background and the skill-check/Q3 signals of ability. Base your conclusion on BOTH the math-level evidence and the results evidence. Be explicit about the small sample and its limits, and about any confound (e.g., one form drawing more novices).

Write a concise report with: (1) a one-line verdict, (2) the ability composition of each form, (3) difficulty evidence once ability is accounted for (including item-level signal if visible), (4) confounds/limitations, (5) a concrete recommendation. Use plain prose and short lists; no preamble.`;

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
          new_q1_score: `${correct}/${total}`,
          new_q1_items: items,
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

    const user = `Pilot data (full-flow completers only).

Form A — PRETEST (n=${formA.length}):
${JSON.stringify(formA, null, 2)}

Form B — POSTTEST (n=${formB.length}):
${JSON.stringify(formB, null, 2)}

Answer: Are Form A (pretest) and Form B (posttest) of the same difficulty? Conclude from both the math-level evidence and the results, conditioning on ability rather than comparing raw means.`;

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
