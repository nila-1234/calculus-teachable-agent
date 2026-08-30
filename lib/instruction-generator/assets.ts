import "server-only";

import { readFile } from "fs/promises";
import path from "path";

import type { LlmStageId, StageId } from "./types";

const ROOT = path.join(process.cwd(), "instruction-generator");

const PROMPT_FILES: Record<LlmStageId, string> = {
  "01": "01-concept-plan.system.md",
  "02": "02-scenario.system.md",
  "03": "03-plot-data.system.md",
  "04": "04-student-task.system.md",
  "05": "05-rubric.system.md",
  "06": "06-sample-answers.system.md",
  "07": "07-ai-student-answers.system.md",
  "08": "08-line-grading.system.md",
};

const SCHEMA_FILES: Record<StageId, string> = {
  "01": "01-generation-plan.schema.json",
  "02": "02-scenario.schema.json",
  "03": "03-plot-data.schema.json",
  "04": "04-student-task.schema.json",
  "05": "05-rubric.schema.json",
  "06": "06-sample-answers.schema.json",
  "07": "07-ai-student-answers.schema.json",
  "08": "08-line-grading.schema.json",
  "09": "09-module.schema.json",
};

export async function loadSystemPrompt(stage: LlmStageId): Promise<string> {
  const [shared, stagePrompt, schema] = await Promise.all([
    readFile(path.join(ROOT, "prompts", "00-shared-rules.system.md"), "utf8"),
    readFile(path.join(ROOT, "prompts", PROMPT_FILES[stage]), "utf8"),
    readFile(path.join(ROOT, "schemas", SCHEMA_FILES[stage]), "utf8"),
  ]);

  return `${shared.trim()}\n\n${stagePrompt.trim()}\n\n## Exact output schema\nReturn one JSON object that validates against this schema. Preserve every declared type exactly.\n\n${schema.trim()}`;
}

export async function loadStageSchemas(): Promise<Record<StageId, object>> {
  const entries = await Promise.all(
    (Object.entries(SCHEMA_FILES) as [StageId, string][]).map(
      async ([stage, filename]) => {
        const source = await readFile(path.join(ROOT, "schemas", filename), "utf8");
        return [stage, JSON.parse(source) as object] as const;
      },
    ),
  );

  return Object.fromEntries(entries) as Record<StageId, object>;
}
