import type { LogDoc } from "./report";
import { minutesPerPhase, type Phase } from "./export";
import { getSurvey } from "@/lib/surveys/definitions";
import type { SurveyItem } from "@/lib/surveys/types";

/**
 * Step-by-step analysis of the whole study flow — screening, pre-survey,
 * pre-test, instruction, post-test, post-survey — for the participants who
 * finished the entire flow (reached and submitted the post-survey).
 *
 * The pre/post TESTS are analysed in insights.ts (graded items). This covers
 * every *other* step: the funnel, the time spent in each phase, the survey
 * response distributions, and how the instruction itself went.
 */

export type ChoiceCount = { label: string; count: number };

export type SurveyItemSummary = {
  id: string;
  prompt: string;
  kind: SurveyItem["kind"];
  n: number;
  /** For choice items: how many picked each option. */
  choices?: ChoiceCount[];
  /** For likert items: mean and the 1..max distribution. */
  likertMean?: number | null;
  likertMax?: number;
  likertCounts?: ChoiceCount[];
  /** For open items: how many answered, plus a few sample responses. */
  answered?: number;
  samples?: string[];
};

export type FunnelStep = { step: string; reached: number };

export type PhaseTiming = {
  phase: Phase;
  label: string;
  medianMin: number | null;
  n: number;
};

export type InstructionSummary = {
  armCounts: { agent: number; lesson: number };
  lessonFirstTry: { itemId: string; firstTryRate: number; n: number }[];
  lessonMedianMin: number | null;
  lessonMedianHints: number | null;
};

export type FlowSummary = {
  totalParticipants: number;
  completers: number;
  funnel: FunnelStep[];
  phases: PhaseTiming[];
  screening: SurveyItemSummary[];
  preSurvey: SurveyItemSummary[];
  postSurvey: SurveyItemSummary[];
  instruction: InstructionSummary;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function groupBySubject(docs: LogDoc[]): Map<string, LogDoc[]> {
  const map = new Map<string, LogDoc[]>();
  for (const d of docs) {
    const key = d.subject_id || "unknown";
    map.set(key, [...(map.get(key) ?? []), d]);
  }
  return map;
}

/** The latest event of a kind for a subject, by timestamp. */
function latest(
  list: LogDoc[],
  event: string,
  scenarioId?: string
): LogDoc | null {
  const m = list
    .filter(
      (d) => d.event === event && (scenarioId === undefined || d.scenario_id === scenarioId)
    )
    .sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? ""));
  return m.length ? m[m.length - 1] : null;
}

function answersOf(doc: LogDoc | null): Record<string, unknown> {
  const a = doc?.data?.answers;
  return a && typeof a === "object" ? (a as Record<string, unknown>) : {};
}

/** Aggregate one survey's items over a set of (subject -> answers) records. */
function summariseSurvey(
  surveyId: string,
  perSubjectAnswers: Record<string, unknown>[]
): SurveyItemSummary[] {
  const survey = getSurvey(surveyId);
  if (!survey) return [];
  const items = survey.sections.flatMap((s) => s.items);

  return items.map((item) => {
    const raw = perSubjectAnswers
      .map((a) => a[item.id])
      .filter((v) => v !== undefined && v !== null && v !== "");

    if (item.kind === "choice") {
      const counts = new Map<string, number>();
      for (const v of raw) {
        const key = String(v);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const order = (item.choices ?? []).map((c) => c.id);
      const choices: ChoiceCount[] = (
        order.length ? order : [...counts.keys()]
      ).map((label) => ({ label, count: counts.get(label) ?? 0 }));
      return { id: item.id, prompt: item.prompt, kind: item.kind, n: raw.length, choices };
    }

    if (item.kind === "likert") {
      const max = item.likert?.max ?? 7;
      const nums = raw
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n));
      const counts: ChoiceCount[] = [];
      for (let i = (item.likert?.min ?? 1); i <= max; i += 1) {
        counts.push({ label: String(i), count: nums.filter((n) => n === i).length });
      }
      return {
        id: item.id,
        prompt: item.prompt,
        kind: item.kind,
        n: nums.length,
        likertMean: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null,
        likertMax: max,
        likertCounts: counts,
      };
    }

    // open
    const texts = raw.map((v) => String(v)).filter((t) => t.trim());
    return {
      id: item.id,
      prompt: item.prompt,
      kind: item.kind,
      n: texts.length,
      answered: texts.length,
      samples: texts.slice(0, 3).map((t) => (t.length > 200 ? `${t.slice(0, 200)}…` : t)),
    };
  });
}

const PHASE_LABELS: Record<Phase, string> = {
  welcome: "Welcome",
  pre_survey: "Pre-survey",
  pretest: "Pre-test",
  scenarios: "Instruction",
  posttest: "Post-test",
  post_survey: "Post-survey",
  other: "Other",
};

