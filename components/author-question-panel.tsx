"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Button,
  Card,
  Flex,
  Heading,
  RadioCards,
  Text,
} from "@radix-ui/themes";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import MathDisplay from "@/components/math-display";
import ScatterPlot from "@/components/scatter-plot";

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
  submitted: boolean;
  isCorrectSelection: boolean;
  onSelectPart: (partId: string, choiceId: string) => void;
  onSubmit: () => void;
  onContinue: () => void;
  onTryAgain: () => void;
};

type OptionCardsProps = {
  title: string;
  options: readonly Choice[];
  selectedValue: string;
  submitted: boolean;
  onChange: (id: string) => void;
};

function OptionCards({
  title,
  options,
  selectedValue,
  submitted,
  onChange,
}: OptionCardsProps) {
  return (
    <Flex direction="column" gap="3">
      <Heading size="3">{title}</Heading>

      <RadioCards.Root
        value={selectedValue}
        onValueChange={onChange}
        columns="1"
        className="w-full"
      >
        {options.map((choice, index) => {
          const isSelected = selectedValue === choice.id;
          const badge = String(index + 1);

          return (
            <RadioCards.Item
              key={choice.id}
              value={choice.id}
              disabled={submitted}
              className="w-full [&_[data-state]]:hidden"
            >
              <Flex align="start" gap="3" className="w-full text-left">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${isSelected
                    ? "border-lime-500 bg-lime-500 text-white"
                    : "border-gray-300 text-gray-600"
                    }`}
                >
                  {badge}
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
  );
}

export default function AuthorQuestionPanel({
  scenario,
  question,
  scatterPlotSrc,
  parts,
  selectedParts,
  submitted,
  isCorrectSelection,
  onSelectPart,
  onSubmit,
  onContinue,
  onTryAgain,
}: AuthorQuestionPanelProps) {
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (submitted && feedbackRef.current) {
      feedbackRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [submitted]);

  // const allSelected = parts.every((part) => selectedParts[part.id]);

  const allSelected = useMemo(() => {
    return parts.every((part) => Boolean(selectedParts[part.id]));
  }, [parts, selectedParts]);

  const selectedFeedback = useMemo(() => {
    return parts.map((part) => {
      const selectedId = selectedParts[part.id];
      const selectedChoice = part.options.find((choice) => choice.id === selectedId);

      return {
        partId: part.id,
        feedback: selectedChoice?.feedback || "",
      };
    });
  }, [parts, selectedParts]);

  return (
    <Card size="3" className="h-full">
      <Flex direction="column" gap="5" className="h-full">
        <Heading size="6">Scenario</Heading>

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
                  <ScatterPlot filePath={scatterPlotSrc} equation="y=0.05*x^3-2*x^2+15*x+80" />
                ) : (
                  <Text color="gray">Scatter plot placeholder</Text>
                )}
              </div>
            </div>
          </Card>

          <Card size="2">
            <Flex direction="column" gap="5">
              <Heading size="4">Question</Heading>

              <Text size="3" className="whitespace-pre-wrap leading-7">
                {question}
              </Text>

              {parts.map((part) => (
                <OptionCards
                  key={part.id}
                  title={`(${part.id})`}
                  options={part.options}
                  selectedValue={selectedParts[part.id] || ""}
                  submitted={submitted}
                  onChange={(choiceId) => onSelectPart(part.id, choiceId)}
                />
              ))}

              <Flex align="center" justify="center">
                <Button
                  onClick={onSubmit}
                  disabled={!allSelected || submitted}
                  color="lime"
                >
                  {submitted ? "Submitted" : "Submit"}
                </Button>
              </Flex>
            </Flex>
          </Card>

          {submitted ? (
            <div ref={feedbackRef}>
              <Card size="2">
                <Flex direction="column" gap="4">
                  <Heading size="4">Feedback</Heading>

                  <div className="space-y-4">
                    {selectedFeedback.map((item) => (
                      <div key={item.partId}>
                        <Text as="div" weight="bold" size="2" className="mb-1">
                          ({item.partId})
                        </Text>
                        <Text size="3" className="whitespace-pre-wrap leading-7">
                          {item.feedback}
                        </Text>
                      </div>
                    ))}
                  </div>

                  <Flex justify="center">
                    {isCorrectSelection ? (
                      <Button onClick={onContinue} color="lime">
                        Continue
                        <ArrowRightIcon />
                      </Button>
                    ) : (
                      <Button onClick={onTryAgain} color="lime">
                        Try Again
                      </Button>
                    )}
                  </Flex>
                </Flex>
              </Card>
            </div>
          ) : null}
        </div>
      </Flex>
    </Card>
  );
}