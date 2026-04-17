"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { ArrowLeftIcon, ArrowRightIcon } from "@radix-ui/react-icons";
import MathDisplay from "@/components/math-display";
import { FinalAiAnswer } from "@/lib/scenarios/types";

export type RubricCriterion = {
  id: string;
  label: string;
};

export type AnswerReviewState = {
  results: Record<string, "pass" | "fail" | "">;
  remarks: Record<string, string>;
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
  onChangeRemark: (
    answerId: string,
    criterionId: string,
    value: string
  ) => void;
  onSubmitAnswer: (answerId: string) => void;
};

export default function ApplyRubricPanel({
  rubric,
  answers,
  reviewStates,
  loadingAnswerId,
  onToggleResult,
  onChangeRemark,
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
        <Flex align="center" justify="between">
          <Heading size="6">Apply Rubric</Heading>
          <Text size="2" color="gray">
            Answer {currentIndex + 1} of {answers.length} · {completedCount} submitted
          </Text>
        </Flex>

        <Text size="3" color="gray">
          In this step, you will apply your rubric to evaluate AI-generated answers.
          For each criterion, decide whether the answer meets the requirement or does not.
        </Text>

        <div className="flex-1 space-y-5 overflow-y-auto">
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

          <Card size="2">
            <Flex direction="column" gap="4">
              <Heading size="4">Evaluate This Answer</Heading>

              <Text size="2" color="gray">
                Review the AI answer above and evaluate it against each selected criterion.
                Mark “Pass” only if the criterion is fully satisfied, and “Fail” if it is missing, incorrect, or incomplete.
                Add remarks to justify your evaluation for each criterion.
              </Text>

              <div className="overflow-hidden rounded-2xl border border-gray-200">
                <table className="w-full border-collapse table-fixed">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-[40%] border-b border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">
                        Criterion
                      </th>
                      <th className="w-[10%] border-b border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">
                        Evaluation
                      </th>
                      <th className="w-[44%] border-b border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">
                        Remarks
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {rubric.map((criterion) => {
                      const selectedValue =
                        currentState?.results?.[criterion.id] ?? "";
                      const remark =
                        currentState?.remarks?.[criterion.id] ?? "";

                      return (
                        <tr key={criterion.id} className="bg-white">
                          <td className="border-b border-gray-200 px-4 py-3 align-middle text-sm font-medium text-slate-900">
                            <MathDisplay text={criterion.label} />
                          </td>

                          <td className="border-b border-gray-200 px-4 py-3 align-middle">
                            <Flex gap="2" wrap="wrap">
                              <Button
                                type="button"
                                variant={selectedValue === "pass" ? "solid" : "soft"}
                                color="green"
                                disabled={isLoading}
                                onClick={() =>
                                  onToggleResult(currentAnswer.id, criterion.id, "pass")
                                }
                              >
                                Pass
                              </Button>

                              <Button
                                type="button"
                                variant={selectedValue === "fail" ? "solid" : "soft"}
                                color="red"
                                disabled={isLoading}
                                onClick={() =>
                                  onToggleResult(currentAnswer.id, criterion.id, "fail")
                                }
                              >
                                Fail
                              </Button>
                            </Flex>
                          </td>

                          <td className="border-b border-gray-200 px-4 py-3 align-middle">
                            <input
                              type="text"
                              value={remark}
                              disabled={isLoading}
                              onChange={(e) =>
                                onChangeRemark(
                                  currentAnswer.id,
                                  criterion.id,
                                  e.target.value
                                )
                              }
                              placeholder="Add remark..."
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-lime-500 focus:ring-2 focus:ring-lime-200 disabled:bg-gray-50"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

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