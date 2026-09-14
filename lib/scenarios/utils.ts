/**
 * The single scenario used as the study's instruction phase.
 *
 * Scenario 5 is "Storage Area Optimization" — the optimization module the
 * pre/post tests are built around. Change this one constant to swap which
 * scenario participants receive.
 */
export const STUDY_SCENARIO_ID = 5;

export function parseScenarioId(
  value: string | string[] | undefined
): number | null {
  if (typeof value !== "string") return null;

  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) return null;

  return id;
}