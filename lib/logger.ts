import { UNKNOWN_SUBJECT_ID, getSubjectId } from "@/lib/subject";
import { isNonParticipantContext } from "@/lib/preview";
import { getProlificIds } from "@/lib/prolific";

/** Events from the /pilot flow are tagged so the server stores them separately. */
function isPilotRoute(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/pilot")
  );
}

const QUEUE_KEY = "logQueue";

/**
 * In-memory copy of the queue, used when localStorage can't hold it (quota
 * full, storage blocked). Nothing is ever dropped to make room: an event that
 * can't be persisted is still kept here and delivered on the next flush.
 */
let memoryQueue: LogEntry[] | null = null;

export type LogEntry = {
  event_id: string;
  subject_id: string;
  /** Groups one uninterrupted run in one tab, independent of subject_id. */
  session_id: string;
  /**
   * Prolific's launch parameters, captured from the entry URL so a submission
   * can be reconciled on Prolific. All present when the participant arrived from
   * Prolific; null otherwise. prolific_session_id is Prolific's SESSION_ID, not
   * the per-tab session_id above.
   */
  prolific_pid: string | null;
  prolific_study_id: string | null;
  prolific_session_id: string | null;
  timestamp: string;
  event: string;
  scenario_id: string;
  /** "pilot" for events from the /pilot flow, kept in a separate store. */
  study?: string;
  /**
   * Monotonic per-browser counter. Several events are often logged in the same
   * millisecond (e.g. a reply, the decision it triggers, and the AI's next
   * line), so the timestamp alone cannot order them; this can.
   */
  seq?: number;
  data: Record<string, unknown>;
};

export type LogStatus = "ok" | "pending" | "failing";

export type LogState = {
  status: LogStatus;
  queued: number;
  lastError: string | null;
};

const INITIAL_LOG_STATE: LogState = { status: "ok", queued: 0, lastError: null };

let state: LogState = INITIAL_LOG_STATE;
const listeners = new Set<() => void>();
let flushing = false;

