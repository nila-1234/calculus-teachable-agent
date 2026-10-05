"use client";

import { Suspense, useEffect, useSyncExternalStore } from "react";
import AppHeader from "@/components/app-header";
import CompletionCode from "@/components/completion-code";
import {
  PILOT_COMPLETION_CODE,
  getProlificPid,
  prolificSubmissionUrl,
} from "@/lib/prolific";
import { logEvent } from "@/lib/logger";
import { isPreviewActive } from "@/lib/preview";

const subscribeNothing = () => () => {};

/**
 * End of the pilot. Shows the pilot's own Prolific completion code for
 * participants who arrived from Prolific (or in preview). The pilot is a
 * separate Prolific study with its own code (PILOT_COMPLETION_CODE), kept
 * distinct from the main study's so the two outcomes never cross.
 */
function PilotComplete() {
  useEffect(() => {
    if (!isPreviewActive()) logEvent("pilot_completed", "pilot", {});
  }, []);

  const showCode = useSyncExternalStore(
    subscribeNothing,
    () => Boolean(getProlificPid()) || isPreviewActive(),
    () => false
  );

  return (
    <main className="flex min-h-screen flex-col bg-stone-100">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-16 sm:px-6">
        <div className="w-full rounded-2xl border-2 border-stone-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-stone-800">Thank you!</h1>
          <p className="mt-4 text-base leading-7 text-stone-600">
            You have completed the study.
          </p>
          {showCode && (
            <div className="mx-auto mt-2 max-w-md">
              <CompletionCode
                code={PILOT_COMPLETION_CODE}
                envVar="NEXT_PUBLIC_PILOT_PROLIFIC_COMPLETION_CODE"
                submitUrl={prolificSubmissionUrl(PILOT_COMPLETION_CODE)}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function PilotCompletePage() {
  return (
    <Suspense>
      <PilotComplete />
    </Suspense>
  );
}
