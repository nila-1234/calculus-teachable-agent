"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/app-header";
import Button from "@/components/button";

/**
 * Entry to the test-question pilot. A separate study from the main one, with
 * its own data (see lib/pilot and /api/pilot-assign). No teachable agent, no
 * lessons: background questions, a short survey, one test, a difficulty survey.
 */
function PilotWelcome() {
  const router = useRouter();
  const query = useSearchParams().toString();

  const begin = () =>
    router.push(
      query ? `/pilot/survey/screening?${query}` : "/pilot/survey/screening"
    );

  return (
    <main className="min-h-screen bg-stone-100">
      <AppHeader />
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border-2 border-stone-200 bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-bold text-stone-800">
            Calculus Problem-Solving Study
          </h1>
          <p className="mt-4 text-base leading-7 text-stone-600">
            In this study, you will answer a few questions about your math
            background, complete a set of calculus optimization problems
            involving maximums and minimums, and answer brief questions about
            your experience and the difficulty of the problems.
          </p>
          <p className="mt-3 text-base leading-7 text-stone-600">
            Participants with different levels of math experience are welcome.
            Please make your best attempt, even if some problems are unfamiliar.
          </p>
          <p className="mt-3 text-sm leading-6 text-stone-500">
            The study takes approximately 30 minutes. Please work independently
            without calculators, AI tools, or outside help. Scratch paper is
            allowed.
          </p>
          <div className="mt-8 flex justify-end">
            <Button onClick={begin}>Begin</Button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function PilotPage() {
  return (
    <Suspense>
      <PilotWelcome />
    </Suspense>
  );
}
