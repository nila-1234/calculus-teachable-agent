"use client";

import { useSyncExternalStore } from "react";
import AppHeader from "@/components/app-header";
import CompletionCode from "@/components/completion-code";
import { SCREEN_OUT_CODE, getProlificPid, prolificSubmissionUrl } from "@/lib/prolific";
import { isPreviewActive } from "@/lib/preview";

const subscribeNothing = () => () => {};

/** Real Prolific participants need the code; preview shows it for review. */
function readShowCode(): boolean {
  return Boolean(getProlificPid()) || isPreviewActive();
}

/**
 * Shown to participants screened out before the study begins.
 *
 * A dead end by design: there is no way forward from here, because continuing
 * would put ineligible data into the study. The wording is deliberately short
 * and warm — it does not repeat "you are not eligible", which reads as a verdict
 * on the person.
 *
 * A participant recruited through Prolific is screened out on Prolific too, at a
 * reduced rate, so they still need the screen-out code. Anyone recruited
 * directly has nothing to submit and sees only the thank-you. The code lives in
 * the URL / localStorage, so it is read client-side via useSyncExternalStore
 * (server snapshot false) to avoid a hydration mismatch.
 */
export default function NotEligiblePage() {
  const showCode = useSyncExternalStore(
    subscribeNothing,
    readShowCode,
    () => false
  );

  return (
    <main className="flex min-h-screen flex-col bg-stone-100">
      <AppHeader />

      <div className="mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-16 sm:px-6">
        <div className="w-full rounded-2xl border-2 border-stone-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-stone-800">
            Thank you for your interest.
          </h1>

          <p className="mt-4 text-base leading-7 text-stone-600">
            {showCode
              ? "You are not eligible for this study, but you will still be compensated. Submit the code below on Prolific."
              : "You may now close this page."}
          </p>

          {showCode && (
            <div className="mx-auto mt-2 max-w-md">
              <CompletionCode
                code={SCREEN_OUT_CODE}
                label="Your screen-out code"
                envVar="NEXT_PUBLIC_PROLIFIC_SCREEN_OUT_CODE"
                submitUrl={prolificSubmissionUrl(SCREEN_OUT_CODE)}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
