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
  items: Record<
    string,
    {
      points: number | null;
      max: number;
      kind: string;
      criteria?: Record<string, string>;
    }
  >;
};

/** Rubric criteria for the show-work (open) items, labelled for the analysis. */
const CRIT_SPECS: { item: string; label: string; crits: [string, string][] }[] = [
  {
    item: "1",
    label: "Q1a — optimization (show work)",
    crits: [
      ["model", "sets up the constraint"],
      ["one-variable", "area as one variable"],
      ["derivative", "differentiates & solves"],
      ["extremum", "justifies it is a maximum"],
      ["quantities", "reports dimensions & area"],
    ],
  },
  {
    item: "2.1",
    label: "Q2.1 — revenue model (choice + explanation)",
    crits: [
      ["chose-c", "chose C (the function)"],
      ["uses-examples", "uses the table's numbers"],
      ["price-times-quantity", "revenue = price × quantity"],
    ],
  },
  {
    item: "2.2",
    label: "Q2.2 — explain the concept (show work)",
    crits: [
      ["derivative", "names the derivative"],
      ["critical-point", "identifies critical point"],
      ["definition", "defines critical point (deriv=0)"],
      ["candidate-only", "critical point only a candidate"],
      ["verify", "must verify it is a max"],
    ],
  },
  {
    item: "3.2",
    label: "Q3.2 — rebut the AI (show work)",
    crits: [
      ["names-constraint", "names the range constraint"],
      ["identifies-conflict", "identifies the AI's conflict"],
      ["prompts-revision", "prompts a revision"],
    ],
  },
];

/** item id -> its [criterionId, label] list, for per-step display. */
const CRIT_LABELS: Record<string, [string, string][]> = Object.fromEntries(
  CRIT_SPECS.map((s) => [s.item, s.crits])
);

/** Multiple-choice items, for the option (distractor) distribution. */
const MC_ITEMS: { item: string; label: string; options: string[]; correct: string }[] =
  [
    { item: "2.1", label: "Q2.1 revenue model", options: ["A", "B", "C"], correct: "C" },
    { item: "2.4", label: "Q2.4 interpret domain", options: ["A", "B", "C"], correct: "A" },
    { item: "3.1", label: "Q3.1 question the AI", options: ["A", "B", "C", "D"], correct: "C" },
  ];

/**
 * The actual option text shown to participants, so the distribution chart
 * reproduces exactly what each A/B/C/D said (what the instructor asked to see),
 * not a paraphrase. Transcribed from lib/tests/definitions.ts. Q2.4 and Q3.1
 * are identical across forms; Q2.1's formula constant differs (200−10p on the
 * pretest, 120−2p on the posttest), noted on the item.
 */
const MC_OPTION_TEXT: Record<string, Record<string, string>> = {
  "2.1": {
    A: "R(p) = p + (200 − 10p)",
    B: "R(p) = 200 − 10p",
    C: "R(p) = p(200 − 10p)",
  },
  "2.4": {
    A: "A price above $20 would make the model predict a negative number of lunch boxes sold.",
    B: "The company’s revenue must always be between $0 and $20.",
    C: "The derivative of the revenue function can only be calculated for prices between $0 and $20, because outside that interval the revenue formula no longer applies and its slope cannot be found.",
  },
  "3.1": {
    A: "Accept the AI’s recommendation and use 25 chairs as the final answer.",
    B: "Ask the AI to explain its calculations in more detail before deciding.",
    C: "Question the AI’s recommendation before accepting it.",
    D: "Start the problem over and solve it independently without the AI.",
  },
};

/** Items whose wording differs by form, shown as a caption under the question. */
const MC_FORM_NOTE: Record<string, string> = {
  "2.1": "Posttest form uses R(p) = p(120 − 2p); structure is identical.",
};

const ITEM_ANALYSIS_LABELS: [string, string][] = [
  ["1", "Q1a optimization (show work)"],
  ["2.1", "Q2.1 revenue model (choice + explanation)"],
  ["2.2", "Q2.2 explain concept (show work)"],
  ["2.3", "Q2.3 matching"],
  ["2.4", "Q2.4 interpret domain (MC)"],
  ["3.1", "Q3.1 question the AI (MC)"],
  ["3.2", "Q3.2 rebut the AI (show work)"],
];

/**
 * The four short numeric Q1 items (1b–1e). Graded right/wrong by numeric match
 * (lib/pilot/tests.ts), so they live on each row's `q1`, NOT in the rubric
 * grades — they must be folded into the item analyses separately. Topic is the
 * same across forms; only the within-range / on-the-edge variant swaps.
 */
const NUMERIC_Q1_LABELS: [string, string][] = [
  ["1b", "Q1b particle motion (numeric)"],
  ["1c", "Q1c profit (numeric)"],
  ["1d", "Q1d fencing (numeric)"],
  ["1e", "Q1e rectangle (numeric)"],
];

/**
 * AI rubric grades (gradeTest + answer key, LiteLLM/claude-sonnet) computed
 * 2026-10-06 and hard-coded so the view shows them without a live model call.
 * Any newer grades from /api/pilot-grade override these by subject.
 */
