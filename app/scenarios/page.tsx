"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/app-header";
import { STUDY_SCENARIO_ID } from "@/lib/scenarios/utils";

/**
 * The study runs a single instruction scenario, so there is nothing to choose.
 *
 * This route is kept rather than deleted because every step of the flow already
 * navigates here — the pre-test, the surveys, and each scenario step on
 * completion. Turning it into a router means those all keep working and the
 * decision lives in one place:
 *
 *   instruction not finished -> the scenario itself
 *   instruction finished     -> forward to the post-test
 *
 * Without that second case, finishing the instruction would send the
 * participant back here and straight into the scenario again, looping forever.
 */
function ScenariosRouterContent() {
  const router = useRouter();
  const query = useSearchParams().toString();

  useEffect(() => {
    const done =
      sessionStorage.getItem(`scenario:${STUDY_SCENARIO_ID}:rubricCompleted`) ===
      "true";

    const target = done
      ? "/test/posttest"
      : `/${STUDY_SCENARIO_ID}/question`;

    router.replace(query ? `${target}?${query}` : target);
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
