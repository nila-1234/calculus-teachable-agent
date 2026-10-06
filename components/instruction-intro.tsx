"use client";

import AppHeader from "@/components/app-header";
import Button from "@/components/button";

/**
 * The transition between the pre-test and the instruction phase.
 *
 * Piloting found the jump straight from the pre-test into the activity
 * confusing, so this short screen is the first page of instruction for both
 * arms. It is shown once per participant (tracked with INTRO_SEEN_KEY) and
 * always in preview so an instructor can review it.
 *
 * Shared by /scenarios (the instruction entry every arm routes through) and the
 * first lesson of the lesson arm, so the lesson arm starts with it even when an
 * instructor previews a lesson directly, without a participant ever seeing it
 * twice.
 */
export const INTRO_SEEN_KEY = "instruction:introSeen";

export function introSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function markIntroSeen(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, "true");
  } catch {
    /* ignore unavailable storage */
  }
}

export default function InstructionIntro({
  onContinue,
}: {
  onContinue: () => void;
}) {
  return (
    <main className="min-h-screen bg-stone-100">
      <AppHeader />
      <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border-2 border-stone-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-stone-800">
            You&apos;ve finished the pre-test.
          </h1>
          <p className="mt-4 text-base leading-7 text-stone-600">
            Next, you&apos;ll work through a short instructional activity on
            applied optimization. After that, there is a final quiz and a brief
            survey.
          </p>
          <div className="mt-8 flex justify-center">
            <Button onClick={onContinue}>Continue</Button>
          </div>
        </div>
      </div>
    </main>
  );
}
