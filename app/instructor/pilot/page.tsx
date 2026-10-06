"use client";

import { useMemo, useState } from "react";
import AppHeader from "@/components/app-header";
import Button from "@/components/button";

type Q1Item = { given: string; expected: number; correct: boolean };

type Phase = {
  started: string | null;
  completed: string | null;
  seconds: number | null;
};
type ItemTiming = { answered_at: string | null; seconds: number | null };

type GradeInfo = {
  total: number;
  max: number;
  complete: boolean;
  items: Record<string, { points: number | null; max: number; kind: string }>;
};

type Answer = {
  choiceId?: string;
  matches?: Record<string, string>;
  text?: string;
  otherText?: string;
  explanation?: string;
};

type Row = {
  subject: string;
  prolific_pid: string | null;
  form: string;
  test: string;
  completed_test: boolean;
  completed_pilot: boolean;
  highest_math: string | null;
  calculus_courses: string | null;
  math_courses: string | null;
  calc_history: string | null;
  screening_algebra_correct: boolean;
  screening_power_rule_correct: boolean;
  q1_correct: number;
  q1_total: number;
  q1: Record<string, Q1Item>;
  test_answers: Record<string, Answer>;
  timings: {
    screening: Phase;
    pre_survey: Phase;
    assessment: Phase;
    difficulty: Phase;
  };
  item_timings: Record<string, ItemTiming>;
  total_seconds: number | null;
  motivation: string | null;
  motivation_other: string | null;
  difficulty: string | null;
  confidence: string | number | null;
  length: string | null;
  unclear: string | null;
  feedback: string | null;
};

type Split = { counts: Record<string, number>; total: number };

/** Q3's correct answer: question the AI before accepting (it ignored the constraint). */
const Q3_CORRECT = "C";
const Q3_GLOSS: Record<string, string> = {
  A: "accept the AI's answer",
  B: "ask the AI to explain more",
  C: "question the AI (correct)",
  D: "start over without the AI",
};

function mean(values: number[]): number | null {
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}

