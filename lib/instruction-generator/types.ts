export type StageId = "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09";
export type LlmStageId = Exclude<StageId, "09">;

export type Stage01Input = {
  concept: string;
  scenarioId: number;
  optionalScenarioName?: string;
  optionalProfileVariant?: string;
};

export type StageDocument = Record<string, unknown>;

export type PipelineDocuments = Partial<Record<StageId, StageDocument>>;

export type GenerateStageRequest = {
  stage: StageId;
  input?: Stage01Input;
  documents: PipelineDocuments;
};

export type ValidationIssue = {
  instancePath: string;
  schemaPath?: string;
  keyword?: string;
  message: string;
  params?: Record<string, unknown>;
};

export type GenerateStageSuccess<T extends StageDocument = StageDocument> = {
  ok: true;
  stage: StageId;
  document: T;
  plotData?: PlotData;
};

export type GenerateStageError = {
  ok: false;
  stage: StageId | null;
  code: string;
  message: string;
  validationErrors?: ValidationIssue[];
};

export type GenerateStageResponse = GenerateStageSuccess | GenerateStageError;

export type PlotPoint = { x: number; y: number };

export type PlotData = {
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  data: PlotPoint[];
};

export type QuestionChoice = {
  id: string;
  text: string;
  correct: boolean;
  feedback: string;
};

export type QuestionPart = {
  id: string;
  label: string;
  options: QuestionChoice[];
};

export type RubricOption = {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
};

export type SampleAnswer = { title: string; text: string };

export type RubricFitItem = {
  pass: boolean;
  step: number;
  feedback: string;
};

export type FinalAiAnswer = {
  id: string;
  label: string;
  steps: string[];
  rubricFit: Record<string, RubricFitItem>;
};

export type ModuleJson = {
  scenario: string;
  question: string;
  plotDataSrc: string;
  scenarioImageSrc?: string;
  questionParts: QuestionPart[];
  rubricOptions: RubricOption[];
  sampleAnswers: {
    correct: SampleAnswer;
    incorrect: SampleAnswer;
  };
  finalAiAnswers: FinalAiAnswer[];
};

export type AssemblyResult = {
  module: ModuleJson;
  plotData?: PlotData;
};
