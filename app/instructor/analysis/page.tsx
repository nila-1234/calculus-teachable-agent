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
import type {
  FlowSummary,
  SurveyItemSummary,
  ParticipantDetail,
} from "@/lib/tests/flow";

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
  flow: FlowSummary;
};

const pct = (value: number | null) =>
  value === null ? "—" : `${Math.round(value * 100)}%`;

const signed = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)} pts`;

/** A labelled horizontal bar for the distribution/discrimination charts. */
function BarRow({
  label,
  count,
  max,
  suffix,
  highlight,
}: {
  label: string;
  count: number;
  max: number;
  suffix?: string;
  highlight?: "good" | "warn";
}) {
  const color =
    highlight === "good"
      ? "bg-lime-500"
      : highlight === "warn"
        ? "bg-amber-500"
        : "bg-stone-400";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 truncate text-right text-stone-500">
        {label}
      </span>
      <div className="h-3 flex-1 rounded bg-stone-100">
        <div
          className={`h-3 rounded ${color}`}
          style={{ width: `${max ? Math.min(100, (count / max) * 100) : 0}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-stone-600">{suffix ?? count}</span>
    </div>
  );
}

const DOWNLOADS: { format: string; label: string; ext: string }[] = [
  { format: "json", label: "Full results (JSON)", ext: "json" },
  { format: "subjects", label: "Per participant (CSV)", ext: "csv" },
  { format: "answers", label: "Every answer (CSV)", ext: "csv" },
  { format: "events", label: "Raw event log (CSV)", ext: "csv" },
  { format: "pairs", label: "Pre/post gain (CSV)", ext: "csv" },
];

/** A simple labelled bar row with a full (wrapping) label, for survey items. */
function MiniBar({ label, count, max }: { label: string; count: number; max: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex-1 text-stone-600">{label}</span>
      <div className="h-3 w-28 shrink-0 rounded bg-stone-100">
        <div
          className="h-3 rounded bg-stone-400"
          style={{ width: `${max ? Math.min(100, (count / max) * 100) : 0}%` }}
        />
      </div>
      <span className="w-6 shrink-0 text-right text-stone-600">{count}</span>
    </div>
  );
}

