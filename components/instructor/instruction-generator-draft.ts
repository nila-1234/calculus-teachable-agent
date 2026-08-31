import type {
  DraftState,
  GeneratorInputs,
  InstructionModule,
  PlotData,
  StageState,
  StageStatus,
} from "./instruction-generator-types";

export const STORAGE_KEY = "instructor:instruction-draft:v1";

export const STAGE_LABELS = [
  "Concept plan",
  "Scenario",
  "Plot data",
  "Student task",
  "Rubric",
  "Sample answers",
  "AI student answers",
  "Line grading",
  "Assemble & validate",
] as const;

const emptyInputs: GeneratorInputs = {
  concept: "",
  scenarioId: null,
  title: "",
  variant: "",
};

function positiveScenarioId(value: unknown): number | null {
  const candidate =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(candidate) && candidate > 0 ? candidate : null;
}

export function generateInternalScenarioId(
  random: () => number = Math.random,
): number {
  const sample = random();
  const boundedSample =
    Number.isFinite(sample) && sample >= 0 && sample < 1 ? sample : 0;
  return Math.floor(boundedSample * Number.MAX_SAFE_INTEGER) + 1;
}

export function buildStages(status: StageStatus = "pending"): StageState[] {
  return STAGE_LABELS.map((label, index) => ({
    stage: String(index + 1).padStart(2, "0"),
    label,
    status,
  }));
}

export function createEmptyDraft(): DraftState {
  return {
    inputs: { ...emptyInputs },
    documents: {},
    module: null,
    plotData: null,
    stages: buildStages(),
    failedStage: null,
    error: "",
    validationErrors: [],
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isModule(value: unknown): value is InstructionModule {
  return (
    isRecord(value) &&
    typeof value.scenario === "string" &&
    (typeof value.question === "string" ||
      Array.isArray(value.questionParts) ||
      Array.isArray(value.rubricOptions))
  );
}

function normalizeRubricFitItem(
  value: unknown,
  stepCount: number,
): { pass: boolean; step: number; feedback: string } {
  const item = isRecord(value) ? value : {};
  const legacyLine = Array.isArray(item.line) ? item.line[0] : item.line;
  const candidateStep =
    typeof item.step === "number" ? item.step : Number(legacyLine);
  const positiveStep =
    Number.isInteger(candidateStep) && candidateStep > 0 ? candidateStep : 1;

  return {
    pass: item.pass === true,
    step: stepCount > 0 ? Math.min(positiveStep, stepCount) : positiveStep,
    feedback: typeof item.feedback === "string" ? item.feedback : "",
  };
}

function normalizeAiAnswer(value: unknown, index: number) {
  const answer = isRecord(value) ? value : {};
  const steps = Array.isArray(answer.steps)
    ? answer.steps.filter((step): step is string => typeof step === "string")
    : typeof answer.text === "string"
      ? answer.text
          .split(/\n\s*\n/)
          .map((step) => step.trim())
          .filter(Boolean)
      : [];
  const rubricFit = isRecord(answer.rubricFit)
    ? Object.fromEntries(
        Object.entries(answer.rubricFit).map(([criterionId, fit]) => [
          criterionId,
          normalizeRubricFitItem(fit, steps.length),
        ]),
      )
    : {};

  return {
    id: typeof answer.id === "string" ? answer.id : `answer-${index + 1}`,
    label:
      typeof answer.label === "string"
        ? answer.label
        : `AI Student ${index + 1}`,
    steps,
    rubricFit,
  };
}

export function normalizeInstructionModule(
  module: InstructionModule,
): InstructionModule {
  return {
    ...module,
    finalAiAnswers: Array.isArray(module.finalAiAnswers)
      ? module.finalAiAnswers.map(normalizeAiAnswer)
      : [],
  };
}

export function isPlotData(value: unknown): value is PlotData {
  return (
    isRecord(value) &&
    (Array.isArray(value.data) ||
      typeof value.xAxisLabel === "string" ||
      typeof value.yAxisLabel === "string")
  );
}

function normalizeStages(value: unknown): StageState[] {
  if (!Array.isArray(value)) return buildStages();
  return buildStages().map((fallback, index) => {
    const candidate = value[index];
    if (!isRecord(candidate)) return fallback;
    const status = candidate.status;
    const validStatus: StageStatus =
      status === "success" || status === "error" ? status : "pending";
    return { ...fallback, status: validStatus };
  });
}

export function restoreDraft(value: unknown): DraftState {
  if (!isRecord(value)) return createEmptyDraft();
  const inputs = isRecord(value.inputs) ? value.inputs : {};
  const documents = isRecord(value.documents) ? value.documents : {};
  const stageOne = isRecord(documents["01"]) ? documents["01"] : {};
  return {
    inputs: {
      concept: typeof inputs.concept === "string" ? inputs.concept : "",
      scenarioId:
        positiveScenarioId(inputs.scenarioId) ??
        positiveScenarioId(stageOne.scenarioId),
      title: typeof inputs.title === "string" ? inputs.title : "",
      variant: typeof inputs.variant === "string" ? inputs.variant : "",
    },
    documents,
    module: isModule(value.module)
      ? normalizeInstructionModule(value.module)
      : null,
    plotData: isPlotData(value.plotData) ? value.plotData : null,
    stages: normalizeStages(value.stages),
    failedStage:
      typeof value.failedStage === "string" ? value.failedStage : null,
    error: typeof value.error === "string" ? value.error : "",
    validationErrors: Array.isArray(value.validationErrors)
      ? value.validationErrors
          .filter((item): item is string => typeof item === "string")
          .slice(0, 6)
      : [],
  };
}

export function buildPipelineBundle(draft: DraftState) {
  return {
    input: draft.inputs,
    documents: draft.documents,
    module: draft.module,
    plotData: draft.plotData,
  };
}