export function buildFlowSummary(docs: LogDoc[]): FlowSummary {
  const bySubject = groupBySubject(docs);
  const subjects = [...bySubject.entries()];

  const has = (list: LogDoc[], event: string, scenarioId?: string) =>
    list.some(
      (d) => d.event === event && (scenarioId === undefined || d.scenario_id === scenarioId)
    );

  const isCompleter = (list: LogDoc[]) => has(list, "survey_completed", "post");
  const completerSubjects = subjects.filter(([, list]) => isCompleter(list));
  const completerLists = completerSubjects.map(([, list]) => list);

  // Funnel across ALL participants: how many reached each step.
  const count = (pred: (list: LogDoc[]) => boolean) =>
    subjects.filter(([, list]) => pred(list)).length;
  const funnel: FunnelStep[] = [
    { step: "Started screening", reached: count((l) => has(l, "step_entered") || l.length > 0) },
    { step: "Finished screening", reached: count((l) => has(l, "screening_completed")) },
    {
      step: "Eligible",
      reached: count((l) =>
        l.some((d) => d.event === "screening_completed" && d.data?.eligible === true)
      ),
    },
    { step: "Consented", reached: count((l) => has(l, "consent_given")) },
    { step: "Pre-survey done", reached: count((l) => has(l, "survey_completed", "pre")) },
    { step: "Pre-test done", reached: count((l) => has(l, "test_completed", "pretest")) },
    { step: "Post-test done", reached: count((l) => has(l, "test_completed", "posttest")) },
    { step: "Post-survey done (completed)", reached: completerLists.length },
  ];

  // Median minutes per phase, completers only.
  const perSubjectMinutes = completerLists.map((l) => minutesPerPhase(l));
  const phases: PhaseTiming[] = (
    ["pre_survey", "pretest", "scenarios", "posttest", "post_survey"] as Phase[]
  ).map((phase) => {
    const vals = perSubjectMinutes.map((m) => m[phase]).filter((v) => v > 0);
    return { phase, label: PHASE_LABELS[phase], medianMin: median(vals), n: vals.length };
  });

  // Survey response distributions, completers only.
  const screening = summariseSurvey(
    "screening",
    completerLists.map((l) => answersOf(latest(l, "screening_completed")))
  );
  const preSurvey = summariseSurvey(
    "pre",
    completerLists.map((l) => answersOf(latest(l, "survey_completed", "pre")))
  );
  const postSurvey = summariseSurvey(
    "post",
    completerLists.map((l) => answersOf(latest(l, "survey_completed", "post")))
  );

  // Instruction summary, completers only.
  const armOf = (list: LogDoc[]): string | null => {
    const ev = latest(list, "condition_assigned");
    const c = ev?.data?.condition;
    return typeof c === "string" ? c : null;
  };
  const armCounts = { agent: 0, lesson: 0 };
  for (const list of completerLists) {
    const arm = armOf(list);
    if (arm === "agent") armCounts.agent += 1;
    else if (arm === "lesson") armCounts.lesson += 1;
  }

  // Lesson first-try correctness per item (lesson arm completers).
  const lessonLists = completerLists.filter((l) => armOf(l) === "lesson");
  const firstTry = new Map<string, { correct: number; n: number }>();
  const lessonMinutes: number[] = [];
  const lessonHints: number[] = [];
  for (const list of lessonLists) {
    // First attempt per item for this participant.
    const seen = new Set<string>();
    for (const d of [...list].sort((a, b) =>
      (a.timestamp ?? "").localeCompare(b.timestamp ?? "")
    )) {
      if (d.event !== "lesson_item_attempted") continue;
      const id = String(d.data?.item_id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const e = firstTry.get(id) ?? { correct: 0, n: 0 };
      e.n += 1;
      if (d.data?.is_correct === true) e.correct += 1;
      firstTry.set(id, e);
    }
    const secs = list
      .filter((d) => d.event === "lesson_completed")
      .map((d) => Number(d.data?.seconds))
      .filter((n) => Number.isFinite(n));
    if (secs.length) lessonMinutes.push(secs.reduce((a, b) => a + b, 0) / 60);
    lessonHints.push(list.filter((d) => d.event === "lesson_hint_shown").length);
  }
  const lessonFirstTry = [...firstTry.entries()]
    .map(([itemId, e]) => ({ itemId, firstTryRate: e.n ? e.correct / e.n : 0, n: e.n }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId, undefined, { numeric: true }));

  return {
    totalParticipants: subjects.length,
    completers: completerLists.length,
    funnel,
    phases,
    screening,
    preSurvey,
    postSurvey,
    instruction: {
      armCounts,
      lessonFirstTry,
      lessonMedianMin: median(lessonMinutes),
      lessonMedianHints: median(lessonHints),
    },
  };
}
