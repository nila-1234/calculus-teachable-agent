"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/app-header";
import { STUDY_SCENARIO_ID } from "@/lib/scenarios/utils";
import {
  lessonPath,
  nextLesson,
  previewCondition,
  resolveCondition,
} from "@/lib/condition";
import { logEvent } from "@/lib/logger";
import { isPreviewActive } from "@/lib/preview";

/**
 * Where a participant goes for the instruction phase.
 *
 * This route is kept rather than deleted because every step of the flow already
 * navigates here — the pre-test, the surveys, and each instruction step on
 * completion. Turning it into a router means those all keep working and the
 * decision lives in one place:
 *
 *   instruction not finished -> the arm this participant was assigned
 *   instruction finished     -> forward to the post-test
 *
 * Without that second case, finishing the instruction would send the
 * participant back here and straight into it again, looping forever.
 *
 * The arm is decided here and nowhere else, so there is a single place to look
 * when a participant ends up somewhere unexpected.
 */
function ScenariosRouterContent() {
  const router = useRouter();
  const query = useSearchParams().toString();

  useEffect(() => {
    let cancelled = false;

    // Preview must not consume an assignment or touch the running count.
    const decide = async () =>
      isPreviewActive() ? previewCondition() : resolveCondition();

    void decide().then((condition) => {
      if (cancelled) return;

      if (!isPreviewActive()) {
        logEvent("condition_assigned", "instruction", { condition });
      }

      let target: string;
      if (condition === "lesson") {
        const pending = nextLesson();
        target = pending ? lessonPath(pending) : "/test/posttest";
      } else {
        const done =
          sessionStorage.getItem(
            `scenario:${STUDY_SCENARIO_ID}:rubricCompleted`
          ) === "true";
        target = done ? "/test/posttest" : `/${STUDY_SCENARIO_ID}/question`;
      }

      router.replace(query ? `${target}?${query}` : target);
    });

    return () => {
      cancelled = true;
    };
  }, [router, query]);

  return (
    <main className="min-h-screen bg-stone-100">
      <AppHeader />
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-sm text-stone-400">Loading…</p>
      </div>
    </main>
  );
}

export default function ScenariosPage() {
  return (
    <Suspense>
      <ScenariosRouterContent />
    </Suspense>
  );
}
