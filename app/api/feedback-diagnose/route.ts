import { NextResponse } from "next/server";
import client from "@/lib/openai";
import { MODELS } from "@/lib/models";

// Discussion mode 3 (lib/feedback-flow.ts): the one decision the LLM makes. After the TA
// explains their reasoning in reply to a probe, judge whether that explanation is sufficient.
// The verdict picks the Sufficient or Insufficient template; it never changes whether the
// criterion moves on or is tried again — the decision tree already knows that.

type FeedbackDiagnoseRequestBody = {
  // "placement", "pass" or "fail": what the TA did.
  action?: "placement" | "pass" | "fail";
  // Whether that action was right (scenario a) or wrong on the 1st attempt (scenario b).
  correct?: boolean;
  question?: string;
  answerText?: string;
  criterionLabel?: string;
  placedStep?: number | null;
  placedStepText?: string;
  expectedStep?: number;
  expectedStepText?: string;
  expectedStatus?: "pass" | "fail" | null;
  // Ground-truth reasoning from the answer key.
  feedback?: string;
  // The probe the TA was answering, and their reply.
  probe?: string;
  taMessage?: string;
};

function describeAction(body: FeedbackDiagnoseRequestBody): string {
  const label = body.criterionLabel ?? "this criterion";
  const placed = `step ${body.placedStep ?? "?"} ("${body.placedStepText ?? ""}")`;
  if (body.action === "placement") {
    return body.correct
      ? `The TA placed the criterion "${label}" on ${placed}. That is correct.`
      : `The TA placed the criterion "${label}" on ${placed}. That is wrong: it belongs on step ${body.expectedStep ?? "?"} ("${body.expectedStepText ?? ""}").`;
  }
  const marked = (body.action ?? "?").toUpperCase();
  return body.correct
    ? `The TA marked ${placed} ${marked} for the criterion "${label}". That is correct.`
    : `The TA marked ${placed} ${marked} for the criterion "${label}". That is wrong: it should be ${(body.expectedStatus ?? "?").toUpperCase()}.`;
}

function buildPrompt(body: FeedbackDiagnoseRequestBody): string {
  const standard = body.correct
    ? `The TA's call was correct. Their explanation is SUFFICIENT if it gives a mathematically sound reason, specific to this step and criterion, for why the call is right. It is INSUFFICIENT if it is vague ("it just is", "I think so"), off-topic, contains a misconception, or gives a wrong reason for the right answer.`
    : `The TA's call was wrong. Their explanation is SUFFICIENT only if they recognize that their call was wrong AND give a mathematically sound reason why (what the step actually does, or what the criterion actually requires). It is INSUFFICIENT if they defend the wrong call, only say they're unsure, or admit the error without a sound reason.`;

  return `You judge a teaching assistant (TA) who is grading an AI student's calculus solution against a rubric, one criterion at a time.

Question:
${body.question || "(question not provided)"}

The student's solution:
${body.answerText || "(solution not provided)"}

${describeAction(body)}

Answer key reasoning for this criterion:
"${body.feedback || "(none)"}"

The TA was asked: "${body.probe ?? ""}"

${standard}

Do not reward length or confidence. Judge only the reasoning.
Answer with ONLY a JSON object: {"sufficient": true} or {"sufficient": false}.`;
}

export async function POST(req: Request) {
  const body: FeedbackDiagnoseRequestBody = await req.json();
  const reply = body.taMessage?.trim();

  // Nothing to judge: an empty reply can't be sufficient.
  if (!reply) return NextResponse.json({ sufficient: false });

  try {
    const completion = await client.chat.completions.create({
      model: MODELS.GEMINI_FAST,
      messages: [
        { role: "system", content: buildPrompt(body) },
        { role: "user", content: `TA's explanation: ${reply}` },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const match = raw.match(/"sufficient"\s*:\s*(true|false)/);
    return NextResponse.json({ sufficient: match?.[1] === "true" });
  } catch (error) {
    // Insufficient is the safe fallback: that message still gives the correct reasoning.
    console.error("feedback-diagnose error, falling back to insufficient:", error);
    return NextResponse.json({ sufficient: false });
  }
}
