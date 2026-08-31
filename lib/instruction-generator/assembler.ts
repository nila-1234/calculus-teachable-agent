import type {
  AssemblyResult,
  FinalAiAnswer,
  ModuleJson,
  PipelineDocuments,
  PlotData,
  QuestionPart,
  RubricFitItem,
  RubricOption,
  SampleAnswer,
} from "./types";

type ScenarioDocument = {
  scenario: string;
  plotDataSrc: string;
  scenarioImageSrc?: string;
};

type TaskDocument = {
  question: string;
  questionParts: QuestionPart[];
};

type RubricDocument = {
  rubricOptions: Array<RubricOption & { criterionType: string }>;
};

type SamplesDocument = {
  sampleAnswers: { correct: SampleAnswer; incorrect: SampleAnswer };
};

type AnswerDocument = {
  answers: Array<Omit<FinalAiAnswer, "rubricFit"> & { trajectory: unknown }>;
};

type GradingDocument = {
  answerGradings: Array<{
    answerId: FinalAiAnswer["id"];
    rubricFit: Record<string, RubricFitItem>;
  }>;
};

type PlotDocument = {
  enabled: boolean;
  plotData?: PlotData;
};

function requireDocument<T>(
  documents: PipelineDocuments,
  stage: keyof PipelineDocuments,
): T {
  const document = documents[stage];
  if (!document) throw new Error(`Missing Stage ${stage} document.`);
  return document as T;
}

export function assembleModule(documents: PipelineDocuments): AssemblyResult {
  const scenario = requireDocument<ScenarioDocument>(documents, "02");
  const plot = requireDocument<PlotDocument>(documents, "03");
  const task = requireDocument<TaskDocument>(documents, "04");
  const rubric = requireDocument<RubricDocument>(documents, "05");
  const samples = requireDocument<SamplesDocument>(documents, "06");
  const answers = requireDocument<AnswerDocument>(documents, "07");
  const grading = requireDocument<GradingDocument>(documents, "08");

  const gradingByAnswer = new Map(
    grading.answerGradings.map((item) => [item.answerId, item.rubricFit]),
  );

  const rubricOptions = rubric.rubricOptions.map(
    ({ id, label, correct, feedback }): RubricOption => ({
      id,
      label,
      correct,
      feedback,
    }),
  );

  const finalAiAnswers = answers.answers.map(
    ({ id, label, steps }): FinalAiAnswer => {
      const rubricFit = gradingByAnswer.get(id);
      if (!rubricFit) throw new Error(`Missing Stage 08 grading for ${id}.`);
      return { id, label, steps, rubricFit };
    },
  );

  const moduleJson: ModuleJson = {
    scenario: scenario.scenario,
    question: task.question,
    plotDataSrc: scenario.plotDataSrc,
    ...(scenario.scenarioImageSrc
      ? { scenarioImageSrc: scenario.scenarioImageSrc }
      : {}),
    questionParts: task.questionParts,
    rubricOptions,
    sampleAnswers: samples.sampleAnswers,
    finalAiAnswers,
  };

  return {
    module: moduleJson,
    ...(plot.enabled && plot.plotData ? { plotData: plot.plotData } : {}),
  };
}
