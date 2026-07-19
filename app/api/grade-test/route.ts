import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { getTest } from "@/lib/tests/definitions";
import { TestAnswers, TestItem } from "@/lib/tests/types";

const GRADING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          itemId: { type: "string" },
          points: { type: "integer" },
          maxPoints: { type: "integer" },
          criteria: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                verdict: { type: "string", enum: ["met", "not_met", "unverifiable"] },
                comment: { type: "string" },
              },
              required: ["name", "verdict", "comment"],
            },
          },
          feedback: { type: "string" },
        },
        required: ["itemId", "points", "maxPoints", "criteria", "feedback"],
      },
    },
  },
  required: ["results"],
} as const;

const SYSTEM_PROMPT = `You are an experienced calculus instructor grading a student's optimization assessment.

For each item you are given the question, the reference solution with its grading rubric, and the student's answer. Grade each item strictly against its rubric:

- Judge each rubric criterion independently and give a verdict: "met", "not_met", or "unverifiable".
- Apply consequential grading where the rubric says so: a later step correctly executed on the student's own earlier (possibly wrong) value still earns its point.
- "unverifiable" is only for criteria that cannot be checked from the submitted answer alone (for example, the content of an external AI conversation behind a link). Unverifiable criteria earn 0 points.
- points = number of criteria judged "met" (respecting any deduction rules stated in the rubric), clamped between 0 and maxPoints.
- feedback: 2-4 sentences addressed directly to the student — what they did well, what was missing, and the key idea to review. Do not reveal the full reference solution verbatim; explain the concept instead.
- Write feedback in plain text. For math, use simple notation like R'(p) = 200 - 20p rather than LaTeX.

Return one result per item, in the same order as given.`;

type GradingRequest = {
  testId: string;
  answers: TestAnswers;
};

function formatAnswer(item: TestItem, answers: TestAnswers): string {
  const answer = answers[item.id] || {};

  if (item.kind === "multiple-choice") {
    const choice = item.choices?.find((c) => c.id === answer.choiceId);
    const parts = [
      `Selected choice: ${answer.choiceId ?? "(none)"}${choice ? ` — ${choice.text}` : ""}`,
    ];
    if (answer.otherText) parts.push(`Other: ${answer.otherText}`);
    if (answer.explanation) parts.push(`Explanation: ${answer.explanation}`);
    return parts.join("\n");
  }

  return answer.text?.trim() || "(no answer)";
}

export async function POST(req: NextRequest) {
  let body: GradingRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const test = getTest(body.testId);
  if (!test || !body.answers) {
    return NextResponse.json({ error: "Unknown test or missing answers" }, { status: 400 });
  }

  const gradeableItems = test.sections.flatMap((section) =>
    section.items
      .filter((item) => item.maxPoints)
      .map((item) => ({ section, item }))
  );

  const itemsPayload = gradeableItems.map(({ section, item }) => ({
    itemId: item.id,
    maxPoints: item.maxPoints,
    scenario: section.scenario ?? null,
    question: item.prompt,
    context: item.context ?? null,
    referenceSolutionAndRubric: item.reference,
    studentAnswer: formatAnswer(item, body.answers),
  }));

  try {
    const client = getAnthropicClient();

    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: GRADING_SCHEMA } },
      messages: [
        {
          role: "user",
          content: `Grade the following assessment items:\n\n${JSON.stringify(itemsPayload, null, 2)}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "The grading model declined this request. Please try again." },
        { status: 502 }
      );
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No grading output was returned. Please try again." },
        { status: 502 }
      );
    }

    const { results } = JSON.parse(textBlock.text);
    return NextResponse.json({ results });
  } catch (err) {
    console.error("Grading error:", err);
    const message =
      err instanceof Error && err.message.includes("ANTHROPIC_API_KEY")
        ? err.message
        : "Grading failed. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
