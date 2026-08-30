import type { PipelineDocuments, StageId } from "./types";

export const STAGE_DEPENDENCIES: Record<StageId, StageId[]> = {
  "01": [],
  "02": ["01"],
  "03": ["01", "02"],
  "04": ["01", "02", "03"],
  "05": ["01", "02", "03", "04"],
  "06": ["01", "02", "03", "04", "05"],
  "07": ["01", "02", "03", "04", "05", "06"],
  "08": ["01", "02", "04", "05", "06", "07"],
  "09": ["01", "02", "03", "04", "05", "06", "07", "08"],
};

export function missingDependencies(
  stage: StageId,
  documents: PipelineDocuments,
): StageId[] {
  return STAGE_DEPENDENCIES[stage].filter((dependency) => !documents[dependency]);
}
