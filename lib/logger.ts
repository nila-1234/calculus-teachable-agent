import { UNKNOWN_SUBJECT_ID, getSubjectId } from "@/lib/subject";

const QUEUE_KEY = "logQueue";

/**
 * Cap on locally buffered events. A full study session is a few hundred events,
 * so this holds an entire run offline; past it the oldest are dropped rather
 * than letting localStorage fill up and start throwing.
 */
const MAX_QUEUE = 1000;

export type LogEntry = {
  event_id: string;
  subject_id: string;
  /** Groups one uninterrupted run in one tab, independent of subject_id. */
  session_id: string;
  timestamp: string;
  event: string;
  scenario_id: string;
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
    localStorage.setItem(QUEUE_KEY, JSON.stringify(entries.slice(-MAX_QUEUE)));
  } catch (err) {
    console.error("[logger] could not persist the log queue:", err);
  }
}

/**
 * Delivers everything buffered locally. Entries stay in the queue until the
 * server confirms it wrote them, so a failed request (offline, 500, missing
 * Firebase credentials) is retried on the next event, on the next page load, and when
 * the browser comes back online instead of being silently dropped.
 */
export async function flushLogQueue(): Promise<void> {
  if (typeof window === "undefined" || flushing) return;

  const batch = readQueue();
  if (!batch.length) {
    emit({ status: "ok", queued: 0 });
    return;
  }

  flushing = true;

  try {
    const res = await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: batch }),
      keepalive: true,
    });

    if (!res.ok) {
      throw new Error(`/api/log responded ${res.status}`);
    }

    const body = await res.json().catch(() => null);
    if (!body?.ok) {
      throw new Error(body?.error ?? "/api/log reported failure");
    }

    // Re-read rather than reusing `batch`: events logged while the request was
    // in flight must survive.
    const delivered = new Set(batch.map((entry) => entry.event_id));
    const remaining = readQueue().filter(
      (entry) => !delivered.has(entry.event_id)
    );
    writeQueue(remaining);
    emit({ status: "ok", queued: remaining.length, lastError: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[logger] failed to deliver ${batch.length} event(s); they stay queued and will be retried:`,
      err
    );
    emit({ status: "failing", queued: batch.length, lastError: message });
  } finally {
    flushing = false;
  }
}

export async function logEvent(
  event: string,
  scenarioId: string | number,
  data: Record<string, unknown>
) {
  if (typeof window === "undefined") return;

  const subjectId = getSubjectId();
  if (subjectId === UNKNOWN_SUBJECT_ID) {
    console.warn(
      `[logger] "${event}" is being logged without a subject ID; it will be attributed to "${UNKNOWN_SUBJECT_ID}".`
    );
  }

  const entry: LogEntry = {
    event_id: newEventId(),
    subject_id: subjectId,
    session_id: getSessionId(),
    timestamp: new Date().toISOString(),
    event,
    scenario_id: String(scenarioId),
    data,
  };

  const queue = readQueue();
  queue.push(entry);
  writeQueue(queue);
  emit({ status: "pending", queued: queue.length });

  await flushLogQueue();
}
