export type GeneratorInputs = {
  concept: string;
  scenarioId: number | null;
  title: string;
  variant: string;
};

export type StageStatus = "pending" | "running" | "success" | "error";

export type StageState = {
  stage: string;
  label: string;
  status: StageStatus;
};

export type Choice = {
  id?: string;
  text?: string;
  correct?: boolean;
  feedback?: string;
  [key: string]: unknown;
};

export type QuestionPart = {
  id?: string;
  label?: string;
  options?: Choice[];
  [key: string]: unknown;
};

export type RubricOption = {
  id?: string;
  label?: string;
  correct?: boolean;
  feedback?: string;
  [key: string]: unknown;
};

export type SampleAnswer = {
  title?: string;
  text?: string;
  [key: string]: unknown;
};

export type RubricFitItem = {
  pass: boolean;
  step: number;
  feedback: string;
};

export type AiAnswer = {
  id: string;
  label: string;
  steps: string[];
  rubricFit: Record<string, RubricFitItem>;
};

export type InstructionModule = {
  scenario?: string;
  question?: string;
  plotDataSrc?: string;
  scenarioImageSrc?: string;
  questionParts?: QuestionPart[];
  rubricOptions?: RubricOption[];
  sampleAnswers?: {
    correct?: SampleAnswer;
    incorrect?: SampleAnswer;
    [key: string]: unknown;
  };
  finalAiAnswers?: AiAnswer[];
  [key: string]: unknown;
};

export type PlotData = {
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  data?: Array<Record<string, unknown>>;
  representation?: string;
  [key: string]: unknown;
};

export type DraftState = {
  inputs: GeneratorInputs;
  documents: Record<string, unknown>;
  module: InstructionModule | null;
  plotData: PlotData | null;
  stages: StageState[];
  failedStage: string | null;
  error: string;
  validationErrors: string[];
};
