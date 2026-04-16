import * as schema1 from "./1/question-schema";
import * as schema2 from "./2/question-schema";
import type { ScenarioModule } from "./types";

const scenarioRegistry: Record<number, ScenarioModule> = {
  1: { id: 1, schema: schema1 },
  2: { id: 2, schema: schema2 },
};

export function getScenario(id: number): ScenarioModule | null {
  return scenarioRegistry[id] ?? null;
}