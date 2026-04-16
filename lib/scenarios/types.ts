export type Choice = {
  id: string;
  text: string;
  correct?: boolean;
  feedback: string;
};

export type QuestionPart = {
  id: string;
  label: string;
  options: readonly Choice[];
};

export type RubricOption = {
  id: string;
  label: string;
  description: string;
};

export type SampleAnswer = {
  title: string;
  text: string;
};

export type FinalAiAnswer = {
  id: string;
  label: string;
  text: string;
};

export type QuestionSchema = {
  SCENARIO_PLACEHOLDER: string;
  QUESTION_PLACEHOLDER: string;
  PLOT_DATA_SRC: string;
  QUESTION_PARTS: readonly QuestionPart[];
  RUBRIC_OPTIONS: readonly RubricOption[];
  SAMPLE_ANSWERS: {
    correct: SampleAnswer;
    incorrect: SampleAnswer;
  };
  FINAL_AI_ANSWERS: readonly FinalAiAnswer[];
};

export type ScenarioModule = {
  id: number;
  schema: QuestionSchema;
};