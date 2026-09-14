"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/app-header";
import Button from "@/components/button";

const STEPS = [
  "Answer a few screening questions",
  "Review and sign the consent form",
  "Complete the pre-survey",
  "Take the pre-test",
  // Deliberately generic: what happens here differs between the control
  // and system conditions, so the entry page must not describe one of them.
  "Complete the instruction",
  "Take the post-test",
  "Complete the post-survey",
];

function WelcomePageContent() {
  const router = useRouter();
  const query = useSearchParams().toString();

  const goToScreening = () =>
    router.push(query ? `/survey/screening?${query}` : "/survey/screening");

  return (
    <main className="flex min-h-screen flex-col bg-stone-100">
      <AppHeader />

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold text-stone-800">
          Teachable Calculus Agent Study
        </h1>
        {/*
          Wording matters here: at this point the visitor has not been screened
          or consented, so this cannot thank them for taking part or imply that
          they will.
        */}
        <p className="mt-2 max-w-3xl text-base leading-6 text-stone-500">
          Thank you for your interest in this study. You&apos;ll begin with a few
          short questions about your background in mathematics, which take about
          a minute and tell us whether this study is a fit for you. If you are
          eligible, you&apos;ll then be asked to review and sign a consent form
          before anything else.
        </p>
        <p className="mt-3 max-w-3xl text-base leading-6 text-stone-500">
          The study itself takes about 90 minutes: a pre-survey and a pre-test on
          optimization, then the instruction, and finally a second assessment and
          a brief post-survey.
        </p>

        <div className="mt-8">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
            What happens next
          </span>
        </div>

        <ol className="mt-4 select-none">
          {STEPS.map((step, index) => {
            const isLast = index === STEPS.length - 1;

            return (
              <li key={step} className="flex gap-4">
                <div className="flex flex-col items-center self-stretch">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime-600 text-base font-bold text-white">
                    {index + 1}
                  </div>
                  {!isLast && <div className="w-0.5 flex-1 bg-stone-200" />}
                </div>

                <span
                  className={`pt-3 text-xs font-bold uppercase tracking-wider text-stone-600 ${
                    isLast ? "" : "pb-8"
                  }`}
                >
                  {step}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 flex justify-center">
          <Button onClick={goToScreening}>Next</Button>
        </div>
      </div>
    </main>
  );
}

export default function WelcomePage() {
  return (
    <Suspense>
      <WelcomePageContent />
    </Suspense>
  );
}
