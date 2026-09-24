"use client";

import { useCallback, useEffect, useState } from "react";
import AppHeader from "@/components/app-header";
import Button from "@/components/button";
import MathDisplay from "@/components/math-display";
import {
  GOAL_DESCRIPTIONS,
  GOAL_LABELS,
  type Insights,
  type ItemStat,
} from "@/lib/tests/insights";

/**
 * Instructor analysis view.
 *
 * Reads the study data back out of the database, grades the pre/post tests, and
 * shows the result — with the underlying sheets downloadable as JSON or CSV.
 *
 * All the work happens in /api/grading-export; this page only renders it. That
 * endpoint requires GRADING_EXPORT_TOKEN and fails closed when it is unset, so
 * grades stay unreachable without it.
 */

const TOKEN_KEY = "gradingExportToken";

type Sheet = { columns: string[]; rows: Record<string, unknown>[] };

type Summary = {
  generatedAt: string;
  events: number;
  submissions: number;
  allComplete: boolean;
  incomplete: {
    subject_id: string;
    test_id: string;
    ungraded: string[];
    error: string | null;
  }[];
  subjects: Sheet;
  pairs: Sheet;
  insights: Insights;
};

const pct = (value: number | null) =>
  value === null ? "—" : `${Math.round(value * 100)}%`;

