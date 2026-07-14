"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import LineRubricPanel, {
  LinePlacement,
  LinePlacementsState,
  RubricCriterion,
} from "@/components/line-rubric-panel";
import { getScenario } from "@/lib/scenarios/registry";
import AppHeader from "@/components/app-header";
import { parseScenarioId } from "@/lib/scenarios/utils";

function GradeLinesPageContent() {
  const params = useParams();
  const scenarioId = parseScenarioId(params.id);
  const scenario = scenarioId ? getScenario(scenarioId) : null;

  if (!scenarioId || !scenario) {
    return <main className="p-6">Scenario not found.</main>;
  }

  const { RUBRIC_OPTIONS, FINAL_AI_ANSWERS } = scenario.schema;

  const [question, setQuestion] = useState("");
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [placements, setPlacements] = useState<LinePlacementsState>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setQuestion(sessionStorage.getItem(`scenario:${scenarioId}:studentQuestion`) || "");
  }, [scenarioId]);

  useEffect(() => {
    const raw = sessionStorage.getItem(`scenario:${scenarioId}:selectedRubricIds`);
    const ids: string[] = raw ? JSON.parse(raw) : RUBRIC_OPTIONS.map((option) => option.id);

    const selectedRubric = ids.map((id) => {
      const match = RUBRIC_OPTIONS.find((option) => option.id === id);
      return { id, label: match?.label || id };
    });

    setRubric(selectedRubric);
  }, [RUBRIC_OPTIONS, scenarioId]);

  const handlePlacementsChange = (
    answerId: string,
    next: Record<string, LinePlacement>
  ) => {
    setPlacements((prev) => ({ ...prev, [answerId]: next }));
  };

  return (
    <main className="min-h-screen bg-stone-100">
      <AppHeader />
      <div className="mx-auto max-w-7xl p-3 py-6 sm:px-6">
        <div className="mb-6 flex items-center justify-between rounded-xl border border-dashed border-stone-300 bg-white px-4 py-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-lime-700">
              Experimental
            </span>
            <p className="text-sm text-stone-500">
              Trying a line-by-line grading UI: drag rubric items onto the exact line they apply to.
            </p>
          </div>
          <Link
            href={`/${scenarioId}/grade`}
            className="text-xs font-semibold text-stone-500 underline-offset-2 hover:text-stone-700 hover:underline"
          >
            Back to standard grading
          </Link>
        </div>

        <LineRubricPanel
          question={question}
          rubric={rubric}
          answers={FINAL_AI_ANSWERS}
          placements={placements}
          onPlacementsChange={handlePlacementsChange}
          currentIndex={currentIndex}
          onCurrentIndexChange={setCurrentIndex}
        />
      </div>
    </main>
  );
}

export default function GradeLinesPage() {
  return (
    <Suspense>
      <GradeLinesPageContent />
    </Suspense>
  );
}
