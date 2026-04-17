"use client";

import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
import MathDisplay from "@/components/math-display";
import { useEffect, useRef } from "react";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import { RubricOption } from "@/lib/scenarios/types";

// export type RubricOption = {
//   id: string;
//   label: string;
//   description: string;
// };

type SampleAnswer = {
  title: string;
  text: string;
};

type CreateRubricPanelProps = {
  question: string;
  correctSample: SampleAnswer;
  incorrectSample: SampleAnswer;
  rubricOptions: readonly RubricOption[];
  selectedRubricIds: string[];
  submitted: boolean;
  feedback: string;
  isPerfect: boolean;
  onToggleRubric: (id: string) => void;
  onTryAgain: () => void;
  onContinue: () => void;
  onSubmit: () => void;
};

export default function CreateRubricPanel({
  question,
  correctSample,
  incorrectSample,
  rubricOptions,
  selectedRubricIds,
  onToggleRubric,
  onContinue,
  onSubmit,
  feedback,
  submitted,
  isPerfect,
  onTryAgain,
}: CreateRubricPanelProps) {
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (submitted && feedbackRef.current) {
      feedbackRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [submitted]);

  return (
    <Card size="3" className="h-full">
      <Flex direction="column" gap="5" className="h-full">
        <Heading size="6">Create Rubric</Heading>

        <Text size="3" color="gray">
          In this step, you will create a grading rubric by selecting the criteria that define a strong solution.
          Focus on what must be correct for the answer to be considered complete and accurate.
          You will use this rubric in the next phase to evaluate the AI students' responses.
        </Text>

        <div className="flex-1 space-y-5 overflow-y-auto">
          {/* Question */}
          <Card size="2">
            <Flex direction="column" gap="3">
              <Heading size="4">Question</Heading>
              <Text size="3" className="whitespace-pre-wrap leading-7">
                <MathDisplay text={question} />
              </Text>
            </Flex>
          </Card>

          <div className="mb-4">
            <Text size="2" color="gray">
              Compare the sample answers to understand what a correct solution includes and what is missing in an incorrect one.
              Use this comparison to choose rubric criteria that clearly separate strong and weak responses.
            </Text>
          </div>

          {/* Sample Answers */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card size="2">
              <Flex direction="column" gap="3">
                <Heading size="4">{correctSample.title}</Heading>
                <Text size="3" className="whitespace-pre-wrap leading-7">
                  <MathDisplay text={correctSample.text} />
                </Text>
              </Flex>
            </Card>

            <Card size="2">
              <Flex direction="column" gap="3">
                <Heading size="4">{incorrectSample.title}</Heading>
                <Text size="3" className="whitespace-pre-wrap leading-7">
                  <MathDisplay text={incorrectSample.text} />
                </Text>
              </Flex>
            </Card>
          </div>

          {/* Rubric Selection */}
          <Card size="2">
            <Flex direction="column" gap="4">
              <Heading size="4">Select Rubric Criteria</Heading>

              <Text size="2" color="gray">
                Select the criteria that should be used to evaluate a student's solution.
                Choose only those that are essential for correctly identifying critical numbers and interpreting the result.
                Avoid selecting criteria that are helpful but not required.
              </Text>

              <div className="overflow-hidden rounded-2xl border border-gray-200">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-24 border-b border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">
                        Select
                      </th>
                      <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">
                        Criterion
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {rubricOptions.map((option) => {
                      const selected = selectedRubricIds.includes(option.id);

                      return (
                        <tr key={option.id} className="bg-white">
                          <td className="border-b border-gray-200 px-4 py-3 align-top">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => onToggleRubric(option.id)}
                              className="mt-1 h-4 w-4 cursor-pointer"
                              disabled={submitted}
                            />
                          </td>

                          <td className="border-b border-gray-200 px-4 py-3 align-top text-sm font-medium text-slate-900">
                            <MathDisplay text={option.label} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Flex align="center" justify="center">
                <Button
                  onClick={onSubmit}
                  disabled={selectedRubricIds.length === 0 || submitted}
                  color="lime"
                >
                  {submitted ? "Submitted" : "Submit"}
                </Button>
              </Flex>
            </Flex>
          </Card>

          {/* Feedback */}
          {/* {submitted ? (
            <Card size="2" ref={feedbackRef}>
              <Flex direction="column" gap="3">
                <Heading size="4">Rubric Feedback</Heading>

                <Text size="3" className="whitespace-pre-wrap leading-7">
                  {feedback}
                </Text>

                <Flex justify="center">
                  <Button
                    onClick={onContinue}
                    disabled={selectedRubricIds.length === 0}
                    color="lime"
                  >
                    Continue
                    <ArrowRightIcon />
                  </Button>
                </Flex>
              </Flex>
            </Card>
          ) : null} */}
          {/* Feedback */}
          {submitted ? (
            <Card size="2" ref={feedbackRef}>
              <Flex direction="column" gap="3">
                <Heading size="4">Rubric Feedback</Heading>

                <Text size="3" className="whitespace-pre-wrap leading-7">
                  {feedback}
                </Text>

                <Flex justify="center" gap="3">
                  {isPerfect ? (
                    <Button onClick={onContinue} color="lime">
                      Continue
                      <ArrowRightIcon />
                    </Button>
                  ) : (
                    <Button onClick={onTryAgain} variant="soft" color="gray">
                      Try Again
                    </Button>
                  )}
                </Flex>
              </Flex>
            </Card>
          ) : null}
        </div>
      </Flex>
    </Card>
  );
}