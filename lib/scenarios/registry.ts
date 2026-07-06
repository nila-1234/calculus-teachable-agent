import schema1Json from "../../public/data/scenarios/1/module.json";
import schema2Json from "../../public/data/scenarios/2/module.json";
import schema3Json from "../../public/data/scenarios/3/module.json";
import schema4Json from "../../public/data/scenarios/4/module.json";
import schema5Json from "../../public/data/scenarios/5/module.json";
import schema6Json from "../../public/data/scenarios/6/module.json";
import schema7Json from "../../public/data/scenarios/7/module.json";

import type { QuestionSchema, ScenarioModule } from "./types";

function mapJsonToSchema(json: any): QuestionSchema {
  return {
    SCENARIO_PLACEHOLDER: json.scenario,
    QUESTION_PLACEHOLDER: json.question,
    PLOT_DATA_SRC: json.plotDataSrc,
    SCENARIO_IMAGE_SRC: json.scenarioImageSrc,
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
  4: { id: 4, schema: mapJsonToSchema(schema4Json) },
  5: { id: 5, schema: mapJsonToSchema(schema5Json) },
  6: { id: 6, schema: mapJsonToSchema(schema6Json) },
  7: { id: 7, schema: mapJsonToSchema(schema7Json) },
};

export function getScenario(id: number): ScenarioModule | null {
  return scenarioRegistry[id] ?? null;
}