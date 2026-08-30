import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import Ajv2020 from "ajv/dist/2020";
import { readFile } from "fs/promises";
import OpenAI from "openai";
import path from "path";
import { NextResponse } from "next/server";
import client from "@/lib/openai";

export const runtime = "nodejs";

type Mark = "pass" | "fail";
type DisputeSpeaker = "ai-student" | "professor";
type DisputeStatus = "continue" | "resolved";

type DisputeHistoryMessage = {
  speaker: "user" | DisputeSpeaker;
  message: string;
};

type GradeLinesCommentRequestBody = {
  scenario: { id: string | number; text: string };
  question: string;
  answer: { id: string; label: string; steps: string[] };
  criterion: { id: string; label: string };
  placement: { userStep: number; expectedStep: number };
  marks: { userMark: Mark; expectedMark: Mark };
  gradingRationale: string;
  history: DisputeHistoryMessage[];
  turn: {
    kind: "start" | "continue";
    number: number;
    currentSpeaker: DisputeSpeaker;
    userMessage?: string;
  };
};

export type GradeLinesCommentResponse = {
  speaker: DisputeSpeaker;
  message: string;
  status: DisputeStatus;
  recommendedMark: Mark;
  reasoningFocus: "criterion-satisfaction" | "criterion-gap" | "respond-to-user";
  evidenceStep: { number: number; quote: string };
};

const ASSET_ROOT = path.join(process.cwd(), "instruction-generator");
const PROMPT_PATH = path.join(
  ASSET_ROOT,
  "prompts",
  "grading-dispute-dialogue.system.md",
);
const SCHEMA_PATH = path.join(
  ASSET_ROOT,
  "schemas",
  "grading-dispute-dialogue.schema.json",
);

let assetsPromise:
  | Promise<{
      prompt: string;
      validate: ReturnType<Ajv2020["compile"]>;
    }>
  | undefined;

function loadRuntimeAssets() {
  assetsPromise ??= Promise.all([
    readFile(PROMPT_PATH, "utf8"),
    readFile(SCHEMA_PATH, "utf8"),
  ]).then(([prompt, schemaSource]) => {
    const schema = JSON.parse(schemaSource) as object;
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    return {
      prompt: `${prompt.trim()}\n\n## Runtime response schema\n${schemaSource.trim()}`,
      validate: ajv.compile(schema),
    };
  });
  return assetsPromise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function isShortString(value: unknown, maxLength = 20_000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function parseRequest(value: unknown): GradeLinesCommentRequestBody | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "scenario",
      "question",
      "answer",
      "criterion",
      "placement",
      "marks",
      "gradingRationale",
      "history",
      "turn",
    ])
  ) {
    return null;
  }

  const { scenario, answer, criterion, placement, marks, history, turn } = value;
  if (
    !isRecord(scenario) ||
    !hasExactKeys(scenario, ["id", "text"]) ||
    !(
      (typeof scenario.id === "string" && scenario.id.trim().length > 0) ||
      (typeof scenario.id === "number" &&
        Number.isInteger(scenario.id) &&
        scenario.id > 0)
    ) ||
    !isShortString(scenario.text) ||
    !isShortString(value.question) ||
    !isRecord(answer) ||
    !hasExactKeys(answer, ["id", "label", "steps"]) ||
    !isShortString(answer.id, 200) ||
    !isShortString(answer.label, 500) ||
    !Array.isArray(answer.steps) ||
    answer.steps.length === 0 ||
    answer.steps.length > 20 ||
    !answer.steps.every((step) => isShortString(step, 10_000)) ||
    !isRecord(criterion) ||
    !hasExactKeys(criterion, ["id", "label"]) ||
    !isShortString(criterion.id, 200) ||
    !isShortString(criterion.label, 2_000) ||
    !isRecord(placement) ||
    !hasExactKeys(placement, ["userStep", "expectedStep"]) ||
    !Number.isInteger(placement.userStep) ||
    !Number.isInteger(placement.expectedStep) ||
    (placement.userStep as number) < 1 ||
    (placement.expectedStep as number) < 1 ||
    (placement.userStep as number) > answer.steps.length ||
    (placement.expectedStep as number) > answer.steps.length ||
    !isRecord(marks) ||
    !hasExactKeys(marks, ["userMark", "expectedMark"]) ||
    !["pass", "fail"].includes(marks.userMark as string) ||
    !["pass", "fail"].includes(marks.expectedMark as string) ||
    !isShortString(value.gradingRationale, 10_000) ||
    !Array.isArray(history) ||
    history.length > 30 ||
    !isRecord(turn) ||
    !Number.isInteger(turn.number) ||
    (turn.number as number) < 1 ||
    !["start", "continue"].includes(turn.kind as string) ||
    !["ai-student", "professor"].includes(turn.currentSpeaker as string)
  ) {
    return null;
  }

  const expectedSpeaker: DisputeSpeaker =
    marks.expectedMark === "pass" ? "ai-student" : "professor";
  const startTurn = turn.kind === "start";
  const latestHistory = history.at(-1);
  const assistantTurns = history.filter(
    (item) => isRecord(item) && item.speaker === expectedSpeaker,
  ).length;
  if (
    marks.userMark === marks.expectedMark ||
    turn.currentSpeaker !== expectedSpeaker ||
    (startTurn
      ? !hasExactKeys(turn, ["kind", "number", "currentSpeaker"]) ||
        turn.number !== 1 ||
        history.length !== 0
      : !hasExactKeys(turn, [
          "kind",
          "number",
          "currentSpeaker",
          "userMessage",
        ]) ||
        !isShortString(turn.userMessage, 4_000) ||
        turn.number !== assistantTurns + 1 ||
        !isRecord(latestHistory) ||
        latestHistory.speaker !== "user" ||
        latestHistory.message !== turn.userMessage) ||
    !history.every(
      (item) =>
        isRecord(item) &&
        hasExactKeys(item, ["speaker", "message"]) &&
        ["user", expectedSpeaker].includes(item.speaker as string) &&
        isShortString(item.message, 4_000),
    )
  ) {
    return null;
  }

  return value as GradeLinesCommentRequestBody;
}

