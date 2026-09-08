import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/models";

/**
 * Picks a model for instructor-side grading.
 *
 * Grading runs as a local script, so it cannot use the deployment's Vercel
 * environment variables — it only sees .env.local. The LiteLLM proxy is
 * preferred because it matches what production uses; the direct provider keys
 * are fallbacks so grading still works on a machine that has no proxy access.
 */

export type GraderClient = {
  label: string;
  complete(system: string, user: string): Promise<string>;
};

/** Reasoning-tier models reject an explicit temperature; retry without it. */
function isTemperatureRejection(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /temperature/i.test(message);
}

function openAiClient(
  client: OpenAI,
  model: string,
  label: string
): GraderClient {
  return {
    label,
    async complete(system, user) {
      const messages = [
        { role: "system" as const, content: system },
        { role: "user" as const, content: user },
      ];

      try {
        const res = await client.chat.completions.create({
          model,
          temperature: 0,
          messages,
        });
        return res.choices[0]?.message?.content ?? "";
      } catch (err) {
        if (!isTemperatureRejection(err)) throw err;
        const res = await client.chat.completions.create({ model, messages });
        return res.choices[0]?.message?.content ?? "";
      }
    },
  };
}

export function resolveGraderClient(): GraderClient {
  const proxyUrl = process.env.LITELLM_PROXY_URL?.trim();
  const proxyKey = process.env.LITELLM_PROXY_KEY?.trim();

  if (proxyUrl && proxyKey) {
    const model = process.env.LITELLM_GRADING_MODEL?.trim() || MODELS.CLAUDE_SONNET;
    return openAiClient(
      new OpenAI({ apiKey: proxyKey, baseURL: proxyUrl }),
      model,
      `LiteLLM proxy (${model})`
    );
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini";
    return openAiClient(
      new OpenAI({ apiKey: openAiKey }),
      model,
      `OpenAI direct (${model})`
    );
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5";
    const client = new Anthropic({ apiKey: anthropicKey });
    return {
      label: `Anthropic direct (${model})`,
      async complete(system, user) {
        const res = await client.messages.create({
          model,
          max_tokens: 4096,
          temperature: 0,
          system,
          messages: [{ role: "user", content: user }],
        });
        return res.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("");
      },
    };
  }

  throw new Error(
    "No grading model configured in .env.local. Set LITELLM_PROXY_URL and " +
      "LITELLM_PROXY_KEY to match production (`vercel env pull .env.local`), " +
      "or provide OPENAI_API_KEY or ANTHROPIC_API_KEY."
  );
}