const signed = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)} pts`;

const DOWNLOADS: { format: string; label: string; ext: string }[] = [
  { format: "json", label: "Full results (JSON)", ext: "json" },
  { format: "subjects", label: "Per participant (CSV)", ext: "csv" },
  { format: "answers", label: "Every answer (CSV)", ext: "csv" },
  { format: "events", label: "Raw event log (CSV)", ext: "csv" },
  { format: "pairs", label: "Pre/post gain (CSV)", ext: "csv" },
];

/** Columns worth showing on screen; the rest stay in the downloads. */
const SHOWN = [
  "subject_id",
  "pre_points",
  "post_points",
  "gain",
  "active_min",
  "flow_complete",
  "phases_missing",
];


/** A ranked row that opens the item's detail. */
function ItemRow({
  item,
  value,
  countLabel,
  onOpen,
}: {
  item: ItemStat;
  value: string;
  countLabel?: number;
  onOpen: (itemId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.itemId)}
      className="flex w-full items-center justify-between rounded-xl border-2 border-stone-200 bg-white px-4 py-2 text-left text-sm transition-colors hover:border-lime-600"
    >
      <span className="font-semibold text-stone-800">
        Q{item.itemId}{" "}
        <span className="font-normal text-stone-400">
          {GOAL_LABELS[item.goal]}
        </span>
      </span>
      <span className="text-stone-600">
        {value}
        <span className="text-stone-400">(n={countLabel ?? item.n})</span>
      </span>
    </button>
  );
}

const VERDICT_STYLES: Record<string, string> = {
  met: "bg-lime-100 text-lime-800",
  not_met: "bg-red-100 text-red-700",
  unverifiable: "bg-amber-100 text-amber-800",
};

/**
 * Why an item is missed.
 *
 * The criterion pass rates are the substance: an aggregate score says Q2.2 is
 * missed, but only these say which part of it people fail.
 */
function ItemDetailPanel({
  item,
  onClose,
}: {
  item: ItemStat | null;
  onClose: () => void;
}) {
  if (!item) return null;

  const { detail } = item;

  return (
    <div className="mt-6 rounded-2xl border-2 border-stone-300 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
            {GOAL_LABELS[item.goal]}
          </p>
          <h3 className="mt-1 text-xl font-bold text-stone-800">
            Question {item.itemId}
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            {pct(item.accuracy)} of available marks · {item.meanPoints.toFixed(1)}
            /{item.maxPoints} mean ·{" "}
            {item.medianSeconds === null
              ? "no timing"
              : `${Math.round(item.medianSeconds)}s median`}{" "}
            · n={item.n}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border-2 border-stone-200 px-3 py-1 text-sm font-semibold text-stone-600 hover:border-stone-400"
        >
          Close
        </button>
      </div>

      {Object.entries(detail.prompts).map(([testId, prompt]) => (
        <div key={testId} className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
            {testId === "pretest" ? "Pre-test" : "Post-test"} wording
          </p>
          <MathDisplay
            text={prompt ?? ""}
            className="mt-1 text-sm leading-6 text-stone-700"
          />
        </div>
      ))}

      {detail.criteria.length > 0 && (
        <>
          <h4 className="mt-6 text-sm font-bold text-stone-800">
            Which criteria fail
          </h4>
          <div className="mt-2 space-y-2">
            {detail.criteria.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl border-2 border-stone-100 bg-stone-50 px-4 py-2"
              >
                <span className="w-44 shrink-0 font-mono text-xs text-stone-600">
                  {c.id}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200">
                  <div
                    className={`h-full ${
                      c.metRate >= 0.5 ? "bg-lime-600" : "bg-red-400"
                    }`}
                    style={{ width: `${Math.round(c.metRate * 100)}%` }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right text-xs text-stone-600">
                  met {Math.round(c.metRate * 100)}%{" "}
                  <span className="text-stone-400">(n={c.n})</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {detail.choices.length > 0 && (
        <>
          <h4 className="mt-6 text-sm font-bold text-stone-800">
            What people chose
          </h4>
          <div className="mt-2 space-y-2">
            {detail.choices.map((c) => (
              <div
                key={c.choiceId}
                className="flex items-center justify-between rounded-xl border-2 border-stone-100 bg-stone-50 px-4 py-2 text-sm"
              >
                <span className="text-stone-700">
                  <span className="font-bold">{c.choiceId}</span>{" "}
                  {c.correct && (
                    <span className="ml-1 rounded bg-lime-100 px-1.5 py-0.5 text-xs font-bold text-lime-800">
                      correct
                    </span>
                  )}
                </span>
                <span className="text-stone-500">chosen {c.count}&times;</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h4 className="mt-6 text-sm font-bold text-stone-800">
        Individual answers
      </h4>
      <div className="mt-2 space-y-3">
        {detail.responses.map((r, index) => (
          <div
            key={`${r.subjectId}-${r.testId}-${index}`}
            className="rounded-xl border-2 border-stone-100 bg-stone-50 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-stone-800">
                {r.subjectId}{" "}
                <span className="font-normal text-stone-400">
                  {r.testId === "pretest" ? "pre" : "post"}
                </span>
              </span>
              <span className="text-sm text-stone-600">
                {r.points ?? "—"}/{r.maxPoints}
              </span>
            </div>
            <MathDisplay
              text={r.answer}
              className="mt-2 text-sm leading-6 text-stone-700"
            />
            {r.verdicts.length > 0 && (
              <div className="mt-3 space-y-1">
                {r.verdicts.map((v) => (
                  <div key={v.id} className="flex items-start gap-2 text-xs">
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 font-bold ${
                        VERDICT_STYLES[v.verdict] ?? "bg-stone-100"
                      }`}
                    >
                      {v.verdict}
                    </span>
                    <span className="font-mono text-stone-500">{v.id}</span>
                    <span className="text-stone-600">{v.comment}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InstructorAnalysisPage() {
  const [token, setToken] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (saved) queueMicrotask(() => setToken(saved));
  }, []);

  const load = useCallback(async (accessToken: string) => {
    if (!accessToken.trim()) {
      setError("Enter the export token to load results.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const res = await fetch(
        `/api/grading-export?format=summary&token=${encodeURIComponent(accessToken)}`,
        { cache: "no-store" }
      );
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }

      sessionStorage.setItem(TOKEN_KEY, accessToken);
      setSummary(body as Summary);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
      setSummary(null);
    }
  }, []);

  const download = (format: string, ext: string) => {
    const url = `/api/grading-export?format=${format}&token=${encodeURIComponent(token)}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = `${format}-${new Date().toISOString().slice(0, 10)}.${ext}`;
    link.click();
  };

  const rows = summary?.subjects.rows ?? [];

  return (
    <main className="flex min-h-screen flex-col bg-stone-100">
      <AppHeader />

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-wider text-lime-700">
          Instructor workspace
        </p>
        <h1 className="mt-2 text-3xl font-bold text-stone-800">
          Study results
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-6 text-stone-500">
          Every logged event, with the pre/post tests auto-graded against the
          answer key. Closed-form items are scored by lookup; open responses are
          judged criterion by criterion.
        </p>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Export token
            </span>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void load(token);
              }}
              placeholder="GRADING_EXPORT_TOKEN"
              className="h-11 w-72 rounded-xl border-2 border-stone-200 bg-white px-3 text-sm text-stone-800 focus:border-lime-600 focus:outline-none"
            />
          </label>
          <Button onClick={() => void load(token)}>
            {status === "loading" ? "Loading…" : "Load results"}
          </Button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border-2 border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        {summary && (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Participants", value: rows.length },
                { label: "Submissions graded", value: summary.submissions },
                { label: "Events logged", value: summary.events },
                {
                  label: "Fully graded",
                  value: summary.allComplete ? "Yes" : "No",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-stone-800">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {!summary.allComplete && (
              <div className="mt-4 rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                <p className="font-bold">
                  Some submissions are not fully graded.
                </p>
                <p className="mt-1">
                  Their totals are partial scores, not low scores — do not treat
                  them as results.
                </p>
                <ul className="mt-2 list-disc space-y-0.5 pl-5">
                  {summary.incomplete.map((item) => (
                    <li key={`${item.subject_id}-${item.test_id}`}>
                      {item.subject_id} / {item.test_id} —{" "}
                      {item.error ?? `ungraded: ${item.ungraded.join(", ")}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <h2 className="mt-10 text-xl font-bold text-stone-800">
              Per participant
            </h2>
            <div className="mt-3 overflow-x-auto rounded-xl border-2 border-stone-200 bg-white">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    {SHOWN.map((column) => (
                      <th
                        key={column}
                        className="whitespace-nowrap border-b border-stone-200 px-3 py-2 font-semibold text-stone-600"
                      >
                        {column.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={SHOWN.length}
                        className="px-3 py-6 text-center text-stone-400"
                      >
                        No participant data yet.
                      </td>
                    </tr>
                  )}
                  {rows.map((row, index) => (
                    <tr key={index} className="border-b border-stone-100 last:border-b-0">
                      {SHOWN.map((column) => (
                        <td
                          key={column}
                          className="whitespace-nowrap px-3 py-2 text-stone-700"
                        >
                          {String(row[column] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {summary.insights && (
              <>
                <h2 className="mt-10 text-xl font-bold text-stone-800">
                  Which skills moved
                </h2>
                <p className="mt-1 text-sm leading-6 text-stone-500">
                  Items grouped by the study&apos;s three assessment goals, using
                  the mapping in the answer key. Gain is post minus pre, in
                  percentage points of the available marks.
                </p>

                {summary.insights.underpowered && (
                  <div className="mt-3 rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    <p className="font-bold">
                      Too few participants to read anything into this.
                    </p>
                    <p className="mt-1">
                      {summary.insights.pairedParticipants} participant(s) have
                      completed both tests. These are descriptions of the data
                      so far, not findings — any ordering between items or goals
                      at this size is noise.
                    </p>
                  </div>
                )}

                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  {summary.insights.goals.map((goal) => (
                    <div
                      key={goal.goal}
                      className="rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm"
                    >
                      <p className="text-sm font-bold text-stone-800">
                        {GOAL_LABELS[goal.goal]}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-stone-500">
                        {GOAL_DESCRIPTIONS[goal.goal]}
                      </p>
                      <p className="mt-3 text-2xl font-bold text-stone-800">
                        {signed(goal.gain)}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        pre {pct(goal.preAccuracy)} &rarr; post{" "}
                        {pct(goal.postAccuracy)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="text-base font-bold text-stone-800">
                      Most often missed
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-stone-500">
                      Lowest share of available marks.
                    </p>
                    <ul className="mt-2 space-y-2">
                      {summary.insights.hardest.map((item) => (
                        <li key={item.itemId}>
                          <ItemRow
                            item={item}
                            value={`${pct(item.accuracy)} `}
                            onOpen={setOpenItem}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-stone-800">
                      Longest to answer
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-stone-500">
                      Median time on the question itself.
                    </p>
                    <ul className="mt-2 space-y-2">
                      {summary.insights.slowest.length === 0 && (
                        <li className="rounded-xl border-2 border-stone-200 bg-white px-4 py-2 text-sm text-stone-400">
                          No timing recorded yet.
                        </li>
                      )}
                      {summary.insights.slowest.map((item) => (
                        <li key={item.itemId}>
                          <ItemRow
                            item={item}
                            value={`${Math.round(item.medianSeconds ?? 0)}s `}
                            countLabel={item.timedN}
                            onOpen={setOpenItem}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <h3 className="mt-12 text-base font-bold text-stone-800">
                  Every item
                </h3>
                <div className="mt-3 overflow-x-auto rounded-xl border-2 border-stone-200 bg-white">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-stone-50">
                      <tr>
                        {["item", "goal", "accuracy", "mean points", "median time", "n"].map(
                          (h) => (
                            <th
                              key={h}
                              className="whitespace-nowrap border-b border-stone-200 px-3 py-2 font-semibold text-stone-600"
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {summary.insights.items.map((item) => (
                        <tr
                          key={item.itemId}
                          onClick={() => setOpenItem(item.itemId)}
                          className="cursor-pointer border-b border-stone-100 last:border-b-0 hover:bg-stone-50"
                        >
                          <td className="px-3 py-2 font-semibold text-stone-800 underline decoration-stone-300 underline-offset-2">
                            Q{item.itemId}
                          </td>
                          <td className="px-3 py-2 text-stone-500">
                            {GOAL_LABELS[item.goal]}
                          </td>
                          <td className="px-3 py-2 text-stone-700">
                            {pct(item.accuracy)}
                          </td>
                          <td className="px-3 py-2 text-stone-700">
                            {item.meanPoints.toFixed(1)} / {item.maxPoints}
                          </td>
                          <td className="px-3 py-2 text-stone-700">
                            {item.medianSeconds === null
                              ? "—"
                              : `${Math.round(item.medianSeconds)}s`}
                          </td>
                          <td className="px-3 py-2 text-stone-400">{item.n}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {openItem && summary.insights && (
              <ItemDetailPanel
                item={
                  summary.insights.items.find((i) => i.itemId === openItem) ??
                  null
                }
                onClose={() => setOpenItem(null)}
              />
            )}

            <h2 className="mt-10 text-xl font-bold text-stone-800">Download</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {DOWNLOADS.map((item) => (
                <button
                  key={item.format}
                  type="button"
                  onClick={() => download(item.format, item.ext)}
                  className="rounded-xl border-2 border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition-colors hover:border-lime-600"
                >
                  {item.label}
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs text-stone-400">
              Generated {new Date(summary.generatedAt).toLocaleString()}.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
