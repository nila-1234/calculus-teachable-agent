import { getSubjectId } from "@/lib/subject";
import { isPreviewActive } from "@/lib/preview";
import { LESSON_SEQUENCE, lessonPath } from "@/lib/lessons/definitions";

/**
 * Which instruction a participant receives.
 *
 * Names are deliberately neutral. Participants can read the URL and, with some
 * effort, the JavaScript bundle; a value called "control" would tell them which
 * arm they are in, and knowing you are the comparison group changes how you
 * engage with it. These say what the activity *is*, not what it is for:
 *
 *   "agent"  — the teachable-agent scenario   (/5/question …)
 *   "lesson" — the ported lesson sequence     (/lesson/1, /lesson/2)
 *
 * The lesson routes are numbered by position rather than by the course units
 * they were ported from, for the same reason: the unit number is a pointer to
 * the source module.
 *
 * For analysis, "lesson" is the comparison condition. That mapping lives here
 * and in the Firestore labels, never in anything a participant sees.
 */

export const CONDITIONS = ["agent", "lesson"] as const;
export type Condition = (typeof CONDITIONS)[number];

/** Lets the instructor preview a specific arm: ?cond=lesson */
const CONDITION_PARAM = "cond";

/**
 * FNV-1a. Not for security — just a stable, well-spread mapping from an
 * arbitrary subject id to a bucket.
 */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Keyed by subject, not a bare "condition".
 *
 * Resetting between participants clears the subject id but not everything else
 * in localStorage, so a shared key would hand the next person on that machine
 * the previous participant's arm — silently, with nothing looking wrong. Tying
 * the cache to the subject means a new subject simply has no cached assignment.
 */
function cacheKey(): string {
  return `condition:${getSubjectId()}`;
}

function readCache(): Condition | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(cacheKey());
    return (CONDITIONS as readonly string[]).includes(stored ?? "")
      ? (stored as Condition)
      : null;
  } catch {
    return null;
  }
}

function writeCache(condition: Condition): void {
  try {
    localStorage.setItem(cacheKey(), condition);
  } catch {
    /* ignore unavailable storage */
  }
}

/**
 * The arm to use if the server cannot be reached.
 *
 * A hash of the subject id, so the same participant always falls back the same
 * way rather than flipping between arms across reloads.
 */
function fallbackCondition(): Condition {
  return CONDITIONS[hash(getSubjectId()) % CONDITIONS.length];
}

/**
 * The participant's arm, resolved against the server so the split is balanced
 * by construction rather than by luck.
 *
 * Cached locally after the first call: assignment is decided once, and every
 * later read is a local lookup. If the server cannot be reached the hash
 * fallback is used *and cached*, because a participant flipping arms partway
 * through would contaminate their data — a rare one-off imbalance is the
 * cheaper failure. The fallback is reported on the next successful call so the
 * running count stays honest, and is recorded server-side as "client-fallback"
 * so it is visible when the split is audited.
 */
export async function resolveCondition(): Promise<Condition> {
  const cached = readCache();
  if (cached) return cached;

  const fallback = fallbackCondition();

  try {
    const res = await fetch("/api/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject_id: getSubjectId() }),
    });
    const data = await res.json();
    if (res.ok && (CONDITIONS as readonly string[]).includes(data?.condition)) {
      writeCache(data.condition as Condition);
      return data.condition as Condition;
    }
  } catch (err) {
    console.error("Condition assignment unreachable, falling back:", err);
  }

  writeCache(fallback);
  // Best effort: tell the server what we used, so its count is not short by one.
  void fetch("/api/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject_id: getSubjectId(), preferred: fallback }),
  }).catch(() => {});

  return fallback;
}

/**
 * The arm an instructor is previewing: ?cond=lesson, defaulting to the agent
 * scenario. Never contacts the server, so browsing the preview cannot consume
 * an assignment or skew the running count.
 */
export function previewCondition(): Condition {
  if (typeof window === "undefined") return "agent";

  try {
    const forced = new URLSearchParams(window.location.search).get(
      CONDITION_PARAM
    );
    if (forced && (CONDITIONS as readonly string[]).includes(forced)) {
      return forced as Condition;
    }
  } catch {
    /* ignore malformed query strings */
  }

  return "agent";
}

/**
 * The already-decided arm, for callers that cannot await. Returns the cached
 * assignment; before one exists it returns the fallback, so this must not be
 * used to make the assignment itself — resolveCondition() does that.
 */
export function getCondition(): Condition {
  if (typeof window === "undefined") return "agent";
  if (isPreviewActive()) return previewCondition();
  return readCache() ?? fallbackCondition();
}

export { LESSON_SEQUENCE, lessonPath };

const COMPLETED_KEY = (lessonId: string) => `lesson:${lessonId}:completed`;

export function isLessonComplete(lessonId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(COMPLETED_KEY(lessonId)) === "true";
  } catch {
    return false;
  }
}

export function markLessonComplete(lessonId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(COMPLETED_KEY(lessonId), "true");
  } catch {
    /* ignore unavailable storage */
  }
}

/** The next lesson still owed, or null when the sequence is finished. */
export function nextLesson(): string | null {
  return LESSON_SEQUENCE.find((id) => !isLessonComplete(id)) ?? null;
}
