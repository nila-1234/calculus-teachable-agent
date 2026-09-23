"use client";

import { Text } from "@radix-ui/themes";
import ScatterPlot from "@/components/scatter-plot";
import MathDisplay from "@/components/math-display";

type ScenarioCardProps = {
  scenario: string;
  scatterPlotSrc?: string;
  scenarioImageSrc?: string;
  // Already in the scatter plot's syntax — see toPlotEquation.
  equation?: string;
};

// Converts a model choice's LaTeX (e.g. "\(f(x) = 2x^{2}\)") into the plain
// expression syntax the scatter plot evaluates (e.g. "y=2*x^2").
export function toPlotEquation(choiceText: string): string {
  return choiceText
    .replace(/^\\\(/, "")
    .replace(/\\\)$/, "")
    .replace(/^f\(x\)\s*=\s*/, "y=")
    .replace(/\\(sin|cos)/g, "$1")
    .replace(/\^\{(\d+)\}/g, "^$1")
    .replace(/e\^\{([^}]+)\}/g, "exp($1)")
    .replace(/(\d)(x)/g, "$1*$2")
    .replace(/(\d)((sin|cos)\()/g, "$1*$2")
    .replace(/\s+/g, "");
}

export default function ScenarioCard({
  scenario,
  scatterPlotSrc,
  scenarioImageSrc,
  equation = "",
}: ScenarioCardProps) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <div
        className={
          scatterPlotSrc || scenarioImageSrc
            ? "grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center"
            : "grid grid-cols-1"
        }
      >
        <div>
          <Text size="1" weight="bold" className="mb-2 block uppercase tracking-wider text-stone-400">
            Scenario
          </Text>
          <MathDisplay text={scenario} className="text-base leading-7 text-stone-700" />
        </div>

        {scatterPlotSrc ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-xl bg-stone-50">
            <ScatterPlot filePath={scatterPlotSrc} equation={equation} />
          </div>
        ) : scenarioImageSrc ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-xl bg-stone-50 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={scenarioImageSrc}
              alt="Scenario diagram"
              className="max-h-[320px] w-full rounded-lg object-contain"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
