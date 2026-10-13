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
};

export type InstructionSummary = {
  armCounts: { agent: number; lesson: number };
  lessonFirstTry: { itemId: string; firstTryRate: number; n: number }[];
  lessonMedianMin: number | null;
  lessonMedianHints: number | null;
  /** Average number of AI interactions per part, across agent completers. */
  avgAiPerPart: { part: string; avg: number; total: number }[];
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

/** One turn in a reconstructed Apply-Rubric discussion. */
export type ConvTurn = {
  speaker: "professor" | "ta";
  /** scripted = canned flow line; llm = model-written; action = the TA's own move/words. */
  kind: "scripted" | "llm" | "action";
  text: string;
};

/**
 * One criterion's discussion thread in the Apply-Rubric step — either the
 * placement (which step it belongs on) or the pass/fail decision, rebuilt turn
 * by turn from the flow transitions (scripted lines) interleaved with the LLM
 * exchanges.
 */
export type ConvThread = {
  heading: string;
  phase: "placement" | "status" | "question";
  outcome: string;
  turns: ConvTurn[];
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
  /** Agent arm: the reconstructed conversation, grouped by criterion/phase. */
  agentThreads: ConvThread[];
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

/** Lesson-arm per-question attempts, in order. */
function lessonItemsOf(list: LogDoc[]): LessonItemDetail[] {
  const first = new Map<
    string,
    { firstTryCorrect: boolean; attempts: number; at: string }
  >();
  const hints = new Map<string, number>();
  for (const d of [...list].sort((a, b) =>
    (a.timestamp ?? "").localeCompare(b.timestamp ?? "")
  )) {
    if (d.event === "lesson_hint_shown") {
      const id = String(d.data?.item_id ?? "");
      if (id) hints.set(id, (hints.get(id) ?? 0) + 1);
    }
    if (d.event !== "lesson_item_attempted") continue;
    const id = String(d.data?.item_id ?? "");
    if (!id) continue;
    const e = first.get(id);
    if (!e) {
      first.set(id, {
        firstTryCorrect: d.data?.is_correct === true,
        attempts: 1,
        at: d.timestamp ?? "",
      });
    } else {
      e.attempts += 1;
    }
  }
  return [...first.entries()]
    .map(([itemId, e]) => ({
      itemId,
      firstTryCorrect: e.firstTryCorrect,
      attempts: e.attempts,
      hints: hints.get(itemId) ?? 0,
      at: e.at,
    }))
    .sort((a, b) => a.at.localeCompare(b.at));
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

  // Apply Rubric: latest placement + pass/fail verdict per criterion. Each
  // criterion is both dropped on a step (stepCorrect) and marked pass/fail
  // (statusCorrect); both count toward how well the TA judged the work.
  const verdicts = new Map<
    string,
    { stepCorrect: boolean; statusCorrect: boolean }
  >();
  for (const d of sorted) {
    if (d.event !== "grade_lines_criterion_graded") continue;
    const key = `${d.data?.answer_id ?? ""}::${d.data?.criterion_id ?? ""}`;
    const p = d.data?.placement as Record<string, unknown> | undefined;
    if (!p) continue;
    const prev = verdicts.get(key) ?? { stepCorrect: false, statusCorrect: false };
    verdicts.set(key, {
      stepCorrect: p.stepCorrect === true,
      // status is only set on the pass/fail phase; keep an earlier true.
      statusCorrect: p.statusCorrect === true || prev.statusCorrect,
    });
  }
  const vlist = [...verdicts.values()];
  const stepOk = vlist.filter((v) => v.stepCorrect).length;
  const statusOk = vlist.filter((v) => v.statusCorrect).length;
  const jTotal = vlist.length;

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
      if (jTotal) {
        scoreLabel = `${stepOk}/${jTotal} placed right, ${statusOk}/${jTotal} marked right`;
        rate = (stepOk + statusOk) / (2 * jTotal);
      }
    }

    return { part: label, scoreLabel, rate, seconds, aiRuns };
  });

  // Keep only parts the participant actually touched.
  return parts.filter(
    (p) => p.seconds != null || p.aiRuns > 0 || p.rate != null || p.scoreLabel !== "—"
  );
}

