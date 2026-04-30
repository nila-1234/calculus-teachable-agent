import schema1Json from "../../public/data/scenarios/1/module.json";
import schema2Json from "../../public/data/scenarios/2/module.json";
import schema3Json from "../../public/data/scenarios/3/module.json";
import type { QuestionSchema, ScenarioModule } from "./types";

function mapJsonToSchema(json: any): QuestionSchema {
  return {
    SCENARIO_PLACEHOLDER: json.scenario,
    QUESTION_PLACEHOLDER: json.question,
    PLOT_DATA_SRC: json.plotDataSrc,
    QUESTION_PARTS: json.questionParts,
    RUBRIC_OPTIONS: json.rubricOptions,
    SAMPLE_ANSWERS: json.sampleAnswers,
    FINAL_AI_ANSWERS: json.finalAiAnswers,
  };
}

const scenarioRegistry: Record<number, ScenarioModule> = {
  1: { id: 1, schema: mapJsonToSchema(schema1Json) },
  2: { id: 2, schema: mapJsonToSchema(schema2Json) },
  3: { id: 3, schema: mapJsonToSchema(schema3Json) },
};

export function getScenario(id: number): ScenarioModule | null {
  return scenarioRegistry[id] ?? null;
}