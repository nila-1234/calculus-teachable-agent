"use client";

import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
import MathDisplay from "@/components/math-display";
import { useEffect, useRef } from "react";
import { ArrowRightIcon, CheckCircledIcon, CrossCircledIcon } from "@radix-ui/react-icons";
import { RubricOption } from "@/lib/scenarios/types";

export type RubricDecision = "include" | "exclude";

type SampleAnswer = {
  title: string;
  text: string;
};

type CreateRubricPanelProps = {
  question: string;
  correctSample: SampleAnswer;
  incorrectSample: SampleAnswer;
  rubricOptions: readonly RubricOption[];
  rubricDecisions: Record<string, RubricDecision>;
  submitted: boolean;
  isPerfect: boolean;
  allCriteriaDecided: boolean;
  onSetRubricDecision: (id: string, decision: RubricDecision) => void;
  onTryAgain: () => void;
  onContinue: () => void;
  onSubmit: () => void;
};

export default function CreateRubricPanel({
  question,
  correctSample,
  incorrectSample,
  rubricOptions,
  rubricDecisions,
  submitted,
  isPerfect,
  allCriteriaDecided,
  onSetRubricDecision,
  onContinue,
  onSubmit,
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
          In this step, you will create a grading rubric by deciding whether each
          criterion should be included or excluded. Use the sample answers to
          decide which criteria are essential for evaluating the student&apos;s
          solution.
        </Text>

        <div className="flex-1 space-y-5 overflow-y-auto">
          <Card size="2">
            <Flex direction="column" gap="3">
              <Heading size="4">Question</Heading>
              <Text size="3" className="whitespace-pre-wrap leading-7">
                <MathDisplay text={question} />
              </Text>
            </Flex>
          </Card>

          <Text size="2" color="gray">
            Compare the sample answers to identify what a correct solution must
            include and what should not be required.
          </Text>

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

          <Card size="2">
            <Flex direction="column" gap="4">
              <div>
                <Heading size="4">Select Rubric Criteria</Heading>
                <Text size="2" color="gray">
                  For each criterion, choose whether it should be included in the
                  rubric or excluded. You must make a choice for every row before
                  submitting.
                </Text>
              </div>

              <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-lime-50">
                    <tr>
                      <th className="border-b border-gray-300 px-4 py-3 text-left font-semibold text-slate-900">
                        Criterion
                      </th>
                      <th className="w-44 border-b border-gray-300 px-4 py-3 text-center font-semibold text-slate-900">
                        Select
                      </th>
                      <th className="w-[45%] border-b border-gray-300 px-4 py-3 text-left font-semibold text-slate-900">
                        {submitted ? "Feedback" : ""}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {rubricOptions.map((option) => {
                      const decision = rubricDecisions[option.id];
                      const included = decision === "include";
                      const excluded = decision === "exclude";

                      const isCorrectDecision =
                        (option.correct && included) ||
                        (!option.correct && excluded);

                      return (
                        <tr key={option.id} className="align-middle">
                          <td className="border-b border-gray-200 px-4 py-4 font-medium text-slate-900">
                            <MathDisplay text={option.label} />
                          </td>

                          <td className="border-b border-gray-200 px-4 py-4 text-center">
                            <Flex gap="2" justify="center">
                              <Button
                                variant="soft"
                                color={included ? "green" : "gray"}
                                onClick={() => onSetRubricDecision(option.id, "include")}
                                disabled={submitted}
                                size="2"
                                className={`${!included ? "!bg-white" : ""}`}
                              >
                                Include
                              </Button>
                              <Button
                                variant="soft"
                                color={excluded ? "red" : "gray"}
                                onClick={() => onSetRubricDecision(option.id, "exclude")}
                                disabled={submitted}
                                size="2"
                                className={`${!excluded ? "!bg-white" : ""}`}
                              >
                                Exclude
                              </Button>
                            </Flex>
                          </td>

                          <td className="w-[45%] border-b border-gray-200 px-4 py-4">
                            {submitted ? (
                              <div className="flex flex-col gap-1">
                                <div className={`flex items-center gap-2 font-semibold ${isCorrectDecision ? "text-green-600" : "text-red-600"}`}>
                                  {isCorrectDecision
                                    ? <><CheckCircledIcon width={30} height={30} /> <div className="text-sm leading-6">
                                      <MathDisplay className="text-green-600" text={"Correct: " + option.feedback} />
                                    </div></>
                                    : <><CrossCircledIcon width={30} height={30} /> <div className="text-sm leading-6">
                                      <MathDisplay className="text-red-600" text={"Incorrect: " + option.feedback} />
                                    </div></>
                                  }
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

              {/* {!allCriteriaDecided && !submitted ? (
                <Text size="2" color="gray">
                  Select include or exclude for every criterion to enable submit.
                </Text>
              ) : null} */}

              <Flex align="center" justify="center">
                <Button
                  onClick={onSubmit}
                  disabled={!allCriteriaDecided || submitted}
                  color="lime"
                >
                  {submitted ? "Submitted" : "Submit"}
                </Button>
              </Flex>
            </Flex>
          </Card>

          {submitted ? (
            <Card size="2" ref={feedbackRef}>
              <Flex direction="column" gap="3">

                {isPerfect ? (
                  <>
                    <Heading size="4">Perfect!</Heading>

                    <Text size="3" className="leading-7">

                      Perfect! You included all essential criteria.
                    </Text>
                  </>) : (
                  <>
                    <Heading size="4">Not Quite!</Heading>

                    <Text size="3" className="leading-7">
                      Not quite. Review the feedback for each
                      criterion and try again.
                    </Text>
                  </>
                )}


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