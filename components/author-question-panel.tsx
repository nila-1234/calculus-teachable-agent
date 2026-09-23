"use client";

import { useMemo } from "react";
import { Flex } from "@radix-ui/themes";
import QuestionPartCardDeck from "@/components/question-part-card-deck";
import ScenarioCard, { toPlotEquation } from "@/components/scenario-card";

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

    return toPlotEquation(selectedChoice.text);
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

      <ScenarioCard
        scenario={scenario}
        scatterPlotSrc={scatterPlotSrc}
        scenarioImageSrc={scenarioImageSrc}
        equation={selectedEquation}
      />

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
