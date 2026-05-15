"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Button,
  Card,
  Flex,
  Heading,
  RadioCards,
  Text,
  TextArea,
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
  explanations: Record<string, string>;
  submitted: boolean;
  isCorrectSelection: boolean;
  onSelectPart: (partId: string, choiceId: string) => void;
  onExplanationChange: (partId: string, value: string) => void;
  onSubmit: () => void;
  onContinue: () => void;
  onTryAgain: () => void;
  questionFeedbackByPart: Record<string, string>;
  questionFeedbackLoading: boolean;
};

type OptionCardsProps = {
  title: string;
  options: readonly Choice[];
  selectedValue: string;
  submitted: boolean;
  explanation: string;
  onChange: (id: string) => void;
  onExplanationChange: (value: string) => void;
};

function OptionCards({
  title,
  options,
  selectedValue,
  explanation,
  submitted,
  onChange,
  onExplanationChange,
}: OptionCardsProps) {
  return (
    <Flex direction="column" gap="3">
      <Heading size="3">{title}</Heading>

      <div className="grid grid-cols-1 gap-4">
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

        {/* <div className="rounded-xl border-2 border-lime-400 bg-lime-50/50 p-3">
          <Text as="div" size="2" weight="medium" className="mb-2 pb-2">
            Explain your selection
          </Text>

          <TextArea
            value={explanation}
            onChange={(e) => onExplanationChange(e.target.value)}
            disabled={submitted}
            placeholder="Why did you choose this option?"
            rows={7}
            className="w-full border-1 border-gray-300"
          />
        </div> */}
      </div>
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
  questionFeedbackByPart,
  questionFeedbackLoading,
  explanations,
  onExplanationChange,
}: AuthorQuestionPanelProps) {
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (submitted && feedbackRef.current) {
      feedbackRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [submitted]);

  const selectedEquation = useMemo(() => {
    const firstPart = parts[0];
    if (!firstPart) return "";

    const selectedId = selectedParts[firstPart.id];
    const selectedChoice = firstPart.options.find(
      (choice) => choice.id === selectedId
    );

    if (!selectedChoice) return "";

    return selectedChoice.text
      // remove \( ... \)
      .replace(/^\\\(/, "")
      .replace(/\\\)$/, "")

      // convert leading f(x)= to y=
      .replace(/^f\(x\)\s*=\s*/, "y=")

      // convert \sin to sin
      .replace(/\\sin/g, "sin")

      // convert x^{3} -> x^3
      .replace(/\^\{(\d+)\}/g, "^$1")

      // convert e^{...} -> exp(...)
      .replace(/e\^\{([^}]+)\}/g, "exp($1)")

      // convert implicit multiplication: 2x -> 2*x
      .replace(/(\d)(x)/g, "$1*$2")

      // convert implicit multiplication: 2sin(...) -> 2*sin(...)
      .replace(/(\d)(sin\()/g, "$1*$2")

      // remove spaces
      .replace(/\s+/g, "");
  }, [parts, selectedParts]);

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
                  <ScatterPlot filePath={scatterPlotSrc} equation={selectedEquation} />
                ) : (
                  <Text color="gray">Scatter plot placeholder</Text>
                )}
              </div>
            </div>
          </Card>

          <Card size="2">
            <Flex direction="column" gap="4">
              <Heading size="4">Question</Heading>

              <Text size="2" color="gray">
                Complete the statement by selecting the correct option for each blank.
              </Text>

              <Text size="3" className="whitespace-pre-wrap leading-7">
                {question}
              </Text>

              {parts.map((part) => (
                <OptionCards
                  key={part.id}
                  title={`(${part.id})`}
                  options={part.options}
                  selectedValue={selectedParts[part.id] || ""}
                  explanation={explanations[part.id] || ""}
                  submitted={submitted}
                  onChange={(choiceId) => onSelectPart(part.id, choiceId)}
                  onExplanationChange={(value) => onExplanationChange(part.id, value)}
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
                    {
                      selectedFeedback.map((item) => (
                        <div key={item.partId}>
                          <Text as="div" weight="bold" size="2" className="mb-1">
                            ({item.partId})
                          </Text>

                          <Text size="3" className="whitespace-pre-wrap leading-7">
                            {item.feedback}
                          </Text>

                          {/* <div className="mt-3 rounded-xl border border-lime-200 bg-lime-50/60 p-3">
                            <Text as="div" size="2" weight="bold" className="mb-1">
                              Your explanation:
                            </Text>

                            <Text size="3" className="whitespace-pre-wrap leading-7">
                              {questionFeedbackByPart[item.partId] || "No explanation feedback returned."}
                            </Text>
                          </div> */}
                        </div>
                      ))
                    }
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