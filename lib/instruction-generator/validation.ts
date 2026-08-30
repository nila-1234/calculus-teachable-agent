import "server-only";

import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";

import { loadStageSchemas } from "./assets";
import type {
  PipelineDocuments,
  StageDocument,
  StageId,
  ValidationIssue,
} from "./types";

type JsonObject = Record<string, unknown>;

let validatorsPromise: Promise<Record<StageId, ValidateFunction>> | undefined;

function asObject(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function asObjects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.map(asObject).filter((item): item is JsonObject => Boolean(item))
    : [];
}

function issue(instancePath: string, message: string): ValidationIssue {
  return { instancePath, keyword: "semantic", message };
}

function fromAjv(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  return (errors ?? []).map((error) => ({
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
    keyword: error.keyword,
    message: error.message ?? "Schema validation failed.",
    params: error.params as Record<string, unknown>,
  }));
}

async function getValidators(): Promise<Record<StageId, ValidateFunction>> {
  if (!validatorsPromise) {
    validatorsPromise = (async () => {
      const schemas = await loadStageSchemas();
      const ajv = new Ajv2020({ allErrors: true, strict: false });

      for (const schema of Object.values(schemas)) {
        ajv.addSchema(schema);
      }

      return Object.fromEntries(
        (Object.entries(schemas) as [StageId, { $id?: string }][]).map(
          ([stage, schema]) => {
            const validator = schema.$id ? ajv.getSchema(schema.$id) : undefined;
            if (!validator) {
              throw new Error(`Unable to register schema for stage ${stage}.`);
            }
            return [stage, validator];
          },
        ),
      ) as Record<StageId, ValidateFunction>;
    })();
  }

  return validatorsPromise;
}

function scenarioIdIssues(documents: PipelineDocuments): ValidationIssue[] {
  const ids = Object.entries(documents)
    .map(([stage, document]) => ({
      stage,
      id: asObject(document)?.scenarioId,
    }))
    .filter((entry): entry is { stage: string; id: number } =>
      Number.isInteger(entry.id),
    );

  if (ids.length < 2) return [];
  const expected = ids[0].id;
  return ids
    .filter(({ id }) => id !== expected)
    .map(({ stage, id }) =>
      issue(`/${stage}/scenarioId`, `Expected scenarioId ${expected}, received ${id}.`),
    );
}

function representationIssues(documents: PipelineDocuments): ValidationIssue[] {
  const plan = asObject(documents["01"]);
  const scenario = asObject(documents["02"]);
  const plot = asObject(documents["03"]);
  if (!plan) return [];

  const fitted = plan.representationType === "FITTED";
  const issues: ValidationIssue[] = [];
  if (plan.visualPolicy !== (fitted ? "SCATTER_REQUIRED" : "NO_PLOT")) {
    issues.push(issue("/01/visualPolicy", "visualPolicy does not match representationType."));
  }
  if (scenario) {
    if (scenario.representationType !== plan.representationType) {
      issues.push(issue("/02/representationType", "Representation must match Stage 01."));
    }
    const expectedPath = fitted
      ? `/data/scenarios/${String(plan.scenarioId)}/plot-data.json`
      : "";
    if (scenario.plotDataSrc !== expectedPath) {
      issues.push(issue("/02/plotDataSrc", `Expected plotDataSrc "${expectedPath}".`));
    }
  }
  if (plot && plot.enabled !== fitted) {
    issues.push(issue("/03/enabled", "Plot enablement must match representationType."));
  }

  if (plot?.enabled === true) {
    const modelSpec = asObject(plot.modelSpec);
    const domain = asObject(modelSpec?.domain);
    const plotData = asObject(plot.plotData);
    const points = asObjects(plotData?.data);
    const min = domain?.min;
    const max = domain?.max;
    if (typeof min === "number" && typeof max === "number") {
      if (min >= max) issues.push(issue("/03/modelSpec/domain", "Domain min must be less than max."));
      points.forEach((point, index) => {
        if (
          typeof point.x !== "number" ||
          point.x < min ||
          point.x > max
        ) {
          issues.push(issue(`/03/plotData/data/${index}/x`, "Point lies outside the model domain."));
        }
        if (index > 0 && Number(points[index - 1].x) > Number(point.x)) {
          issues.push(issue(`/03/plotData/data/${index}/x`, "Plot points must be sorted by x."));
        }
      });
    }
  }
  return issues;
}

