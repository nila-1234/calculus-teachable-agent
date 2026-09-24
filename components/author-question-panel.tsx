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
        explanations={explanations}
        onExplanationChange={onExplanationChange}
        onExplanationBlur={onExplanationBlur}
        llmFeedback={llmFeedback}
        loadingFeedback={loadingFeedback}
      />
    </Flex>
  );
}
