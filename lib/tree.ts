import { FieldValue, type Firestore } from "firebase-admin/firestore";
import getFirestore from "@/lib/firestore";
import { getTest } from "@/lib/tests/definitions";
import { findItem, formatAnswer } from "@/lib/tests/format";
import type { TestItemAnswer } from "@/lib/tests/types";
import { getSurvey } from "@/lib/surveys/definitions";
import { getLesson } from "@/lib/lessons/definitions";
import { parseMulti, type SurveyItem } from "@/lib/surveys/types";

/**
 * A browsable mirror of the event log, shaped the way a person reads a study:
 *
 *   subjects/{subject_id}
 *     phases/{1-screening, 2-consent, 3-pre-survey, 4-pre-test, ...}
 *       items/{01-Q1, 02-Q2.1, ...}     one document per question
 *       events/{timestamp__id}          everything not tied to a question
 *       conversation/{timestamp__id}    the exchanges with the AI
 *
 * This is a *projection*, not the source of truth. The flat `logs` collection
 * stays exactly as it is and every analysis still reads it — it has the
 * event_id de-duplication and the retry semantics the study depends on, and a
 * bug in here must never be able to cost us a participant's data. Everything
 * below is written with merge, so re-running it is always safe.
 *
 * Phase folders are number-prefixed because the Firestore console sorts by
 * document id: without the prefix the study would read post-survey, pre-test,
 * screening. Question folders are prefixed for the same reason — survey
 * question ids are slugs that would otherwise sort alphabetically rather than
 * in the order people answered them.
 */

type Phase = { key: string; label: string };

const PHASE_BY_SCENARIO: Record<string, Phase> = {
  screening: { key: "1-screening", label: "Screening survey" },
  consent: { key: "2-consent", label: "Consent form" },
  pre: { key: "3-pre-survey", label: "Pre-survey" },
  pretest: { key: "4-pre-test", label: "Pre-test" },
  posttest: { key: "6-post-test", label: "Post-test" },
  post: { key: "7-post-survey", label: "Post-survey" },
};

const UNSORTED: Phase = { key: "9-unsorted", label: "Unsorted" };

/**
 * Scenario ids identify the phase: named for the surveys and tests, a bare
 * number for the teachable-agent scenario, a dotted unit number for a lesson.
 *
 * Both instruction arms sort into slot 5, since a participant only ever sees
 * one of them and they occupy the same position in the flow.
 */
function phaseFor(scenarioId: unknown): Phase {
  const id = typeof scenarioId === "string" ? scenarioId.trim() : "";
  if (!id) return UNSORTED;

  const known = PHASE_BY_SCENARIO[id];
  if (known) return known;

  if (id === "instruction") {
    return { key: "5-instruction", label: "Instruction (arm assignment)" };
  }

  if (/^\d+$/.test(id)) {
    return { key: "5-instruction", label: `Teachable-agent scenario ${id}` };
  }

  // Comparison arm. The source unit is spelled out here because nothing a
  // participant sees reaches this collection.
  if (/^lesson-\d+$/.test(id)) {
    const lesson = getLesson(id);
    return {
      key: `5-${id}`,
      label: lesson
        ? `Lesson ${lesson.sourceUnit} — ${lesson.title}`
        : `Lesson ${id}`,
    };
  }

  return UNSORTED;
}

/**
 * Firestore rejects ids containing "/", the ids "." and "..", and anything
 * matching __*__. Subject ids are free text, so none of that is hypothetical.
 */
function docId(raw: string): string {
  const cleaned = raw.replace(/\//g, "-").trim().slice(0, 400);
  if (!cleaned || cleaned === "." || cleaned === "..") return "unnamed";
  if (/^__.*__$/.test(cleaned)) return `id-${cleaned}`;
  return cleaned;
}

/** Zero-padded so the console's lexicographic order matches question order. */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Chronological ids, so an events folder reads top to bottom in order. */
function eventDocId(record: LogEntry): string {
  const stamp = typeof record.timestamp === "string" ? record.timestamp : "";
  const id = typeof record.event_id === "string" ? record.event_id : "";
  if (!stamp) return docId(id || "unknown");
  return docId(`${stamp}__${id.slice(0, 8)}`);
}

/** Firestore rejects undefined values outright, so strip them before writing. */
function clean<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((v) => v !== undefined).map(clean) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = clean(v);
    }
    return out as T;
  }
  return value;
}

export type LogEntry = Record<string, unknown>;

type TreeItem = {
  /** Document id, order-prefixed. */
  id: string;
  item_id: string;
  order: number;
  section?: string;
  question: string;
  answer: string;
};

/* ---------------------------------------------------------------- tests --- */

/** Definition order across sections, so Q2.3 sorts after Q2.2 and before Q3.1. */
function testOrder(testId: string): Map<string, number> {
  const order = new Map<string, number>();
  const test = getTest(testId);
  if (!test) return order;

  let index = 1;
  for (const section of test.sections) {
    for (const item of section.items) order.set(item.id, index++);
  }
  return order;
}

