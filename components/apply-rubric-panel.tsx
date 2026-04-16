"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
} from "@radix-ui/react-icons";
import MathDisplay from "@/components/math-display";
import { FinalAiAnswer } from "@/lib/scenarios/types";

export type RubricCriterion = {
  id: string;
  label: string;
};

export type AnswerReviewState = {
  results: Record<string, "pass" | "fail" | "">;
  submitted: boolean;
  feedback: string;
};

type ApplyRubricPanelProps = {
  rubric: RubricCriterion[];
  answers: readonly FinalAiAnswer[];
  reviewStates: Record<string, AnswerReviewState>;
  loadingAnswerId?: string | null;
  onToggleResult: (
    answerId: string,
    criterionId: string,
    value: "pass" | "fail"
  ) => void;
  onSubmitAnswer: (answerId: string) => void;
};

export default function ApplyRubricPanel({
  rubric,
  answers,
  reviewStates,
  loadingAnswerId,
  onToggleResult,
  onSubmitAnswer,
}: ApplyRubricPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  const currentAnswer = answers[currentIndex];
  const currentState = reviewStates[currentAnswer.id];

  const allFilled = rubric.every(
    (criterion) => currentState?.results?.[criterion.id]
  );

  const isLoading = loadingAnswerId === currentAnswer.id;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < answers.length - 1;

  const completedCount = useMemo(
    () => answers.filter((a) => reviewStates[a.id]?.submitted).length,
    [answers, reviewStates]
  );

  useEffect(() => {
    if (currentState?.submitted && feedbackRef.current) {
      requestAnimationFrame(() => {
        feedbackRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [currentAnswer.id, currentState?.submitted]);

  return (
    <Card size="3" className="h-full">
      <Flex direction="column" gap="5" className="h-full">
        {/* Header */}
        <Flex align="center" justify="between">
          <Heading size="6">Apply Rubric</Heading>
          <Text size="2" color="gray">
            Answer {currentIndex + 1} of {answers.length} ·{" "}
            {completedCount} submitted
          </Text>
        </Flex>

        <div className="flex-1 space-y-5 overflow-y-auto">
          {/* Answer */}
          <Card size="2">
            <Flex direction="column" gap="3">
              <Flex align="center" justify="between">
                <Heading size="4">{currentAnswer.label}</Heading>
                {currentState?.submitted ? (
                  <Text size="2" color="green">
                    Submitted
                  </Text>
                ) : (
                  <Text size="2" color="gray">
                    Not submitted
                  </Text>
                )}
              </Flex>

              <Text size="3" className="whitespace-pre-wrap leading-7">
                <MathDisplay text={currentAnswer.text} />
              </Text>
            </Flex>
          </Card>

          {/* Rubric Table */}
          <Card size="2">
            <Flex direction="column" gap="4">
              <Heading size="4">Evaluate This Answer</Heading>

              <div className="overflow-hidden rounded-2xl border border-gray-200">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">
                        Criterion
                      </th>
                      <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">
                        Evaluation
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {rubric.map((criterion) => {
                      const selectedValue =
                        currentState?.results?.[criterion.id] ?? "";

                      return (
                        <tr key={criterion.id} className="bg-white">
                          <td className="border-b border-gray-200 px-4 py-3 align-top text-sm font-medium text-slate-900">
                            <MathDisplay text={criterion.label} />
                          </td>

                          <td className="border-b border-gray-200 px-4 py-3 align-top">
                            <Flex gap="2">
                              <Button
                                type="button"
                                variant={
                                  selectedValue === "pass" ? "solid" : "soft"
                                }
                                color="green"
                                disabled={isLoading}
                                onClick={() =>
                                  onToggleResult(
                                    currentAnswer.id,
                                    criterion.id,
                                    "pass"
                                  )
                                }
                              >
                                Pass
                              </Button>

                              <Button
                                type="button"
                                variant={
                                  selectedValue === "fail" ? "solid" : "soft"
                                }
                                color="red"
                                disabled={isLoading}
                                onClick={() =>
                                  onToggleResult(
                                    currentAnswer.id,
                                    criterion.id,
                                    "fail"
                                  )
                                }
                              >
                                Fail
                              </Button>
                            </Flex>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Submit */}
              <Flex justify="center">
                <Button
                  type="button"
                  onClick={() => onSubmitAnswer(currentAnswer.id)}
                  disabled={!allFilled || isLoading}
                  color="lime"
                >
                  {isLoading
                    ? "Submitting..."
                    : currentState?.submitted
                      ? "Resubmit"
                      : "Submit"}
                </Button>
              </Flex>
            </Flex>
          </Card>

          {/* Feedback */}
          {currentState?.submitted ? (
            <div ref={feedbackRef}>
              <Card size="2">
                <Flex direction="column" gap="3">
                  <Heading size="4">Feedback for This Answer</Heading>

                  {isLoading ? (
                    <Text size="3" color="gray">
                      Generating feedback...
                    </Text>
                  ) : currentState?.feedback ? (
                    <Text size="3" className="whitespace-pre-wrap leading-7">
                      {currentState.feedback}
                    </Text>
                  ) : (
                    <Text size="3" color="gray">
                      Submit this answer’s rubric evaluation to receive feedback.
                    </Text>
                  )}
                </Flex>
              </Card>
            </div>
          ) : null}
        </div>

        {/* Navigation */}
        <Flex align="center" justify="between">
          <Button
            type="button"
            variant="soft"
            color="gray"
            disabled={!hasPrevious}
            onClick={() => setCurrentIndex((prev) => prev - 1)}
          >
            <ArrowLeftIcon />
            Previous
          </Button>

          <Button
            type="button"
            variant="soft"
            color="gray"
            disabled={!hasNext}
            onClick={() => setCurrentIndex((prev) => prev + 1)}
          >
            Next
            <ArrowRightIcon />
          </Button>
        </Flex>
      </Flex>
    </Card>
  );
}