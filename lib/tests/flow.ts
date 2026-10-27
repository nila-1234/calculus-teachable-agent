import type { LogDoc } from "./report";
import { fullFlowSubjects, minutesPerPhase, type Phase } from "./export";
import { getSurvey } from "@/lib/surveys/definitions";
import type { SurveyItem } from "@/lib/surveys/types";
import { getLesson } from "@/lib/lessons/definitions";
import { getScenario } from "@/lib/scenarios/registry";
import type { LessonQuestion } from "@/lib/lessons/types";
import {
  transitionPlacement,
  placementLine,
  type PlacementEvent,
  type PlacementFlow,
  type PlacementLineId,
} from "@/lib/placement-flow";
import { statusLine } from "@/lib/status-flow";

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
  key: string;
  label: string;
  medianMin: number | null;
  n: number;
  /** A sub-step of the row above it (e.g. one task of the instruction). */
  sub?: boolean;
};

/** Aggregate over agent completers for one task of the agent instruction. */
export type AgentStepSummary = {
  step: string;
  medianMin: number | null;
  /** Mean score rate (0–1) across participants, where the task is scored. */
  meanRate: number | null;
  avgAiRuns: number;
  n: number;
};

export type InstructionSummary = {
  armCounts: { agent: number; lesson: number };
  lessonFirstTry: { itemId: string; firstTryRate: number; n: number }[];
  lessonMedianMin: number | null;
  lessonMedianHints: number | null;
  /** Average number of AI interactions per part, across agent completers. */
  avgAiPerPart: { part: string; avg: number; total: number }[];
  /** Agent arm, per task: median time, mean score, average AI runs. */
  agentSteps: AgentStepSummary[];
};

export type AnswerLine = { label: string; value: string };

/** One student↔AI exchange in the agent scenario, with context. */
export type AiExchange = {
  at: string;
  /** Human label for which part of the activity this was. */
  part: string;
  route: string;
  path: string;
  /** What the step/placement/criterion was, and whether it was right. */
  context: string;
  student: string;
  ai: string;
  durationMs: number | null;
};

/** One try at a LearnVia question. */
export type LessonTry = {
  n: number;
  at: string;
  correct: boolean;
  /** What the participant answered (option text, or what they typed). */
  response: string;
  /** Hints opened on this question before this try. */
  hintsBefore: number;
  /**
   * Seconds since the participant's previous answer in this lesson (or since
   * the lesson opened, for the first) — i.e. how long this try took.
   */
  seconds: number | null;
};

/** One LearnVia question, with every try the participant made. */
export type LessonItemDetail = {
  /** Which LearnVia lesson ("Lesson 1" / "Lesson 2"). */
  lesson: string;
  itemId: string;
  /** Question number within its lesson, in lesson order (1-based). */
  number: number;
  prompt: string;
  firstTryCorrect: boolean;
  attempts: number;
  /** How many hints the participant opened on this question. */
  hints: number;
  /** How many hints the question offers (0 = it has no hint). */
  hintsAvailable: number;
  /** Each hint opened: which one, when, and before which try. */
  hintsOpened: { index: number; at: string; beforeTry: number }[];
  /** Which try was the first correct one; null if never answered correctly. */
  passedOnTry: number | null;
  /** Time of the first try. */
  at: string;
  tries: LessonTry[];
};

/**
 * One part of the agent scenario, scored from that part's own events.
 * `rate` (0–1) is the fraction judged correct where that is meaningful, and is
 * used to pick the lowest-scoring part; it is null for parts with no answer key
 * (e.g. applying the rubric to the AI's work).
 */
export type AgentPartScore = {
  part: string;
  scoreLabel: string;
  rate: number | null;
  seconds: number | null;
  aiRuns: number;
};

/**
 * One turn of the agent instruction, from either side.
 *
 * The participant plays the TA. On the AI side, the "professor" and the
 * "student" are both AI personas (who speaks depends on the call being
 * discussed — see lib/grading-voice.ts and lib/status-flow.ts).
 */
export type ConvTurn = {
  speaker: "participant" | "professor" | "student" | "system";
  /**
   * action  = something the participant did (picked, dragged, marked);
   * reply   = something the participant typed or clicked in reply;
   * scripted = a fixed AI line from the decision tree;
   * llm     = an AI line written by the model;
   * note    = how the system read / judged a response.
   */
  kind: "action" | "reply" | "scripted" | "llm" | "note";
  text: string;
  /** For participant moves/replies: whether it was right, when that is known. */
  correct?: boolean | null;
};

/** One unit of a task: a question part, a rubric attempt, or one criterion's discussion. */
export type AgentTaskItem = {
  title: string;
  /** Why the AI engaged here (what the participant did that triggered it). */
  trigger: string;
  /** How it ended. */
  outcome: string;
  turns: ConvTurn[];
};

/** One task of the agent instruction, in stepper order. */
export type AgentTask = {
  task: "Question" | "Create Rubric" | "Apply Rubric";
  summary: string;
  items: AgentTaskItem[];
};

export type InstructionDetail = {
  arm: string | null;
  minutes: number | null;
  /** Lesson arm: per-question correctness + timestamp. */
  lesson: LessonItemDetail[];
  /** Agent arm: a scored, timed breakdown of each scenario part. */
  agentParts: AgentPartScore[];
  /** Agent arm: which part scored lowest / took most / took least time. */
  agentLowestPart: string | null;
  agentSlowestPart: string | null;
  agentFastestPart: string | null;
  /** Lesson arm: seconds spent in each LearnVia lesson. */
  lessonTimes: { lesson: string; seconds: number | null }[];
  /** Agent arm: every task, with how the participant responded and what the AI said. */
  agentTasks: AgentTask[];
  /** True when the exact discussion transcript was logged (newer runs). */
  agentExactTranscript: boolean;
  /** Agent arm: the raw AI exchanges, in order (fallback / full detail). */
  agent: AiExchange[];
};

/** Everything one completer answered, step by step, for the bottom-of-page dump. */
export type ParticipantDetail = {
  subjectId: string;
  arm: string | null;
  screening: AnswerLine[];
  preSurvey: AnswerLine[];
  preTest: AnswerLine[];
  instruction: InstructionDetail;
  postTest: AnswerLine[];
  postSurvey: AnswerLine[];
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
  participants: ParticipantDetail[];
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

    // open — show every response in full; these are instructor-only and the
    // whole sentence is the point (no truncation, no "…").
    const texts = raw.map((v) => String(v)).filter((t) => t.trim());
    return {
      id: item.id,
      prompt: item.prompt,
      kind: item.kind,
      n: texts.length,
      answered: texts.length,
      samples: texts,
    };
  });
}

function formatValue(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  return JSON.stringify(v);
}

/** Map one survey's answers to labelled lines using the item prompts. */
function surveyAnswerLines(
  surveyId: string,
  answers: Record<string, unknown>
): AnswerLine[] {
  const survey = getSurvey(surveyId);
  if (!survey) return [];
  return survey.sections
    .flatMap((s) => s.items)
    .map((item) => ({ label: item.prompt, value: formatValue(answers[item.id]) }))
    .filter((l) => l.value !== "");
}

/**
 * Answers to pre-survey items that earlier participants were asked in the
 * post-survey (the motivation items moved from post to pre). They are shown on
 * that participant's card, labelled as answered after the activity — but kept
 * out of the pre-survey distribution, since before- and after-activity answers
 * are not the same measure.
 */
