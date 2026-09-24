"use client";

import AppHeader from "@/components/app-header";

/**
 * Shown to participants screened out before the study begins.
 *
 * A dead end by design: there is no way forward from here, because continuing
 * would put ineligible data into the study. Deliberately short and warm — the
 * earlier wording led with "you are not eligible", which reads as a verdict on
 * the person rather than on a scheduling constraint. Nobody needs to be told
 * twice that they did not qualify, so this simply thanks them and stops.
 */
export default function NotEligiblePage() {
  return (
    <main className="flex min-h-screen flex-col bg-stone-100">
      <AppHeader />

      <div className="mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-16 sm:px-6">
        <div className="w-full rounded-2xl border-2 border-stone-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-stone-800">
            Thank you for your interest.
          </h1>

          <p className="mt-4 text-base leading-7 text-stone-600">
            You may now close this page.
          </p>
        </div>
      </div>
    </main>
  );
}
