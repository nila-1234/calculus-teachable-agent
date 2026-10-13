import type { LogDoc } from "./report";
import { fullFlowSubjects, minutesPerPhase, type Phase } from "./export";
import { getSurvey } from "@/lib/surveys/definitions";
import type { SurveyItem } from "@/lib/surveys/types";
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

/** One lesson-arm question attempt. */
export type LessonItemDetail = {
  /** Which LearnVia lesson ("Lesson 1" / "Lesson 2"). */
  lesson: string;
  itemId: string;
  firstTryCorrect: boolean;
  attempts: number;
  hints: number;
  at: string;
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

/** Lesson-arm per-question attempts, in order, tagged with their lesson. */
function lessonItemsOf(list: LogDoc[]): LessonItemDetail[] {
  const first = new Map<
    string,
    { lesson: string; itemId: string; firstTryCorrect: boolean; attempts: number; at: string }
  >();
  const hints = new Map<string, number>();
  for (const d of [...list].sort((a, b) =>
    (a.timestamp ?? "").localeCompare(b.timestamp ?? "")
  )) {
    const id = String(d.data?.item_id ?? "");
    const key = `${d.scenario_id ?? ""}::${id}`;
    if (d.event === "lesson_hint_shown") {
      if (id) hints.set(key, (hints.get(key) ?? 0) + 1);
    }
    if (d.event !== "lesson_item_attempted") continue;
    if (!id) continue;
    const e = first.get(key);
    if (!e) {
      first.set(key, {
        lesson: lessonLabel(d.scenario_id),
        itemId: id,
        firstTryCorrect: d.data?.is_correct === true,
        attempts: 1,
        at: d.timestamp ?? "",
      });
    } else {
      e.attempts += 1;
    }
  }
  return [...first.entries()]
    .map(([key, e]) => ({ ...e, hints: hints.get(key) ?? 0 }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Seconds spent in each LearnVia lesson, from that lesson's own completion
 * event (each lesson times itself from when it opens to when it is finished).
 * The latest completion wins if a lesson was somehow finished twice.
 */
function lessonTimesOf(list: LogDoc[]): { lesson: string; seconds: number | null }[] {
  const byLesson = new Map<string, number | null>();
  for (const id of Object.keys(LESSON_LABELS)) byLesson.set(id, null);
  for (const d of [...list].sort((a, b) =>
    (a.timestamp ?? "").localeCompare(b.timestamp ?? "")
  )) {
    if (d.event !== "lesson_completed" || !d.scenario_id) continue;
    const s = Number(d.data?.seconds);
    if (Number.isFinite(s) && s > 0) byLesson.set(d.scenario_id, s);
  }
  return [...byLesson.entries()].map(([id, seconds]) => ({
    lesson: lessonLabel(id),
    seconds,
  }));
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

/**
 * Score each part of the agent scenario for one participant, from that part's
 * own events: first-try MCQ correctness when composing the question, whether
 * the rubric selection was perfect, how many answers were reviewed, and how
 * many step placements were judged correctly. Time is the dwell on that page;
 * AI runs are the exchanges routed to that part.
 */
function agentPartsOf(list: LogDoc[]): AgentPartScore[] {
  const sorted = [...list].sort((a, b) =>
    (a.timestamp ?? "").localeCompare(b.timestamp ?? "")
  );

  // Time on task per part (summed dwell), and AI runs per part.
  const secondsByKey = new Map<string, number>();
  for (const d of sorted) {
    if (d.event !== "step_exited") continue;
    const seg = lastSegment(String(d.data?.path ?? ""));
    const dwell = Number(d.data?.dwell_ms);
    if (seg && Number.isFinite(dwell))
      secondsByKey.set(seg, (secondsByKey.get(seg) ?? 0) + dwell / 1000);
  }
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
};

/**
 * Every grading verdict in Apply Rubric, in order. Each drag (placement) and
 * each pass/fail mark (status) is sent to /api/grade-lines-feedback, which
 * returns whether it was right — that response is the ground truth for what
 * the participant did and whether it was correct.
 */
function gradeVerdictsOf(sorted: LogDoc[]): GradeVerdict[] {
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
 * Apply Rubric task: one item per criterion per phase (which step it belongs
 * on, then pass/fail), showing every move the participant made, why the AI
 * engaged, what it said, and exactly how the participant replied.
 *
 * Newer runs log every displayed line (grade_lines_flow_message), which is used
 * verbatim. Older runs are rebuilt: the decision tree is deterministic
 * (lib/placement-flow.ts), so replaying each logged transition recovers the
 * fixed AI lines; model-written lines and replies come from the AI exchanges.
 * In older runs, a typed reply that never reached an AI route was not saved.
 */
function applyRubricTaskOf(sorted: LogDoc[]): { task: AgentTask | null; exact: boolean } {
  const exact = sorted.some((d) => d.event === "grade_lines_flow_message");
  const items = new Map<string, AgentTaskItem & { phase: "placement" | "status"; started: boolean }>();
  const lastVerdict = new Map<string, GradeVerdict>();
  const order: string[] = [];
  let currentKey: string | null = null;
  let pendingClassify: { reply: string; label: string } | null = null;
  // The last participant reply in each item whose text still needs filling in.
  const unfilled = new Map<string, ConvTurn>();

  const itemFor = (key: string, v: GradeVerdict | undefined, phase: "placement" | "status") => {
    let it = items.get(key);
    if (!it) {
      it = {
        title: `${v?.answerTitle ?? "Answer"} · "${v?.item.criterion ?? key}" — ${
          phase === "status" ? "pass / fail" : "which step"
        }`,
        trigger: "",
        outcome: "",
        turns: [],
        phase,
        started: false,
      };
      items.set(key, it);
      order.push(key);
    }
    return it;
  };

  for (const d of sorted) {
    const data = (d.data ?? {}) as Record<string, unknown>;

    // A drag or a pass/fail mark, graded.
    if (d.event === "ai_exchange" && data.route === "grade-lines-feedback") {
      const [v] = gradeVerdictsOf([d]);
      if (!v) continue;
      const key = `${v.answerId}::${v.criterionId}::${v.phase}`;
      lastVerdict.set(key, v);
      const it = itemFor(key, v, v.phase);
      it.turns.push(describeMove(v.phase, v.item));
      currentKey = key;
      continue;
    }

    // A correct call accepted without any discussion.
    if (
      d.event === "grade_lines_placement_unchallenged" ||
      d.event === "grade_lines_status_unchallenged"
    ) {
      const phase = d.event === "grade_lines_status_unchallenged" ? "status" : "placement";
      const key = `${data.answer_id}::${data.criterion_id}::${phase}`;
      const it = itemFor(key, lastVerdict.get(key), phase);
      if (!it.trigger) it.trigger = "No discussion — the correct call was accepted as-is.";
      it.turns.push({
        speaker: "system",
        kind: "note",
        text: "Accepted without discussion (correct calls are only challenged 20% of the time).",
      });
      it.outcome = "Accepted — correct, no discussion.";
      continue;
    }

    // Exact transcript lines (newer runs).
    if (d.event === "grade_lines_flow_message") {
      const phase = data.kind === "status" ? "status" : "placement";
      const key = `${data.answer_id}::${data.criterion_id}::${phase}`;
      const it = itemFor(key, lastVerdict.get(key), phase);
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

    if (
      d.event === "grade_lines_placement_transition" ||
      d.event === "grade_lines_status_transition"
    ) {
      const phase = d.event === "grade_lines_status_transition" ? "status" : "placement";
      const key = `${data.answer_id}::${data.criterion_id}::${phase}`;
      currentKey = key;
      const v = lastVerdict.get(key);
      const it = itemFor(key, v, phase);
      const from = data.from as PlacementFlow | undefined;
      const event = data.event as PlacementEvent | undefined;
      if (!from || !event) continue;

      if (event.type === "DROP" && !it.started && v) {
        it.trigger = triggerFor(phase, v.item);
        it.started = true;
      }

      if (!exact) {
        if (event.type === "REPLY") {
          const node = from.kind === "chat" ? from.node : "";
          const label = event.label ?? null;
          let turn: ConvTurn;
          if (node === "askSure" && pendingClassify) {
            turn = { speaker: "participant", kind: "reply", text: pendingClassify.reply };
          } else if (node === "askSure" && label && QUICK_REPLY_TEXT[label]) {
            turn = { speaker: "participant", kind: "reply", text: QUICK_REPLY_TEXT[label] };
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
          pendingClassify = null;
        }

        const { effects } = transitionPlacement(from, event);
        const persona = v ? personaFor(phase, v.item) : "professor";
        for (const effect of effects) {
          if (effect.type === "say" && v) {
            it.turns.push({
              speaker: persona,
              kind: "scripted",
              text: scriptedLine(phase, effect.line, v.item),
            });
          }
          // `explain` lines are model-written; they arrive as the next
          // placement-explain exchange.
        }
      }

      const { next } = transitionPlacement(from, event);
      if (next.kind === "resolved") {
        it.outcome =
          next.how === "accepted"
            ? `Resolved — the participant stood by a correct call (attempt ${next.attempt}).`
            : `Resolved — the participant moved it after being told the answer (attempt ${next.attempt}).`;
      } else if (next.kind === "dragging" && next.revealed) {
        it.outcome = "Out of attempts — the AI revealed the correct answer.";
      }
      continue;
    }

    if (d.event === "ai_exchange" && !exact) {
      const route = String(data.route ?? "");
      const req = (data.request ?? {}) as Record<string, unknown>;
      const res = (data.response ?? {}) as Record<string, unknown>;

      if (route === "placement-classify") {
        pendingClassify = {
          reply: pick(req, ["reply", "message", "text"]),
          label: String(res.label ?? ""),
        };
        continue;
      }

      if (route === "placement-explain" && currentKey) {
        const it = items.get(currentKey);
        if (!it) continue;
        // The explain call carries the participant's reply that prompted it.
        const ta = typeof req.taMessage === "string" ? req.taMessage.trim() : "";
        const hole = unfilled.get(currentKey);
        if (ta && hole) {
          hole.text = ta;
          unfilled.delete(currentKey);
        }
        const text = pick(res, ["text"]);
        const persona = req.speaker === "student" ? "student" : "professor";
        if (text) it.turns.push({ speaker: persona, kind: "llm", text });
      }
    }
  }

  if (order.length === 0) return { task: null, exact };

  const list = order.map((k) => {
    const { phase: _phase, started: _started, ...item } = items.get(k)!;
    void _phase;
    void _started;
    return {
      ...item,
      trigger: item.trigger || "—",
      outcome: item.outcome || "—",
    };
  });

  const discussed = list.filter((i) => !i.outcome.startsWith("Accepted")).length;
  const firstMoves = order.map((k) => items.get(k)!.turns.find((t) => t.kind === "action"));
  const firstRight = firstMoves.filter((t) => t?.correct === true).length;
  return {
    exact,
    task: {
      task: "Apply Rubric",
      summary: `${firstRight}/${list.length} calls right on the first try · ${discussed} discussed with the AI.`,
      items: list,
    },
  };
}

/** Every task of the agent instruction, in stepper order. */
function agentTasksOf(list: LogDoc[]): { tasks: AgentTask[]; exact: boolean } {
  const sorted = [...list].sort((a, b) =>
    (a.timestamp ?? "").localeCompare(b.timestamp ?? "")
  );
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
  // LearnVia lesson time is measured from the lessons' own completion events
  // (each lesson logs its own elapsed seconds), summed across BOTH lessons per
  // participant. This is more reliable than page-dwell for the lesson arm, and
  // it is the actual on-task time across the two lessons.
  const lessonTotalsMin = completerLists
    .filter((l) => armOf(l) === "lesson")
    .map((l) => {
      const secs = l
        .filter((d) => d.event === "lesson_completed")
        .map((d) => Number(d.data?.seconds))
        .filter((n) => Number.isFinite(n) && n > 0);
      return secs.length ? secs.reduce((a, b) => a + b, 0) / 60 : null;
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
      postSurvey: surveyAnswerLines(
        "post",
        answersOf(latest(list, "survey_completed", "post"))
      ),
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
