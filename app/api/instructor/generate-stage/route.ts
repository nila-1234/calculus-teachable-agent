import { NextResponse } from "next/server";

import { assembleModule } from "@/lib/instruction-generator/assembler";
import {
  missingDependencies,
  STAGE_DEPENDENCIES,
} from "@/lib/instruction-generator/dependencies";
import {
  GeneratorError,
  generateLlmStage,
} from "@/lib/instruction-generator/generator";
import type {
  GenerateStageError,
  GenerateStageRequest,
  PipelineDocuments,
  Stage01Input,
  StageId,
  ValidationIssue,
} from "@/lib/instruction-generator/types";
import { validateStageDocument } from "@/lib/instruction-generator/validation";

export const runtime = "nodejs";

const STAGES = new Set<StageId>([
  "01", "02", "03", "04", "05", "06", "07", "08", "09",
]);

function errorResponse(
  stage: StageId | null,
  code: string,
  message: string,
  status: number,
  validationErrors?: ValidationIssue[],
) {
  const body: GenerateStageError = {
    ok: false,
    stage,
    code,
    message,
    ...(validationErrors?.length ? { validationErrors } : {}),
  };
  return NextResponse.json(body, { status });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseInput(value: unknown): Stage01Input | undefined {
  if (!isObject(value)) return undefined;
  if (
    typeof value.concept !== "string" ||
    !value.concept.trim() ||
    !Number.isInteger(value.scenarioId) ||
    Number(value.scenarioId) < 1
  ) {
    return undefined;
  }
  if (
    value.optionalScenarioName !== undefined &&
    typeof value.optionalScenarioName !== "string"
  ) {
    return undefined;
  }
  if (
    value.optionalProfileVariant !== undefined &&
    typeof value.optionalProfileVariant !== "string"
  ) {
    return undefined;
  }
  return value as Stage01Input;
}

function parseRequest(body: unknown):
  | { request: GenerateStageRequest }
  | { stage: StageId | null; message: string } {
  if (!isObject(body)) return { stage: null, message: "Request body must be a JSON object." };
  const stage = typeof body.stage === "string" && STAGES.has(body.stage as StageId)
    ? (body.stage as StageId)
    : null;
  if (!stage) return { stage: null, message: "stage must be one of 01 through 09." };
  if (!isObject(body.documents)) {
    return { stage, message: "documents must be an object keyed by stage ID." };
  }
  const input = body.input === undefined ? undefined : parseInput(body.input);
  if (stage === "01" && !input) {
    return {
      stage,
      message: "Stage 01 input requires concept and a positive integer scenarioId.",
    };
  }
  if (stage !== "01" && body.input !== undefined && !input) {
    return { stage, message: "input has an invalid Stage 01 input shape." };
  }

  return {
    request: {
      stage,
      input,
      documents: body.documents as PipelineDocuments,
    },
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(null, "INVALID_JSON", "Request body is not valid JSON.", 400);
  }

  const parsed = parseRequest(body);
  if ("message" in parsed) {
    return errorResponse(parsed.stage, "INVALID_REQUEST", parsed.message, 400);
  }

  const { stage, input, documents } = parsed.request;
  const missing = missingDependencies(stage, documents);
  if (missing.length) {
    return errorResponse(
      stage,
      "MISSING_DOCUMENTS",
      `Missing required stage documents: ${missing.join(", ")}.`,
      400,
    );
  }

  for (const dependency of STAGE_DEPENDENCIES[stage]) {
    const document = documents[dependency];
    if (!document) continue;
    const errors = await validateStageDocument(dependency, document, documents);
    if (errors.length) {
      return errorResponse(
        stage,
        "INVALID_SOURCE_DOCUMENT",
        `Stage ${dependency} source document failed validation.`,
        422,
        errors,
      );
    }
  }

  try {
    if (stage === "09") {
      const assembled = assembleModule(documents);
      const errors = await validateStageDocument("09", assembled.module, documents);
      if (errors.length) {
        return errorResponse(
          stage,
          "ASSEMBLED_MODULE_INVALID",
          "The deterministically assembled module failed validation.",
          422,
          errors,
        );
      }
      return NextResponse.json({
        ok: true,
        stage,
        document: assembled.module,
        ...(assembled.plotData ? { plotData: assembled.plotData } : {}),
      });
    }

    const document = await generateLlmStage(stage, input, documents);
    const errors = await validateStageDocument(stage, document, documents);
    if (errors.length) {
      return errorResponse(
        stage,
        "GENERATED_DOCUMENT_INVALID",
        `Generated Stage ${stage} document failed validation.`,
        422,
        errors,
      );
    }
    return NextResponse.json({ ok: true, stage, document });
  } catch (error) {
    if (error instanceof GeneratorError) {
      const status = error.code === "AI_PROVIDER_NOT_CONFIGURED" ? 503 : 502;
      return errorResponse(stage, error.code, error.message, status);
    }
    return errorResponse(
      stage,
      "GENERATION_FAILED",
      error instanceof Error ? error.message : "Stage generation failed.",
      500,
    );
  }
}
