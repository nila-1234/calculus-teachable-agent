import lesson1021 from "../../public/data/lessons/10.2.1.json";
import lesson1022 from "../../public/data/lessons/10.2.2.json";
import type { LessonDefinition } from "./types";

/**
 * Lesson content, ported from the course's own activity payloads.
 *
 * Imported rather than fetched so the questions, answer key, and per-distractor
 * explanations are part of the bundle: a lesson can never half-load and leave a
 * participant staring at a spinner mid-study.
 */
const LESSONS: Record<string, LessonDefinition> = {
  "10.2.1": lesson1021 as LessonDefinition,
  "10.2.2": lesson1022 as LessonDefinition,
};

/** The lessons that make up the guided-lesson arm, in participant order. */
export const LESSON_SEQUENCE = ["10.2.1", "10.2.2"] as const;

export function lessonPath(lessonId: string): string {
  return `/lesson/${lessonId}`;
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