const STATIC_GRADES: Record<string, GradeInfo> = {
  "58adfc6e7cf56d0001f931a2": {"total":4,"max":22,"complete":true,"items":{"1":{"points":0,"max":5,"kind":"open","criteria":{"model":"not_met","one-variable":"not_met","derivative":"not_met","extremum":"not_met","quantities":"not_met"}},"2.1":{"points":0,"max":3,"kind":"open","criteria":{"chose-c":"not_met","uses-examples":"not_met","price-times-quantity":"not_met"}},"2.2":{"points":1,"max":5,"kind":"open","criteria":{"derivative":"met","critical-point":"not_met","definition":"not_met","candidate-only":"not_met","verify":"not_met"}},"2.3":{"points":2,"max":4,"kind":"matching"},"2.4":{"points":1,"max":1,"kind":"choice"},"3.1":{"points":0,"max":1,"kind":"choice"},"3.2":{"points":0,"max":3,"kind":"open","criteria":{"names-constraint":"not_met","identifies-conflict":"not_met","prompts-revision":"not_met"}}}},
  "697cd118af4b9f1235c8a580": {"total":0,"max":22,"complete":true,"items":{"1":{"points":0,"max":5,"kind":"open","criteria":{"model":"not_met","one-variable":"not_met","derivative":"not_met","extremum":"not_met","quantities":"not_met"}},"2.1":{"points":0,"max":3,"kind":"open","criteria":{"chose-c":"not_met","uses-examples":"not_met","price-times-quantity":"not_met"}},"2.2":{"points":0,"max":5,"kind":"open","criteria":{"derivative":"not_met","critical-point":"not_met","definition":"not_met","candidate-only":"not_met","verify":"not_met"}},"2.3":{"points":0,"max":4,"kind":"matching"},"2.4":{"points":0,"max":1,"kind":"choice"},"3.1":{"points":0,"max":1,"kind":"choice"},"3.2":{"points":0,"max":3,"kind":"open","criteria":{"names-constraint":"not_met","identifies-conflict":"not_met","prompts-revision":"not_met"}}}},
  "698ce4ba931f89581ecc6d7d": {"total":12,"max":22,"complete":true,"items":{"1":{"points":4,"max":5,"kind":"open","criteria":{"model":"met","one-variable":"met","derivative":"met","extremum":"not_met","quantities":"met"}},"2.1":{"points":2,"max":3,"kind":"open","criteria":{"chose-c":"met","uses-examples":"not_met","price-times-quantity":"met"}},"2.2":{"points":3,"max":5,"kind":"open","criteria":{"derivative":"met","critical-point":"met","definition":"met","candidate-only":"not_met","verify":"not_met"}},"2.3":{"points":1,"max":4,"kind":"matching"},"2.4":{"points":1,"max":1,"kind":"choice"},"3.1":{"points":1,"max":1,"kind":"choice"},"3.2":{"points":0,"max":3,"kind":"open","criteria":{"names-constraint":"not_met","identifies-conflict":"not_met","prompts-revision":"not_met"}}}},
  "699f99838bc35ad313ab9f51": {"total":0,"max":22,"complete":true,"items":{"1":{"points":0,"max":5,"kind":"open","criteria":{"model":"not_met","one-variable":"not_met","derivative":"not_met","extremum":"not_met","quantities":"not_met"}},"2.1":{"points":0,"max":3,"kind":"open","criteria":{"chose-c":"not_met","uses-examples":"not_met","price-times-quantity":"not_met"}},"2.2":{"points":0,"max":5,"kind":"open","criteria":{"derivative":"not_met","critical-point":"not_met","definition":"not_met","candidate-only":"not_met","verify":"not_met"}},"2.3":{"points":0,"max":4,"kind":"matching"},"2.4":{"points":0,"max":1,"kind":"choice"},"3.1":{"points":0,"max":1,"kind":"choice"},"3.2":{"points":0,"max":3,"kind":"open","criteria":{"names-constraint":"not_met","identifies-conflict":"not_met","prompts-revision":"not_met"}}}},
  "69dae6f92db929c858644edc": {"total":2,"max":22,"complete":true,"items":{"1":{"points":0,"max":5,"kind":"open","criteria":{"model":"not_met","one-variable":"not_met","derivative":"not_met","extremum":"not_met","quantities":"not_met"}},"2.1":{"points":0,"max":3,"kind":"open","criteria":{"chose-c":"not_met","uses-examples":"not_met","price-times-quantity":"not_met"}},"2.2":{"points":0,"max":5,"kind":"open","criteria":{"derivative":"not_met","critical-point":"not_met","definition":"not_met","candidate-only":"not_met","verify":"not_met"}},"2.3":{"points":1,"max":4,"kind":"matching"},"2.4":{"points":1,"max":1,"kind":"choice"},"3.1":{"points":0,"max":1,"kind":"choice"},"3.2":{"points":0,"max":3,"kind":"open","criteria":{"names-constraint":"not_met","identifies-conflict":"not_met","prompts-revision":"not_met"}}}},
  "69fb90ec1ec66537d620e491": {"total":17,"max":22,"complete":true,"items":{"1":{"points":2,"max":5,"kind":"open","criteria":{"model":"met","one-variable":"met","derivative":"not_met","extremum":"not_met","quantities":"not_met"}},"2.1":{"points":3,"max":3,"kind":"open","criteria":{"chose-c":"met","uses-examples":"met","price-times-quantity":"met"}},"2.2":{"points":3,"max":5,"kind":"open","criteria":{"derivative":"met","critical-point":"met","definition":"met","candidate-only":"not_met","verify":"not_met"}},"2.3":{"points":4,"max":4,"kind":"matching"},"2.4":{"points":1,"max":1,"kind":"choice"},"3.1":{"points":1,"max":1,"kind":"choice"},"3.2":{"points":3,"max":3,"kind":"open","criteria":{"names-constraint":"met","identifies-conflict":"met","prompts-revision":"met"}}}},
  "6a178e2e2b82ec7429f2353c": {"total":16,"max":22,"complete":true,"items":{"1":{"points":5,"max":5,"kind":"open","criteria":{"model":"met","one-variable":"met","derivative":"met","extremum":"met","quantities":"met"}},"2.1":{"points":3,"max":3,"kind":"open","criteria":{"chose-c":"met","uses-examples":"met","price-times-quantity":"met"}},"2.2":{"points":2,"max":5,"kind":"open","criteria":{"derivative":"met","critical-point":"met","definition":"not_met","candidate-only":"not_met","verify":"not_met"}},"2.3":{"points":1,"max":4,"kind":"matching"},"2.4":{"points":1,"max":1,"kind":"choice"},"3.1":{"points":1,"max":1,"kind":"choice"},"3.2":{"points":3,"max":3,"kind":"open","criteria":{"names-constraint":"met","identifies-conflict":"met","prompts-revision":"met"}}}},
  "6a1c4ff5565b7f7ae832d10e": {"total":12,"max":22,"complete":true,"items":{"1":{"points":2,"max":5,"kind":"open","criteria":{"model":"met","one-variable":"met","derivative":"not_met","extremum":"not_met","quantities":"not_met"}},"2.1":{"points":2,"max":3,"kind":"open","criteria":{"chose-c":"met","uses-examples":"not_met","price-times-quantity":"met"}},"2.2":{"points":2,"max":5,"kind":"open","criteria":{"derivative":"met","critical-point":"met","definition":"not_met","candidate-only":"not_met","verify":"not_met"}},"2.3":{"points":2,"max":4,"kind":"matching"},"2.4":{"points":1,"max":1,"kind":"choice"},"3.1":{"points":0,"max":1,"kind":"choice"},"3.2":{"points":3,"max":3,"kind":"open","criteria":{"names-constraint":"met","identifies-conflict":"met","prompts-revision":"met"}}}},
  "6a9f047c09a7a822e7058fb8": {"total":16,"max":22,"complete":true,"items":{"1":{"points":1,"max":5,"kind":"open","criteria":{"model":"not_met","one-variable":"not_met","derivative":"not_met","extremum":"not_met","quantities":"met"}},"2.1":{"points":3,"max":3,"kind":"open","criteria":{"chose-c":"met","uses-examples":"met","price-times-quantity":"met"}},"2.2":{"points":3,"max":5,"kind":"open","criteria":{"derivative":"met","critical-point":"met","definition":"not_met","candidate-only":"not_met","verify":"met"}},"2.3":{"points":4,"max":4,"kind":"matching"},"2.4":{"points":1,"max":1,"kind":"choice"},"3.1":{"points":1,"max":1,"kind":"choice"},"3.2":{"points":3,"max":3,"kind":"open","criteria":{"names-constraint":"met","identifies-conflict":"met","prompts-revision":"met"}}}},
  "6aaf04a43b9d955ca2188eb7": {"total":18,"max":22,"complete":true,"items":{"1":{"points":5,"max":5,"kind":"open","criteria":{"model":"met","one-variable":"met","derivative":"met","extremum":"met","quantities":"met"}},"2.1":{"points":2,"max":3,"kind":"open","criteria":{"chose-c":"met","uses-examples":"not_met","price-times-quantity":"met"}},"2.2":{"points":4,"max":5,"kind":"open","criteria":{"derivative":"met","critical-point":"met","definition":"met","candidate-only":"not_met","verify":"met"}},"2.3":{"points":2,"max":4,"kind":"matching"},"2.4":{"points":1,"max":1,"kind":"choice"},"3.1":{"points":1,"max":1,"kind":"choice"},"3.2":{"points":3,"max":3,"kind":"open","criteria":{"names-constraint":"met","identifies-conflict":"met","prompts-revision":"met"}}}},
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

/**
 * Q2.1 is one test question but two graded parts: the multiple-choice pick
 * (1 pt) and the written explanation (2 pts). Showing them on separate lines,
 * each with its own sub-score, keeps a wrong choice from looking like a failed
 * explanation (and vice versa) — the two are judged independently.
 */
function Q21Breakdown({ verdicts }: { verdicts: Record<string, string> }) {
  const choice = verdicts["chose-c"] === "met" ? 1 : 0;
  const expl =
    (verdicts["uses-examples"] === "met" ? 1 : 0) +
    (verdicts["price-times-quantity"] === "met" ? 1 : 0);
  return (
    <>
      <div>
        <span className="font-semibold text-stone-500">Choice {choice}/1:</span>{" "}
        <Tick ok={verdicts["chose-c"] === "met"} /> chose C
      </div>
      <div>
        <span className="font-semibold text-stone-500">
          Explanation {expl}/2:
        </span>{" "}
        <Tick ok={verdicts["uses-examples"] === "met"} /> uses the table&apos;s
        numbers <Tick ok={verdicts["price-times-quantity"] === "met"} /> revenue =
        price × quantity
      </div>
    </>
  );
}

/** A labelled horizontal bar for the distribution charts. */
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
      <span className="w-24 shrink-0 truncate text-right text-stone-500">
        {label}
      </span>
      <div className="h-3 flex-1 rounded bg-stone-100">
        <div
          className={`h-3 rounded ${color}`}
          style={{ width: `${max ? Math.min(100, (count / max) * 100) : 0}%` }}
        />
      </div>
      <span className="w-14 shrink-0 text-stone-600">{suffix ?? count}</span>
    </div>
  );
}

