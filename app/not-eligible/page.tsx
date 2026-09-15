"use client";

import AppHeader from "@/components/app-header";
import CompletionCode from "@/components/completion-code";
import { SCREENOUT_CODE } from "@/lib/prolific";

/**
 * Shown to participants screened out before the study begins.
 *
 * A dead end by design: there is no way forward from here, because continuing
 * would put ineligible data into the study. The wording avoids implying any
 * judgement of the person.
 */
export default function NotEligiblePage() {
  return (
    <main className="flex min-h-screen flex-col bg-stone-100">
      <AppHeader />

      <div className="mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-16 sm:px-6">
        <div className="w-full rounded-2xl border-2 border-stone-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-stone-800">
            You are not eligible to participate in this study
          </h1>

          {/*
            Deliberately not "no further action is required": a screened-out
            participant on Prolific still has to submit their code to be paid.
          */}
          <p className="mt-4 text-base leading-7 text-stone-600">
            Thank you for your interest. At this time, you do not meet the
            eligibility criteria for participation.
          </p>

          {/*
            Prolific issues a separate code for screened-out participants so they
            can still be paid without counting as completions. Showing it here is
            the only way they get it.
          */}
          <CompletionCode
            code={SCREENOUT_CODE}
            label="Your code"
            envVar="NEXT_PUBLIC_PROLIFIC_SCREENOUT_CODE"
          />
        </div>
      </div>
    </main>
  );
}
