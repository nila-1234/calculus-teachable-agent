"use client";

import { useCallback, useEffect, useState } from "react";
import AppHeader from "@/components/app-header";
import Button from "@/components/button";

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
};

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

export default function InstructorAnalysisPage() {
  const [token, setToken] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
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
