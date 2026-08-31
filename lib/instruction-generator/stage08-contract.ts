import type { PipelineDocuments } from "./types";

type JsonObject = Record<string, unknown>;

export type Stage08AnswerContract = {
  answerId: string;
  stepCount: number;
  allowedStepRange: { minimum: 1; maximum: number };
};

export type Stage08OutputContract = {
  expectedAnswerIds: string[];
  essentialCriterionIds: string[];
  answerStepCounts: Stage08AnswerContract[];
  exactAnswerGradingCount: number;
  allowedTopLevelKeys: ["schemaVersion", "scenarioId", "answerGradings"];
  allowedAnswerGradingKeys: ["answerId", "rubricFit"];
  allowedRubricFitEntryKeys: ["pass", "step", "feedback"];
  outputSkeleton: {
    schemaVersion: "1.0.0";
    scenarioId: number;
    answerGradings: Array<{
      answerId: string;
      rubricFit: Record<
        string,
        { pass: "<boolean>"; step: string; feedback: "<string, at least 20 characters>" }
      >;
    }>;
  };
};

function asObject(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function requireObject(value: unknown, label: string): JsonObject {
  const object = asObject(value);
  if (!object) throw new Error(`${label} must be an object.`);
  return object;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

export function buildStage08OutputContract(
  documents: PipelineDocuments,
): Stage08OutputContract {
  const rubric = requireObject(documents["05"], "Stage 05 document");
  const answersDocument = requireObject(documents["07"], "Stage 07 document");
  const scenarioId = answersDocument.scenarioId;
  if (!Number.isSafeInteger(scenarioId) || Number(scenarioId) < 1) {
    throw new Error("Stage 07 scenarioId must be a positive safe integer.");
  }

  if (!Array.isArray(rubric.rubricOptions)) {
    throw new Error("Stage 05 rubricOptions must be an array.");
  }
  const essentialCriterionIds = rubric.rubricOptions
    .map((value, index) => {
      const option = requireObject(value, `Stage 05 rubricOptions[${index}]`);
      return option.correct === true
        ? requireString(option.id, `Stage 05 rubricOptions[${index}].id`)
        : null;
    })
    .filter((id): id is string => id !== null);

  if (!Array.isArray(answersDocument.answers)) {
    throw new Error("Stage 07 answers must be an array.");
  }
  const answerStepCounts = answersDocument.answers.map((value, index) => {
    const answer = requireObject(value, `Stage 07 answers[${index}]`);
    const answerId = requireString(answer.id, `Stage 07 answers[${index}].id`);
    if (!Array.isArray(answer.steps) || answer.steps.length < 1) {
      throw new Error(`Stage 07 answer "${answerId}" must contain steps.`);
    }
    return {
      answerId,
      stepCount: answer.steps.length,
      allowedStepRange: { minimum: 1 as const, maximum: answer.steps.length },
    };
  });
  const expectedAnswerIds = answerStepCounts.map(({ answerId }) => answerId);

  return {
    expectedAnswerIds,
    essentialCriterionIds,
    answerStepCounts,
    exactAnswerGradingCount: expectedAnswerIds.length,
    allowedTopLevelKeys: ["schemaVersion", "scenarioId", "answerGradings"],
    allowedAnswerGradingKeys: ["answerId", "rubricFit"],
    allowedRubricFitEntryKeys: ["pass", "step", "feedback"],
    outputSkeleton: {
      schemaVersion: "1.0.0",
      scenarioId: Number(scenarioId),
      answerGradings: answerStepCounts.map(({ answerId, stepCount }) => ({
        answerId,
        rubricFit: Object.fromEntries(
          essentialCriterionIds.map((criterionId) => [
            criterionId,
            {
              pass: "<boolean>" as const,
              step: `<integer from 1 through ${stepCount}>`,
              feedback: "<string, at least 20 characters>" as const,
            },
          ]),
        ),
      })),
    },
  };
}
