"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/app-header";
import LessonRunner from "@/components/lesson-runner";
import { getLesson } from "@/lib/lessons/definitions";
import { logEvent } from "@/lib/logger";
import { PREVIEW_PARAM, isPreviewActive } from "@/lib/preview";
import {
  LESSON_SEQUENCE,
  lessonPath,
  markLessonComplete,
} from "@/lib/condition";

/**
 * A lesson in the guided-lesson arm.
 *
 * The route is deliberately just /lesson/<unit> — it names the activity, not
 * the study arm. See lib/condition.ts.
 */
function LessonPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const preview = searchParams.has(PREVIEW_PARAM);

  const lessonId = typeof params.lessonId === "string" ? params.lessonId : "";
  const lesson = getLesson(lessonId);

  useEffect(() => {
    if (!lesson) return;
    if (isPreviewActive()) return;
    logEvent("lesson_started", lesson.id, { title: lesson.title });
  }, [lesson]);

  if (!lesson) {
    return (
      <main className="min-h-screen bg-stone-100">
        <AppHeader />
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
          <p className="text-sm text-stone-500">This lesson is not available.</p>
        </div>
      </main>
    );
  }

  const position = LESSON_SEQUENCE.indexOf(
    lesson.id as (typeof LESSON_SEQUENCE)[number]
  );
  const next = LESSON_SEQUENCE[position + 1];

  const handleComplete = () => {
    // Preview must never write study state or advance a participant's progress.
    if (preview) return;

    markLessonComplete(lesson.id);
    const target = next ? lessonPath(next) : "/test/posttest";
    router.push(query ? `${target}?${query}` : target);
  };

  return (
    <main className="min-h-screen bg-stone-100">
      <AppHeader />
      <div className="mx-auto max-w-4xl overflow-y-auto p-3 py-6 sm:px-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-stone-400">
          Lesson {position + 1} of {LESSON_SEQUENCE.length} · {lesson.id}
        </p>
        <LessonRunner
          lesson={lesson}
          onComplete={handleComplete}
          completeLabel={next ? "Continue" : "Continue to the next section"}
        />
      </div>
    </main>
  );
}

export default function LessonPage() {
  return (
    <Suspense>
      <LessonPageContent />
    </Suspense>
  );
}