function parseModelResponse(
  raw: string,
  body: GradeLinesCommentRequestBody,
  validate: ReturnType<Ajv2020["compile"]>,
): GradeLinesCommentResponse {
  const parsed: unknown = JSON.parse(raw.trim());
  if (!validate(parsed) || !isRecord(parsed)) {
    throw new Error("Model response failed the dispute response schema.");
  }

  const response = parsed as GradeLinesCommentResponse;
  const expectedSpeaker = body.marks.expectedMark === "pass" ? "ai-student" : "professor";
  const evidenceText = body.answer.steps[response.evidenceStep.number - 1];
  if (
    response.speaker !== expectedSpeaker ||
    response.speaker !== body.turn.currentSpeaker ||
    response.recommendedMark !== body.marks.expectedMark ||
    !evidenceText ||
    !evidenceText.includes(response.evidenceStep.quote)
  ) {
    throw new Error("Model response violated the server-derived dispute state.");
  }
  return response;
}

function learnerAccepted(body: GradeLinesCommentRequestBody): boolean {
  const latest = body.turn.userMessage?.toLowerCase() ?? "";
  return /\b(i agree|you're right|you are right|understand now|makes sense|changed|change it|mark it|end discussion|stop)\b/.test(
    latest,
  );
}

function buildFallback(body: GradeLinesCommentRequestBody): GradeLinesCommentResponse {
  const speaker: DisputeSpeaker =
    body.marks.expectedMark === "pass" ? "ai-student" : "professor";
  const stepNumber = body.placement.expectedStep;
  const step = body.answer.steps[stepNumber - 1];
  const quote = step.slice(0, 240);
  const resolved = body.turn.kind === "continue" && learnerAccepted(body);
  const stepPlacementNote =
    body.placement.userStep === stepNumber
      ? ""
      : ` The strongest evidence is on step ${stepNumber}, rather than step ${body.placement.userStep}.`;

  let message: string;
  if (resolved) {
    message =
      speaker === "ai-student"
        ? "Thanks for taking another look at my step and updating the mark."
        : "Good—your revised mark now matches the evidence in that step.";
  } else if (speaker === "ai-student") {
    message = `Could you explain why this was marked AI Fail? Step ${stepNumber} says “${quote},” which is the evidence that satisfies “${body.criterion.label}.”${stepPlacementNote}`;
  } else {
    message = `This should be AI Fail: step ${stepNumber} says “${quote},” but it does not fully satisfy “${body.criterion.label}.” ${body.gradingRationale}${stepPlacementNote}`;
  }

  return {
    speaker,
    message,
    status: resolved ? "resolved" : "continue",
    recommendedMark: body.marks.expectedMark,
    reasoningFocus:
      body.turn.kind === "continue"
        ? "respond-to-user"
        : speaker === "ai-student"
          ? "criterion-satisfaction"
          : "criterion-gap",
    evidenceStep: { number: stepNumber, quote },
  };
}

async function requestModel(systemPrompt: string, payload: string): Promise<string> {
  if (process.env.OPENAI_API_KEY) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: payload },
      ],
      response_format: { type: "json_object" },
    });
    return completion.choices[0]?.message.content ?? "";
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 1_200,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: payload }],
    });
    return response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
  }

  if (
    !process.env.LITELLM_PROXY_KEY ||
    !process.env.LITELLM_PROXY_URL ||
    !process.env.LITELLM_DEFAULT_MODEL
  ) {
    throw new Error("No AI provider is configured.");
  }
  const completion = await client.chat.completions.create({
    model: process.env.LITELLM_DEFAULT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: payload },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });
  return completion.choices[0]?.message.content ?? "";
}

export async function POST(req: Request) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const body = parseRequest(rawBody);
  if (!body) {
    return NextResponse.json({ error: "INVALID_DISPUTE_CONTEXT" }, { status: 400 });
  }

  const fallback = buildFallback(body);
  try {
    const { prompt, validate } = await loadRuntimeAssets();
    const raw = await requestModel(prompt, JSON.stringify(body));
    return NextResponse.json(parseModelResponse(raw, body, validate));
  } catch (error) {
    console.error(
      "grade-lines-comment model unavailable or invalid; using validated fallback:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(fallback);
  }
}
