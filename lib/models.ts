export const DEFAULT_MODEL =
  process.env.LITELLM_DEFAULT_MODEL || "wine-gemini-2.5-flash-lite";

export const MODELS = {
  GEMINI_FAST: "wine-gemini-2.5-flash-lite",
  GEMINI_FLASH_PREVIEW: "wine-gemini-3-flash-preview",
  GEMINI_PRO_PREVIEW: "wine-gemini-3.1-pro-preview", // choose
  // The test grader's default (lib/tests/grading-model.ts). Sonnet 4.5 was
  // retired by the provider as Legacy, and the proxy now refuses it.
  CLAUDE_SONNET: "wine-claude-sonnet-5-5",
  CLAUDE_HAIKU: "wine-claude-haiku-4-5",
  CLAUDE_OPUS: "wine-claude-opus-4-5",
} as const;