function emit(next: Partial<LogState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

/** Snapshot getters and subscribe are shaped for useSyncExternalStore. */
export function getLogState(): LogState {
  return state;
}

export function getServerLogState(): LogState {
  return INITIAL_LOG_STATE;
}

export function subscribeLogState(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const SEQ_KEY = "logSeq";
let memorySeq = 0;

/** Next value of the per-browser event counter (falls back to in-memory). */
function nextSeq(): number {
  try {
    const next = Math.max(Number(localStorage.getItem(SEQ_KEY)) || 0, memorySeq) + 1;
    localStorage.setItem(SEQ_KEY, String(next));
    memorySeq = next;
    return next;
  } catch {
    memorySeq += 1;
    return memorySeq;
  }
}

function newEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const SESSION_ID_KEY = "logSessionId";

/**
 * Per-tab session identifier. Deliberately sessionStorage: a new tab is a new
 * run, which is what you want when reconstructing how long a sitting took, even
 * if the same subject comes back later.
 */
function getSessionId(): string {
  if (typeof window === "undefined") return "unknown";

  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = newEventId();
      sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

function readQueue(): LogEntry[] {
  if (typeof window === "undefined") return [];
  if (memoryQueue) return memoryQueue;

  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LogEntry[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(entries: LogEntry[]) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
    memoryQueue = null;
  } catch (err) {
    // Storage full or blocked: keep every event in memory instead of losing it.
    memoryQueue = entries;
    console.error("[logger] could not persist the log queue; holding it in memory:", err);
  }
}

/**
 * Browsers reject a `keepalive` request (and a sendBeacon) whose body is over
 * 64 KiB. Every batch is kept under this, so every upload can survive the tab
 * closing mid-request.
 */
const KEEPALIVE_MAX_BYTES = 60 * 1024;

/** Cap on one request — kept under the keepalive limit (see above). */
const BATCH_MAX_BYTES = KEEPALIVE_MAX_BYTES;

/** Most batches sent in one flush before yielding (each is confirmed first). */
const MAX_BATCHES_PER_FLUSH = 50;

const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;

/** The oldest events that fit in one request, in order (always at least one). */
function takeBatch(queue: LogEntry[]): LogEntry[] {
  const batch: LogEntry[] = [];
  let bytes = 16;
  for (const entry of queue) {
    const size = utf8Bytes(JSON.stringify(entry)) + 1;
    if (batch.length && bytes + size > BATCH_MAX_BYTES) break;
    batch.push(entry);
    bytes += size;
  }
  return batch;
}

/**
 * Delivers everything buffered locally, in size-bounded batches, until the
 * queue is empty. Entries stay in the queue until the server confirms it wrote
 * them, so a failed request (offline, 500, missing Firebase credentials) is
 * retried on the next event, on the next page load, and when the browser comes
 * back online instead of being silently dropped.
 *
 * This used to send the WHOLE queue as one keepalive request. AI exchanges are
 * large, so a few queued together could exceed the browser's 64 KiB keepalive
 * limit; that request failed every time, the queue only grew, and the rest of
 * the participant's session was never delivered.
 */
export async function flushLogQueue(): Promise<void> {
  if (typeof window === "undefined" || flushing) return;

  flushing = true;
  let attempted = 0;

  try {
    for (let i = 0; i < MAX_BATCHES_PER_FLUSH; i++) {
      const queue = readQueue();
      if (!queue.length) {
        emit({ status: "ok", queued: 0, lastError: null });
        return;
      }

      const batch = takeBatch(queue);
      attempted = batch.length;
      const body = JSON.stringify({ entries: batch });

      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        // Lets the last events survive the tab closing — but only legal when small.
        keepalive: utf8Bytes(body) <= KEEPALIVE_MAX_BYTES,
      });

      if (!res.ok) {
        throw new Error(`/api/log responded ${res.status}`);
      }

      const reply = await res.json().catch(() => null);
      // The server reports which events (if any) it could not store; every
      // other event in the batch is safely written and leaves the queue.
      const failed = new Set<string>(
        Array.isArray(reply?.failed) ? (reply.failed as string[]) : []
      );
      if (!reply?.ok && failed.size === 0) {
        throw new Error(reply?.error ?? "/api/log reported failure");
      }

      // Re-read rather than reusing `queue`: events logged while the request
      // was in flight must survive.
      const delivered = new Set(
        batch.map((entry) => entry.event_id).filter((id) => !failed.has(id))
      );
      const remaining = readQueue().filter(
        (entry) => !delivered.has(entry.event_id)
      );
      writeQueue(remaining);
      emit({
        status: failed.size ? "failing" : remaining.length ? "pending" : "ok",
        queued: remaining.length,
        lastError: failed.size ? `${failed.size} event(s) not stored yet` : null,
      });
      // Retry the ones the server couldn't store on the next flush, not now.
      if (failed.size) return;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[logger] failed to deliver ${attempted} event(s); they stay queued and will be retried:`,
      err
    );
    emit({ status: "failing", queued: readQueue().length, lastError: message });
  } finally {
    flushing = false;
  }
}

/**
 * Last-chance delivery when the page is hidden or closed: hands every queued
 * event to the browser via sendBeacon, which survives the page unloading,
 * in chunks under the 64 KiB beacon limit. Events stay queued (a beacon can't
 * confirm delivery); the server de-duplicates by event_id, so resending them
 * on a later visit is harmless.
 */
export function beaconLogQueue(): void {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  if (typeof navigator.sendBeacon !== "function") return;
  let rest = readQueue();
  while (rest.length) {
    const batch = takeBatch(rest);
    const body = JSON.stringify({ entries: batch });
    const sent = navigator.sendBeacon(
      "/api/log",
      new Blob([body], { type: "application/json" })
    );
    if (!sent) break;
    rest = rest.slice(batch.length);
  }
}

export async function logEvent(
  event: string,
  scenarioId: string | number,
  data: Record<string, unknown>
) {
  if (typeof window === "undefined") return;

  // Instructor preview and instructor tooling must never reach the study data.
  // Dropping the event here covers every call site at once, so no page can
  // forget to opt out.
  if (isNonParticipantContext()) return;

  const subjectId = getSubjectId();
  if (subjectId === UNKNOWN_SUBJECT_ID) {
    console.warn(
      `[logger] "${event}" is being logged without a subject ID; it will be attributed to "${UNKNOWN_SUBJECT_ID}".`
    );
  }

  // Recorded from the launch URL, so events are attributable even before the
  // subject ID is entered in the pre-survey.
  const prolific = getProlificIds();

  const entry: LogEntry = {
    event_id: newEventId(),
    subject_id: subjectId,
    session_id: getSessionId(),
    prolific_pid: prolific.pid,
    prolific_study_id: prolific.studyId,
    prolific_session_id: prolific.sessionId,
    timestamp: new Date().toISOString(),
    seq: nextSeq(),
    event,
    scenario_id: String(scenarioId),
    // Events from the /pilot flow are tagged so the server routes them to a
    // separate collection, keeping the pilot's data out of the main study.
    ...(isPilotRoute() ? { study: "pilot" } : {}),
    data,
  };

  const queue = readQueue();
  queue.push(entry);
  writeQueue(queue);
  emit({ status: "pending", queued: queue.length });

  await flushLogQueue();
}