function referenceIssues(documents: PipelineDocuments): ValidationIssue[] {
  const task = asObject(documents["04"]);
  const rubric = asObject(documents["05"]);
  const answers = asObject(documents["07"]);
  const grading = asObject(documents["08"]);
  const assembledModule = asObject(documents["09"]);
  const issues: ValidationIssue[] = [];

  asObjects(task?.questionParts).forEach((part, index) => {
    const correctCount = asObjects(part.options).filter((option) => option.correct === true).length;
    if (correctCount !== 1) {
      issues.push(issue(`/04/questionParts/${index}/options`, "Each question part must have exactly one correct option."));
    }
  });

  const rubricOptions = asObjects(rubric?.rubricOptions);
  const allRubricIds = rubricOptions.map((option) => option.id).filter((id): id is string => typeof id === "string");
  const essentialIds = rubricOptions
    .filter((option) => option.correct === true)
    .map((option) => option.id)
    .filter((id): id is string => typeof id === "string");
  if (new Set(allRubricIds).size !== allRubricIds.length) {
    issues.push(issue("/05/rubricOptions", "Rubric IDs must be unique."));
  }

  const answerObjects = asObjects(answers?.answers);
  const answerIds = answerObjects.map((answer) => answer.id).filter((id): id is string => typeof id === "string");
  if (new Set(answerIds).size !== answerIds.length) {
    issues.push(issue("/07/answers", "Answer IDs must be unique."));
  }
  const misconceptionIds = new Set(
    asObjects(asObject(documents["01"])?.misconceptions)
      .map((item) => item.id)
      .filter((id): id is string => typeof id === "string"),
  );
  answerObjects.forEach((answer, index) => {
    const trajectory = asObject(answer.trajectory);
    if (
      typeof trajectory?.firstAffectedCriterionId === "string" &&
      !essentialIds.includes(trajectory.firstAffectedCriterionId)
    ) {
      issues.push(issue(`/07/answers/${index}/trajectory/firstAffectedCriterionId`, "Referenced criterion is not an essential Stage 05 ID."));
    }
    if (
      typeof trajectory?.misconceptionId === "string" &&
      !misconceptionIds.has(trajectory.misconceptionId)
    ) {
      issues.push(issue(`/07/answers/${index}/trajectory/misconceptionId`, "Referenced misconception is not defined in Stage 01."));
    }
  });

  const gradings = asObjects(grading?.answerGradings);
  const gradingIds = gradings.map((item) => item.answerId).filter((id): id is string => typeof id === "string");
  if (
    grading &&
    (gradingIds.length !== answerIds.length ||
      gradingIds.some((id, index) => id !== answerIds[index]) ||
      new Set(gradingIds).size !== gradingIds.length)
  ) {
    issues.push(issue("/08/answerGradings", "Stage 08 answer IDs and order must exactly match Stage 07."));
  }
  gradings.forEach((item, gradingIndex) => {
    const fit = asObject(item.rubricFit) ?? {};
    const keys = Object.keys(fit);
    if (
      keys.length !== essentialIds.length ||
      keys.some((key) => !essentialIds.includes(key))
    ) {
      issues.push(issue(`/08/answerGradings/${gradingIndex}/rubricFit`, "rubricFit keys must exactly match Stage 05 essential IDs."));
    }
    const answer = answerObjects.find((candidate) => candidate.id === item.answerId);
    const stepCount = Array.isArray(answer?.steps) ? answer.steps.length : 0;
    Object.entries(fit).forEach(([criterionId, value]) => {
      const step = asObject(value)?.step;
      if (
        !Number.isInteger(step) ||
        Number(step) < 1 ||
        Number(step) > stepCount
      ) {
        issues.push(issue(`/08/answerGradings/${gradingIndex}/rubricFit/${criterionId}/step`, `Step reference must be between 1 and ${stepCount}.`));
      }
    });
  });

  const finalAnswers = asObjects(assembledModule?.finalAiAnswers);
  if (assembledModule) {
    const finalAnswerIds = finalAnswers
      .map((answer) => answer.id)
      .filter((id): id is string => typeof id === "string");
    if (
      finalAnswerIds.length !== answerIds.length ||
      finalAnswerIds.some((id, index) => id !== answerIds[index]) ||
      new Set(finalAnswerIds).size !== finalAnswerIds.length
    ) {
      issues.push(issue("/09/finalAiAnswers", "Final answer IDs and order must exactly match Stage 07."));
    }
    finalAnswers.forEach((answer, answerIndex) => {
      const steps = Array.isArray(answer.steps) ? answer.steps : [];
      const fit = asObject(answer.rubricFit) ?? {};
      const keys = Object.keys(fit);
      if (
        keys.length !== essentialIds.length ||
        keys.some((key) => !essentialIds.includes(key))
      ) {
        issues.push(issue(`/09/finalAiAnswers/${answerIndex}/rubricFit`, "rubricFit keys must exactly match Stage 05 essential IDs."));
      }
      Object.entries(fit).forEach(([criterionId, value]) => {
        const step = asObject(value)?.step;
        if (
          !Number.isInteger(step) ||
          Number(step) < 1 ||
          Number(step) > steps.length
        ) {
          issues.push(issue(`/09/finalAiAnswers/${answerIndex}/rubricFit/${criterionId}/step`, `Step reference must be between 1 and ${steps.length}.`));
        }
      });
    });
  }

  return issues;
}

export async function validateStageDocument(
  stage: StageId,
  document: StageDocument,
  suppliedDocuments: PipelineDocuments,
): Promise<ValidationIssue[]> {
  const validators = await getValidators();
  const valid = validators[stage](document);
  const documents = { ...suppliedDocuments, [stage]: document };
  return [
    ...(valid ? [] : fromAjv(validators[stage].errors)),
    ...scenarioIdIssues(documents),
    ...representationIssues(documents),
    ...referenceIssues(documents),
  ];
}
