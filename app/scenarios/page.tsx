"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/app-header";
import InstructionIntro, {
  introSeen,
  markIntroSeen,
} from "@/components/instruction-intro";
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
 * The entry to the instruction phase.
 *
 * Every step of the flow navigates here — the pre-test, the surveys, and each
 * instruction step on completion — so the decision of where to go next lives in
 * one place:
 *
 *   instruction not finished -> the arm this participant was assigned
 *   instruction finished     -> forward to the post-test
 *
 * Entering instruction (not leaving it for the post-test) first shows a short
 * transition screen. Piloting found the jump straight from the pre-test into
 * the activity confusing — this is the first page of the instruction phase for
 * both arms, including the lesson arm, and the page an instructor sees first
 * when previewing instruction. Shown once per participant; always shown in
 * preview so it can be reviewed.
 */
function ScenariosRouterContent() {
  const router = useRouter();
  const query = useSearchParams().toString();

  // Null until the arm resolves. A non-null value is the instruction target to
  // show the transition before.
  const [target, setTarget] = useState<string | null>(null);

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

      let dest: string;
      if (condition === "lesson") {
        const pending = nextLesson();
        dest = pending ? lessonPath(pending) : "/test/posttest";
      } else {
        const done =
          sessionStorage.getItem(
            `scenario:${STUDY_SCENARIO_ID}:rubricCompleted`
          ) === "true";
        dest = done ? "/test/posttest" : `/${STUDY_SCENARIO_ID}/question`;
      }

      const withQuery = query ? `${dest}?${query}` : dest;

      // Transition only when entering instruction, not when leaving it for the
      // post-test.
      const entering = dest !== "/test/posttest";
      const preview = isPreviewActive();
      const seen = !preview && introSeen();

      if (entering && !seen) {
        setTarget(withQuery);
      } else {
        router.replace(withQuery);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router, query]);

  const handleContinue = () => {
    if (!target) return;
    if (!isPreviewActive()) {
      markIntroSeen();
      logEvent("instruction_intro_continue", "instruction", {});
    }
    router.replace(target);
  };

  if (!target) {
    return (
      <main className="min-h-screen bg-stone-100">
        <AppHeader />
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
          <p className="text-sm text-stone-400">Loading…</p>
        </div>
      </main>
    );
  }

  return <InstructionIntro onContinue={handleContinue} />;
}

export default function ScenariosPage() {
  return (
    <Suspense>
      <ScenariosRouterContent />
    </Suspense>
  );
}
