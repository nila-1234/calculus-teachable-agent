import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/**
 * Anthropic client for test grading and feedback.
 * Requires ANTHROPIC_API_KEY in .env.local.
 */
export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY. Add it to .env.local to enable grading."
    );
  }
  if (!client) {
    client = new Anthropic();
  }
  return client;
}