/** The real study's screen-out rule (lib/surveys/eligibility.ts), applied here. */
// Matches the rule as these pilot participants were actually run. The
// "Other college-level mathematics" re-add (screening-readd-other) is for
// future participants only, so it is deliberately NOT applied to this data.
const INELIGIBLE: Record<string, string[]> = {
  highest_math: ["Calculus II", "Calculus III or higher"],
  calculus_courses: ["3 or more"],
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
              <th className="py-1 font-semibold">Rubric score</th>
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
                    <td className="py-1 text-stone-600">
                      {grade?.items?.[id] && grade.items[id].points != null ? (
                        <>
                          <span className="whitespace-nowrap font-semibold">
                            {grade.items[id].points}/{grade.items[id].max}
                          </span>
                          {grade.items[id].kind !== "open" && (
                            <span className="text-[10px] text-stone-400">
                              {" "}
                              (key)
                            </span>
                          )}
                          {grade.items[id].criteria &&
                            CRIT_LABELS[id] && (
                              <div className="mt-0.5 space-y-0.5 text-[10px] leading-tight text-stone-500">
                                {id === "2.1" ? (
                                  <Q21Breakdown
                                    verdicts={grade.items[id].criteria ?? {}}
                                  />
                                ) : (
                                  CRIT_LABELS[id].map(([cid, clabel]) => (
                                    <div key={cid}>
                                      <Tick
                                        ok={
                                          grade.items[id].criteria?.[cid] ===
                                          "met"
                                        }
                                      />{" "}
                                      {clabel}
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                        </>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
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
  // Shared toggle for the analysis + by-question sections.
  const [analysisEligibleOnly, setAnalysisEligibleOnly] = useState(false);
  const [ai, setAi] = useState<{ analysis: string; model: string | null } | null>(
    null
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [grades, setGrades] = useState<Record<string, GradeInfo>>(STATIC_GRADES);

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
            if (g.ok && g.scores)
              setGrades({
                ...STATIC_GRADES,
                ...(g.scores as Record<string, GradeInfo>),
              });
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

  const downloadAnalysisCsv = () => {
    if (!analysis) return;
    const q = (x: unknown) => `"${String(x ?? "").replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push("ITEM-LEVEL (mean % of max; higher = did better)");
    lines.push(
      ["item", "label", "max", "mean_points", "pct_of_max", "score_distribution", "median_seconds"]
        .map(q)
        .join(",")
    );
    for (const it of analysis.items)
      lines.push(
        [
          it.id,
          it.label,
          it.max,
          it.meanPts.toFixed(2),
          `${it.pct}%`,
          it.dist.filter((d) => d.count > 0).map((d) => `${d.points}pt x${d.count}`).join(" "),
          it.medianSec ?? "",
        ]
          .map(q)
          .join(",")
      );
    lines.push("");
    lines.push("CRITERION-LEVEL (show-work items; % of participants who met each rubric point)");
    lines.push(["item", "rubric_criterion", "met", "n", "pct_met"].map(q).join(","));
    for (const c of analysis.crit)
      lines.push(
        [c.item, c.clabel, c.met, c.n, `${c.pct}%`].map(q).join(",")
      );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pilot-answer-key-analysis.csv";
    a.click();
    URL.revokeObjectURL(url);
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

  // Answer-key analysis against the AI rubric grades: per-item mean % of max,
  // and per-criterion % met on the show-work items. Computed over all completed
  // participants shown (preview/test runs already excluded by `view`).
  const analysis = useMemo(() => {
    if (!view) return null;
    const subs = view.completed.filter(
      (r) => !analysisEligibleOnly || !screenOut(r).out
    );
    const pctOf = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

    const itemSecsOf = (id: string) =>
      subs
        .map((r) => r.item_timings?.[id]?.seconds)
        .filter((s): s is number => s != null);

    // Rubric items (from the AI grades) and the four numeric Q1 items (0/1, from
    // each row's `q1`) are built the same shape so the charts treat Q1b–Q1e like
    // any other question.
    const rubricItems = ITEM_ANALYSIS_LABELS.map(([id, label]) => {
      const vals = subs
        .map((r) => grades[r.subject]?.items?.[id])
        .filter((x): x is NonNullable<typeof x> => Boolean(x));
      const max = vals[0]?.max ?? 0;
      const meanPts = vals.length
        ? vals.reduce((a, i) => a + (i.points ?? 0), 0) / vals.length
        : 0;
      // Score distribution: count at each point value 0..max.
      const dist = Array.from({ length: max + 1 }, (_, p) => ({
        points: p,
        count: vals.filter((i) => (i.points ?? -1) === p).length,
      }));
      const itemSecs = itemSecsOf(id);
      return {
        id,
        label,
        max,
        meanPts,
        pct: pctOf(meanPts, max),
        n: vals.length,
        dist,
        medianSec: median(itemSecs),
        minSec: itemSecs.length ? Math.min(...itemSecs) : null,
        maxSec: itemSecs.length ? Math.max(...itemSecs) : null,
      };
    });

    const numericItems = NUMERIC_Q1_LABELS.map(([id, label]) => {
      const vals = subs
        .map((r) => r.q1?.[id])
        .filter((x): x is Q1Item => Boolean(x));
      const correct = vals.filter((v) => v.correct).length;
      const meanPts = vals.length ? correct / vals.length : 0; // max is 1
      const dist = [0, 1].map((p) => ({
        points: p,
        count: vals.filter((v) => (v.correct ? 1 : 0) === p).length,
      }));
      const itemSecs = itemSecsOf(id);
      return {
        id,
        label,
        max: 1,
        meanPts,
        pct: pctOf(correct, vals.length),
        n: vals.length,
        dist,
        medianSec: median(itemSecs),
        minSec: itemSecs.length ? Math.min(...itemSecs) : null,
        maxSec: itemSecs.length ? Math.max(...itemSecs) : null,
      };
    });

    const items = [...rubricItems, ...numericItems].sort(
      (a, b) => b.pct - a.pct
    );

    const crit = CRIT_SPECS.flatMap((spec) =>
      spec.crits.map(([cid, clabel]) => {
        const verdicts = subs
          .map((r) => grades[r.subject]?.items?.[spec.item]?.criteria?.[cid])
          .filter((v): v is string => Boolean(v));
        const met = verdicts.filter((v) => v === "met").length;
        return {
          item: spec.label,
          clabel,
          met,
          n: verdicts.length,
          pct: pctOf(met, verdicts.length),
        };
      })
    );

    // Overall test-total distribution (bucketed on the /max scale).
    const totals = subs
      .map((r) => grades[r.subject]?.total)
      .filter((t): t is number => t != null);
    const totalMax =
      subs.map((r) => grades[r.subject]?.max).find((m) => m != null) ?? 22;
    const step = Math.max(1, Math.ceil((totalMax + 1) / 6));
    const totalDist: { label: string; count: number }[] = [];
    for (let lo = 0; lo <= totalMax; lo += step) {
      const hi = Math.min(lo + step - 1, totalMax);
      totalDist.push({
        label: lo === hi ? `${lo}` : `${lo}–${hi}`,
        count: totals.filter((t) => t >= lo && t <= hi).length,
      });
    }

    // Option (distractor) distribution for the MC items.
    const optionDist = MC_ITEMS.map((spec) => {
      const counts: Record<string, number> = {};
      for (const r of subs) {
        const c = r.test_answers?.[spec.item]?.choiceId;
        if (c) counts[c] = (counts[c] ?? 0) + 1;
      }
      const options = spec.options.map((id) => ({
        id,
        count: counts[id] ?? 0,
        isCorrect: id === spec.correct,
      }));
      const maxWrong = Math.max(
        0,
        ...options.filter((o) => !o.isCorrect).map((o) => o.count)
      );
      return {
        item: spec.item,
        label: spec.label,
        correct: spec.correct,
        options,
        mainDistractor:
          maxWrong > 0
            ? options.find((o) => !o.isCorrect && o.count === maxWrong)?.id ??
              null
            : null,
      };
    });

    // Item discrimination: mean TEST TOTAL of those who got the item (>= half
    // its max) vs those who did not. A positive gap = the item separates
    // stronger from weaker students.
    const totalOf = (r: Row) => grades[r.subject]?.total ?? null;
    const meanTotal = (list: Row[]) => {
      const v = list.map(totalOf).filter((t): t is number => t != null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const discrimRow = (
      id: string,
      label: string,
      got: Row[],
      notGot: Row[]
    ) => {
      const mg = meanTotal(got);
      const mn = meanTotal(notGot);
      return {
        id,
        label,
        meanGot: mg,
        meanNot: mn,
        nGot: got.length,
        nNot: notGot.length,
        gap: mg != null && mn != null ? mg - mn : null,
      };
    };
    const rubricDiscrim = ITEM_ANALYSIS_LABELS.map(([id, label]) => {
      const withItem = subs.filter((r) => grades[r.subject]?.items?.[id]);
      const max = grades[withItem[0]?.subject]?.items?.[id]?.max ?? 0;
      return discrimRow(
        id,
        label,
        withItem.filter((r) => (grades[r.subject].items[id].points ?? 0) >= max / 2),
        withItem.filter((r) => (grades[r.subject].items[id].points ?? 0) < max / 2)
      );
    });
    // Numeric Q1 items split strong/weak against the SAME rubric total (which
    // excludes them), so the gap is a genuine discrimination, not part-whole.
    const numericDiscrim = NUMERIC_Q1_LABELS.map(([id, label]) => {
      const withItem = subs.filter((r) => r.q1?.[id]);
      return discrimRow(
        id,
        label,
        withItem.filter((r) => r.q1[id].correct),
        withItem.filter((r) => !r.q1[id].correct)
      );
    });
    const discrimination = [...rubricDiscrim, ...numericDiscrim].sort(
      (a, b) => (b.gap ?? -99) - (a.gap ?? -99)
    );

    // Screen-out reasons across the shown participants.
    const reasonCounts: Record<string, number> = {};
    for (const r of subs)
      for (const reason of screenOut(r).reasons)
        reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    const screenReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
    const eligibleCount = subs.filter((r) => !screenOut(r).out).length;

    return {
      items,
      crit,
      n: subs.length,
      totalMax,
      totalDist,
      optionDist,
      discrimination,
      screenReasons,
      eligibleCount,
    };
  }, [view, grades, analysisEligibleOnly]);

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
                  AI overall results check — screening & pretest review
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
                    <th className="py-1 pr-3 font-semibold">New Q1</th>
                    <th className="py-1 pr-3 font-semibold">Rubric /20</th>
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
                        <td className="py-1 pr-3 text-stone-800">
                          {grades[r.subject]
                            ? `${grades[r.subject].total}/${grades[r.subject].max}`
                            : "—"}
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

            {analysis && (
              <div className="overflow-x-auto rounded-xl border-2 border-stone-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-stone-800">
                    Answer-key analysis (AI rubric)
                  </h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-stone-600">
                      <input
                        type="checkbox"
                        checked={analysisEligibleOnly}
                        onChange={(e) =>
                          setAnalysisEligibleOnly(e.target.checked)
                        }
                        className="h-4 w-4 accent-lime-600"
                      />
                      Only not-screened-out
                    </label>
                    <Button onClick={downloadAnalysisCsv}>
                      Download analysis (CSV)
                    </Button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-stone-400">
                  Across {analysis.n} {analysisEligibleOnly ? "eligible" : "completed"}{" "}
                  participant{analysis.n === 1 ? "" : "s"}. Higher = students did
                  better against the answer-key rubric.
                </p>

                <h3 className="mt-3 text-sm font-bold text-stone-700">
                  By question — mean % of max (best first)
                </h3>
                <table className="mt-1 w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs text-stone-400">
                      <th className="py-1 pr-3 font-semibold">Question</th>
                      <th className="py-1 pr-3 font-semibold">Mean</th>
                      <th className="py-1 pr-3 font-semibold">% of max</th>
                      <th className="py-1 pr-3 font-semibold">
                        Score distribution
                      </th>
                      <th className="py-1 font-semibold">Median time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.items.map((it) => (
                      <tr key={it.id} className="border-t border-stone-100">
                        <td className="py-1 pr-3 text-stone-700">{it.label}</td>
                        <td className="py-1 pr-3 text-stone-600">
                          {it.meanPts.toFixed(2)}/{it.max}
                        </td>
                        <td className="py-1 pr-3 font-semibold text-stone-800">
                          {it.pct}%
                        </td>
                        <td className="py-1 pr-3 text-xs text-stone-500">
                          {it.dist
                            .filter((d) => d.count > 0)
                            .map((d) => `${d.points}pt×${d.count}`)
                            .join("  ")}
                        </td>
                        <td className="py-1 whitespace-nowrap text-stone-500">
                          {fmtSec(it.medianSec)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* ---- Conclusions: item difficulty / discrimination ---- */}
                <h3 className="mt-5 text-sm font-bold text-stone-700">
                  Conclusions — which items are too easy / too hard
                </h3>
                <p className="mt-1 text-xs text-stone-400">
                  Difficulty = mean % of max. Discrimination = test-total gap
                  between those who got the item and those who didn&apos;t
                  (bigger = separates strong from weak better). Small sample
                  ({analysis.n}) — read as signal, not proof.
                </p>
                <table className="mt-1 w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs text-stone-400">
                      <th className="py-1 pr-3 font-semibold">Question</th>
                      <th className="py-1 pr-3 font-semibold">% of max</th>
                      <th className="py-1 pr-3 font-semibold">Discrim.</th>
                      <th className="py-1 font-semibold">Read</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.items.map((it) => {
                      const d = analysis.discrimination.find(
                        (x) => x.id === it.id
                      );
                      const gap = d?.gap ?? null;
                      const verdict =
                        it.pct >= 75
                          ? { t: "Too easy — near ceiling", c: "text-amber-600" }
                          : gap != null && gap < 2
                            ? { t: "Weak discriminator", c: "text-amber-600" }
                            : it.pct <= 30
                              ? { t: "Hard — floor-leaning", c: "text-stone-600" }
                              : { t: "Good spread", c: "text-lime-700" };
                      return (
                        <tr key={it.id} className="border-t border-stone-100">
                          <td className="py-1 pr-3 text-stone-700">
                            {it.label}
                          </td>
                          <td className="py-1 pr-3 font-semibold text-stone-800">
                            {it.pct}%
                          </td>
                          <td className="py-1 pr-3 text-stone-500">
                            {gap == null ? "—" : `+${gap.toFixed(1)}`}
                          </td>
                          <td className={`py-1 font-medium ${verdict.c}`}>
                            {verdict.t}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-1 text-xs text-stone-400">
                  Takeaway: the pretest mostly captures what we want — the
                  show-your-work items separate strong from weak. Watch the
                  near-ceiling MC (Q2.4) and the single guessable MC (Q3.1) as
                  candidates to harden.
                </p>

                {/* ---- Score distribution ---- */}
                <h3 className="mt-5 text-sm font-bold text-stone-700">
                  Score distribution
                </h3>
                <p className="mt-1 text-xs font-semibold text-stone-500">
                  Overall test (/{analysis.totalMax}) — participants per band
                </p>
                <div className="mt-1 space-y-1">
                  {(() => {
                    const mc = Math.max(
                      1,
                      ...analysis.totalDist.map((b) => b.count)
                    );
                    return analysis.totalDist.map((b) => (
                      <BarRow
                        key={b.label}
                        label={b.label}
                        count={b.count}
                        max={mc}
                        highlight="good"
                      />
                    ));
                  })()}
                </div>
                <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {analysis.items.map((it) => {
                    const mc = Math.max(1, ...it.dist.map((d) => d.count));
                    return (
                      <div key={it.id}>
                        <p className="text-[11px] font-semibold text-stone-500">
                          {it.label} (/{it.max})
                        </p>
                        <div className="mt-0.5 space-y-0.5">
                          {it.dist.map((d) => (
                            <BarRow
                              key={d.points}
                              label={`${d.points} pt`}
                              count={d.count}
                              max={mc}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ---- Option / distractor distribution ---- */}
                <h3 className="mt-5 text-sm font-bold text-stone-700">
                  Option distribution (multiple choice)
                </h3>
                <p className="mt-1 text-xs text-stone-400">
                  ✓ = correct option; the most-chosen wrong option is the main
                  distractor.
                </p>
                <div className="mt-1 space-y-4">
                  {analysis.optionDist.map((q) => {
                    const mc = Math.max(1, ...q.options.map((o) => o.count));
                    return (
                      <div key={q.item}>
                        <p className="text-[11px] font-semibold text-stone-500">
                          {q.label} (correct {q.correct})
                        </p>
                        {MC_FORM_NOTE[q.item] && (
                          <p className="text-[10px] text-stone-400">
                            {MC_FORM_NOTE[q.item]}
                          </p>
                        )}
                        <div className="mt-0.5 space-y-0.5">
                          {q.options.map((o) => {
                            const color = o.isCorrect
                              ? "bg-lime-500"
                              : o.id === q.mainDistractor
                                ? "bg-amber-500"
                                : "bg-stone-400";
                            const mark = o.isCorrect
                              ? " ✓"
                              : o.id === q.mainDistractor
                                ? " ◆"
                                : "";
                            return (
                              <div
                                key={o.id}
                                className="flex items-start gap-2 text-xs"
                              >
                                <span className="w-8 shrink-0 pt-0.5 text-right font-medium text-stone-600">
                                  {o.id}
                                  {mark}
                                </span>
                                <div className="mt-0.5 h-3 w-28 shrink-0 rounded bg-stone-100">
                                  <div
                                    className={`h-3 rounded ${color}`}
                                    style={{
                                      width: `${mc ? Math.min(100, (o.count / mc) * 100) : 0}%`,
                                    }}
                                  />
                                </div>
                                <span className="w-6 shrink-0 pt-0.5 text-stone-600">
                                  {o.count}
                                </span>
                                <span className="flex-1 pt-0.5 text-stone-500">
                                  {MC_OPTION_TEXT[q.item]?.[o.id] ?? ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ---- Item discrimination ---- */}
                <h3 className="mt-5 text-sm font-bold text-stone-700">
                  Item discrimination
                </h3>
                <p className="mt-1 text-xs text-stone-400">
                  Mean test total of those who got the item (≥ half marks) minus
                  those who didn&apos;t. A bigger positive gap = the item better
                  separates strong from weak students.
                </p>
                <div className="mt-1 space-y-1">
                  {analysis.discrimination.map((d) => (
                    <BarRow
                      key={d.id}
                      label={d.label.replace(/ \(.*\)/, "")}
                      count={Math.max(0, d.gap ?? 0)}
                      max={analysis.totalMax}
                      highlight={(d.gap ?? 0) > 0 ? "good" : "warn"}
                      suffix={
                        d.gap == null
                          ? "—"
                          : `+${d.gap.toFixed(1)} (${d.meanGot?.toFixed(0) ?? "–"} vs ${d.meanNot?.toFixed(0) ?? "–"})`
                      }
                    />
                  ))}
                </div>

                {/* ---- Time per question ---- */}
                <h3 className="mt-5 text-sm font-bold text-stone-700">
                  Time per question (spread)
                </h3>
                <p className="mt-1 text-xs text-stone-400">
                  Each bar spans the fastest to slowest completer; the dot marks
                  the median. Longer bars = more spread in how long people took.
                </p>
                <div className="mt-2 space-y-1.5">
                  {(() => {
                    const gmax = Math.max(
                      1,
                      ...analysis.items.map((it) => it.maxSec ?? 0)
                    );
                    return [...analysis.items]
                      .sort((a, b) => (b.medianSec ?? 0) - (a.medianSec ?? 0))
                      .map((it) => {
                        const lo = it.minSec ?? 0;
                        const hi = it.maxSec ?? 0;
                        const med = it.medianSec ?? lo;
                        return (
                          <div
                            key={it.id}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span className="w-24 shrink-0 truncate text-right text-stone-500">
                              {it.label.replace(/ \(.*\)/, "")}
                            </span>
                            <div className="relative h-3 flex-1 rounded bg-stone-100">
                              <div
                                className="absolute h-3 rounded bg-sky-200"
                                style={{
                                  left: `${(lo / gmax) * 100}%`,
                                  width: `${((hi - lo) / gmax) * 100}%`,
                                }}
                              />
                              <div
                                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-600"
                                style={{ left: `${(med / gmax) * 100}%` }}
                                title={`median ${fmtSec(med)}`}
                              />
                            </div>
                            <span className="w-28 shrink-0 text-stone-500">
                              {fmtSec(it.minSec)}–{fmtSec(it.maxSec)}
                            </span>
                          </div>
                        );
                      });
                  })()}
                </div>
                <table className="mt-3 w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs text-stone-400">
                      <th className="py-1 pr-3 font-semibold">Question</th>
                      <th className="py-1 pr-3 font-semibold">Min</th>
                      <th className="py-1 pr-3 font-semibold">Median</th>
                      <th className="py-1 font-semibold">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...analysis.items]
                      .sort((a, b) => (b.medianSec ?? 0) - (a.medianSec ?? 0))
                      .map((it) => (
                        <tr key={it.id} className="border-t border-stone-100">
                          <td className="py-1 pr-3 text-stone-700">
                            {it.label}
                          </td>
                          <td className="py-1 pr-3 text-stone-500">
                            {fmtSec(it.minSec)}
                          </td>
                          <td className="py-1 pr-3 font-semibold text-stone-800">
                            {fmtSec(it.medianSec)}
                          </td>
                          <td className="py-1 text-stone-500">
                            {fmtSec(it.maxSec)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                {/* ---- Screen-out reasons ---- */}
                {analysis.screenReasons.length > 0 && (
                  <>
                    <h3 className="mt-5 text-sm font-bold text-stone-700">
                      Screen-out reasons
                    </h3>
                    <p className="mt-1 text-xs text-stone-400">
                      How many of the {analysis.n} completers each rule would
                      exclude ({analysis.eligibleCount} would be kept).
                    </p>
                    <div className="mt-1 space-y-1">
                      {(() => {
                        const mc = Math.max(
                          1,
                          ...analysis.screenReasons.map((s) => s.count)
                        );
                        return analysis.screenReasons.map((s) => (
                          <BarRow
                            key={s.reason}
                            label={s.reason}
                            count={s.count}
                            max={mc}
                            highlight="warn"
                          />
                        ));
                      })()}
                    </div>
                  </>
                )}

                <h3 className="mt-5 text-sm font-bold text-stone-700">
                  Rubric distribution — % who met each criterion
                </h3>
                <table className="mt-1 w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs text-stone-400">
                      <th className="py-1 pr-3 font-semibold">Item</th>
                      <th className="py-1 pr-3 font-semibold">Rubric criterion</th>
                      <th className="py-1 font-semibold">% met</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.crit.map((c, i) => (
                      <tr key={i} className="border-t border-stone-100">
                        <td className="py-1 pr-3 text-stone-500">{c.item}</td>
                        <td className="py-1 pr-3 text-stone-700">{c.clabel}</td>
                        <td className="py-1 font-semibold text-stone-800">
                          {c.pct}%{" "}
                          <span className="text-xs font-normal text-stone-400">
                            ({c.met}/{c.n})
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="rounded-xl border-2 border-stone-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-stone-800">
                  By question — all responses
                </h2>
                <label className="flex items-center gap-2 text-xs text-stone-600">
                  <input
                    type="checkbox"
                    checked={analysisEligibleOnly}
                    onChange={(e) => setAnalysisEligibleOnly(e.target.checked)}
                    className="h-4 w-4 accent-lime-600"
                  />
                  Only not-screened-out
                </label>
              </div>
              <p className="mt-1 text-xs text-stone-400">
                Every completed participant&apos;s answer to one question, with
                its score and time. Click a question to expand.
              </p>
              {ALL_ITEMS.map((id) => {
                const answered = view.completed.filter(
                  (r) =>
                    (!analysisEligibleOnly || !screenOut(r).out) &&
                    (r.test_answers?.[id] || r.q1?.[id])
                );
                if (!answered.length) return null;
                return (
                  <details
                    key={id}
                    className="mt-2 rounded-lg border border-stone-200"
                  >
                    <summary className="cursor-pointer p-2 text-sm font-semibold text-stone-700">
                      {ITEM_LABELS[id] ?? id}{" "}
                      <span className="font-normal text-stone-400">
                        ({answered.length})
                      </span>
                    </summary>
                    <div className="space-y-2 p-3 pt-0">
                      {answered.map((r) => {
                        const g = grades[r.subject]?.items?.[id];
                        const q1g = r.q1?.[id];
                        return (
                          <div
                            key={r.subject}
                            className="rounded bg-stone-50 p-2 text-sm"
                          >
                            <div className="flex flex-wrap justify-between gap-2 text-xs text-stone-500">
                              <span className="font-mono">
                                {shortId(r)} ({r.form})
                              </span>
                              <span>
                                {g
                                  ? `${g.points}/${g.max}`
                                  : q1g
                                    ? q1g.correct
                                      ? "correct"
                                      : `wrong (exp ${q1g.expected})`
                                    : "—"}
                                {" · "}
                                {fmtSec(r.item_timings?.[id]?.seconds)}
                              </span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-stone-800">
                              {renderAnswer(r.test_answers?.[id])}
                            </p>
                            {g?.criteria && CRIT_LABELS[id] && (
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-stone-500">
                                {id === "2.1" ? (
                                  <Q21Breakdown verdicts={g.criteria ?? {}} />
                                ) : (
                                  CRIT_LABELS[id].map(([cid, clabel]) => (
                                    <span key={cid}>
                                      <Tick ok={g.criteria?.[cid] === "met"} />{" "}
                                      {clabel}
                                    </span>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
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