type FlowCtx = {
  criterionLabel: string;
  placedStep: number | null;
  expectedStep: number;
  marked: "pass" | "fail" | null;
  expected: "pass" | "fail" | null;
};

function emptyCtx(): FlowCtx {
  return {
    criterionLabel: "",
    placedStep: null,
    expectedStep: 0,
    marked: null,
    expected: null,
  };
}

/** Render a scripted flow line for whichever phase the thread is in. */
function scriptedLine(
  phase: "placement" | "status",
  line: PlacementLineId,
  ctx: FlowCtx
): string {
  return phase === "status"
    ? statusLine(line, {
        marked: ctx.marked,
        expected: ctx.expected,
        placedStep: ctx.placedStep,
      })
    : placementLine(line, {
        criterionLabel: ctx.criterionLabel,
        placedStep: ctx.placedStep,
        expectedStep: ctx.expectedStep,
      });
}

const REPLY_PHRASE: Record<string, string> = {
  yes: "Yes, I'm keeping it.",
  no: "No, I'm not sure.",
  unclear: "(reply the AI couldn't read as yes/no)",
};

/**
 * Rebuild the Apply-Rubric conversation for one agent participant.
 *
 * The visible dialogue is a deterministic state machine (lib/placement-flow.ts,
 * shared by placement and pass/fail) with a few lines written by the model. So
 * the transcript is reconstructed by replaying each logged transition to get
 * its scripted lines, and splicing in the model-written lines and the TA's
 * free-text replies from the AI exchanges — grouped per criterion and phase.
 */
