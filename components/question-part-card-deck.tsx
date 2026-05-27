"use client";

import { useMemo, useRef, useEffect } from "react";
import { Button, Card, Flex, Heading, RadioCards, Text, TextArea } from "@radix-ui/themes";
import MathDisplay from "@/components/math-display";
import FeedbackCard from "@/components/feedback-card";

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

type Props = {
  parts: readonly QuestionPart[];
  selectedParts: Record<string, string>;
  submittedParts: Record<string, boolean>;
  activeIndex: number;
  onSelectPart: (partId: string, choiceId: string) => void;
  onSubmitPart: (partId: string) => void;
  onTryAgainPart: (partId: string) => void;
  onNextPart: () => void;
  onContinue?: () => void;
  mode?: number;
  explanations?: Record<string, string>;
  onExplanationChange?: (partId: string, value: string) => void;
  llmFeedback?: Record<string, string>;
  loadingFeedback?: Record<string, boolean>;
};

export default function QuestionPartCardDeck({
  parts,
  selectedParts,
  submittedParts,
  activeIndex,
  onSelectPart,
  onSubmitPart,
  onTryAgainPart,
  onNextPart,
  onContinue,
  mode = 1,
  explanations = {},
  onExplanationChange,
  llmFeedback = {},
  loadingFeedback = {},
}: Props) {
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  const part = parts[activeIndex];
  const isLastPart = activeIndex === parts.length - 1;

  const selectedChoice = useMemo(() => {
    if (!part) return undefined;
    return part.options.find((choice) => choice.id === selectedParts[part.id]);
  }, [part, selectedParts]);

  const isSubmitted = part ? Boolean(submittedParts[part.id]) : false;
  const isCorrect = Boolean(selectedChoice?.correct);
  const canSubmit = Boolean(selectedChoice) && !isSubmitted;
  const isMode2 = mode === 2;

  useEffect(() => {
    if (isSubmitted && feedbackRef.current) {
      feedbackRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [isSubmitted]);

  if (!part) return null;

  return (
    <Card size="2">
      <Flex direction="column" gap="4">
        <Flex align="center" justify="between">
          <Heading size="4">Question</Heading>
          <Text size="2" color="gray">
            Part {activeIndex + 1} of {parts.length}
          </Text>
        </Flex>

        <Text size="2" color="gray">
          Solve each part correctly before moving to the next one.
        </Text>

        <Flex direction="column" gap="3">
          <Heading size="3">{part.label}</Heading>

          <div className={isMode2 ? "grid grid-cols-[3fr_1fr] gap-4 items-stretch" : ""}>
            <RadioCards.Root
              value={selectedParts[part.id] || ""}
              onValueChange={(choiceId) => onSelectPart(part.id, choiceId)}
              columns="1"
              className="w-full"
            >
              {part.options.map((choice, index) => {
                const isSelected = selectedParts[part.id] === choice.id;

                return (
                  <RadioCards.Item
                    key={choice.id}
                    value={choice.id}
                    disabled={isSubmitted}
                    className="w-full [&_[data-state]]:hidden"
                  >
                    <Flex align="start" gap="3" className="w-full text-left">
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${isSelected
                            ? "border-lime-500 bg-lime-500 text-white"
                            : "border-gray-300 text-gray-600"
                          }`}
                      >
                        {index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <MathDisplay text={choice.text} />
                      </div>
                    </Flex>
                  </RadioCards.Item>
                );
              })}
            </RadioCards.Root>

            {isMode2 && (
              <Flex direction="column" gap="2" className="h-full">
                <Text size="2" weight="medium" color="gray">
                  Explain your reasoning
                </Text>
                <TextArea
                  placeholder="Why did you choose this answer?"
                  value={explanations[part.id] || ""}
                  onChange={(e) => onExplanationChange?.(part.id, e.target.value)}
                  disabled={isSubmitted}
                  className="flex-1 resize-none min-h-0"
                />
              </Flex>
            )}
          </div>
        </Flex>

        <Flex justify="center">
          <Button onClick={() => onSubmitPart(part.id)} disabled={!canSubmit} color="lime">
            Submit
          </Button>
        </Flex>

        {isSubmitted ? (
          <div ref={feedbackRef} className="pb-4">
            <Flex direction="column" gap="4">
              <FeedbackCard
                feedback={selectedChoice?.feedback || "No feedback available."}
                llmFeedback={isMode2 ? llmFeedback[part.id] : undefined}
                loadingLlm={isMode2 && loadingFeedback[part.id]}
              />

              <Flex justify="center">
                {isCorrect ? (
                  isLastPart ? (
                    <Button onClick={onContinue} color="lime">
                      Continue →
                    </Button>
                  ) : (
                    <Button onClick={onNextPart} color="lime">
                      Next Question
                    </Button>
                  )
                ) : (
                  <Button onClick={() => onTryAgainPart(part.id)} color="lime">
                    Try Again
                  </Button>
                )}
              </Flex>
            </Flex>
          </div>
        ) : null}
      </Flex>
    </Card>
  );
}
