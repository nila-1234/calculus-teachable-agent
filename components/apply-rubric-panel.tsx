"use client";

import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
import MathDisplay from "@/components/math-display";
import { useEffect, useRef } from "react";

export type RubricCriterion = {
  id: string;
  label: string;
};

export type AnswerEvaluation = {
  id: string;
  title: string;
  text: string;
  results: Record<string, "pass" | "fail" | "">;
};

type ApplyRubricPanelProps = {
  rubric: RubricCriterion[];
  answers: AnswerEvaluation[];
  submitted: boolean;
  feedback: string;
  onToggleResult: (
    answerId: string,
    criterionId: string,
    value: "pass" | "fail"
  ) => void;
  onSubmit: () => void;
};

export default function ApplyRubricPanel({
  rubric,
  answers,
  submitted,
  feedback,
  onToggleResult,
  onSubmit,
}: ApplyRubricPanelProps) {
  const allFilled = answers.every((answer) =>
    rubric.every((criterion) => answer.results[criterion.id])
  );

  const feedbackRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    if (submitted && feedbackRef.current) {
      feedbackRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [submitted]);

  return (
    <Card size="3" className="h-full">
      <Flex direction="column" gap="5" className="h-full">
        <Heading size="6">Apply Rubric</Heading>

        <div className="flex-1 space-y-5">
          {answers.map((answer) => (
            <Card key={answer.id} size="2">
              <Flex direction="column" gap="4">
                <div>
                  <Heading size="4">{answer.title}</Heading>
                  <div className="mt-2 text-sm leading-7 text-slate-900">
                    <MathDisplay text={answer.text} />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">
                          Criterion
                        </th>
                        <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700">
                          Decision
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rubric.map((criterion) => {
                        const current = answer.results[criterion.id] || "";

                        return (
                          <tr key={criterion.id} className="bg-white">
                            <td className="border-b border-gray-200 px-4 py-3 text-sm text-slate-900">
                              <MathDisplay text={criterion.label} />
                            </td>
                            <td className="border-b border-gray-200 px-4 py-3">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onToggleResult(answer.id, criterion.id, "pass")
                                  }
                                  disabled={submitted}
                                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${current === "pass"
                                    ? "border-green-500 bg-green-50 text-green-700"
                                    : "border-gray-200 bg-white text-gray-700"
                                    } ${submitted ? "cursor-not-allowed opacity-60" : ""}`}
                                >
                                  Pass
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    onToggleResult(answer.id, criterion.id, "fail")
                                  }
                                  disabled={submitted}
                                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${current === "fail"
                                    ? "border-red-500 bg-red-50 text-red-700"
                                    : "border-gray-200 bg-white text-gray-700"
                                    } ${submitted ? "cursor-not-allowed opacity-60" : ""}`}
                                >
                                  Fail
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Flex>
            </Card>
          ))}

          <Flex align="center" justify="center">
            <Button
              onClick={onSubmit}
              disabled={!allFilled || submitted}
              color="cyan"
            >
              {submitted ? "Submitted" : "Submit"}
            </Button>
          </Flex>

          {feedback ? (

            <Card size="2" ref={feedbackRef}>
              <Flex direction="column" gap="3">
                <Heading size="4">Evaluation Feedback</Heading>
                <Text size="3" className="whitespace-pre-wrap leading-7">
                  {feedback}
                </Text>
              </Flex>
            </Card>
          ) : null}

        </div>
      </Flex>
    </Card>
  );
}