function agentConversation(list: LogDoc[]): ConvThread[] {
  const sorted = [...list].sort((a, b) =>
    (a.timestamp ?? "").localeCompare(b.timestamp ?? "")
  );

  const threads = new Map<string, ConvThread>();
  const ctxByKey = new Map<string, FlowCtx>();
  let currentKey: string | null = null;
  let pendingReply: string | null = null;

  const questionThread: ConvThread = {
    heading: "Question — explanation feedback",
    phase: "question",
    outcome: "",
    turns: [],
  };

  const threadFor = (
    answer: string,
    criterion: string,
    phase: "placement" | "status",
    ctx: FlowCtx
  ): ConvThread => {
    const key = `${answer}::${criterion}::${phase}`;
    let t = threads.get(key);
    if (!t) {
      const name = ctx.criterionLabel || criterion || "criterion";
      t = {
        heading: `Apply Rubric · ${name} · ${
          phase === "status" ? "pass/fail" : "placement"
        }`,
        phase,
        outcome: "",
        turns: [],
      };
      threads.set(key, t);
    }
    return t;
  };

  for (const d of sorted) {
    const data = (d.data ?? {}) as Record<string, unknown>;

    if (d.event === "grade_lines_criterion_graded") {
      const answer = String(data.answer_id ?? "");
      const criterion = String(data.criterion_id ?? "");
      const phase = data.phase === "status" ? "status" : "placement";
      const key = `${answer}::${criterion}::${phase}`;
      const p = (data.placement ?? {}) as Record<string, unknown>;
      const ctx = ctxByKey.get(key) ?? emptyCtx();
      if (typeof p.placedStep === "number") ctx.placedStep = p.placedStep;
      if (typeof p.expectedStep === "number") ctx.expectedStep = p.expectedStep;
      if (p.status === "pass" || p.status === "fail") ctx.marked = p.status;
      if (p.expectedStatus === "pass" || p.expectedStatus === "fail")
        ctx.expected = p.expectedStatus;
      ctxByKey.set(key, ctx);
      currentKey = key;
      continue;
    }

    if (
      d.event === "grade_lines_placement_transition" ||
      d.event === "grade_lines_status_transition"
    ) {
      const phase =
        d.event === "grade_lines_status_transition" ? "status" : "placement";
      const answer = String(data.answer_id ?? "");
      const criterion = String(data.criterion_id ?? "");
      const key = `${answer}::${criterion}::${phase}`;
      currentKey = key;
      const ctx = ctxByKey.get(key) ?? emptyCtx();
      ctxByKey.set(key, ctx);
      const thread = threadFor(answer, criterion, phase, ctx);

      const from = data.from as PlacementFlow | undefined;
      const event = data.event as PlacementEvent | undefined;
      if (!from || !event) continue;

      // The TA's own move / reply that drives this transition.
      if (event.type === "DROP") {
        thread.turns.push({
          speaker: "ta",
          kind: "action",
          text:
            phase === "status"
              ? `Marked it ${(ctx.marked ?? "?").toUpperCase()}.`
              : `Dragged "${ctx.criterionLabel || criterion}" onto step ${
                  ctx.placedStep ?? "?"
                }.`,
        });
      } else {
        thread.turns.push({
          speaker: "ta",
          kind: "action",
          text:
            pendingReply ??
            REPLY_PHRASE[event.label ?? "unclear"] ??
            "(reply)",
        });
        pendingReply = null;
      }

      // Replay the state machine to get the scripted professor lines.
      const { next, effects } = transitionPlacement(from, event);
      for (const effect of effects) {
        if (effect.type === "say") {
          thread.turns.push({
            speaker: "professor",
            kind: "scripted",
            text: scriptedLine(phase, effect.line, ctx),
          });
        }
        // `explain` effects are model-written: filled by the placement-explain
        // exchange that follows this transition.
      }
      if (next.kind === "resolved") {
        thread.outcome =
          next.how === "accepted"
            ? `Resolved — stood by the call (attempt ${next.attempt}).`
            : `Resolved — moved after being told (attempt ${next.attempt}).`;
      }
      continue;
    }

    if (d.event === "ai_exchange") {
      const route = String(data.route ?? "");
      const req = (data.request ?? {}) as Record<string, unknown>;
      const res = (data.response ?? {}) as Record<string, unknown>;

      // Keep the criterion label / steps fresh for scripted-line rendering.
      if (currentKey) {
        const ctx = ctxByKey.get(currentKey) ?? emptyCtx();
        if (typeof req.criterionLabel === "string")
          ctx.criterionLabel = req.criterionLabel;
        if (typeof req.placedStep === "number") ctx.placedStep = req.placedStep;
        if (typeof req.expectedStep === "number")
          ctx.expectedStep = req.expectedStep;
        ctxByKey.set(currentKey, ctx);
      }

      if (route === "question-feedback") {
        const student = pick(req, ["explanation", "answer", "text"]);
        const ai = pick(res, ["feedback", "reply", "comment", "text"]);
        if (student)
          questionThread.turns.push({
            speaker: "ta",
            kind: "action",
            text: student,
          });
        if (ai)
          questionThread.turns.push({ speaker: "professor", kind: "llm", text: ai });
        continue;
      }

      if (route === "placement-classify") {
        // The TA's free answer to "Are you sure?" — attached to the REPLY
        // transition that immediately follows.
        pendingReply = pick(req, ["reply", "message", "text"]) || pendingReply;
        continue;
      }

      // The remaining routes are model-written professor lines in the current
      // thread (affirm/hint/reveal, line feedback, or open chat).
      const target =
        currentKey && threads.get(currentKey)
          ? threads.get(currentKey)!
          : null;
      if (!target) continue;

      if (route === "grade-chat") {
        const student = pick(req, ["message", "reply", "text"]);
        if (student)
          target.turns.push({ speaker: "ta", kind: "action", text: student });
      }
      const ai = pick(res, ["text", "reply", "feedback", "comment", "message"]);
      if (ai) target.turns.push({ speaker: "professor", kind: "llm", text: ai });
    }
  }

  const out: ConvThread[] = [];
  if (questionThread.turns.length) out.push(questionThread);
  out.push(...threads.values());
  return out;
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

  const phases: PhaseTiming[] = [
    { key: "pre_survey", label: "Pre-survey", ...medPhase("pre_survey") },
    { key: "pretest", label: "Pre-test", ...medPhase("pretest") },
    {
      key: "instruction_agent",
      label: "Instruction (agent)",
      ...medPhase("scenarios", (x) => x.arm === "agent"),
    },
    {
      key: "lesson",
      label: "LearnVia lesson (both lessons)",
      medianMin: median(lessonTotalsMin),
      n: lessonTotalsMin.length,
    },
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
      agentThreads: arm === "agent" ? agentConversation(list) : [],
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
    },
    participants,
  };
}
