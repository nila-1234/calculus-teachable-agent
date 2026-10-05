"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/app-header";
import InstructionIntro, {
  introSeen,
  markIntroSeen,
} from "@/components/instruction-intro";
import LessonRunner from "@/components/lesson-runner";
import { LESSON_SEQUENCE, lessonFromSlug, lessonPath } from "@/lib/lessons/definitions";
import { logEvent } from "@/lib/logger";
import { PREVIEW_PARAM, isPreviewActive } from "@/lib/preview";
import { markLessonComplete } from "@/lib/condition";

const subscribeNothing = () => () => {};

/**
 * One lesson of the lesson arm.
 *
 * Routed by position (/lesson/1) rather than by the unit it was ported from —
 * the unit number would point straight at the source module. See
 * lib/condition.ts.
 */
function LessonPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const preview = searchParams.has(PREVIEW_PARAM);

  const slug = typeof params.lessonId === "string" ? params.lessonId : "";
  const lesson = lessonFromSlug(slug);

  useEffect(() => {
    if (!lesson) return;
    if (isPreviewActive()) return;
    logEvent("lesson_started", lesson.id, { title: lesson.title });
  }, [lesson]);

  // The lesson arm also starts with the pre-test transition, so it shows even
  // when an instructor previews a lesson directly. Gated by introSeen so a
  // participant who already saw it at /scenarios never sees it twice; always in
  // preview. Read via useSyncExternalStore (server snapshot false) to avoid a
  // hydration mismatch.
  const [introDismissed, setIntroDismissed] = useState(false);
  const needsIntro = useSyncExternalStore(
    subscribeNothing,
    () => {
      const pos = lesson
        ? LESSON_SEQUENCE.indexOf(lesson.id as (typeof LESSON_SEQUENCE)[number])
        : -1;
      return pos === 0 && (isPreviewActive() || !introSeen());
    },
    () => false
  );

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

  const dismissIntro = () => {
    if (!isPreviewActive()) markIntroSeen();
    setIntroDismissed(true);
  };

  if (needsIntro && !introDismissed) {
    return <InstructionIntro onContinue={dismissIntro} />;
  }

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
          Lesson {position + 1} of {LESSON_SEQUENCE.length}
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
