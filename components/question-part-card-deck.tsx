"use client";

import { useMemo, useRef, useEffect } from "react";
import { Button, Card, Flex, Heading, RadioCards, Text } from "@radix-ui/themes";
import MathDisplay from "@/components/math-display";

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

  useEffect(() => {
    if (isSubmitted && feedbackRef.current) {
      feedbackRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
        </Flex>

        <Flex justify="center">
          <Button onClick={() => onSubmitPart(part.id)} disabled={!canSubmit} color="lime">
            Submit
          </Button>
        </Flex>

        {isSubmitted ? (
          <div ref={feedbackRef}>
            <Card size="2">
              <Flex direction="column" gap="3">
                <Heading size="4">Feedback</Heading>

                <Text size="3" className="whitespace-pre-wrap leading-7">
                  {selectedChoice?.feedback || "No feedback available."}
                </Text>

                <Flex justify="center">
                  {isCorrect ? (
                    isLastPart ? (
                      <Flex align="center" gap="4">
                        {/* <Text weight="bold">
                          All parts solved correctly.
                        </Text> */}

                        <Button onClick={onContinue} color="lime">
                          Continue →
                        </Button>
                      </Flex>
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
            </Card>
          </div>
        ) : null}
      </Flex>
    </Card>
  );
}