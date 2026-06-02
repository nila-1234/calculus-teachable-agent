"use client";

import { useMemo } from "react";
import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
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
  llmFeedback?: Record<string, string>;
  loadingFeedback?: Record<string, boolean>;
};

export default function AuthorQuestionPanel({
  scenario,
  question,
  scatterPlotSrc,
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
      .replace(/\\sin/g, "sin")
      .replace(/\^\{(\d+)\}/g, "^$1")
      .replace(/e\^\{([^}]+)\}/g, "exp($1)")
      .replace(/(\d)(x)/g, "$1*$2")
      .replace(/(\d)(sin\()/g, "$1*$2")
      .replace(/\s+/g, "");
  }, [parts, selectedParts]);

  return (
    <Card size="3" className="h-full">
      <Flex direction="column" gap="5" className="h-full">
        <Flex align="center" justify="between">
          <Heading size="6">Scenario</Heading>
          <Flex gap="2" align="center">
            <Button
              size="1"
              variant={mode === 1 ? "solid" : "soft"}
              color="lime"
              onClick={() => onModeChange?.(1)}
            >
              Standard
            </Button>
            <Button
              size="1"
              variant={mode === 2 ? "solid" : "soft"}
              color="lime"
              onClick={() => onModeChange?.(2)}
            >
              Self-Explanation
            </Button>
          </Flex>
        </Flex>

        <div className="flex-1 space-y-5">
          <Card size="2">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div>
                <Text size="3" className="whitespace-pre-wrap leading-7">
                  {scenario}
                </Text>
              </div>

              <div className="flex min-h-[320px] items-center justify-center rounded-xl bg-gray-50">
                {scatterPlotSrc ? (
                  <ScatterPlot
                    filePath={scatterPlotSrc}
                    equation={selectedEquation}
                  />
                ) : (
                  <Text color="gray">Scatter plot placeholder</Text>
                )}
              </div>
            </div>
          </Card>

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
            llmFeedback={llmFeedback}
            loadingFeedback={loadingFeedback}
          />
        </div>
      </Flex>
    </Card>
  );
}
