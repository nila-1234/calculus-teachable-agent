import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import client from "@/lib/openai";

import { loadSystemPrompt } from "./assets";
import { STAGE_DEPENDENCIES } from "./dependencies";
import { buildStage08OutputContract } from "./stage08-contract";
import type {
  LlmStageId,
  PipelineDocuments,
  Stage01Input,
  StageDocument,
} from "./types";

export class GeneratorError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GeneratorError";
  }
}

function stagePayload(
  stage: LlmStageId,
  input: Stage01Input | undefined,
  documents: PipelineDocuments,
): Record<string, unknown> {
  if (stage === "01") {
    if (!input) {
      throw new GeneratorError("INVALID_REQUEST", "Stage 01 requires input.");
    }
    return {
      CONCEPT: input.concept,
      SCENARIO_ID: input.scenarioId,
      ...(input.optionalScenarioName
        ? { OPTIONAL_SCENARIO_NAME: input.optionalScenarioName }
        : {}),
      ...(input.optionalProfileVariant
        ? { OPTIONAL_PROFILE_VARIANT: input.optionalProfileVariant }
        : {}),
    };
  }

  return {
    stage,
    ...(stage === "08"
      ? { stage08OutputContract: buildStage08OutputContract(documents) }
      : {}),
    documents: Object.fromEntries(
      STAGE_DEPENDENCIES[stage].map((dependency) => [
        `${dependency}.json`,
        documents[dependency],
      ]),
    ),
  };
}

export function parseModelJson(raw: string): StageDocument {
  const trimmed = raw.trim();
  let json = trimmed;

  if (trimmed.startsWith("```")) {
    const match = trimmed.match(/^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i);
    if (!match) {
      throw new GeneratorError(
        "INVALID_MODEL_JSON",
        "Model response contained malformed code fences or text outside them.",
      );
    }
    json = match[1].trim();
  } else if (trimmed.includes("```")) {
    throw new GeneratorError(
      "INVALID_MODEL_JSON",
      "Model response contained unexpected code fences.",
    );
  }

  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected one JSON object.");
    }
    return parsed as StageDocument;
  } catch (error) {
    if (error instanceof GeneratorError) throw error;
    throw new GeneratorError(
      "INVALID_MODEL_JSON",
      error instanceof Error ? error.message : "Could not parse model JSON.",
    );
  }
}

export async function generateLlmStage(
  stage: LlmStageId,
  input: Stage01Input | undefined,
  documents: PipelineDocuments,
): Promise<StageDocument> {
  const systemPrompt = await loadSystemPrompt(stage);
  const userPayload = JSON.stringify(stagePayload(stage, input, documents));
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (openaiApiKey) {
    try {
      const openai = new OpenAI({ apiKey: openaiApiKey });
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPayload },
        ],
        response_format: { type: "json_object" },
        reasoning_effort: "low",
      });
      const content = completion.choices[0]?.message.content;
      if (!content) {
        throw new GeneratorError(
          "EMPTY_MODEL_RESPONSE",
          "OpenAI returned no JSON content.",
        );
      }
      return parseModelJson(content);
    } catch (error) {
      if (error instanceof GeneratorError) throw error;
      throw new GeneratorError(
        "OPENAI_REQUEST_FAILED",
        error instanceof Error ? error.message : "OpenAI request failed.",
      );
    }
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (anthropicApiKey) {
    try {
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const message = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
        max_tokens: 12_000,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: "user", content: userPayload }],
      });
      const content = message.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("")
        .trim();
      if (!content) {
        throw new GeneratorError(
          "EMPTY_MODEL_RESPONSE",
          "Anthropic returned no JSON content.",
        );
      }
      return parseModelJson(content);
    } catch (error) {
      if (error instanceof GeneratorError) throw error;
      throw new GeneratorError(
        "ANTHROPIC_REQUEST_FAILED",
        error instanceof Error ? error.message : "Anthropic request failed.",
      );
    }
  }

  const apiKey = process.env.LITELLM_PROXY_KEY;
  const baseURL = process.env.LITELLM_PROXY_URL;
  const model = process.env.LITELLM_DEFAULT_MODEL;
  if (!apiKey || !baseURL || !model) {
    throw new GeneratorError(
      "AI_PROVIDER_NOT_CONFIGURED",
      "Set OPENAI_API_KEY or ANTHROPIC_API_KEY, or configure all three LiteLLM variables.",
    );
  }

  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: userPayload,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });
  } catch (error) {
    throw new GeneratorError(
      "LITELLM_REQUEST_FAILED",
      error instanceof Error ? error.message : "LiteLLM request failed.",
    );
  }

  const content = completion.choices[0]?.message.content;
  if (!content) {
    throw new GeneratorError("EMPTY_MODEL_RESPONSE", "LiteLLM returned no JSON content.");
  }
  return parseModelJson(content);
}
