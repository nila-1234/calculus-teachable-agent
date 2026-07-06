"use client";

import { useMemo } from "react";
import { Flex, Text } from "@radix-ui/themes";
import ScatterPlot from "@/components/scatter-plot";
import QuestionPartCardDeck from "@/components/question-part-card-deck";

type Choice = {
  id: string;
  text: string;
  correct?: boolean;
  feedback?: string;
};

type QuestionPart = {
  id: string;
  label: string;
  options: readonly Choice[];
};

type AuthorQuestionPanelProps = {
  scenario: string;
  question: string;
  scatterPlotSrc: string;
  scenarioImageSrc?: string;
  parts: readonly QuestionPart[];
  selectedParts: Record<string, string>;
  submittedParts: Record<string, boolean>;
  activePartIndex: number;
  onSelectPart: (partId: string, choiceId: string) => void;
  onSubmitPart: (partId: string) => void;
  onTryAgainPart: (partId: string) => void;
  onNextPart: () => void;
  onContinue?: () => void;
  mode?: number;
  onModeChange?: (mode: number) => void;
  explanations?: Record<string, string>;
  onExplanationChange?: (partId: string, value: string) => void;
  onExplanationBlur?: (partId: string, value: string) => void;
  llmFeedback?: Record<string, string>;
  loadingFeedback?: Record<string, boolean>;
};

export default function AuthorQuestionPanel({
  scenario,
  question,
  scatterPlotSrc,
  scenarioImageSrc,
  parts,
  selectedParts,
  submittedParts,
  activePartIndex,
  onSelectPart,
  onSubmitPart,
  onTryAgainPart,
  onNextPart,
  onContinue,
  mode = 1,
  onModeChange,
  explanations,
  onExplanationChange,
  onExplanationBlur,
  llmFeedback,
  loadingFeedback,
}: AuthorQuestionPanelProps) {
  const selectedEquation = useMemo(() => {
    const firstPart = parts[0];
    if (!firstPart) return "";

    const selectedId = selectedParts[firstPart.id];
    const selectedChoice = firstPart.options.find(
      (choice) => choice.id === selectedId
    );

    if (!selectedChoice) return "";

    return selectedChoice.text
      .replace(/^\\\(/, "")
      .replace(/\\\)$/, "")
      .replace(/^f\(x\)\s*=\s*/, "y=")
      .replace(/\\(sin|cos)/g, "$1")
      .replace(/\^\{(\d+)\}/g, "^$1")
      .replace(/e\^\{([^}]+)\}/g, "exp($1)")
      .replace(/(\d)(x)/g, "$1*$2")
      .replace(/(\d)((sin|cos)\()/g, "$1*$2")
      .replace(/\s+/g, "");
  }, [parts, selectedParts]);

  return (
    <Flex direction="column" gap="5">
      <Flex align="center" justify="end">
        <div className="inline-flex gap-1 rounded-lg bg-stone-100 p-1">
          <button
            type="button"
            onClick={() => onModeChange?.(1)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === 1 ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Standard
          </button>
          <button
            type="button"
            onClick={() => onModeChange?.(2)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === 2 ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Self-Explanation
          </button>
        </div>
      </Flex>

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
            <Text size="3" className="whitespace-pre-wrap leading-7 text-stone-700">
              {scenario}
            </Text>
          </div>

          {scatterPlotSrc ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-xl bg-stone-50">
              <ScatterPlot
                filePath={scatterPlotSrc}
                equation={selectedEquation}
              />
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

      <QuestionPartCardDeck
        parts={parts}
        selectedParts={selectedParts}
        submittedParts={submittedParts}
        activeIndex={activePartIndex}
        onSelectPart={onSelectPart}
        onSubmitPart={onSubmitPart}
        onTryAgainPart={onTryAgainPart}
        onNextPart={onNextPart}
        onContinue={onContinue}
        mode={mode}
        explanations={explanations}
        onExplanationChange={onExplanationChange}
        onExplanationBlur={onExplanationBlur}
        llmFeedback={llmFeedback}
        loadingFeedback={loadingFeedback}
      />
    </Flex>
  );
}
