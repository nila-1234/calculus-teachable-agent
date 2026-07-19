"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon } from "@radix-ui/react-icons";
import AppHeader from "@/components/app-header";
import RippleButton from "@/components/ripple-button";
import { TestId } from "@/lib/tests/types";

const tests: { id: TestId; name: string; description: string }[] = [
  {
    id: "pretest",
    name: "Pre-Test",
    description: "Assessment — Optimization (Pre-Test)",
  },
  {
    id: "posttest",
    name: "Post-Test",
    description: "Assessment — Optimization (Post-Test)",
  },
];

export default function TestHomePage() {
  const router = useRouter();
  const [completedTests, setCompletedTests] = useState<Set<string>>(new Set());

  useEffect(() => {
    const completed = new Set<string>();
    tests.forEach(({ id }) => {
      if (sessionStorage.getItem(`test:${id}:completed`) === "true") {
        completed.add(id);
      }
    });
    setCompletedTests(completed);
  }, []);

  return (
    <main className="flex min-h-screen flex-col bg-stone-100">
      <AppHeader />

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold text-stone-800">
          Optimization Assessments
        </h1>
        <p className="mt-2 max-w-3xl text-base leading-6 text-stone-500">
          Each assessment has three questions: a worked optimization problem, a
          multi-part modeling and grading exercise, and a real-world problem you
          analyze together with an AI.
        </p>

        <div className="mt-8">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
            Choose an assessment
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3">
          {tests.map((test, index) => {
            const isDone = completedTests.has(test.id);

            return (
              <RippleButton
                key={test.id}
                onClick={() => router.push(`/test/${test.id}`)}
                className="flex items-center gap-3 rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-lime-600 focus-visible:outline-none focus-visible:border-lime-600 focus-visible:bg-lime-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-600 text-sm font-bold text-white">
                  {index + 1}
                </span>

                <span className="flex-1">
                  <span className="block text-base font-bold text-stone-800">
                    {test.name}
                  </span>
                  <span className="block text-xs text-stone-500">
                    {test.description}
                  </span>
                </span>

                {isDone && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime-600">
                    <CheckIcon className="text-white" width={12} height={12} />
                  </span>
                )}
              </RippleButton>
            );
          })}
        </div>
      </div>
    </main>
  );
}