function median(values: (number | null)[]): number | null {
  const a = values.filter((v): v is number => v != null).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

const pct = (v: number | null) =>
  v === null ? "—" : `${Math.round(v * 100)}%`;

function fmtSec(s: number | null | undefined): string {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

const shortId = (r: Row) => (r.prolific_pid || r.subject).slice(0, 10);

function Tick({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? "text-lime-700" : "text-rose-600"}>
      {ok ? "✓" : "✗"}
    </span>
  );
}

/** The real study's screen-out rule (lib/surveys/eligibility.ts), applied here. */
const INELIGIBLE: Record<string, string[]> = {
  highest_math: [
    "Calculus III or higher",
    "Other college-level mathematics (e.g., linear algebra, differential equations)",
    "I am not sure",
  ],
  calculus_courses: ["3 or more", "I am not sure"],
  math_courses: ["3 or more"],
  calc_history: ["I am currently enrolled in a calculus course"],
};

function screenOut(r: Row): { out: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (INELIGIBLE.highest_math.includes(String(r.highest_math)))
    reasons.push(`highest math: ${r.highest_math}`);
  if (INELIGIBLE.calculus_courses.includes(String(r.calculus_courses)))
    reasons.push(`${r.calculus_courses} calculus courses`);
  if (INELIGIBLE.math_courses.includes(String(r.math_courses)))
    reasons.push(`${r.math_courses} math courses`);
  if (INELIGIBLE.calc_history.includes(String(r.calc_history)))
    reasons.push("currently enrolled in calculus");
  if (!r.screening_algebra_correct) reasons.push("algebra check failed");
  if (!r.screening_power_rule_correct) reasons.push("power-rule check failed");
  return { out: reasons.length > 0, reasons };
}

/**
 * Heuristic flag for a Q1a answer that looks machine-written: LaTeX source in a
 * plain box, or textbook scaffolding ("Step 2", "Substitute", "Therefore").
 * A hint for a human decision, not an automatic exclusion.
 */
function looksAiWritten(text: string): boolean {
  return /\\\(|\\\[|\\frac|\bStep\s*\d|\bSubstitute\b|\bFormulate\b|\bTherefore\b/i.test(
    text || ""
  );
}

const ITEM_LABELS: Record<string, string> = {
  "1": "Q1a — gardener, show work",
  "1b": "Q1b",
  "1c": "Q1c",
  "1d": "Q1d",
  "1e": "Q1e",
  "2.1": "Q2.1",
  "2.2": "Q2.2",
  "2.3": "Q2.3 — matching",
  "2.4": "Q2.4",
  "3.1": "Q3.1 — accept/question the AI",
  "3.2": "Q3.2 — reply to the AI",
};

/** Test-question order for the per-participant "all responses" table. */
const ALL_ITEMS = [
  "1",
  "1b",
  "1c",
  "1d",
  "1e",
  "2.1",
  "2.2",
  "2.3",
  "2.4",
  "3.1",
  "3.2",
];

function renderAnswer(a?: Answer): string {
  if (!a) return "—";
  const parts: string[] = [];
  if (a.choiceId) parts.push(`chose ${a.choiceId}`);
  if (a.matches)
    parts.push(
      Object.entries(a.matches)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")
    );
  if (a.text) parts.push(a.text);
  if (a.otherText) parts.push(`other: ${a.otherText}`);
  if (a.explanation) parts.push(`— ${a.explanation}`);
  return parts.join(" ") || "—";
}

/** One participant's full breakdown — collapsed by default to keep the page short. */
function ParticipantCard({ r, grade }: { r: Row; grade?: GradeInfo }) {
  const q3 = r.test_answers?.["3.1"]?.choiceId ?? "—";
  const so = screenOut(r);
  const aiFlag = looksAiWritten(r.test_answers?.["1"]?.text ?? "");

  return (
    <details className="rounded-xl border-2 border-stone-200 bg-white">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-4 text-sm">
        <span className="font-mono font-bold text-stone-800">{shortId(r)}…</span>
        <span className="font-semibold text-stone-500">Form {r.form}</span>
        <span className="text-stone-600">
          Q1 {r.q1_correct}/{r.q1_total}
        </span>
        {so.out ? (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
            screen-out
          </span>
        ) : (
          <span className="rounded-full bg-lime-100 px-2 py-0.5 text-xs font-bold text-lime-700">
            eligible
          </span>
        )}
        {aiFlag && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
            Q1a looks AI-written
          </span>
        )}
        {so.out && (
          <span className="w-full text-xs text-stone-400">
            {so.reasons.join(" · ")}
          </span>
        )}
      </summary>

      <div className="border-t border-stone-100 p-5 pt-4">
      <div className="rounded-lg bg-stone-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
          Math background (self-reported)
        </p>
        <p className="mt-1 text-sm text-stone-700">
          Highest math: <span className="font-semibold">{r.highest_math ?? "—"}</span>
          {" · "}Calc courses: {r.calculus_courses ?? "—"}
          {" · "}Math courses: {r.math_courses ?? "—"}
          {" · "}Calc history: {r.calc_history ?? "—"}
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
            Screening skill checks
          </p>
          <p className="mt-1 text-sm text-stone-700">
            Algebra <Tick ok={r.screening_algebra_correct} /> · Power rule{" "}
            <Tick ok={r.screening_power_rule_correct} />
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
            Self-report
          </p>
          <p className="mt-1 text-sm text-stone-700">
            Difficulty: {r.difficulty ?? "—"} · Confidence:{" "}
            {r.confidence ?? "—"}/7 · Length: {r.length ?? "—"}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
            All responses — Q1 to Q3
          </p>
          <p className="text-xs text-stone-400">
            New Q1: {r.q1_correct}/{r.q1_total}
            {grade && (
              <>
                {" · "}
                <span className="font-semibold text-stone-600">
                  AI-graded total: {grade.total}/{grade.max}
                </span>
                {!grade.complete && " (some items need review)"}
              </>
            )}
          </p>
        </div>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-stone-400">
              <th className="py-1 pr-3 font-semibold">Question</th>
              <th className="py-1 pr-3 font-semibold">Response</th>
              <th className="py-1 pr-3 font-semibold">Time</th>
              <th className="py-1 pr-3 font-semibold">Result</th>
              <th className="py-1 font-semibold">AI score</th>
            </tr>
          </thead>
          <tbody>
            {ALL_ITEMS.filter((id) => r.test_answers?.[id] || r.q1?.[id]).map(
              (id) => {
                const graded = r.q1?.[id];
                const isQ3 = id === "3.1";
                return (
                  <tr key={id} className="border-t border-stone-100 align-top">
                    <td className="py-1 pr-3 font-mono text-xs text-stone-600">
                      {ITEM_LABELS[id] ?? id}
                      {id === "1" && aiFlag && (
                        <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-800">
                          AI?
                        </span>
                      )}
                    </td>
                    <td className="py-1 pr-3 text-stone-800">
                      <span className="whitespace-pre-wrap">
                        {renderAnswer(r.test_answers?.[id])}
                      </span>
                      {isQ3 && (
                        <span className="text-stone-400">
                          {" "}
                          ({Q3_GLOSS[q3] ?? "—"})
                        </span>
                      )}
                    </td>
                    <td className="py-1 pr-3 whitespace-nowrap text-stone-500">
                      {fmtSec(r.item_timings?.[id]?.seconds)}
                    </td>
                    <td className="py-1 whitespace-nowrap">
                      {graded ? (
                        <>
                          <Tick ok={graded.correct} />{" "}
                          <span className="text-xs text-stone-400">
                            exp {graded.expected}
                          </span>
                        </>
                      ) : isQ3 ? (
                        <Tick ok={q3 === Q3_CORRECT} />
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className="py-1 whitespace-nowrap text-stone-600">
                      {grade?.items?.[id] && grade.items[id].points != null
                        ? `${grade.items[id].points}/${grade.items[id].max}`
                        : "—"}
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg bg-stone-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
          Timing
        </p>
        <p className="mt-1 text-sm text-stone-700">
          Total: <span className="font-semibold">{fmtSec(r.total_seconds)}</span>
          {" · "}Screening: {fmtSec(r.timings?.screening?.seconds)}
          {" · "}Pre-survey: {fmtSec(r.timings?.pre_survey?.seconds)}
          {" · "}Assessment: {fmtSec(r.timings?.assessment?.seconds)}
          {" · "}Difficulty: {fmtSec(r.timings?.difficulty?.seconds)}
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Per item:{" "}
          {Object.keys(r.item_timings ?? {})
            .sort()
            .map((id) => `${id} ${fmtSec(r.item_timings[id]?.seconds)}`)
            .join(" · ") || "—"}
        </p>
      </div>

      {(r.unclear || r.feedback) && (
        <div className="mt-3 space-y-1 text-sm text-stone-600">
          {r.unclear && (
            <p>
              <span className="font-semibold text-stone-500">Unclear:</span>{" "}
              {r.unclear}
            </p>
          )}
          {r.feedback && (
            <p>
              <span className="font-semibold text-stone-500">Feedback:</span>{" "}
              {r.feedback}
            </p>
          )}
        </div>
      )}
      </div>
    </details>
  );
}

export default function PilotAnalysisPage() {
  const [token, setToken] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [split, setSplit] = useState<Split | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTestRuns, setShowTestRuns] = useState(false);
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [ai, setAi] = useState<{ analysis: string; model: string | null } | null>(
    null
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [grades, setGrades] = useState<Record<string, GradeInfo>>({});

  const runAi = async (force: boolean) => {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch(
        `/api/pilot-ai-analysis${force ? "?force=1" : ""}`,
        { headers: { "x-grading-token": token } }
      ).then((r) => r.json());
      if (res.ok) {
        setAi({
          analysis: res.analysis,
          model: res.cached ? `${res.model} (cached)` : res.model,
        });
      } else {
        setAiError(res.error || "Could not run the AI analysis.");
      }
    } catch (e) {
      setAiError(String(e));
    } finally {
      setAiLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [exp, asg] = await Promise.all([
        fetch("/api/pilot-export", {
          headers: { "x-grading-token": token },
        }).then((r) => r.json()),
        fetch("/api/pilot-assign").then((r) => r.json()),
      ]);
      if (!exp.ok) {
        setError(exp.error || "Could not load the pilot data.");
        setRows(null);
      } else {
        setRows(exp.rows as Row[]);
        setSplit(asg?.ok ? (asg as Split) : null);
        // Auto-run the AI difficulty analysis. The server only calls the model
        // when the dataset changed, so a refresh on unchanged data is free.
        void runAi(false);
        // AI rubric grades for the free-response items (cached server-side).
        fetch("/api/pilot-grade", { headers: { "x-grading-token": token } })
          .then((r) => r.json())
          .then((g) => {
            if (g.ok && g.scores) setGrades(g.scores as Record<string, GradeInfo>);
          })
          .catch(() => {});
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const download = (format: "json" | "csv") => {
    window.open(
      `/api/pilot-export?format=${format}&token=${encodeURIComponent(token)}`,
      "_blank"
    );
  };

  const view = useMemo(() => {
    if (!rows) return null;
    // A preview/test run has no real Prolific PID (preview sends "test").
    const isTestRun = (r: Row) => !r.prolific_pid || r.prolific_pid === "test";
    const real = rows.filter((r) => !isTestRun(r));
    const testRuns = rows.filter(isTestRun);
    const shown = showTestRuns ? rows : real;

    // "Completed" = finished the whole pilot (through the exit survey). Someone
    // who did the test but abandoned the exit survey is counted separately, not
    // in the analysis, so a half-finished run can't skew the numbers.
    const completed = shown.filter((r) => r.completed_pilot);
    const testOnly = shown.filter(
      (r) => r.completed_test && !r.completed_pilot
    ).length;
    const byForm = (f: string) =>
      completed.filter((r) => r.form === f);
    const q1Rate = (f: string) =>
      mean(byForm(f).filter((r) => r.q1_total > 0).map((r) => r.q1_correct / r.q1_total));
    const q3CorrectRate = mean(
      completed.map((r) =>
        r.test_answers?.["3.1"]?.choiceId === Q3_CORRECT ? 1 : 0
      )
    );

    return {
      real,
      testRuns,
      completed,
      formA: byForm("A").length,
      formB: byForm("B").length,
      q1RateA: q1Rate("A"),
      q1RateB: q1Rate("B"),
      algebraRate: mean(completed.map((r) => (r.screening_algebra_correct ? 1 : 0))),
      powerRate: mean(completed.map((r) => (r.screening_power_rule_correct ? 1 : 0))),
      q3CorrectRate,
      testOnly,
      medianTotal: median(completed.map((r) => r.total_seconds)),
      medianAssessment: median(
        completed.map((r) => r.timings?.assessment?.seconds ?? null)
      ),
    };
  }, [rows, showTestRuns]);

  return (
    <main className="min-h-screen bg-stone-100">
      <AppHeader />
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold text-stone-800">Pilot results</h1>
        <p className="mt-2 max-w-2xl text-base leading-6 text-stone-500">
          The A/B test-question pilot, read from its own data store
          (pilot_logs). Separate from the main study. Free-response Q1 is graded
          by matching any number in the answer to the key; always read the raw
          answer below to confirm.
        </p>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Access token
            </span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && token && load()}
              placeholder="GRADING_EXPORT_TOKEN"
              className="h-11 w-72 rounded-xl border-2 border-stone-200 bg-white px-3 text-sm text-stone-800 focus:border-lime-600 focus:outline-none focus:ring-4 focus:ring-lime-50"
            />
          </label>
          <Button onClick={load} disabled={!token || loading}>
            {loading ? "Loading…" : "Load"}
          </Button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            {error}
          </p>
        )}

        {view && (
          <div className="mt-8 space-y-6">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Completed", String(view.completed.length)],
                ["Form A", String(view.formA)],
                ["Form B", String(view.formB)],
                [
                  "Q3 correct",
                  pct(view.q3CorrectRate),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border-2 border-stone-200 bg-white p-4"
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
                    {label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-stone-800">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-sm text-stone-500">
              Median total time: {fmtSec(view.medianTotal)} · median assessment
              time: {fmtSec(view.medianAssessment)} (completed participants).
            </p>

            <div className="rounded-xl border-2 border-lime-300 bg-lime-50/50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-stone-800">
                  AI difficulty analysis — are the pre- and post-test equally
                  hard?
                </h2>
                <Button
                  onClick={() => runAi(true)}
                  disabled={aiLoading || !token}
                >
                  {aiLoading ? "Analyzing…" : "Re-run"}
                </Button>
              </div>
              {aiError && (
                <p className="mt-2 text-sm text-amber-800">{aiError}</p>
              )}
              {ai ? (
                <>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                    {ai.analysis}
                  </p>
                  {ai.model && (
                    <p className="mt-2 text-xs text-stone-400">
                      Model: {ai.model}. Regenerated only when the dataset
                      changes.
                    </p>
                  )}
                </>
              ) : (
                !aiError && (
                  <p className="mt-2 text-sm text-stone-500">
                    {aiLoading ? "Analyzing the dataset…" : "Preparing…"}
                  </p>
                )
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border-2 border-stone-200 bg-white p-5">
                <h2 className="text-base font-bold text-stone-800">
                  New Q1 — mean correct by form
                </h2>
                <p className="mt-2 text-sm text-stone-600">
                  Form A (pretest): {pct(view.q1RateA)} · Form B (posttest):{" "}
                  {pct(view.q1RateB)}
                </p>
                <p className="mt-1 text-xs text-stone-400">
                  If the forms are matched, these should be close (among
                  calc-capable participants).
                </p>
              </div>
              <div className="rounded-xl border-2 border-stone-200 bg-white p-5">
                <h2 className="text-base font-bold text-stone-800">
                  Screening skill checks
                </h2>
                <p className="mt-2 text-sm text-stone-600">
                  Algebra correct: {pct(view.algebraRate)} · Power-rule correct:{" "}
                  {pct(view.powerRate)}
                </p>
                <p className="mt-1 text-xs text-stone-400">
                  Collected in the pilot, not screened on.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border-2 border-stone-200 bg-white p-5">
              <h2 className="text-base font-bold text-stone-800">
                Screening &amp; correctness
              </h2>
              <p className="mt-1 text-xs text-stone-400">
                Who the real study&apos;s rule would screen out, and how the rest
                did. Q1a flagged where the written solution looks AI-generated.
              </p>
              <table className="mt-3 w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs text-stone-400">
                    <th className="py-1 pr-3 font-semibold">Participant</th>
                    <th className="py-1 pr-3 font-semibold">Form</th>
                    <th className="py-1 pr-3 font-semibold">Q1</th>
                    <th className="py-1 pr-3 font-semibold">Screen-out?</th>
                    <th className="py-1 pr-3 font-semibold">Reason / AI flag</th>
                  </tr>
                </thead>
                <tbody>
                  {view.completed.map((r) => {
                    const so = screenOut(r);
                    const ai = looksAiWritten(r.test_answers?.["1"]?.text ?? "");
                    return (
                      <tr
                        key={r.subject}
                        className="border-t border-stone-100 align-top"
                      >
                        <td className="py-1 pr-3 font-mono text-stone-600">
                          {shortId(r)}…
                        </td>
                        <td className="py-1 pr-3 text-stone-600">{r.form}</td>
                        <td className="py-1 pr-3 text-stone-800">
                          {r.q1_correct}/{r.q1_total}
                        </td>
                        <td className="py-1 pr-3">
                          {so.out ? (
                            <span className="font-bold text-rose-700">out</span>
                          ) : (
                            <span className="font-bold text-lime-700">keep</span>
                          )}
                        </td>
                        <td className="py-1 pr-3 text-xs text-stone-500">
                          {[...so.reasons, ai ? "Q1a looks AI-written" : ""]
                            .filter(Boolean)
                            .join("; ") || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-3 text-sm text-stone-600">
                Eligible (not screened out):{" "}
                <span className="font-bold">
                  {view.completed.filter((r) => !screenOut(r).out).length}
                </span>{" "}
                of {view.completed.length}. Mean new-Q1 among those kept:{" "}
                {pct(
                  mean(
                    view.completed
                      .filter((r) => !screenOut(r).out && r.q1_total > 0)
                      .map((r) => r.q1_correct / r.q1_total)
                  )
                )}
                .
              </p>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-bold text-stone-800">
                  Participants (
                  {
                    view.completed.filter(
                      (r) => !onlyEligible || !screenOut(r).out
                    ).length
                  }
                  {onlyEligible ? ` of ${view.completed.length}` : ""})
                </h2>
                <label className="flex items-center gap-2 text-sm text-stone-600">
                  <input
                    type="checkbox"
                    checked={onlyEligible}
                    onChange={(e) => setOnlyEligible(e.target.checked)}
                    className="h-4 w-4 accent-lime-600"
                  />
                  Only show participants not screened out
                </label>
              </div>
              {view.testOnly > 0 && (
                <p className="mt-1 text-xs text-stone-400">
                  {view.testOnly} more did the test but did not finish the exit
                  survey — excluded here.
                </p>
              )}
              <div className="mt-3 space-y-4">
                {view.completed.filter(
                  (r) => !onlyEligible || !screenOut(r).out
                ).length === 0 && (
                  <p className="text-sm text-stone-500">
                    No participants to show.
                  </p>
                )}
                {view.completed
                  .filter((r) => !onlyEligible || !screenOut(r).out)
                  .map((r) => (
                    <ParticipantCard
                      key={r.subject}
                      r={r}
                      grade={grades[r.subject]}
                    />
                  ))}
              </div>
            </div>

            {split && (
              <p className="text-sm text-stone-500">
                Live assignment split — A: {split.counts.A ?? 0}, B:{" "}
                {split.counts.B ?? 0} (total {split.total}).
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-stone-600">
                <input
                  type="checkbox"
                  checked={showTestRuns}
                  onChange={(e) => setShowTestRuns(e.target.checked)}
                  className="h-4 w-4 accent-lime-600"
                />
                Include preview/test runs ({view.testRuns.length} hidden)
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-stone-500">
                The download includes every participant&apos;s raw answers to all
                test questions (Q1 original, Q2, and the Q3 AI-conversation
                items) — one column per item in the CSV, ungraded.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => download("csv")}>Download CSV</Button>
                <Button onClick={() => download("json")}>Download JSON</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
