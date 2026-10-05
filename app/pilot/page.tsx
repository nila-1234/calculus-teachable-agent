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
          <h1 className="text-2xl font-bold text-stone-800">Calculus study</h1>
          <p className="mt-4 text-base leading-7 text-stone-600">
            Thank you for taking part. You will answer a few background
            questions, a short survey, and then a calculus test, followed by a
            couple of questions about the test. It takes about 30 minutes.
          </p>
          <p className="mt-3 text-sm leading-6 text-stone-500">
            Please complete it in one sitting and on your own, without
            generative-AI assistance. Ordinary calculators and scratch paper are
            fine.
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
