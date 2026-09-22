import lessonOne from "../../public/data/lessons/lesson-1.json";
import lessonTwo from "../../public/data/lessons/lesson-2.json";
import type { LessonDefinition } from "./types";

/**
 * Lesson content, ported from the course's own activity payloads.
 *
 * Imported rather than fetched so the questions, answer key, and per-distractor
 * explanations are part of the bundle: a lesson can never half-load and leave a
 * participant staring at a spinner mid-study.
 */
const LESSONS: Record<string, LessonDefinition> = {
  "lesson-1": lessonOne as LessonDefinition,
  "lesson-2": lessonTwo as LessonDefinition,
};

/** The lessons that make up the lesson arm, in participant order. */
export const LESSON_SEQUENCE = ["lesson-1", "lesson-2"] as const;

/**
 * Routes are /lesson/1 and /lesson/2 — a position, not a unit number. The
 * source unit would be a direct pointer to the course module this arm was
 * ported from, which is exactly what a curious participant should not have.
 */
export function lessonPath(lessonId: string): string {
  const index = LESSON_SEQUENCE.indexOf(lessonId as (typeof LESSON_SEQUENCE)[number]);
  return `/lesson/${index >= 0 ? index + 1 : 1}`;
}

/** Resolves the /lesson/<n> route parameter back to a lesson. */
export function lessonFromSlug(slug: string): LessonDefinition | null {
  const n = Number.parseInt(slug, 10);
  if (!Number.isFinite(n) || n < 1 || n > LESSON_SEQUENCE.length) return null;
  return getLesson(LESSON_SEQUENCE[n - 1]);
}

export function getLesson(id: string): LessonDefinition | null {
  return LESSONS[id] ?? null;
}

export function listLessons(): LessonDefinition[] {
  return Object.values(LESSONS);
}

/** Total questions, used for the progress counter. */
export function countQuestions(lesson: LessonDefinition): number {
  return lesson.sections.reduce((n, s) => n + (s.questions?.length ?? 0), 0);
}