function testItemDoc(
  testId: string,
  itemId: string,
  answer: unknown
): TreeItem | null {
  const test = getTest(testId);
  if (!test) return null;

  const found = findItem(test, itemId);
  if (!found) return null;

  const order = testOrder(testId).get(itemId) ?? 99;

  return {
    id: `${pad(order)}-Q${itemId}`,
    item_id: itemId,
    order,
    section: found.scenario,
    question: found.item.prompt,
    answer: formatAnswer(found.item, answer as TestItemAnswer | undefined),
  };
}

/* -------------------------------------------------------------- surveys --- */

/**
 * The answer as a person would read it, not as it is stored. A multi-select
 * lands in the log as "a|c" and a choice as a bare option id; both are
 * meaningless in the console without the option text.
 */
function renderSurveyAnswer(item: SurveyItem, raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "(no answer)";

  const label = (id: string) =>
    item.choices?.find((c) => c.id === id)?.text ?? id;

  if (item.kind === "multi") {
    return parseMulti(value).map(label).join("; ") || "(no answer)";
  }
  if (item.kind === "choice") return label(value);
  if (item.kind === "likert" && item.likert) {
    const { min, max, minLabel, maxLabel } = item.likert;
    return `${value}  (${min} = ${minLabel} … ${max} = ${maxLabel})`;
  }
  return value;
}

function surveyItemDocs(
  surveyId: string,
  answers: Record<string, unknown>
): TreeItem[] {
  const survey = getSurvey(surveyId);
  if (!survey) return [];

  const docs: TreeItem[] = [];
  let index = 1;

  for (const section of survey.sections) {
    for (const item of section.items) {
      const order = index++;
      const raw = answers[item.id];
      docs.push({
        id: `${pad(order)}-${docId(item.id)}`,
        item_id: item.id,
        order,
        section: section.title,
        question: item.prompt,
        answer: renderSurveyAnswer(item, typeof raw === "string" ? raw : undefined),
      });
    }
  }

  return docs;
}

/* -------------------------------------------------------------- lessons --- */

/**
 * One document per lesson question, carrying the prompt alongside what was
 * typed or chosen.
 *
 * Merged on the question id, so repeated attempts converge onto one document
 * showing the latest response — the full attempt history stays in the events
 * folder, where first-try correctness can still be read off.
 */
function lessonItemDoc(
  lessonId: string,
  data: Record<string, unknown>
): TreeItem | null {
  const lesson = getLesson(lessonId);
  const itemId = typeof data.item_id === "string" ? data.item_id : "";
  if (!lesson || !itemId) return null;

  const questions = lesson.sections.flatMap((s) => s.questions ?? []);
  const index = questions.findIndex((q) => q.id === itemId);
  if (index < 0) return null;

  const question = questions[index];
  const order = index + 1;

  // A choice id means nothing in the console; show the option that id refers to.
  const response = String(data.response ?? "");
  const answer =
    question.kind === "choice"
      ? question.choices?.find((c) => c.id === response)?.label ||
        (question.choices?.find((c) => c.id === response)?.labelImage
          ? "(diagram option)"
          : response)
      : response;

  return {
    id: `${pad(order)}-Q${order}`,
    item_id: itemId,
    order,
    section: question.kind === "choice" ? "Multiple choice" : "Short answer",
    question: question.prompt,
    answer: `${answer}${data.is_correct ? "  ✓" : "  ✗"} (attempt ${data.attempt ?? 1})`,
  };
}

/* --------------------------------------------------------- conversation --- */

/**
 * Best-effort readable view of one AI exchange. The request and response bodies
 * differ by route, so this reaches for the common shapes and keeps the raw
 * payload alongside rather than guessing and losing it.
 */
function conversationDoc(data: Record<string, unknown>) {
  const request = data.request as Record<string, unknown> | undefined;
  const response = data.response as Record<string, unknown> | undefined;

  let prompt = "";
  const messages = request?.messages;
  if (Array.isArray(messages) && messages.length) {
    const last = messages[messages.length - 1] as Record<string, unknown>;
    prompt = typeof last?.content === "string" ? last.content : "";
  }
  if (!prompt) {
    for (const key of ["prompt", "message", "text", "input", "question"]) {
      const candidate = request?.[key];
      if (typeof candidate === "string" && candidate) {
        prompt = candidate;
        break;
      }
    }
  }

  let reply = "";
  for (const key of ["reply", "content", "message", "text", "output", "feedback"]) {
    const candidate = response?.[key];
    if (typeof candidate === "string" && candidate) {
      reply = candidate;
      break;
    }
  }

  return {
    route: data.route ?? null,
    prompt: prompt || "(could not extract — see raw_request)",
    reply: reply || "(could not extract — see raw_response)",
    ok: data.ok ?? null,
    duration_ms: data.duration_ms ?? null,
    raw_request: request ?? null,
    raw_response: response ?? null,
  };
}

/* ---------------------------------------------------------------- write --- */

export type Op = {
  ref: FirebaseFirestore.DocumentReference;
  data: Record<string, unknown>;
};

/** Firestore caps a batch at 500 operations. */
const BATCH_LIMIT = 450;

