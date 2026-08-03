"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/app-header";
import Button from "@/components/button";

const STEPS = [
  "Take the pre-test",
  "Work through the TA scenarios",
  "Take the post-test",
];

function WelcomePageContent() {
  const router = useRouter();
  const query = useSearchParams().toString();

  const goToTests = () => router.push(query ? `/test?${query}` : "/test");

  return (
    <main className="flex min-h-screen flex-col bg-stone-100">
      <AppHeader />

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold text-stone-800">
          Teachable Calculus Agent Study
        </h1>
        <p className="mt-2 max-w-3xl text-base leading-6 text-stone-500">
          Thank you for taking part in this study. You&apos;ll start with a
          short assessment on optimization, then work through a set of calculus
          TA scenarios where you write questions, build rubrics, and grade
          student answers. At the end, you&apos;ll take a second assessment so
          we can see how your thinking changed.
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

        <div className="mt-8 flex justify-end">
          <Button onClick={goToTests}>Next</Button>
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
