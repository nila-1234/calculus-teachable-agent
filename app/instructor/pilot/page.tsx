"use client";

import { useMemo, useState } from "react";
import AppHeader from "@/components/app-header";
import Button from "@/components/button";

type Q1Item = { given: string; expected: number; correct: boolean };

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
  screening_algebra_correct: boolean;
  screening_power_rule_correct: boolean;
  q1_correct: number;
  q1_total: number;
  q1: Record<string, Q1Item>;
  test_answers: Record<string, Answer>;
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

const pct = (v: number | null) =>
  v === null ? "—" : `${Math.round(v * 100)}%`;

const shortId = (r: Row) => (r.prolific_pid || r.subject).slice(0, 10);

function Tick({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? "text-lime-700" : "text-rose-600"}>
      {ok ? "✓" : "✗"}
    </span>
  );
}

/** One participant's full breakdown — the analysis you'd otherwise do by hand. */
function ParticipantCard({ r }: { r: Row }) {
  const q3 = r.test_answers?.["3.1"]?.choiceId ?? "—";
  const q3Text = r.test_answers?.["3.2"]?.text ?? "";
  const q1Ids = Object.keys(r.q1 ?? {}).sort();

  return (
    <div className="rounded-xl border-2 border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-mono text-sm font-bold text-stone-800">
          {shortId(r)}…
        </h3>
        <span className="text-xs font-semibold text-stone-500">
          Form {r.form} ({r.test || "—"}) · motivation: {r.motivation ?? "—"}
        </span>
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
        <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
          New Question 1 — {r.q1_correct}/{r.q1_total}
        </p>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-stone-400">
              <th className="py-1 pr-3 font-semibold">Item</th>
              <th className="py-1 pr-3 font-semibold">Expected</th>
              <th className="py-1 pr-3 font-semibold">Given</th>
              <th className="py-1 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {q1Ids.map((id) => {
              const item = r.q1[id];
              return (
                <tr key={id} className="border-t border-stone-100 align-top">
                  <td className="py-1 pr-3 font-mono text-stone-600">{id}</td>
                  <td className="py-1 pr-3 text-stone-600">{item.expected}</td>
                  <td className="py-1 pr-3 text-stone-800">
                    {item.given || "—"}
                  </td>
                  <td className="py-1">
                    <Tick ok={item.correct} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg bg-stone-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
          AI-conversation question (Q3)
        </p>
        <p className="mt-1 text-sm text-stone-700">
          Chose <span className="font-bold">{q3}</span> —{" "}
          {Q3_GLOSS[q3] ?? "—"}{" "}
          <Tick ok={q3 === Q3_CORRECT} />
        </p>
        {q3Text && (
          <p className="mt-2 text-sm italic text-stone-600">
            “{q3Text}”
          </p>
        )}
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
  );
}

export default function PilotAnalysisPage() {
  const [token, setToken] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [split, setSplit] = useState<Split | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTestRuns, setShowTestRuns] = useState(false);

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

    const completed = shown.filter((r) => r.completed_test);
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

            <div>
              <h2 className="text-xl font-bold text-stone-800">
                Participants ({view.completed.length})
              </h2>
              <div className="mt-3 space-y-4">
                {view.completed.length === 0 && (
                  <p className="text-sm text-stone-500">
                    No completed participants to show.
                  </p>
                )}
                {view.completed.map((r) => (
                  <ParticipantCard key={r.subject} r={r} />
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
