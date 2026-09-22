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
 *   "lesson" — the guided lesson sequence     (/lesson/10.2.1, /lesson/10.2.2)
 *
 * For analysis, "lesson" is the comparison condition. That mapping lives here
 * and in the exports, never in anything a participant sees.
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
 * The participant's arm, derived from their subject id rather than drawn at
 * random and stored.
 *
 * Deriving it means the assignment survives cleared storage, a different tab,
 * or a mid-study browser restart — a participant always lands back in the arm
 * they started in. A coin flip written to localStorage would silently re-flip
 * any of those, which is how someone ends up having done half of each
 * condition. The cost is that balance is only probabilistic; with a pilot-sized
 * sample, check the split rather than assuming it.
 */
export function getCondition(): Condition {
  if (typeof window === "undefined") return "agent";

  // Only honoured in preview: otherwise a participant who found the parameter
  // could pick their own arm.
  if (isPreviewActive()) {
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
  }

  return CONDITIONS[hash(getSubjectId()) % CONDITIONS.length];
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
