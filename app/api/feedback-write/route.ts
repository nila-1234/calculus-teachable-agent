import { NextResponse } from "next/server";
import client from "@/lib/openai";
import { MODELS } from "@/lib/models";
import type { CommentSpeaker } from "@/lib/grading-voice";
import type { FeedbackScenario, FeedbackType } from "@/lib/feedback-templates";

// Discussion mode 3 (lib/feedback-flow.ts): fills the bracketed gaps of a Figma template that
// code couldn't fill (lib/feedback-templates.ts already put in step numbers and, for scenario
// 5, the criterion). The LLM keeps every word outside the brackets. Which template is said,
// and what happens next, is already decided.

type FeedbackWriteRequestBody = {
  scenario?: FeedbackScenario;
  feedbackType?: FeedbackType;
  speaker?: CommentSpeaker;
  // Template with code-fillable slots already filled, and the slots left for the LLM.
  template?: string;
  placeholders?: string[];
  // Figma example response for this criterion, as a style reference (scenario 5 only).
  example?: string | null;
  studentName?: string;
  question?: string;
  answerText?: string;
  criterionLabel?: string;
  placedStep?: number | null;
  placedStepText?: string;
  expectedStep?: number;
  expectedStepText?: string;
  userStatus?: "pass" | "fail" | null;
  expectedStatus?: "pass" | "fail" | null;
  feedback?: string;
  // The TA's explanation, for Sufficient / Insufficient feedback to respond to.
  taMessage?: string;
};

const upper = (status: string | null | undefined) => (status ?? "?").toUpperCase();

// Used when the LLM is unavailable: a plain line built from the answer key, so the TA
// still gets the substance of the feedback.
function buildFallback(body: FeedbackWriteRequestBody): string {
  const label = `"${body.criterionLabel ?? "this criterion"}"`;
  const group = body.scenario?.[0];
  const reason = body.feedback ?? "";
  const step = body.placedStep ?? "?";

  switch (body.feedbackType) {
    case "probe":
      if (group === "1") return `What about step ${step} makes you think this is where ${label} is shown?`;
      if (group === "2") return `What in the student's step ${step} shows it meets ${label}?`;
      return `Where did I go wrong on ${label}?`;
    case "sufficient":
      if (body.scenario?.endsWith("a")) return `Exactly. ${reason}`;
      if (group === "1") return `Exactly. ${reason} Go ahead and move it.`;
      return `Right. ${reason} Go ahead and change the mark to '${body.expectedStatus ?? "?"}'.`;
    case "insufficient":
      if (body.scenario?.endsWith("a")) return `Your call is correct. ${reason}`;
      if (group === "1") return `Take another look at what ${label} requires. Try again.`;
      return `${reason} Try again.`;
    case "insufficient_2nd":
      if (group === "1") return `The correct placement is step ${body.expectedStep ?? "?"}. ${reason}`;
      return `This step should be marked '${body.expectedStatus ?? "?"}'. ${reason}`;
    default:
      return reason || "Okay.";
  }
}

function describeContext(body: FeedbackWriteRequestBody): string {
  const label = body.criterionLabel ?? "this criterion";
  const placed = `step ${body.placedStep ?? "?"} ("${body.placedStepText ?? ""}")`;
  if (body.scenario?.startsWith("1")) {
    return `The TA placed the criterion "${label}" on ${placed}. The correct step is step ${body.expectedStep ?? "?"} ("${body.expectedStepText ?? ""}").`;
  }
  return `The criterion "${label}" is on ${placed}. The TA marked it ${upper(body.userStatus)}; the correct mark is ${upper(body.expectedStatus)}.`;
}

function buildPrompt(body: FeedbackWriteRequestBody): string {
  const studentName = body.studentName || "the AI student";
  const persona =
    body.speaker === "student"
      ? `You are role-playing as ${studentName}, an AI student in a calculus tutoring exercise. A teaching assistant (TA) is grading your solution against a rubric, one criterion at a time.`
      : `You are role-playing as a calculus professor supervising a teaching assistant (TA) who is grading ${studentName}'s solution against a rubric, one criterion at a time.`;

  // A probe is the same whether the TA was right or wrong, so it must not hint either way:
  // the model only sees the criterion, never the answer key.
  if (body.feedbackType === "probe") {
    return `${persona}

Fill in this message template:
${body.template}

Rules:
- Keep every word outside the square brackets exactly as written.
- Replace [criterion] with a short verb phrase for the rubric criterion "${body.criterionLabel ?? ""}" (e.g. "computes the derivative"). Replace [criterion action] with the same phrase in the past tense (e.g. "computed the derivative").
- Output only the finished message, with no square brackets left.`;
  }

  const noReveal =
    body.scenario === "1b" && body.feedbackType === "insufficient"
      ? "\n- Never state or hint which step the criterion belongs on; the TA has to find it."
      : "";

  return `${persona}

Question:
${body.question || "(question not provided)"}

The student's solution:
${body.answerText || "(solution not provided)"}

${describeContext(body)}

Answer key reasoning for this criterion, for your understanding only (don't quote it verbatim):
"${body.feedback || "(none)"}"

Fill in this message template:
${body.template}
${body.example ? `\nExample of a finished message for this criterion, for style only (its step numbers and details may not match this solution):\n${body.example}\n` : ""}
Rules:
- Keep every word outside the square brackets exactly as written.
- Replace each bracketed part with content grounded in the solution and the answer key above. Don't invent math facts.
- Some bracketed parts are instructions (e.g. "[If the TA expressed a specific misconception, address it.]"). Follow them using the TA's message; if they don't apply, drop them entirely.
- [criterion] is the rubric criterion "${body.criterionLabel ?? ""}"; phrase it to fit the sentence.${noReveal}
- Output only the finished message, with no square brackets left. Never break character or mention being an AI.`;
}

export async function POST(req: Request) {
  const body: FeedbackWriteRequestBody = await req.json();

  try {
    const completion = await client.chat.completions.create({
      model: MODELS.GEMINI_FAST,
      messages: [
        { role: "system", content: buildPrompt(body) },
        {
          role: "user",
          content: body.taMessage?.trim()
            ? `The TA's explanation: ${body.taMessage.trim()}`
            : "Write the message now.",
        },
      ],
      temperature: 0.4,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    // A reply that still has a bracket in it didn't follow the template; don't show it.
    const usable = text && !/\[[^\]]+\]/.test(text);
    return NextResponse.json({ text: usable ? text : buildFallback(body) });
  } catch (error) {
    console.error("feedback-write error, using fallback:", error);
    return NextResponse.json({ text: buildFallback(body) });
  }
}
