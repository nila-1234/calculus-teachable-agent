export function parseScenarioId(
  value: string | string[] | undefined
): number | null {
  if (typeof value !== "string") return null;

  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) return null;

  return id;
}