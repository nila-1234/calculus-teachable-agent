"use client";

import { useMemo, useState } from "react";
import AppHeader from "@/components/app-header";
import Button from "@/components/button";

type Row = {
  subject: string;
  form: string;
  completed_test: boolean;
  completed_pilot: boolean;
  screening_algebra_correct: boolean;
  screening_power_rule_correct: boolean;
  q1_correct: number;
  q1_total: number;
  difficulty: string | null;
  motivation: string | null;
};

type Split = { counts: Record<string, number>; total: number };

function mean(values: number[]): number | null {
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}

export default function PilotAnalysisPage() {
  const [token, setToken] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [split, setSplit] = useState<Split | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  const summary = useMemo(() => {
    if (!rows) return null;
    const byForm = (f: string) => rows.filter((r) => r.form === f);
    const q1Rate = (f: string) =>
      mean(
        byForm(f)
          .filter((r) => r.q1_total > 0)
          .map((r) => r.q1_correct / r.q1_total)
      );
    return {
      total: rows.length,
      completed: rows.filter((r) => r.completed_pilot).length,
      formA: byForm("A").length,
      formB: byForm("B").length,
      algebraRate: mean(rows.map((r) => (r.screening_algebra_correct ? 1 : 0))),
      powerRate: mean(rows.map((r) => (r.screening_power_rule_correct ? 1 : 0))),
      q1RateA: q1Rate("A"),
      q1RateB: q1Rate("B"),
    };
  }, [rows]);

  const pct = (v: number | null) =>
    v === null ? "—" : `${Math.round(v * 100)}%`;

  return (
    <main className="min-h-screen bg-stone-100">
      <AppHeader />
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold text-stone-800">Pilot results</h1>
        <p className="mt-2 max-w-2xl text-base leading-6 text-stone-500">
          The A/B test-question pilot, read from its own data store
          (pilot_logs). Separate from the main study.
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

        {summary && (
          <div className="mt-8 space-y-6">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Participants", String(summary.total)],
                ["Completed", String(summary.completed)],
                ["Form A", String(summary.formA)],
                ["Form B", String(summary.formB)],
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

            <div className="rounded-xl border-2 border-stone-200 bg-white p-5">
              <h2 className="text-base font-bold text-stone-800">
                Screening skill checks (collected, not screened on)
              </h2>
              <p className="mt-2 text-sm text-stone-600">
                Algebra check correct: {pct(summary.algebraRate)} · Power-rule
                check correct: {pct(summary.powerRate)}
              </p>
            </div>

            <div className="rounded-xl border-2 border-stone-200 bg-white p-5">
              <h2 className="text-base font-bold text-stone-800">
                New Question-1 items — mean correct
              </h2>
              <p className="mt-2 text-sm text-stone-600">
                Form A (pretest): {pct(summary.q1RateA)} · Form B (posttest):{" "}
                {pct(summary.q1RateB)}
              </p>
              <p className="mt-1 text-xs text-stone-400">
                If the forms are matched in difficulty, these should be close.
              </p>
            </div>

            {split && (
              <p className="text-sm text-stone-500">
                Live assignment split — A: {split.counts.A ?? 0}, B:{" "}
                {split.counts.B ?? 0} (total {split.total}).
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => download("csv")}>Download CSV</Button>
              <Button onClick={() => download("json")}>Download JSON</Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