/**
 * The documents one event produces. Takes the database rather than reaching for
 * it, so the shape of the tree can be exercised against a stub — this is the
 * part worth checking, and it should not require live credentials to do so.
 */
export function opsFor(db: Firestore, entry: LogEntry): Op[] {
  const subjectId =
    typeof entry.subject_id === "string" ? entry.subject_id.trim() : "";
  if (!subjectId) return [];

  const event = typeof entry.event === "string" ? entry.event : "";
  const scenarioId = entry.scenario_id;
  const phase = phaseFor(scenarioId);
  const timestamp = entry.timestamp ?? null;
  const data = (entry.data ?? {}) as Record<string, unknown>;

  const subjectRef = db.collection("subjects").doc(docId(subjectId));
  const phaseRef = subjectRef.collection("phases").doc(phase.key);

  const ops: Op[] = [
    {
      ref: subjectRef,
      // Deliberately no name. Names live in `consents`, which the consent text
      // promises is kept separate from study data.
      data: {
        subject_id: subjectId,
        prolific_pid: entry.prolific_pid ?? null,
        last_seen: timestamp,
        updated_at: FieldValue.serverTimestamp(),
      },
    },
    {
      ref: phaseRef,
      data: {
        subject_id: subjectId,
        phase: phase.key,
        label: phase.label,
        scenario_id: scenarioId ?? null,
        updated_at: FieldValue.serverTimestamp(),
      },
    },
  ];

  // Unique per phase, so these never overwrite each other.
  if (event === "test_started") {
    ops.push({ ref: phaseRef, data: { started_at: timestamp } });
  }
  if (event.endsWith("_completed") || event === "consent_given") {
    ops.push({ ref: phaseRef, data: { completed_at: timestamp } });
  }

  const items: TreeItem[] = [];

  if (event === "test_item_answered" && typeof scenarioId === "string") {
    const itemId = typeof data.item_id === "string" ? data.item_id : "";
    const doc = itemId ? testItemDoc(scenarioId, itemId, data.answer) : null;
    if (doc) items.push(doc);
  }

  if (event === "test_completed" && typeof scenarioId === "string") {
    const answers = (data.answers ?? {}) as Record<string, unknown>;
    for (const itemId of Object.keys(answers)) {
      const doc = testItemDoc(scenarioId, itemId, answers[itemId]);
      if (doc) items.push(doc);
    }
  }

  if (event === "lesson_item_attempted" && typeof scenarioId === "string") {
    const doc = lessonItemDoc(scenarioId, data);
    if (doc) items.push(doc);
  }

  if (
    (event === "survey_completed" || event === "screening_completed") &&
    typeof scenarioId === "string"
  ) {
    const answers = (data.answers ?? {}) as Record<string, unknown>;
    items.push(...surveyItemDocs(scenarioId, answers));
  }

  for (const item of items) {
    ops.push({
      ref: phaseRef.collection("items").doc(item.id),
      data: {
        item_id: item.item_id,
        order: item.order,
        section: item.section ?? null,
        question: item.question,
        answer: item.answer,
        answered_at: timestamp,
      },
    });
  }

  // The AI exchanges go to their own folder rather than into events: the raw
  // payloads are large, and the whole point is to be able to read a
  // conversation without wading through step transitions.
  if (event === "ai_exchange") {
    ops.push({
      ref: phaseRef.collection("conversation").doc(eventDocId(entry)),
      data: { ...conversationDoc(data), timestamp, event_id: entry.event_id ?? null },
    });
  } else {
    ops.push({
      ref: phaseRef.collection("events").doc(eventDocId(entry)),
      data: {
        event,
        timestamp,
        session_id: entry.session_id ?? null,
        event_id: entry.event_id ?? null,
        data,
      },
    });
  }

  return ops;
}

/**
 * Collapses repeated writes to the same document.
 *
 * Every event touches its subject and phase document, so a batch of twenty
 * events would otherwise write the same two documents twenty times — on a free
 * Firestore plan that burns the daily write quota for no benefit. Ops arrive in
 * event order and merge in that order, so the last value still wins, which is
 * the same result the individual writes would have produced.
 */
export function dedupe(ops: Op[]): Op[] {
  const merged = new Map<string, Op>();

  for (const op of ops) {
    const existing = merged.get(op.ref.path);
    if (existing) existing.data = { ...existing.data, ...op.data };
    else merged.set(op.ref.path, { ref: op.ref, data: { ...op.data } });
  }

  return [...merged.values()];
}

/**
 * Mirrors events into the browsable tree.
 *
 * Every write is a merge keyed by a deterministic document id, so replaying the
 * same events — a client retry, or a full rebuild — converges rather than
 * duplicating.
 */
export async function mirrorEvents(entries: LogEntry[]): Promise<number> {
  const db = getFirestore();
  const ops = dedupe(entries.flatMap((entry) => opsFor(db, entry)));
  if (!ops.length) return 0;

  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + BATCH_LIMIT)) {
      batch.set(op.ref, clean(op.data), { merge: true });
    }
    await batch.commit();
  }

  return ops.length;
}