function movedItemLines(postAnswers: Record<string, unknown>): AnswerLine[] {
  const pre = getSurvey("pre");
  if (!pre) return [];
  return pre.sections
    .flatMap((s) => s.items)
    .filter((item) => postAnswers[item.id] !== undefined)
    .map((item) => ({
      label: `${item.prompt} (answered after the activity — before this item moved to the pre-survey)`,
      value: formatValue(postAnswers[item.id]),
    }))
    .filter((l) => l.value !== "");
}

/** Format one test item's answer object (choice / text / matching) readably. */
function formatTestAnswer(v: unknown): string {
  if (!v || typeof v !== "object") return formatValue(v);
  const a = v as {
    choiceId?: string;
    text?: string;
    matches?: Record<string, string>;
  };
  const parts: string[] = [];
  if (a.choiceId) parts.push(`chose ${a.choiceId}`);
  if (a.matches)
    parts.push(
      Object.entries(a.matches)
        .map(([k, val]) => `${k}→${val}`)
        .join(", ")
    );
  if (a.text) parts.push(a.text);
  return parts.join(" · ") || formatValue(v);
}

/** One line per answered item from a test_completed event. */
function testAnswerLines(doc: LogDoc | null): AnswerLine[] {
  return Object.entries(answersOf(doc))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([itemId, val]) => ({ label: `Q${itemId}`, value: formatTestAnswer(val) }))
    .filter((l) => l.value !== "");
}

const AI_PART_LABELS: Record<string, string> = {
  "question-feedback": "Explanation feedback",
  "grade-chat": "Chat with the AI",
  "apply-rubric-feedback": "Rubric feedback",
  "grade-lines-comment": "Comment on a solution line",
  "grade-lines-feedback": "Line-grading feedback",
  "placement-classify": "Judge a step — classify reply",
  "placement-explain": "Judge a step — explain",
  "ai-student-answers": "AI sample answers",
};

