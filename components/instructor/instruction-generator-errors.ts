const MAX_VALIDATION_ERRORS = 6;
const MAX_PATH_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 240;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: string, maximumLength: number): string {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length <= maximumLength
    ? cleaned
    : `${cleaned.slice(0, Math.max(0, maximumLength - 1)).trimEnd()}…`;
}

export function formatApiValidationErrors(payload: unknown): string[] {
  if (!isObject(payload) || !Array.isArray(payload.validationErrors)) return [];

  return payload.validationErrors
    .slice(0, MAX_VALIDATION_ERRORS)
    .map((value) => {
      if (!isObject(value) || typeof value.message !== "string") return null;
      const message = cleanText(value.message, MAX_MESSAGE_LENGTH);
      if (!message) return null;
      const path =
        typeof value.instancePath === "string"
          ? cleanText(value.instancePath, MAX_PATH_LENGTH)
          : "";
      return `${path || "/"}: ${message}`;
    })
    .filter((value): value is string => value !== null);
}
