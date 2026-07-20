"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckIcon } from "@radix-ui/react-icons";
import AppHeader from "@/components/app-header";
import RippleButton from "@/components/ripple-button";

const scenarios = [
  { id: 1, name: "Company Profit Analysis" },
  { id: 2, name: "Water Reservoir Levels" },
  { id: 3, name: "Machine Risk Scores" },
  { id: 4, name: "Delivery Cost Analysis" },
  { id: 5, name: "Storage Area Optimization" },
  { id: 6, name: "App User Growth" },
  { id: 7, name: "Project Cash Flow" },
  { id: 8, name: "Data Center Power Draw" },
];

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const questionMode = searchParams.get("questionMode") || "2";
  const applyRubricMode = searchParams.get("applyRubricMode") || "1";

  const [completedScenarios, setCompletedScenarios] = useState<Set<number>>(new Set());

  useEffect(() => {
    const completed = new Set<number>();
    scenarios.forEach(({ id }) => {
      if (sessionStorage.getItem(`scenario:${id}:rubricCompleted`) === "true") {
        completed.add(id);
      }
    });
    setCompletedScenarios(completed);
  }, []);

  const goToScenario = (id: number) =>
    router.push(`/${id}/question?questionMode=${questionMode}&applyRubricMode=${applyRubricMode}`);

  const doneCount = completedScenarios.size;

  return (
    <main className="flex min-h-screen flex-col bg-stone-100">
      <AppHeader />

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold text-stone-800">
            Welcome
          </h1>
          <RippleButton
            onClick={() => router.push("/test")}
            className="shrink-0 rounded-xl border-2 border-stone-200 bg-white px-4 py-2 text-sm font-bold text-stone-800 shadow-sm transition-colors hover:border-lime-600 focus-visible:outline-none focus-visible:border-lime-600 focus-visible:bg-lime-50"
          >
            Pre/Post Test
          </RippleButton>
        </div>
        <p className="mt-2 max-w-3xl text-base leading-6 text-stone-500">
          It&apos;s your first week as a calculus TA. As part of your TA duties,
          you help your professor prepare calculus questions, clarify what
          strong student answers should include, and grade the work students
          submit.
        </p>

        <div className="mt-8 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
            Choose a scenario
          </span>
          <span className="rounded-full bg-lime-50 px-3 py-1 text-xs font-semibold text-lime-700">
            {doneCount} of {scenarios.length} done
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {scenarios.map((scenario) => {
            const isDone = completedScenarios.has(scenario.id);

            return (
              <RippleButton
                key={scenario.id}
                onClick={() => goToScenario(scenario.id)}
                className="flex items-center gap-3 rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-lime-600 focus-visible:outline-none focus-visible:border-lime-600 focus-visible:bg-lime-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-600 text-sm font-bold text-white">
                  {scenario.id}
                </span>

                <span className="flex-1 text-base font-bold text-stone-800">
                  {scenario.name}
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

export default function HomePage() {
  return (
    <Suspense>
      <HomePageContent />
    </Suspense>
  );
}
