import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import getFirestore from "@/lib/firestore";
import { authorizeInstructor } from "@/lib/instructor-auth";
import { gradeTest } from "@/lib/tests/grade";
import type { TestAnswers, TestId } from "@/lib/tests/types";

/**
 * Instructor-only AI grading of the pilot's free-response items.
 *
 * The new Q1 items (1b–1e) are numeric and graded in /api/pilot-export. This
 * grades the REST of the test — Q1a (show your work), Q2, and Q3 — with the
 * same LLM rubric pipeline the main study uses (gradeTest + the answer key),
 * giving per-item points and a total out of 20 per form.
 *
 * Cached in pilot_meta/grades by a sha1 fingerprint of the graded answers, so a
 * page refresh costs no tokens; ?force=1 re-grades. Reads only pilot_logs.
 */

export const dynamic = "force-dynamic";
// Grading several submissions each needs an LLM round-trip; allow the function
// the time to finish rather than timing out at the default limit.
export const maxDuration = 300;

type Ev = {
  subject_id?: string;
  prolific_pid?: string | null;
  event?: string;
  scenario_id?: string;
  timestamp?: string;
  data?: Record<string, unknown>;
};

function answersOf(ev: Ev | null): TestAnswers {
  const a = ev?.data?.answers;
  return a && typeof a === "object" ? (a as TestAnswers) : {};
}

export async function GET(req: NextRequest) {
  const denied = authorizeInstructor(req);
  if (denied) return denied;

  try {
    const db = getFirestore();
    const snap = await db.collection("pilot_logs").get();
    const events = snap.docs.map((d) => d.data() as Ev);

    const bySubject = new Map<string, Ev[]>();
    for (const e of events) {
      const s = String(e.subject_id ?? "");
      if (!s) continue;
      bySubject.set(s, [...(bySubject.get(s) ?? []), e]);
    }

    // One graded submission per full-flow completer (skip preview/test runs).
    const subs: { subject: string; testId: TestId; answers: TestAnswers }[] = [];
    for (const [subject, evs] of bySubject) {
      if (evs.some((e) => e.prolific_pid === "test")) continue;
      if (!evs.some((e) => e.event === "pilot_completed")) continue;
      const testEv =
        evs
          .filter((e) => e.event === "test_completed")
          .sort((a, b) =>
            String(a.timestamp ?? "").localeCompare(String(b.timestamp ?? ""))
          )
          .pop() ?? null;
      const testId = testEv?.scenario_id as TestId | undefined;
      if (testId !== "pretest" && testId !== "posttest") continue;
      subs.push({ subject, testId, answers: answersOf(testEv) });
    }
    subs.sort((a, b) => a.subject.localeCompare(b.subject));

    const fingerprint = createHash("sha1")
      .update(JSON.stringify(subs))
      .digest("hex");
    const cacheRef = db.doc("pilot_meta/grades");
    const force = req.nextUrl.searchParams.get("force") === "1";

    if (!force) {
      const cached = (await cacheRef.get()).data();
      if (cached && cached.fingerprint === fingerprint) {
        return NextResponse.json({ ok: true, cached: true, ...cached });
      }
    }

    // Grade all submissions concurrently — each needs an LLM round-trip, so
    // sequential grading of ten people overruns the function's time limit. One
    // failure is isolated so it cannot discard the others.
    const scores: Record<string, unknown> = {};
    let model: string | null = null;
    const graded = await Promise.all(
      subs.map(async ({ subject, testId, answers }) => {
        try {
          const r = await gradeTest(testId, answers);
          return { subject, r, error: null as string | null };
        } catch (e) {
          return { subject, r: null, error: String(e) };
        }
      })
    );
    for (const { subject, r, error } of graded) {
      if (!r) {
        scores[subject] = { error };
        continue;
      }
      model = r.gradedBy ?? model;
      // Per-criterion verdicts for the open (show-work) items, for a rubric-area
      // analysis ("where did students do best").
      const criteriaByItem = new Map(
        r.openItems.map((o) => [
          o.itemId,
          Object.fromEntries(o.criteria.map((c) => [c.id, c.verdict])),
        ])
      );
      scores[subject] = {
        testId: r.testId,
        total: r.totalPoints,
        max: r.totalMaxPoints,
        complete: r.complete,
        items: Object.fromEntries(
          r.items.map((it) => [
            it.itemId,
            {
              points: it.points ?? null,
              max: it.maxPoints,
              kind: it.kind,
              ...(criteriaByItem.has(it.itemId)
                ? { criteria: criteriaByItem.get(it.itemId) }
                : {}),
            },
          ])
        ),
      };
    }

    const payload = {
      fingerprint,
      model,
      graded_at: new Date().toISOString(),
      count: subs.length,
      scores,
    };
    await cacheRef.set(payload);

    return NextResponse.json({ ok: true, cached: false, ...payload });
  } catch (err) {
    console.error("Pilot grading failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
