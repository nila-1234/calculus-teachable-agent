"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Dialog, Flex, Heading, Text } from "@radix-ui/themes";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircledIcon, CrossCircledIcon, CheckIcon } from "@radix-ui/react-icons";
import MathDisplay from "@/components/math-display";
import { FinalAiAnswer } from "@/lib/scenarios/types";

export type RubricCriterion = {
  id: string;
  label: string;
};
type RubricCriterionFeedback = {
  criterionId: string;
  criterion: string;
  evaluation: "pass" | "fail" | "";
  correct: boolean;
  expectedEvaluation: "pass" | "fail" | null;
  feedback: string;
};

export type AnswerReviewState = {
  results: Record<string, "pass" | "fail" | "">;
  submitted: boolean;
  feedback: RubricCriterionFeedback[];
};

type SampleAnswer = {
  title: string;
  text: string;
};

type ApplyRubricPanelProps = {
  question?: string;
  rubric: RubricCriterion[];
  answers: readonly FinalAiAnswer[];
  reviewStates: Record<string, AnswerReviewState>;
  loadingAnswerId?: string | null;
  onToggleResult: (answerId: string, criterionId: string, value: "pass" | "fail") => void;
  onSubmitAnswer: (answerId: string) => void;
  mode?: number;
  onModeChange?: (mode: number) => void;
  explanations?: Record<string, Record<string, string>>;
  onExplanationChange?: (answerId: string, criterionId: string, value: string) => void;
  onExplanationBlur?: (answerId: string, criterionId: string, value: string) => void;
  onComplete?: () => void;
  correctSample?: SampleAnswer;
};

export default function ApplyRubricPanel({
  question,
  rubric,
  answers,
  reviewStates,
  loadingAnswerId,
  onToggleResult,
  onSubmitAnswer,
  mode = 1,
  onModeChange,
  explanations = {},
  onExplanationChange,
  onExplanationBlur,
  onComplete,
  correctSample,
}: ApplyRubricPanelProps) {
  const isMode2 = mode === 2;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hintOpen, setHintOpen] = useState(false);
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

  const allSubmitted = completedCount === answers.length && answers.length > 0;

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
          <Text size="2" color="gray">
            Answer {currentIndex + 1} of {answers.length} · {completedCount} submitted
          </Text>
        </Flex>

        <Text size="3" color="gray">
          In this step, you will apply your rubric to evaluate a fresh set of AI-generated answers.
          Review each answer carefully and use the criteria you defined to assess whether it meets the requirements.
        </Text>

        <div className="flex-1 space-y-5 overflow-y-auto">
          {question && (
            <Card size="2">
              <Flex direction="column" gap="3">
                <Heading size="4">Question</Heading>
                <Text size="3" className="whitespace-pre-wrap leading-7">
                  <MathDisplay text={question} />
                </Text>
              </Flex>
            </Card>
          )}

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
              <Flex align="center" gap="3">
                <Heading size="4">Evaluate This Answer</Heading>
                {correctSample && (
                  <Dialog.Root open={hintOpen} onOpenChange={setHintOpen}>
                    <Dialog.Trigger>
                      <Button variant="ghost" color="gray" size="2">
                        View Correct Answer
                      </Button>
                    </Dialog.Trigger>
                    <Dialog.Content maxWidth="600px">
                      <Dialog.Title>Fully Correct Answer</Dialog.Title>
                      <Text size="3" className="whitespace-pre-wrap leading-7">
                        <MathDisplay text={correctSample.text} />
                      </Text>
                      <Flex justify="end" mt="4">
                        <Dialog.Close>
                          <Button variant="soft" color="gray">Close</Button>
                        </Dialog.Close>
                      </Flex>
                    </Dialog.Content>
                  </Dialog.Root>
                )}
              </Flex>

              <Text size="2" color="gray">
                Review the AI answer above and evaluate it against each selected criterion.
                Mark “Pass” only if the criterion is fully satisfied, and “Fail” if it is missing, incorrect, or incomplete.
              </Text>

              <div className="overflow-hidden rounded-2xl border border-gray-200">
                <table className="w-full border-collapse table-fixed">
                  <thead className="bg-lime-50">
                    <tr>
                      <th className={`${isMode2 ? "w-[33%]" : "w-[45%]"} border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-slate-900`}>
                        Criterion
                      </th>
                      <th className={`${isMode2 ? "w-[12%]" : "w-[18%]"} border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-slate-900`}>
                        Evaluation
                      </th>
                      {isMode2 && (
                        <th className="w-[25%] border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-slate-900">
                          Reasoning
                        </th>
                      )}
                      <th className={`${isMode2 ? "w-[30%]" : "w-[37%]"} border-b border-gray-300 px-4 py-3 text-left text-sm font-semibold text-slate-900`}>
                        {currentState?.submitted ? "Feedback" : ""}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {rubric.map((criterion) => {
                      const selectedValue =
                        currentState?.results?.[criterion.id] ?? "";
                      const criterionFeedback = Array.isArray(currentState?.feedback)
                        ? currentState.feedback.find((item) => item.criterionId === criterion.id)
                        : undefined;
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
                          {isMode2 && (
                            <td className="border-b border-gray-200 px-4 py-3 align-top">
                              <textarea
                                className="w-full min-h-[72px] resize-none rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-gray-400 disabled:opacity-50"
                                placeholder="Explain your reasoning…"
                                value={explanations[currentAnswer.id]?.[criterion.id] || ""}
                                onChange={(e) => onExplanationChange?.(currentAnswer.id, criterion.id, e.target.value)}
                                onBlur={(e) => onExplanationBlur?.(currentAnswer.id, criterion.id, e.target.value)}
                                disabled={isLoading}
                              />
                            </td>
                          )}

                          <td className="border-b border-gray-200 px-4 py-3 align-top">
                            {currentState?.submitted ? (
                              <div
                                className={`min-h-[40px] flex items-center gap-2 ${criterionFeedback?.correct
                                    ? "text-green-600"
                                    : "text-red-600"
                                  }`}
                              >
                                {!isLoading && (criterionFeedback?.correct
                                  ? <CheckCircledIcon className="shrink-0 mt-0.5" width={25} height={25} />
                                  : <CrossCircledIcon className="shrink-0 mt-0.5" width={25} height={25} />
                                )}
                                <div>
                                  {isLoading ? (
                                    "Loading feedback..."
                                  ) : criterionFeedback?.feedback ? (
                                    <MathDisplay text={criterionFeedback.feedback} />
                                  ) : (
                                    "No feedback returned for this criterion."
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="min-h-[40px]" />
                            )}
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

          {/* {currentState?.submitted ? (
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
          ) : null} */}
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
            color="lime"
            disabled={!allSubmitted}
            onClick={() => onComplete?.()}
          >
            <CheckIcon />
            Complete Submission
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