/** One survey question's response distribution. */
function SurveyItemView({ item }: { item: SurveyItemSummary }) {
  return (
    <div className="mt-3 border-t border-stone-100 pt-3 first:border-t-0 first:pt-0">
      <p className="text-xs font-semibold text-stone-600">
        {item.prompt}{" "}
        <span className="font-normal text-stone-400">(n={item.n})</span>
      </p>
      {item.kind === "choice" && item.choices && (
        <div className="mt-1 space-y-1">
          {(() => {
            const mc = Math.max(1, ...item.choices.map((c) => c.count));
            return item.choices.map((c) => (
              <MiniBar key={c.label} label={c.label} count={c.count} max={mc} />
            ));
          })()}
        </div>
      )}
      {item.kind === "likert" && item.likertCounts && (
        <div className="mt-1">
          <p className="text-xs text-stone-500">
            mean{" "}
            {item.likertMean != null ? item.likertMean.toFixed(1) : "—"} /{" "}
            {item.likertMax}
          </p>
          <div className="mt-1 space-y-1">
            {(() => {
              const mc = Math.max(1, ...item.likertCounts!.map((c) => c.count));
              return item.likertCounts!.map((c) => (
                <MiniBar key={c.label} label={c.label} count={c.count} max={mc} />
              ));
            })()}
          </div>
        </div>
      )}
      {item.kind === "open" && (
        <div className="mt-1 text-xs text-stone-500">
          {item.answered ?? 0} answered.
          {item.samples && item.samples.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-stone-600">
              {item.samples.map((s, i) => (
                <li key={i}>&ldquo;{s}&rdquo;</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** One labelled group of a participant's answers. */
function AnswerBlock({
  title,
  lines,
}: {
  title: string;
  lines: { label: string; value: string }[];
}) {
  if (lines.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
        {title}
      </p>
      <ul className="mt-1 space-y-1.5">
        {lines.map((l, i) => (
          <li key={i} className="text-xs">
            <span className="text-stone-500">{l.label}</span>
            <span className="mt-0.5 block whitespace-pre-wrap text-stone-800">
              {l.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One completer's full step-by-step answers, collapsed by default. */
function ParticipantCard({ p }: { p: ParticipantDetail }) {
  return (
    <details className="rounded-xl border-2 border-stone-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-stone-800">
        {p.subjectId}{" "}
        <span className="font-normal text-stone-400">· {p.arm ?? "—"}</span>
      </summary>
      <div className="mt-2 border-t border-stone-100 pt-1">
        <AnswerBlock title="Screening" lines={p.screening} />
        <AnswerBlock title="Pre-survey" lines={p.preSurvey} />
        <AnswerBlock title="Pre-test" lines={p.preTest} />
        <AnswerBlock title="Post-test" lines={p.postTest} />
        <AnswerBlock title="Post-survey" lines={p.postSurvey} />
      </div>
    </details>
  );
}

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
          <p className="mt-1 text-xs text-stone-400">
            ✓ correct · ◆ main distractor (most-chosen wrong option)
          </p>
          {(() => {
            const maxWrong = Math.max(
              0,
              ...detail.choices.filter((c) => !c.correct).map((c) => c.count)
            );
            const distractor =
              maxWrong > 0
                ? detail.choices.find(
                    (c) => !c.correct && c.count === maxWrong
                  )?.choiceId ?? null
                : null;
            const mc = Math.max(1, ...detail.choices.map((c) => c.count));
            return (
              <div className="mt-2 space-y-1">
                {detail.choices.map((c) => (
                  <BarRow
                    key={c.choiceId}
                    label={`${c.choiceId}${c.correct ? " ✓" : c.choiceId === distractor ? " ◆" : ""}`}
                    count={c.count}
                    max={mc}
                    highlight={
                      c.correct
                        ? "good"
                        : c.choiceId === distractor
                          ? "warn"
                          : undefined
                    }
                    suffix={`${c.count}×`}
                  />
                ))}
              </div>
            );
          })()}
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

            {summary.flow && (
              <>
                <h2 className="mt-10 text-xl font-bold text-stone-800">
                  Full flow — step by step
                </h2>
                <p className="mt-1 text-sm leading-6 text-stone-500">
                  Every step from screening to post-survey. The response
                  breakdowns below cover only the{" "}
                  <span className="font-semibold">
                    {summary.flow.completers}
                  </span>{" "}
                  participant(s) who finished the whole flow (of{" "}
                  {summary.flow.totalParticipants} who started).
                </p>

                {/* Funnel */}
                <h3 className="mt-5 text-base font-bold text-stone-800">
                  Completion funnel
                </h3>
                <div className="mt-2 space-y-1">
                  {(() => {
                    const mc = Math.max(
                      1,
                      ...summary.flow.funnel.map((f) => f.reached)
                    );
                    return summary.flow.funnel.map((f) => (
                      <BarRow
                        key={f.step}
                        label={f.step}
                        count={f.reached}
                        max={mc}
                      />
                    ));
                  })()}
                </div>

                {/* Time per phase */}
                <h3 className="mt-5 text-base font-bold text-stone-800">
                  Median time per phase (completers)
                </h3>
                <table className="mt-2 w-full border-collapse text-sm">
                  <tbody>
                    {summary.flow.phases.map((p) => (
                      <tr key={p.phase} className="border-t border-stone-100">
                        <td className="py-1 pr-3 text-stone-700">{p.label}</td>
                        <td className="py-1 pr-3 font-semibold text-stone-800">
                          {p.medianMin == null
                            ? "—"
                            : `${p.medianMin.toFixed(1)} min`}
                        </td>
                        <td className="py-1 text-xs text-stone-400">
                          n={p.n}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Instruction */}
                <h3 className="mt-5 text-base font-bold text-stone-800">
                  Instruction
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  Arm: {summary.flow.instruction.armCounts.lesson} lesson,{" "}
                  {summary.flow.instruction.armCounts.agent} agent.
                  {summary.flow.instruction.lessonMedianMin != null && (
                    <>
                      {" "}
                      Lesson median{" "}
                      {summary.flow.instruction.lessonMedianMin.toFixed(1)} min,{" "}
                      {summary.flow.instruction.lessonMedianHints ?? 0} hints.
                    </>
                  )}
                </p>
                {summary.flow.instruction.lessonFirstTry.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-semibold text-stone-500">
                      Lesson first-try correctness per item
                    </p>
                    {summary.flow.instruction.lessonFirstTry.map((it) => (
                      <MiniBar
                        key={it.itemId}
                        label={`Q${it.itemId} (${Math.round(it.firstTryRate * 100)}%, n=${it.n})`}
                        count={Math.round(it.firstTryRate * 100)}
                        max={100}
                      />
                    ))}
                  </div>
                )}

                {/* Survey breakdowns */}
                {(
                  [
                    ["Screening responses", summary.flow.screening],
                    ["Pre-survey responses", summary.flow.preSurvey],
                    ["Post-survey responses", summary.flow.postSurvey],
                  ] as const
                ).map(([label, items]) => (
                  <div key={label}>
                    <h3 className="mt-5 text-base font-bold text-stone-800">
                      {label}
                    </h3>
                    <div className="mt-2 rounded-xl border-2 border-stone-100 bg-white p-4">
                      {items.length === 0 ? (
                        <p className="text-xs text-stone-400">No data yet.</p>
                      ) : (
                        items.map((item) => (
                          <SurveyItemView key={item.id} item={item} />
                        ))
                      )}
                    </div>
                  </div>
                ))}

                <p className="mt-4 text-xs text-stone-400">
                  The pre-test and post-test item analysis is below.
                </p>
              </>
            )}

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

                {/* ---- Score distribution ---- */}
                <h3 className="mt-12 text-base font-bold text-stone-800">
                  Score distribution
                </h3>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Completers per score band, out of {summary.insights.totalMax}.
                </p>
                <div className="mt-3 grid gap-6 md:grid-cols-2">
                  {(
                    [
                      ["Pre-test", summary.insights.scorePre],
                      ["Post-test", summary.insights.scorePost],
                    ] as const
                  ).map(([label, bands]) => {
                    const mc = Math.max(1, ...bands.map((b) => b.count));
                    return (
                      <div key={label}>
                        <p className="mb-1 text-xs font-semibold text-stone-500">
                          {label}
                        </p>
                        <div className="space-y-1">
                          {bands.map((b) => (
                            <BarRow
                              key={b.label}
                              label={b.label}
                              count={b.count}
                              max={mc}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ---- Item discrimination ---- */}
                <h3 className="mt-10 text-base font-bold text-stone-800">
                  Item discrimination
                </h3>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Mean test total of those who got the item (≥ half marks) minus
                  those who didn&apos;t. Bigger positive gap = the item better
                  separates strong from weak participants. Pooled across pre and
                  post.
                </p>
                <div className="mt-3 space-y-1">
                  {[...summary.insights.items]
                    .sort(
                      (a, b) =>
                        (b.discriminationGap ?? -99) -
                        (a.discriminationGap ?? -99)
                    )
                    .map((item) => (
                      <BarRow
                        key={item.itemId}
                        label={`Q${item.itemId}`}
                        count={Math.max(0, item.discriminationGap ?? 0)}
                        max={summary.insights.totalMax}
                        highlight={
                          (item.discriminationGap ?? 0) > 0 ? "good" : "warn"
                        }
                        suffix={
                          item.discriminationGap == null
                            ? "—"
                            : `+${item.discriminationGap.toFixed(1)} (${item.discMeanGot?.toFixed(0) ?? "–"} vs ${item.discMeanNot?.toFixed(0) ?? "–"})`
                        }
                      />
                    ))}
                </div>

                {/* ---- Conclusions ---- */}
                <h3 className="mt-10 text-base font-bold text-stone-800">
                  Conclusions — which items are too easy / too hard
                </h3>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Difficulty = mean % of max (pooled). Discrimination = the gap
                  above. Small sample — read as signal, not proof.
                </p>
                <table className="mt-2 w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs text-stone-400">
                      <th className="py-1 pr-3 font-semibold">Item</th>
                      <th className="py-1 pr-3 font-semibold">% of max</th>
                      <th className="py-1 pr-3 font-semibold">Discrim.</th>
                      <th className="py-1 font-semibold">Read</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...summary.insights.items]
                      .sort((a, b) => b.accuracy - a.accuracy)
                      .map((item) => {
                        const acc = item.accuracy * 100;
                        const gap = item.discriminationGap;
                        const v =
                          acc >= 75
                            ? { t: "Too easy — near ceiling", c: "text-amber-600" }
                            : gap != null && gap < 2
                              ? { t: "Weak discriminator", c: "text-amber-600" }
                              : acc <= 30
                                ? { t: "Hard — floor-leaning", c: "text-stone-600" }
                                : { t: "Good spread", c: "text-lime-700" };
                        return (
                          <tr
                            key={item.itemId}
                            className="border-t border-stone-100"
                          >
                            <td className="py-1 pr-3 text-stone-700">
                              Q{item.itemId}
                            </td>
                            <td className="py-1 pr-3 font-semibold text-stone-800">
                              {Math.round(acc)}%
                            </td>
                            <td className="py-1 pr-3 text-stone-500">
                              {gap == null ? "—" : `+${gap.toFixed(1)}`}
                            </td>
                            <td className={`py-1 font-medium ${v.c}`}>{v.t}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>

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

            {summary.flow && summary.flow.participants.length > 0 && (
              <>
                <h2 className="mt-10 text-xl font-bold text-stone-800">
                  Per participant — full answers
                </h2>
                <p className="mt-1 text-sm leading-6 text-stone-500">
                  Every completer&apos;s answers to every step of the flow. Click
                  a participant to expand.
                </p>
                <div className="mt-3 space-y-2">
                  {summary.flow.participants.map((p) => (
                    <ParticipantCard key={p.subjectId} p={p} />
                  ))}
                </div>
              </>
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