function pick(o: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

function boolStr(v: unknown, yes: string, no: string): string {
  if (v === true) return yes;
  if (v === false) return no;
  return "";
}

/** Turn one ai_exchange event into a readable exchange with context. */
function summariseExchange(d: LogDoc): AiExchange {
  const data = (d.data ?? {}) as Record<string, unknown>;
  const route = String(data.route ?? "");
  const path = String(data.path ?? "");
  const req = (data.request ?? {}) as Record<string, unknown>;
  const res = (data.response ?? {}) as Record<string, unknown>;

  // Context: what step/criterion this was about, and whether it was right.
  const ctx: string[] = [];
  if (req.criterionLabel) ctx.push(String(req.criterionLabel));
  if (req.placedStep !== undefined && req.expectedStep !== undefined) {
    ctx.push(
      `placed on step ${req.placedStep} (expected ${req.expectedStep}, ${boolStr(req.stepCorrect, "correct", "wrong")})`
    );
  }
  if (req.userStatus !== undefined && req.expectedStatus !== undefined) {
    ctx.push(
      `marked ${req.userStatus} (expected ${req.expectedStatus}, ${boolStr(req.statusCorrect, "correct", "wrong")})`
    );
  }
  if (route === "placement-classify" && res.label) {
    ctx.push(`reply read as "${String(res.label)}"`);
  }

  const student =
    pick(req, [
      "reply",
      "message",
      "comment",
      "studentMessage",
      "text",
      "answer",
      "explanation",
      "userStatus",
    ]) || (req.question ? `Q: ${String(req.question)}` : "");
  const ai =
    pick(res, [
      "reply",
      "feedback",
      "comment",
      "message",
      "text",
      "label",
      "verdict",
    ]) ||
    (typeof data.response === "object"
      ? JSON.stringify(data.response).slice(0, 300)
      : String(data.response ?? ""));

  return {
    at: d.timestamp ?? "",
    part: AI_PART_LABELS[route] ?? route,
    route,
    path,
    context: ctx.join("; "),
    student,
    ai,
    durationMs: typeof data.duration_ms === "number" ? data.duration_ms : null,
  };
}

/** The two LearnVia lessons, by the scenario id their events are logged under. */
const LESSON_LABELS: Record<string, string> = {
  "lesson-1": "Lesson 1",
  "lesson-2": "Lesson 2",
};
const lessonLabel = (id: string | undefined) =>
  LESSON_LABELS[id ?? ""] ?? id ?? "Lesson";

/** A lesson's questions in the order the participant meets them. */
function lessonQuestions(lessonId: string): LessonQuestion[] {
  const lesson = getLesson(lessonId);
  return lesson ? lesson.sections.flatMap((s) => s.questions ?? []) : [];
}

/** A logged lesson response, in words: the option's text, or what was typed. */
function lessonResponseText(q: LessonQuestion | undefined, value: unknown): string {
  if (value === undefined || value === null || value === "") return "(blank)";
  if (q?.kind === "choice" && q.choices) {
    const ids = Array.isArray(value) ? value.map(String) : [String(value)];
    return ids
      .map((id) => {
        const c = q.choices!.find((x) => x.id === id);
        return c ? c.label || "(diagram option)" : id;
      })
      .join("; ");
  }
  return formatValue(value);
}

/**
 * Lesson-arm questions, each with EVERY try: when it was made, what was
 * answered, whether it was right, hints opened before it, and how long it took
 * (since the participant's previous answer in that lesson, or since the lesson
 * opened). Also which try was the first correct one.
 */
function lessonItemsOf(list: LogDoc[]): LessonItemDetail[] {
  const sorted = causalSort(list);
  const items = new Map<string, LessonItemDetail>();
  const hintsSoFar = new Map<string, number>();
  // Hints opened per question (shared with the item once it exists).
  const hintLog = new Map<string, LessonItemDetail["hintsOpened"]>();
  // Previous answer (or lesson start) per lesson, to time each try.
  const lastMark = new Map<string, number>();

  for (const d of sorted) {
    const lessonId = d.scenario_id ?? "";
    if (d.event === "lesson_started") {
      lastMark.set(lessonId, ms(d));
      continue;
    }
    const id = String(d.data?.item_id ?? "");
    const key = `${lessonId}::${id}`;
    if (d.event === "lesson_hint_shown" && id) {
      const count = (hintsSoFar.get(key) ?? 0) + 1;
      hintsSoFar.set(key, count);
      const opened = hintLog.get(key) ?? [];
      hintLog.set(key, opened);
      opened.push({
        index: typeof d.data?.hint_index === "number" ? d.data.hint_index : count,
        at: d.timestamp ?? "",
        beforeTry: (items.get(key)?.tries.length ?? 0) + 1,
      });
      const existing = items.get(key);
      if (existing) existing.hints = count;
      continue;
    }
    if (d.event !== "lesson_item_attempted" || !id) continue;

    const questions = lessonQuestions(lessonId);
    const index = questions.findIndex((q) => q.id === id);
    const q = index >= 0 ? questions[index] : undefined;
    let item = items.get(key);
    if (!item) {
      item = {
        lesson: lessonLabel(lessonId),
        itemId: id,
        number: index >= 0 ? index + 1 : items.size + 1,
        prompt: q?.prompt ?? "",
        firstTryCorrect: d.data?.is_correct === true,
        attempts: 0,
        hints: 0,
        hintsAvailable: q?.hints?.length ?? 0,
        hintsOpened: hintLog.get(key) ?? [],
        passedOnTry: null,
        at: d.timestamp ?? "",
        tries: [],
      };
      if (!hintLog.has(key)) hintLog.set(key, item.hintsOpened);
      items.set(key, item);
    }

    const now = ms(d);
    const since = lastMark.get(lessonId);
    const correct = d.data?.is_correct === true;
    const n = item.tries.length + 1;
    item.tries.push({
      n,
      at: d.timestamp ?? "",
      correct,
      response: lessonResponseText(q, d.data?.response),
      hintsBefore: hintsSoFar.get(key) ?? 0,
      seconds: since && now >= since ? Math.round((now - since) / 1000) : null,
    });
    item.attempts = n;
    item.hints = hintsSoFar.get(key) ?? 0;
    if (correct && item.passedOnTry == null) item.passedOnTry = n;
    lastMark.set(lessonId, now);
  }

  // Questions in a lesson the participant opened but never answered still get
  // a row, so a missing question reads as "not attempted", not as nothing.
  for (const lessonId of lastMark.keys()) {
    lessonQuestions(lessonId).forEach((q, index) => {
      const key = `${lessonId}::${q.id}`;
      if (items.has(key)) return;
      items.set(key, {
        lesson: lessonLabel(lessonId),
        itemId: q.id,
        number: index + 1,
        prompt: q.prompt,
        firstTryCorrect: false,
        attempts: 0,
        hints: hintsSoFar.get(key) ?? 0,
        hintsAvailable: q.hints?.length ?? 0,
        hintsOpened: hintLog.get(key) ?? [],
        passedOnTry: null,
        at: "",
        tries: [],
      });
    });
  }

  return [...items.values()].sort(
    (a, b) => a.lesson.localeCompare(b.lesson) || a.number - b.number
  );
}

/**
 * Time spent in each LearnVia lesson: from that lesson opening
 * (lesson_started) to it being finished (lesson_completed), by the event
 * clock.
 *
 * Not the lesson's self-reported `seconds`: the lesson component wasn't reset
 * between lessons, so Lesson 2's own timer could still be counting from when
 * Lesson 1 opened — that inflated Lesson 2 and double-counted Lesson 1 in the
 * total. The self-reported value is only a fallback when the start is missing.
 */
function lessonTimesOf(list: LogDoc[]): { lesson: string; seconds: number | null }[] {
  const sorted = causalSort(list);
  return Object.keys(LESSON_LABELS).map((lessonId) => {
    const started = sorted.find(
      (d) => d.event === "lesson_started" && d.scenario_id === lessonId
    );
    const completed = [...sorted]
      .reverse()
      .find((d) => d.event === "lesson_completed" && d.scenario_id === lessonId);
    let seconds: number | null = null;
    if (started && completed && ms(completed) > ms(started)) {
      seconds = Math.round((ms(completed) - ms(started)) / 1000);
    } else if (completed) {
      const s = Number(completed.data?.seconds);
      if (Number.isFinite(s) && s > 0) seconds = s;
    }
    return { lesson: lessonLabel(lessonId), seconds };
  });
}

/**
 * The agent scenario's three interactive steps, in order, keyed by the page's
 * path segment — matching the in-scenario stepper (Question → Create Rubric →
 * Apply Rubric → Complete). "Apply Rubric" is the grade-lines page, where the
 * TA places each criterion on a step and marks it pass/fail. The standalone
 * /grade page is NOT part of this flow, so it is deliberately absent.
 */
const AGENT_PARTS: { key: string; label: string }[] = [
  { key: "question", label: "Question" },
  { key: "create-rubric", label: "Create Rubric" },
  { key: "grade-lines", label: "Apply Rubric" },
];

/** Which scenario part each AI route belongs to, for the per-part run counts. */
const ROUTE_TO_PART: Record<string, string> = {
  "question-feedback": "Question",
  "grade-lines-comment": "Apply Rubric",
  "grade-lines-feedback": "Apply Rubric",
  "placement-classify": "Apply Rubric",
  "placement-explain": "Apply Rubric",
  "grade-chat": "Apply Rubric",
};

/** The last non-empty segment of a path, e.g. "/5/grade-lines" -> "grade-lines". */
function lastSegment(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? "";
}

/** Longest single stretch on one page that still counts as working on it. */
const MAX_PAGE_SPAN_MS = 90 * 60 * 1000;

/**
 * Seconds on each page (keyed by the path's last segment), measured from
 * arriving on the page to arriving on the next one — the last page of a
 * session falls back to its exit dwell.
 *
 * The page's own exit dwell is NOT summed for the others: the step timer used
 * to stop for good at the first tab switch and never resume, so a participant
 * who glanced at another tab during the Question step was credited with only
 * the seconds before that glance.
 */
function secondsByPage(list: LogDoc[]): Map<string, number> {
  const out = new Map<string, number>();
  const bySession = new Map<string, LogDoc[]>();
  for (const d of list) {
    if (d.event !== "step_entered" && d.event !== "step_exited") continue;
    const key = d.session_id ?? "";
    bySession.set(key, [...(bySession.get(key) ?? []), d]);
  }
  for (const events of bySession.values()) {
    const ordered = causalSort(events);
    const entries = ordered.filter((d) => d.event === "step_entered");
    entries.forEach((entry, i) => {
      const path = String(entry.data?.path ?? "");
      const next = entries[i + 1];
      let span = 0;
      if (next) {
        span = ms(next) - ms(entry);
      } else {
        const exit = ordered.find(
          (d) =>
            d.event === "step_exited" &&
            d.data?.path === path &&
            ms(d) >= ms(entry)
        );
        const dwell = Number(exit?.data?.dwell_ms);
        if (Number.isFinite(dwell)) span = dwell;
      }
      if (span > 0 && span <= MAX_PAGE_SPAN_MS) {
        const seg = lastSegment(path);
        out.set(seg, (out.get(seg) ?? 0) + span / 1000);
      }
    });
  }
  return out;
}

/**
 * Score each part of the agent scenario for one participant, from that part's
 * own events: first-try MCQ correctness when composing the question, whether
 * the rubric selection was perfect, and how many step placements / pass-fail
 * marks were right. Time is the time on that page; AI runs are the exchanges
 * routed to that part.
 */
function agentPartsOf(list: LogDoc[]): AgentPartScore[] {
  const sorted = causalSort(list);

  // Time on task per part, and AI runs per part.
  const secondsByKey = secondsByPage(list);
  const aiByPart = new Map<string, number>();
  for (const d of sorted) {
    if (d.event !== "ai_exchange") continue;
    const part = ROUTE_TO_PART[String(d.data?.route ?? "")];
    if (part) aiByPart.set(part, (aiByPart.get(part) ?? 0) + 1);
  }

  // Compose the question: first-submit correctness per MCQ part.
  const firstSubmit = new Map<string, boolean>();
  for (const d of sorted) {
    if (d.event !== "question_part_submitted") continue;
    const pid = String(d.data?.part_id ?? "");
    if (!pid || firstSubmit.has(pid)) continue;
    firstSubmit.set(pid, d.data?.is_correct === true);
  }
  const qCorrect = [...firstSubmit.values()].filter(Boolean).length;
  const qTotal = firstSubmit.size;

  // Create the rubric: the latest submission's accuracy.
  const rubric = latest(list, "rubric_submitted");
  const rubricPerfect = rubric?.data?.is_perfect === true;
  const wrongly = Array.isArray(rubric?.data?.wrongly_included)
    ? (rubric!.data!.wrongly_included as unknown[]).length
    : 0;
  const missed = Array.isArray(rubric?.data?.missed_essential)
    ? (rubric!.data!.missed_essential as unknown[]).length
    : 0;

  // Apply Rubric: FIRST-try correctness per criterion — whether the participant
  // put it on the right step on their first drag, and marked it right on their
  // first pass/fail. The verdicts come from the grading call's response (the
  // drag event itself only records the step index, not whether it was right).
  const firstPlace = new Map<string, boolean>();
  const firstStatus = new Map<string, boolean>();
  for (const v of gradeVerdictsOf(sorted)) {
    const key = `${v.answerId}::${v.criterionId}`;
    if (v.phase === "placement") {
      if (!firstPlace.has(key)) firstPlace.set(key, v.item.stepCorrect);
    } else if (!firstStatus.has(key)) {
      firstStatus.set(key, v.item.statusCorrect);
    }
  }
  const stepOk = [...firstPlace.values()].filter(Boolean).length;
  const statusOk = [...firstStatus.values()].filter(Boolean).length;
  const jTotal = firstPlace.size;
  const sTotal = firstStatus.size;

  const parts: AgentPartScore[] = AGENT_PARTS.map(({ key, label }) => {
    const seconds = secondsByKey.get(key) ?? null;
    const aiRuns = aiByPart.get(label) ?? 0;
    let scoreLabel = "—";
    let rate: number | null = null;

    if (key === "question") {
      if (qTotal) {
        scoreLabel = `${qCorrect}/${qTotal} parts correct (first try)`;
        rate = qCorrect / qTotal;
      }
    } else if (key === "create-rubric") {
      if (rubric) {
        scoreLabel = rubricPerfect
          ? "perfect selection"
          : `${wrongly} wrongly included, ${missed} missed`;
        rate = rubricPerfect ? 1 : 0;
      }
    } else if (key === "grade-lines") {
      if (jTotal || sTotal) {
        scoreLabel = `${stepOk}/${jTotal} placed on the right step, ${statusOk}/${sTotal} marked pass/fail right (first try)`;
        rate = (stepOk + statusOk) / Math.max(1, jTotal + sTotal);
      }
    }

    return { part: label, scoreLabel, rate, seconds, aiRuns };
  });

  // Keep only parts the participant actually touched.
  return parts.filter(
    (p) => p.seconds != null || p.aiRuns > 0 || p.rate != null || p.scoreLabel !== "—"
  );
}

/** The verdict the grader returned for one drag or pass/fail mark. */
type GradeItem = {
  criterion: string;
  placedStep: number | null;
  expectedStep: number;
  stepCorrect: boolean;
  status: "pass" | "fail" | null;
  expectedStatus: "pass" | "fail" | null;
  statusCorrect: boolean;
};

type GradeVerdict = {
  at: string;
  answerId: string;
  answerTitle: string;
  criterionId: string;
  phase: "placement" | "status";
  item: GradeItem;
  /** The logged event this move is shown at (the move itself when possible). */
  anchor: LogDoc;
};

/**
 * Score one logged move against the scenario's answer key.
 *
 * Grading is deterministic — /api/grade-lines-feedback only compares the step
 * and pass/fail the TA chose with the key's — so the verdict can be computed
 * from the move itself (grade_lines_criterion_graded, logged before the grading
 * call) and never depends on the grading reply having been logged.
 */
function keyVerdict(d: LogDoc): GradeVerdict | null {
  const data = (d.data ?? {}) as Record<string, unknown>;
  const answerId = String(data.answer_id ?? "");
  const criterionId = String(data.criterion_id ?? "");
  const p = (data.placement ?? {}) as Record<string, unknown>;
  const status = p.status === "pass" || p.status === "fail" ? p.status : null;
  const placedStep =
    typeof data.placed_step === "number"
      ? data.placed_step
      : typeof p.stepIndex === "number"
        ? p.stepIndex + 1
        : null;

  const schema = getScenario(Number(d.scenario_id))?.schema;
  const answer = schema?.FINAL_AI_ANSWERS.find((a) => a.id === answerId);
  const fit = answer?.rubricFit?.[criterionId];
  const expectedStep =
    fit?.step ?? (typeof data.expected_step === "number" ? data.expected_step : null);
  const expectedStatus: "pass" | "fail" | null = fit
    ? fit.pass
      ? "pass"
      : "fail"
    : data.expected_status === "pass" || data.expected_status === "fail"
      ? data.expected_status
      : null;
  if (placedStep == null || expectedStep == null) return null;

  return {
    at: d.timestamp ?? "",
    answerId,
    answerTitle: answer?.label ?? String(data.answer_title ?? answerId),
    criterionId,
    phase: data.phase === "status" || status ? "status" : "placement",
    anchor: d,
    item: {
      criterion:
        schema?.RUBRIC_OPTIONS.find((o) => o.id === criterionId)?.label ??
        (typeof data.criterion_label === "string" ? data.criterion_label : criterionId),
      placedStep,
      expectedStep,
      stepCorrect: placedStep === expectedStep,
      status,
      expectedStatus,
      statusCorrect: status != null && status === expectedStatus,
    },
  };
}

/**
 * Every drag (placement) and pass/fail mark (status) in Apply Rubric, with
 * whether it was right, in order. Scored from the logged move and the answer
 * key; the grading reply is only a fallback (e.g. a scenario not in the
 * registry), and a grading reply with no logged move still counts as a move.
 */
function gradeVerdictsOf(sorted: LogDoc[]): GradeVerdict[] {
  const replies = serverVerdictsOf(sorted).map((v) => ({ ...v, used: false }));
  const out: GradeVerdict[] = [];

  for (const d of sorted) {
    if (d.event !== "grade_lines_criterion_graded") continue;
    const phase = d.data?.phase === "status" ? "status" : "placement";
    const key = `${d.data?.answer_id}::${d.data?.criterion_id}::${phase}`;
    // The grading reply for this move: same criterion, arriving just after.
    let reply: (typeof replies)[number] | null = null;
    for (const r of replies) {
      if (r.used || `${r.answerId}::${r.criterionId}::${r.phase}` !== key) continue;
      const gap = ms(r) - ms(d);
      if (gap < -1000 || gap > PAIR_WINDOW_MS) continue;
      if (!reply || Math.abs(gap) < Math.abs(ms(reply) - ms(d))) reply = r;
    }
    if (reply) reply.used = true;

    const v = keyVerdict(d) ?? (reply ? { ...reply, anchor: d } : null);
    if (v) out.push(v);
  }

  // Grading replies whose move was never logged still show the move.
  for (const r of replies) {
    if (r.used) continue;
    const { used: _used, ...v } = r;
    void _used;
    out.push(v);
  }
  return out.sort((a, b) => ms(a.anchor) - ms(b.anchor));
}

/** Verdicts as returned by /api/grade-lines-feedback (fallback source). */
function serverVerdictsOf(sorted: LogDoc[]): GradeVerdict[] {
  const out: GradeVerdict[] = [];
  for (const d of sorted) {
    if (d.event !== "ai_exchange" || d.data?.route !== "grade-lines-feedback") continue;
    const req = (d.data?.request ?? {}) as Record<string, unknown>;
    const res = (d.data?.response ?? {}) as Record<string, unknown>;
    const fb = Array.isArray(res.feedback) ? (res.feedback[0] as Record<string, unknown>) : null;
    if (!fb) continue;
    const rubric = Array.isArray(req.rubric) ? (req.rubric[0] as Record<string, unknown>) : {};
    const criterionId = String(fb.criterionId ?? rubric?.criterionId ?? "");
    const placements = (req.placements ?? {}) as Record<string, Record<string, unknown>>;
    const sent = placements[criterionId];
    const status = sent?.status === "pass" || sent?.status === "fail" ? sent.status : null;
    out.push({
      at: d.timestamp ?? "",
      answerId: String(req.answerId ?? ""),
      answerTitle: String(req.answerTitle ?? req.answerId ?? "Answer"),
      criterionId,
      phase: status ? "status" : "placement",
      anchor: d,
      item: {
        criterion: String(fb.criterion ?? rubric?.criterion ?? criterionId),
        placedStep: typeof fb.placedStep === "number" ? fb.placedStep : null,
        expectedStep: typeof fb.expectedStep === "number" ? fb.expectedStep : 0,
        stepCorrect: fb.stepCorrect === true,
        status: fb.status === "pass" || fb.status === "fail" ? fb.status : status,
        expectedStatus:
          fb.expectedStatus === "pass" || fb.expectedStatus === "fail" ? fb.expectedStatus : null,
        statusCorrect: fb.statusCorrect === true,
      },
    });
  }
  return out;
}

const UP = (s: string | null) => (s ?? "?").toUpperCase();

/** Render a fixed decision-tree line for whichever phase is being discussed. */
function scriptedLine(
  phase: "placement" | "status",
  line: PlacementLineId,
  item: GradeItem
): string {
  return phase === "status"
    ? statusLine(line, {
        marked: item.status,
        expected: item.expectedStatus,
        placedStep: item.placedStep,
      })
    : placementLine(line, {
        criterionLabel: item.criterion,
        placedStep: item.placedStep,
        expectedStep: item.expectedStep,
      });
}

/** What the participant did, in words, and whether it was right. */
function describeMove(phase: "placement" | "status", item: GradeItem): ConvTurn {
  if (phase === "placement") {
    return {
      speaker: "participant",
      kind: "action",
      correct: item.stepCorrect,
      text: item.stepCorrect
        ? `Dragged "${item.criterion}" onto step ${item.placedStep ?? "?"} — correct.`
        : `Dragged "${item.criterion}" onto step ${item.placedStep ?? "?"} — wrong (it belongs on step ${item.expectedStep}).`,
    };
  }
  return {
    speaker: "participant",
    kind: "action",
    correct: item.statusCorrect,
    text: item.statusCorrect
      ? `Marked step ${item.placedStep ?? "?"} as ${UP(item.status)} for "${item.criterion}" — correct.`
      : `Marked step ${item.placedStep ?? "?"} as ${UP(item.status)} for "${item.criterion}" — wrong (should be ${UP(item.expectedStatus)}).`,
  };
}

/** Which AI persona voices a discussion (mirrors grading-voice / status-flow). */
function personaFor(phase: "placement" | "status", item: GradeItem): "professor" | "student" {
  if (phase === "placement") return "professor";
  return item.status === "fail" ? "student" : "professor";
}

/** Why the AI opened a discussion about this move. */
function triggerFor(phase: "placement" | "status", item: GradeItem): string {
  const persona = personaFor(phase, item);
  const who = persona === "student" ? "The student (AI)" : "The professor (AI)";
  if (phase === "placement") {
    return item.stepCorrect
      ? `${who} double-checked a correct drag (correct calls are challenged 20% of the time).`
      : `${who} questioned a drag onto the wrong step.`;
  }
  if (!item.statusCorrect) return `${who} questioned a wrong ${UP(item.status)} call.`;
  return item.status === "fail"
    ? `${who} pushed back on a FAIL — a FAIL is always questioned, even when correct.`
    : `${who} double-checked a correct PASS (challenged 20% of the time).`;
}

const QUICK_REPLY_TEXT: Record<string, string> = {
  yes: "Yes, I'm sure",
  no: "No, I'm not sure",
};

const NODE_QUESTION: Record<string, string> = {
  askSure: '"Are you sure?"',
  askWhy: '"Why do you think that?"',
  askUnsure: '"What are you unsure about?"',
  consider: '"Consider this…" hint',
};

/**
 * Question task: each part's attempts. Every submit sends the chosen option's
 * text and the participant's explanation to /api/question-feedback, and the
 * AI's feedback comes back per part — so each attempt is fully recoverable.
 */
function questionTaskOf(sorted: LogDoc[]): AgentTask | null {
  const parts = new Map<string, AgentTaskItem & { tries: boolean[] }>();
  for (const d of sorted) {
    if (d.event !== "ai_exchange" || d.data?.route !== "question-feedback") continue;
    const req = (d.data?.request ?? {}) as Record<string, unknown>;
    const res = (d.data?.response ?? {}) as Record<string, unknown>;
    const fbByPart = (res.feedbackByPart ?? {}) as Record<string, unknown>;
    const responses = Array.isArray(req.responses)
      ? (req.responses as Record<string, unknown>[])
      : [];
    for (const r of responses) {
      const partId = String(r.partId ?? "");
      if (!partId) continue;
      const item =
        parts.get(partId) ??
        ({
          title: String(r.partLabel ?? `Part ${partId}`),
          trigger: "The AI gives feedback on every submitted choice and explanation.",
          outcome: "",
          turns: [],
          tries: [],
        } as AgentTaskItem & { tries: boolean[] });
      const correct = r.selectedChoiceCorrect === true;
      item.tries.push(correct);
      item.turns.push({
        speaker: "participant",
        kind: "action",
        correct,
        text: `Attempt ${item.tries.length}: chose "${String(r.selectedChoiceText ?? "?")}" — ${
          correct ? "correct" : "wrong"
        }.`,
      });
      const explanation = String(r.explanation ?? "").trim();
      item.turns.push({
        speaker: "participant",
        kind: "reply",
        text: explanation ? `Explanation: ${explanation}` : "(no explanation written)",
      });
      const fb = fbByPart[partId];
      const fbText =
        typeof fb === "string"
          ? fb
          : fb && typeof fb === "object"
            ? pick(fb as Record<string, unknown>, ["feedback", "text", "message", "comment"]) ||
              JSON.stringify(fb)
            : "";
      if (fbText) item.turns.push({ speaker: "professor", kind: "llm", text: fbText });
      parts.set(partId, item);
    }
  }
  if (parts.size === 0) return null;

  const items = [...parts.values()].map(({ tries, ...item }) => {
    const firstRight = tries[0] === true;
    const solvedAt = tries.indexOf(true);
    return {
      ...item,
      outcome: firstRight
        ? "Correct on the first try."
        : solvedAt >= 0
          ? `Correct on attempt ${solvedAt + 1} (first try wrong).`
          : `Not answered correctly (${tries.length} attempt${tries.length === 1 ? "" : "s"}).`,
    };
  });
  const firstRight = items.filter((i) => i.outcome.startsWith("Correct on the first")).length;
  return {
    task: "Question",
    summary: `${firstRight}/${items.length} parts correct on the first try.`,
    items,
  };
}

/**
 * Create Rubric task: each submission — which criteria the participant
 * included or left out, and what the check found wrong. There is no AI chat in
 * this task; the system's check is the response.
 */
function rubricTaskOf(sorted: LogDoc[]): AgentTask | null {
  const labels = new Map<string, string>();
  for (const d of sorted) {
    if (d.event === "rubric_decision" && d.data?.criterion_id) {
      labels.set(String(d.data.criterion_id), String(d.data.criterion_label ?? d.data.criterion_id));
    }
  }
  const name = (id: unknown) => labels.get(String(id)) ?? String(id);
  const names = (v: unknown) => (Array.isArray(v) ? v.map(name) : []);

  const items: AgentTaskItem[] = [];
  for (const d of sorted) {
    if (d.event !== "rubric_submitted") continue;
    const decisions = (d.data?.decisions ?? {}) as Record<string, string>;
    const included = Object.entries(decisions).filter(([, v]) => v === "include").map(([k]) => name(k));
    const excluded = Object.entries(decisions).filter(([, v]) => v !== "include").map(([k]) => name(k));
    const wrongly = names(d.data?.wrongly_included);
    const missed = names(d.data?.missed_essential);
    const perfect = d.data?.is_perfect === true;
    items.push({
      title: `Submission ${items.length + 1}`,
      trigger: "The rubric selection is checked against the answer key on submit.",
      outcome: perfect
        ? "Perfect selection."
        : [
            wrongly.length ? `Wrongly included: ${wrongly.join("; ")}.` : "",
            missed.length ? `Missed essential: ${missed.join("; ")}.` : "",
          ]
            .filter(Boolean)
            .join(" "),
      turns: [
        {
          speaker: "participant",
          kind: "action",
          correct: perfect,
          text: `Included: ${included.join("; ") || "—"}`,
        },
        { speaker: "participant", kind: "action", text: `Left out: ${excluded.join("; ") || "—"}` },
        {
          speaker: "system",
          kind: "note",
          text: perfect
            ? "Check: perfect selection."
            : `Check: ${wrongly.length} wrongly included, ${missed.length} essential missed.`,
        },
      ],
    });
  }
  if (items.length === 0) return null;
  const perfectAt = items.findIndex((i) => i.outcome === "Perfect selection.");
  return {
    task: "Create Rubric",
    summary:
      perfectAt === 0
        ? "Perfect on the first submission."
        : perfectAt > 0
          ? `Perfect on submission ${perfectAt + 1} of ${items.length}.`
          : `Never perfect (${items.length} submission${items.length === 1 ? "" : "s"}).`,
    items,
  };
}

/**
 * Cause-and-effect rank for events logged in the same millisecond. A drag is
 * graded, then discussed; a reply is typed, then read by the AI, then moves the
 * decision tree, which then speaks. Several of these routinely share a
 * timestamp, and the database returns ties in arbitrary order — so without
 * this, a reply could land after the AI line that answered it.
 */
function causalRank(d: LogDoc): number {
  const route = d.event === "ai_exchange" ? String(d.data?.route ?? "") : "";
  if (route === "grade-lines-feedback" || d.event === "grade_lines_criterion_graded") return 0;
  if (d.event === "grade_lines_flow_message" && d.data?.role === "user") return 1;
  if (route === "placement-classify") return 2;
  if (
    d.event === "grade_lines_placement_transition" ||
    d.event === "grade_lines_status_transition" ||
    d.event === "grade_lines_placement_unchallenged" ||
    d.event === "grade_lines_status_unchallenged"
  )
    return 3;
  if (d.event === "grade_lines_flow_message") return 4;
  if (route === "placement-explain") return 5;
  return 3;
}

/**
 * Events in the order they happened: by the per-browser sequence number when
 * both events have one (newer runs), otherwise by timestamp with same-instant
 * ties broken by cause and effect.
 */
function causalSort(list: LogDoc[]): LogDoc[] {
  return [...list].sort((a, b) => {
    if (
      typeof a.seq === "number" &&
      typeof b.seq === "number" &&
      a.session_id === b.session_id
    )
      return a.seq - b.seq;
    const t = (a.timestamp ?? "").localeCompare(b.timestamp ?? "");
    return t !== 0 ? t : causalRank(a) - causalRank(b);
  });
}

const ms = (d: { timestamp?: string; at?: string }) =>
  Date.parse(d.timestamp ?? d.at ?? "") || 0;

/** How far apart (ms) a move and its discussion step may be and still pair. */
const PAIR_WINDOW_MS = 15000;

/**
 * Apply Rubric task: one item per criterion per phase (which step it belongs
 * on, then pass/fail), showing in order: the participant's move, the AI's
 * question or challenge, the participant's reply, the AI's answer, and so on.
 *
 * Newer runs log every displayed line (grade_lines_flow_message), used
 * verbatim. Older runs are rebuilt: the decision tree is deterministic
 * (lib/placement-flow.ts), so replaying each logged transition recovers the
 * fixed AI lines; model-written lines and replies come from the AI exchanges.
 * Moves and replies are paired with their own step by time and content, never
 * by arrival order. In older runs, a typed reply that never reached an AI call
 * was not saved, and is shown as such.
 */
function applyRubricTaskOf(list: LogDoc[]): { task: AgentTask | null; exact: boolean } {
  const sorted = causalSort(list);
  const exact = sorted.some((d) => d.event === "grade_lines_flow_message");

  // Every graded drag / mark, and every classified reply, up front — so each
  // can be paired with its own discussion step regardless of log order.
  // Every drag / mark, scored, keyed by the logged event it is shown at.
  const moveAt = new Map<LogDoc, GradeVerdict>(
    gradeVerdictsOf(sorted).map((v) => [v.anchor, v])
  );
  const classifies = sorted
    .filter((d) => d.event === "ai_exchange" && d.data?.route === "placement-classify")
    .map((d) => {
      const req = (d.data?.request ?? {}) as Record<string, unknown>;
      return {
        at: ms(d),
        question: String(req.question ?? ""),
        reply: pick(req, ["reply", "message", "text"]),
        used: false,
      };
    });

  const takeClassify = (at: number, questions: string[]) => {
    let best: (typeof classifies)[number] | null = null;
    for (const c of classifies) {
      if (c.used || Math.abs(c.at - at) > PAIR_WINDOW_MS) continue;
      const matches = questions.includes(c.question);
      const bestMatches = best ? questions.includes(best.question) : false;
      if (
        !best ||
        (matches && !bestMatches) ||
        (matches === bestMatches && Math.abs(c.at - at) < Math.abs(best.at - at))
      )
        best = c;
    }
    if (best) best.used = true;
    return best;
  };

  const items = new Map<string, AgentTaskItem>();
  const current = new Map<string, GradeVerdict>();
  const order: string[] = [];
  const unfilled = new Map<string, ConvTurn>();
  let activeKey: string | null = null;

  const itemFor = (key: string, v: GradeVerdict | null | undefined, phase: "placement" | "status") => {
    let it = items.get(key);
    if (!it) {
      it = {
        title: `${v?.answerTitle ?? "Answer"} · "${v?.item.criterion ?? key.split("::")[1]}" — ${
          phase === "status" ? "pass / fail" : "which step"
        }`,
        trigger: "",
        outcome: "",
        turns: [],
      };
      items.set(key, it);
      order.push(key);
    }
    return it;
  };

  for (const d of sorted) {
    const data = (d.data ?? {}) as Record<string, unknown>;

    const isTransition =
      d.event === "grade_lines_placement_transition" ||
      d.event === "grade_lines_status_transition";
    const isUnchallenged =
      d.event === "grade_lines_placement_unchallenged" ||
      d.event === "grade_lines_status_unchallenged";

    if (isTransition || isUnchallenged) {
      const phase = (d.event ?? "").includes("_status_") ? "status" : "placement";
      const key = `${data.answer_id}::${data.criterion_id}::${phase}`;
      activeKey = key;
      const event = data.event as PlacementEvent | undefined;
      const from = data.from as PlacementFlow | undefined;

      // The move itself was already shown when it was made (see the
      // grade_lines_criterion_graded branch); here the AI decides to discuss it.
      if (isUnchallenged || event?.type === "DROP") {
        const v = current.get(key);
        const it = itemFor(key, v, phase);
        if (isUnchallenged) {
          if (!it.trigger) it.trigger = "No discussion — the correct call was accepted as-is.";
          it.turns.push({
            speaker: "system",
            kind: "note",
            text: "Accepted without discussion (correct calls are only challenged 20% of the time).",
          });
          it.outcome = "Accepted — correct, no discussion.";
          continue;
        }
        if (!it.trigger && v) it.trigger = triggerFor(phase, v.item);
      }

      if (!from || !event) continue;
      const v = current.get(key);
      const it = itemFor(key, v, phase);

      if (!exact && event.type === "REPLY") {
        const node = from.kind === "chat" ? from.node : "";
        const label = event.label ?? null;
        let turn: ConvTurn;
        if (node === "askSure") {
          // The question this reply answered: "Are you sure…?" or, after an
          // unclear reply, "Just to check…".
          const asked = v
            ? [scriptedLine(phase, "askSure", v.item), scriptedLine(phase, "clarify", v.item)]
            : [];
          const c = takeClassify(ms(d), asked);
          turn = c
            ? { speaker: "participant", kind: "reply", text: c.reply }
            : label && QUICK_REPLY_TEXT[label]
              ? { speaker: "participant", kind: "reply", text: QUICK_REPLY_TEXT[label] }
              : { speaker: "participant", kind: "reply", text: "(reply not saved in this run)" };
        } else {
          turn = {
            speaker: "participant",
            kind: "reply",
            text: `(typed a reply to the ${NODE_QUESTION[node] ?? "question"} — not saved in this run)`,
          };
          unfilled.set(key, turn);
        }
        it.turns.push(turn);
        if (node === "askSure") {
          it.turns.push({
            speaker: "system",
            kind: "note",
            text: `Read as: ${label ?? "unclear"}${
              label === "unclear" && from.kind === "chat" && from.unclear >= 1
                ? " (second unclear reply — treated as no)"
                : ""
            }.`,
          });
        }
      }

      const { next, effects } = transitionPlacement(from, event);
      if (!exact && v) {
        const persona = personaFor(phase, v.item);
        for (const effect of effects) {
          if (effect.type === "say") {
            it.turns.push({
              speaker: persona,
              kind: "scripted",
              text: scriptedLine(phase, effect.line, v.item),
            });
          }
          // `explain` lines are model-written: they arrive as the
          // placement-explain exchange that follows.
        }
      }
      if (next.kind === "resolved") {
        it.outcome =
          next.how === "accepted"
            ? `Resolved — the participant stood by a correct call (attempt ${next.attempt}).`
            : `Resolved — the participant moved it after being told the answer (attempt ${next.attempt}).`;
      } else if (next.kind === "dragging" && next.revealed) {
        it.outcome = "Out of attempts — the AI told them the answer.";
      }
      continue;
    }

    // A drag or a pass/fail mark, shown at the moment it was made, scored.
    const move = moveAt.get(d);
    if (move) {
      const key = `${move.answerId}::${move.criterionId}::${move.phase}`;
      current.set(key, move);
      activeKey = key;
      itemFor(key, move, move.phase).turns.push(describeMove(move.phase, move.item));
      continue;
    }
    if (d.event === "grade_lines_criterion_graded") {
      // A move that could not be scored at all (no answer key and no grading
      // reply) — still shown, with where it went.
      const p = (data.placement ?? {}) as Record<string, unknown>;
      const phase = data.phase === "status" ? "status" : "placement";
      const key = `${data.answer_id}::${data.criterion_id}::${phase}`;
      activeKey = key;
      const step = typeof p.stepIndex === "number" ? p.stepIndex + 1 : "?";
      itemFor(key, current.get(key), phase).turns.push({
        speaker: "participant",
        kind: "action",
        correct: null,
        text:
          phase === "status"
            ? `Marked step ${step} as ${UP((p.status as string) ?? null)} (no answer key found for this item).`
            : `Dragged it onto step ${step} (no answer key found for this item).`,
      });
      continue;
    }

    // Moves that are never graded: back to the bank, or a mark cleared.
    if (d.event === "grade_lines_move") {
      const action = String(data.action ?? "");
      if (action !== "removed" && action !== "unmarked") continue;
      const phase = action === "unmarked" ? "status" : "placement";
      const key = `${data.answer_id}::${data.criterion_id}::${phase}`;
      const it = itemFor(key, current.get(key), phase);
      it.turns.push({
        speaker: "participant",
        kind: "action",
        correct: null,
        text:
          action === "removed"
            ? `Dragged it back to the criteria bank (off step ${data.from_step ?? "?"}).`
            : `Cleared the ${UP((data.from_status as string) ?? null)} mark.`,
      });
      continue;
    }

    // Exact transcript lines (newer runs).
    if (d.event === "grade_lines_flow_message") {
      const phase = data.kind === "status" ? "status" : "placement";
      const key = `${data.answer_id}::${data.criterion_id}::${phase}`;
      const it = itemFor(key, current.get(key), phase);
      const role = String(data.role ?? "");
      it.turns.push(
        role === "user"
          ? { speaker: "participant", kind: "reply", text: String(data.text ?? "") }
          : {
              speaker: role === "student" ? "student" : "professor",
              kind: "llm",
              text: String(data.text ?? ""),
            }
      );
      continue;
    }

    // Model-written AI line (older runs), plus the reply that prompted it.
    if (!exact && d.event === "ai_exchange" && data.route === "placement-explain" && activeKey) {
      const it = items.get(activeKey);
      if (!it) continue;
      const req = (data.request ?? {}) as Record<string, unknown>;
      const res = (data.response ?? {}) as Record<string, unknown>;
      const ta = typeof req.taMessage === "string" ? req.taMessage.trim() : "";
      const hole = unfilled.get(activeKey);
      if (ta && hole) {
        hole.text = ta;
        unfilled.delete(activeKey);
      }
      const text = pick(res, ["text"]);
      const persona = req.speaker === "student" ? "student" : "professor";
      if (text) it.turns.push({ speaker: persona, kind: "llm", text });
    }
  }

  if (order.length === 0) return { task: null, exact };

  const listOut = order.map((k) => {
    const item = items.get(k)!;
    return { ...item, trigger: item.trigger || "—", outcome: item.outcome || "—" };
  });

  const discussed = listOut.filter(
    (i) => i.turns.some((t) => t.speaker !== "participant" && t.speaker !== "system")
  ).length;
  const firstRight = listOut.filter(
    (i) => i.turns.find((t) => t.kind === "action")?.correct === true
  ).length;
  return {
    exact,
    task: {
      task: "Apply Rubric",
      summary: `${firstRight}/${listOut.length} calls right on the first try · ${discussed} discussed with the AI.`,
      items: listOut,
    },
  };
}

/** Every task of the agent instruction, in stepper order. */
function agentTasksOf(list: LogDoc[]): { tasks: AgentTask[]; exact: boolean } {
  const sorted = causalSort(list);
  const apply = applyRubricTaskOf(sorted);
  const tasks = [questionTaskOf(sorted), rubricTaskOf(sorted), apply.task].filter(
    (t): t is AgentTask => t != null
  );
  return { tasks, exact: apply.exact };
}

export function buildFlowSummary(docs: LogDoc[]): FlowSummary {
  const bySubject = groupBySubject(docs);
  const subjects = [...bySubject.entries()];

  const has = (list: LogDoc[], event: string, scenarioId?: string) =>
    list.some(
      (d) => d.event === event && (scenarioId === undefined || d.scenario_id === scenarioId)
    );

  // Completers = finished EVERY step of the flow (not just the post-survey);
  // this also drops instructor preview / dev runs. See fullFlowSubjects.
  const fullFlow = fullFlowSubjects(docs);
  const completerSubjects = subjects.filter(([subject]) => fullFlow.has(subject));
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

  // Arm per completer (each completer is in exactly one arm).
  const armOf = (list: LogDoc[]): string | null => {
    const ev = latest(list, "condition_assigned");
    const c = ev?.data?.condition;
    return typeof c === "string" ? c : null;
  };

  // Median minutes per phase, completers only. The instruction phase is split
  // into the agent scenario and the LearnVia lesson, grouped by arm.
  const withMinutes = completerLists.map((l) => ({
    arm: armOf(l),
    m: minutesPerPhase(l),
  }));
  const medPhase = (
    phase: Phase,
    filter: (x: { arm: string | null }) => boolean = () => true
  ) => {
    const vals = withMinutes
      .filter(filter)
      .map((x) => x.m[phase])
      .filter((v) => v > 0);
    return { medianMin: median(vals), n: vals.length };
  };
  // LearnVia total = Lesson 1 + Lesson 2, each timed from opening to finishing
  // (see lessonTimesOf — the lesson's self-reported timer could double count).
  const lessonTotalMinOf = (l: LogDoc[]): number | null => {
    const secs = lessonTimesOf(l)
      .map((t) => t.seconds)
      .filter((s): s is number => s != null);
    return secs.length ? secs.reduce((a, b) => a + b, 0) / 60 : null;
  };
  const lessonTotalsMin = completerLists
    .filter((l) => armOf(l) === "lesson")
    .map((l) => {
      return lessonTotalMinOf(l);
    })
    .filter((v): v is number => v != null);

  // Each lesson on its own, from its own completion event.
  const perLessonMin = (label: string) => {
    const vals = completerLists
      .filter((l) => armOf(l) === "lesson")
      .map((l) => lessonTimesOf(l).find((t) => t.lesson === label)?.seconds ?? null)
      .filter((v): v is number => v != null)
      .map((s) => s / 60);
    return { medianMin: median(vals), n: vals.length };
  };

  // Each task of the agent instruction (Question / Create Rubric / Apply
  // Rubric), with time, score and AI runs, across agent completers.
  const agentPartLists = completerLists
    .filter((l) => armOf(l) === "agent")
    .map((l) => agentPartsOf(l));
  const agentSteps: AgentStepSummary[] = AGENT_PARTS.map(({ label }) => {
    const rows = agentPartLists
      .map((parts) => parts.find((p) => p.part === label))
      .filter((p): p is AgentPartScore => p != null);
    const mins = rows
      .map((p) => p.seconds)
      .filter((s): s is number => s != null)
      .map((s) => s / 60);
    const rates = rows.map((p) => p.rate).filter((r): r is number => r != null);
    return {
      step: label,
      medianMin: median(mins),
      meanRate: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null,
      avgAiRuns: agentPartLists.length
        ? rows.reduce((a, p) => a + p.aiRuns, 0) / agentPartLists.length
        : 0,
      n: rows.length,
    };
  });

  const phases: PhaseTiming[] = [
    { key: "pre_survey", label: "Pre-survey", ...medPhase("pre_survey") },
    { key: "pretest", label: "Pre-test", ...medPhase("pretest") },
    {
      key: "instruction_agent",
      label: "Instruction (agent) — total",
      ...medPhase("scenarios", (x) => x.arm === "agent"),
    },
    ...agentSteps.map((s) => ({
      key: `agent_${s.step}`,
      label: s.step,
      medianMin: s.medianMin,
      n: s.n,
      sub: true,
    })),
    {
      key: "lesson",
      label: "LearnVia lesson — total (both lessons)",
      medianMin: median(lessonTotalsMin),
      n: lessonTotalsMin.length,
    },
    ...Object.values(LESSON_LABELS).map((label) => ({
      key: `lesson_${label}`,
      label,
      ...perLessonMin(label),
      sub: true,
    })),
    { key: "posttest", label: "Post-test", ...medPhase("posttest") },
    { key: "post_survey", label: "Post-survey", ...medPhase("post_survey") },
  ];

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
    const total = lessonTotalMinOf(list);
    if (total != null) lessonMinutes.push(total);
    lessonHints.push(list.filter((d) => d.event === "lesson_hint_shown").length);
  }
  const lessonFirstTry = [...firstTry.entries()]
    .map(([itemId, e]) => ({ itemId, firstTryRate: e.n ? e.correct / e.n : 0, n: e.n }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId, undefined, { numeric: true }));

  // Every completer's full set of answers, step by step, for the page bottom.
  const instructionDetailOf = (list: LogDoc[]): InstructionDetail => {
    const arm = armOf(list);
    const mins = minutesPerPhase(list).scenarios;
    const agentParts = arm === "agent" ? agentPartsOf(list) : [];
    const scored = agentParts.filter((p) => p.rate != null);
    const timed = agentParts.filter((p) => p.seconds != null);
    const minBy = <T>(xs: T[], f: (x: T) => number): T | null =>
      xs.length ? xs.reduce((a, b) => (f(b) < f(a) ? b : a)) : null;
    const maxBy = <T>(xs: T[], f: (x: T) => number): T | null =>
      xs.length ? xs.reduce((a, b) => (f(b) > f(a) ? b : a)) : null;
    return {
      arm,
      minutes: mins > 0 ? mins : null,
      lesson: arm === "lesson" ? lessonItemsOf(list) : [],
      agentParts,
      agentLowestPart: minBy(scored, (p) => p.rate ?? 1)?.part ?? null,
      agentSlowestPart: maxBy(timed, (p) => p.seconds ?? 0)?.part ?? null,
      agentFastestPart: minBy(timed, (p) => p.seconds ?? Infinity)?.part ?? null,
      lessonTimes: arm === "lesson" ? lessonTimesOf(list) : [],
      ...(() => {
        if (arm !== "agent") return { agentTasks: [], agentExactTranscript: false };
        const { tasks, exact } = agentTasksOf(list);
        return { agentTasks: tasks, agentExactTranscript: exact };
      })(),
      agent:
        arm === "agent"
          ? list
              .filter((d) => d.event === "ai_exchange")
              .sort((a, b) =>
                (a.timestamp ?? "").localeCompare(b.timestamp ?? "")
              )
              .map(summariseExchange)
          : [],
    };
  };

  const participants: ParticipantDetail[] = completerSubjects.map(
    ([subjectId, list]) => ({
      subjectId,
      arm: armOf(list),
      screening: surveyAnswerLines(
        "screening",
        answersOf(latest(list, "screening_completed"))
      ),
      preSurvey: surveyAnswerLines(
        "pre",
        answersOf(latest(list, "survey_completed", "pre"))
      ),
      preTest: testAnswerLines(latest(list, "test_completed", "pretest")),
      instruction: instructionDetailOf(list),
      postTest: testAnswerLines(latest(list, "test_completed", "posttest")),
      postSurvey: [
        ...surveyAnswerLines(
          "post",
          answersOf(latest(list, "survey_completed", "post"))
        ),
        ...movedItemLines(answersOf(latest(list, "survey_completed", "post"))),
      ],
    })
  );

  // Average AI interactions per part, across agent completers.
  const agentLists = completerLists.filter((l) => armOf(l) === "agent");
  const partTotals = new Map<string, number>();
  for (const l of agentLists) {
    for (const d of l) {
      if (d.event !== "ai_exchange") continue;
      const r = String(d.data?.route ?? "");
      const part = AI_PART_LABELS[r] ?? r;
      partTotals.set(part, (partTotals.get(part) ?? 0) + 1);
    }
  }
  const avgAiPerPart = [...partTotals.entries()]
    .map(([part, total]) => ({
      part,
      total,
      avg: agentLists.length ? total / agentLists.length : 0,
    }))
    .sort((a, b) => b.total - a.total);

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
      avgAiPerPart,
      agentSteps,
    },
    participants,
  };
}
