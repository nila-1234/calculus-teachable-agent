"use client";

import { useEffect, useRef } from "react";
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
  part1: QuestionPart;
  part2: QuestionPart;
  selectedPart1: string;
  selectedPart2: string;
  submitted: boolean;
  selectedFeedbackPart1: string;
  selectedFeedbackPart2: string;
  isCorrectSelection: boolean;
  onSelectPart1: (id: string) => void;
  onSelectPart2: (id: string) => void;
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
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${isSelected
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
  part1,
  part2,
  selectedPart1,
  selectedPart2,
  submitted,
  selectedFeedbackPart1,
  selectedFeedbackPart2,
  isCorrectSelection,
  onSelectPart1,
  onSelectPart2,
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

  const allSelected = Boolean(selectedPart1 && selectedPart2);

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
                  <ScatterPlot filePath={scatterPlotSrc} />
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

              <OptionCards
                title="Blank (1)"
                options={part1.options}
                selectedValue={selectedPart1}
                submitted={submitted}
                onChange={onSelectPart1}
              />

              <OptionCards
                title="Blank (2)"
                options={part2.options}
                selectedValue={selectedPart2}
                submitted={submitted}
                onChange={onSelectPart2}
              />

              <Flex align="center" justify="between">
                <Text size="2" color="gray">
                  Select one option for each blank.
                </Text>

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
                    <div>
                      <Text as="div" weight="bold" size="2" className="mb-1">
                        Blank (1)
                      </Text>
                      <Text size="3" className="whitespace-pre-wrap leading-7">
                        {selectedFeedbackPart1}
                      </Text>
                    </div>

                    <div>
                      <Text as="div" weight="bold" size="2" className="mb-1">
                        Blank (2)
                      </Text>
                      <Text size="3" className="whitespace-pre-wrap leading-7">
                        {selectedFeedbackPart2}
                      </Text>
                    </div>
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