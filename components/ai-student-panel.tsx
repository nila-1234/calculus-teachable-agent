"use client";

import MathDisplay from "@/components/math-display";
import {
  Button,
  Card,
  Flex,
  Heading,
  Select,
  Table,
  Text,
} from "@radix-ui/themes";
import { Cross2Icon } from "@radix-ui/react-icons";

export type RubricRow = {
  id: string;
  criteria: string;
  score: "Pass" | "Fail" | "";
};

type AiStudentPanelProps = {
  question: string;
  rubricRows: RubricRow[];
  setRubricRows: React.Dispatch<React.SetStateAction<RubricRow[]>>;
  submitted: boolean;
  loading: boolean;
  aiAnswer?: string;
  answersLoading?: boolean;
  onSubmit: () => void;
  feedback: string;
};

const CRITERIA_OPTIONS = [
  "completeness",
  "accuracy",
  "explanation",
  "relevance",
] as const;

const SCORE_OPTIONS = ["Pass", "Fail"] as const;

function createRubricRowId() {
  return `rubric-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function AiStudentPanel({
  question,
  rubricRows,
  setRubricRows,
  submitted,
  loading,
  aiAnswer,
  answersLoading = false,
  onSubmit,
  feedback,
}: AiStudentPanelProps) {
  const hasAnyRubricContent = rubricRows.some(
    (row) => row.criteria.trim() || row.score.trim()
  );

  const isDisabled = !hasAnyRubricContent || loading || submitted;

  const updateRow = (
    rowId: string,
    field: keyof Omit<RubricRow, "id">,
    value: string
  ) => {
    setRubricRows((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      )
    );
  };

  const addRow = () => {
    setRubricRows((prev) => [
      ...prev,
      {
        id: createRubricRowId(),
        criteria: "",
        score: "",
      },
    ]);
  };

  const removeRow = (rowId: string) => {
    setRubricRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  return (
    <Card size="3" className="h-full">
      <Flex direction="column" gap="5" className="h-full">
        <Heading size="5">Evaluate AI Student</Heading>

        <div className="flex-1 space-y-5 overflow-y-auto">
          <Card size="2">
            <Flex direction="column" gap="3">
              <Heading size="4">Your Question</Heading>
              <div>
                {question ? (
                  <MathDisplay text={question} />
                ) : (
                  <Text color="gray">No question submitted yet.</Text>
                )}
              </div>
            </Flex>
          </Card>

          <Card size="2">
            <Flex direction="column" gap="3">
              <Heading size="4">AI Student Answer</Heading>

              {answersLoading ? (
                <Flex align="center" gap="3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
                  <Text color="gray">Solving...</Text>
                </Flex>
              ) : aiAnswer ? (
                <MathDisplay text={aiAnswer} />
              ) : (
                <Text color="gray">No AI student answer available yet.</Text>
              )}
            </Flex>
          </Card>

          <Card size="2">
            <Flex direction="column" gap="4">
              <Flex align="center" justify="between">
                <Heading size="4">Your Rubric</Heading>
                <Button
                  type="button"
                  onClick={addRow}
                  disabled={loading || submitted}
                  variant="soft"
                  color="crimson"
                >
                  Add Row
                </Button>
              </Flex>

              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Criteria</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell className="w-48">
                        Score
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell className="w-28" />
                    </Table.Row>
                  </Table.Header>

                  <Table.Body>
                    {rubricRows.map((row) => (
                      <Table.Row key={row.id}>
                        <Table.Cell>
                          <Select.Root
                            value={row.criteria}
                            onValueChange={(value) =>
                              updateRow(row.id, "criteria", value)
                            }
                            disabled={loading || submitted}
                          >
                            <Select.Trigger
                              placeholder="Select criterion"
                              className="w-full"
                            />
                            <Select.Content>
                              {CRITERIA_OPTIONS.map((option) => (
                                <Select.Item key={option} value={option}>
                                  {option.charAt(0).toUpperCase() + option.slice(1)}
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select.Root>
                        </Table.Cell>

                        <Table.Cell>
                          <div className="flex w-full overflow-hidden rounded-lg border border-gray-200">
                            <button
                              type="button"
                              onClick={() => updateRow(row.id, "score", "Pass")}
                              disabled={loading || submitted}
                              className={`flex-1 px-3 py-1.5 text-sm font-medium transition ${row.score === "Pass"
                                ? "bg-green-100 text-green-700"
                                : "bg-white text-gray-600 hover:bg-gray-50"
                                }`}
                            >
                              Pass
                            </button>

                            <button
                              type="button"
                              onClick={() => updateRow(row.id, "score", "Fail")}
                              disabled={loading || submitted}
                              className={`flex-1 px-3 py-1.5 text-sm font-medium transition border-l border-gray-200 ${row.score === "Fail"
                                ? "bg-red-100 text-red-700"
                                : "bg-white text-gray-600 hover:bg-gray-50"
                                }`}
                            >
                              Fail
                            </button>
                          </div>
                        </Table.Cell>

                        <Table.Cell align="center">
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            disabled={loading || submitted || rubricRows.length === 1}
                            className="inline-flex items-center justify-center rounded-md p-2 
                            text-gray-400 transition hover:bg-red-50 hover:text-red-600 
                            disabled:cursor-not-allowed disabled:text-gray-300"
                          >
                            <Cross2Icon width={16} height={16} />
                          </button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </div>

              <Flex direction="column" gap="2">
                {!loading && !submitted && !hasAnyRubricContent ? (
                  <Text size="2" color="gray">
                    Fill in at least one rubric row to continue.
                  </Text>
                ) : null}

                <Flex align="center" justify="between">
                  <div />
                  <Button
                    type="button"
                    onClick={onSubmit}
                    disabled={isDisabled}
                    color="crimson"
                    variant="solid"
                  >
                    {loading ? "Submitting..." : submitted ? "Submitted" : "Submit"}
                  </Button>
                </Flex>
              </Flex>
            </Flex>
          </Card>

          <Card size="2">
            <Flex direction="column" gap="3">
              <Heading size="4">Rubric Feedback</Heading>

              {loading ? (
                <Text color="gray">Generating feedback...</Text>
              ) : feedback ? (
                <Text size="3" className="whitespace-pre-wrap">
                  {feedback}
                </Text>
              ) : (
                <Text color="gray">
                  Submit your rubric to receive AI feedback.
                </Text>
              )}
            </Flex>
          </Card>
        </div>
      </Flex>
    </Card>
  );
}