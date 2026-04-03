"use client";

import Image from "next/image";
import { Button, Card, Flex, Heading, RadioCards, Text } from "@radix-ui/themes";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import MathDisplay from "@/components/math-display";
import { useEffect, useRef } from "react";

import ScatterPlot from "@/components/scatter-plot";

type Choice = {
  id: string;
  text: string;
  correct?: boolean;
  feedback?: string;
};

type AuthorQuestionPanelProps = {
  scenario: string;
  question: string;
  scatterPlotSrc: string;
  choices: Choice[];
  selectedChoice: string;
  submitted: boolean;
  selectedFeedback: string;
  isCorrectSelection: boolean;
  onSelectChoice: (id: string) => void;
  onSubmit: () => void;
  onContinue: () => void;
  onTryAgain: () => void;
};


export default function AuthorQuestionPanel({
  scenario,
  question,
  scatterPlotSrc,
  choices,
  selectedChoice,
  submitted,
  selectedFeedback,
  isCorrectSelection,
  onSelectChoice,
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

  
  return (
    <Card size="3" className="h-full">
      <Flex direction="column" gap="5" className="h-full">
        <Heading size="6">Scenario</Heading>

        <div className="flex-1 space-y-5">
          <Card size="2">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div>
                {/* <Heading size="4" mb="3">
                  Scenario
                </Heading> */}
                <Text size="3" className="whitespace-pre-wrap leading-7">
                  {scenario}
                </Text>
              </div>

              {/* <div className="rounded-2xl border border-gray-200 bg-white p-4"> */}
                <div className="flex min-h-[320px] items-center justify-center rounded-xl bg-gray-50">
                  {scatterPlotSrc ? (
                    <ScatterPlot filePath={scatterPlotSrc} />
                  ) : (
                    <Text color="gray">Scatter plot placeholder</Text>
                  )}
                </div>
              {/* </div> */}
            </div>
          </Card>

          <Card size="2">
            <Flex direction="column" gap="4">
              <Heading size="4">Question</Heading>

              <Text size="3" className="whitespace-pre-wrap leading-7">
                {question}
              </Text>

              <RadioCards.Root
                value={selectedChoice}
                onValueChange={(value) => onSelectChoice(value)}
                columns="1"
                className="w-full"
              >
                {choices.map((choice) => {
                  const isSelected = selectedChoice === choice.id;

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
                          {choice.id}
                        </div>

                        <Text size="3" className="leading-7 text-slate-900">
                          <MathDisplay text={choice.text} />
                        </Text>
                      </Flex>
                    </RadioCards.Item>
                  );
                })}
              </RadioCards.Root>

              <Flex align="center" justify="between">

                <Button
                  onClick={onSubmit}
                  disabled={!selectedChoice || submitted}
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

                  <Text size="3" className="whitespace-pre-wrap leading-7">
                    {selectedFeedback}
                  </Text>

                  <Flex justify="center">
                    {isCorrectSelection ? (
                      <Button onClick={onContinue} color="lime">
                        Continue
                        <ArrowRightIcon className="" />
                      </Button>
                    ) : <Button onClick={onTryAgain} color="lime">
                      Try Again
                    </Button>}
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