import { NextResponse } from "next/server";
import client from "@/lib/openai";
import { MODELS } from "@/lib/models";
import type { CommentSpeaker } from "@/lib/grading-voice";
import type { PlacementExplainSlot } from "@/lib/placement-flow";

type PlacementExplainRequestBody = {
  slot?: PlacementExplainSlot;
  // Which decision tree is asking: step placement (lib/placement-flow.ts) or the pass/fail
  // call (lib/status-flow.ts). Defaults to placement.
  kind?: "placement" | "status";
  // Who says the line. Placement is always the professor; pass/fail can be the student.
  speaker?: CommentSpeaker;
  answerTitle?: string;
  answerText?: string;
  question?: string;
  criterionLabel?: string;
  placedStep?: number | null;
  stepText?: string;
  expectedStep?: number;
  expectedStepText?: string;
  // Pass/fail only: what the TA marked and what it should be.
  userStatus?: "pass" | "fail" | null;
  expectedStatus?: "pass" | "fail" | null;
  feedback?: string;
  // Whether the TA's current drop (or mark) is right.
  correct?: boolean;
  // The TA's most recent message, for the reply to acknowledge.
  taMessage?: string;
};

const upper = (status: "pass" | "fail" | null | undefined) => (status ?? "?").toUpperCase();

// Writes the text of one line. Which line gets said — and what happens to the item
// afterwards — is already decided by the decision tree; this only phrases it.
function buildPlacementInstructions(body: PlacementExplainRequestBody): string {
  const { slot, placedStep, expectedStep, correct } = body;

  switch (slot) {
    case "affirm":
      return `The TA placed it on step ${placedStep ?? "?"}, which is correct, and just said they're sure of it. Confirm they're right: open with a short affirming word ("Correct.", "Exactly.", "That's right."), then give a brief explanation of why the criterion applies to that step. Don't ask them to justify it further.`;
    case "hint":
      return `The TA placed it on step ${placedStep ?? "?"}, which is wrong, and just explained why they think it's right. Open with "Consider this:" and point them to what the criterion actually checks for, so they know what to look for in the work. Never state, hint at, or make obvious by elimination which step it belongs on — they have to find it themselves.`;
    case "reveal":
      return correct
        ? `The TA placed it on step ${placedStep ?? "?"}, which was actually correct, but they second-guessed it and are out of attempts. Tell them their original placement on step ${expectedStep ?? "?"} was right, briefly explain why, and ask them to drag it back there.`
        : `The TA is out of attempts. Tell them this criterion belongs on step ${expectedStep ?? "?"}, briefly explain why the criterion applies there, and ask them to drag it there.`;
    default:
      return "Reply briefly.";
  }
}

function buildStatusInstructions(body: PlacementExplainRequestBody): string {
  const { slot, userStatus, expectedStatus, correct, speaker } = body;
  const affirm =
    speaker === "student"
      ? `("Oh okay.", "Got it.", "That makes sense.")`
      : `("Correct.", "Exactly.", "That's right.")`;

  switch (slot) {
    case "affirm":
      return `The TA marked this criterion ${upper(userStatus)}, which is correct, and just said they're sure of it. Accept it: open with a short affirming word or phrase ${affirm}, then briefly say why the step ${userStatus === "fail" ? "misses" : "meets"} the criterion. Don't ask them to justify it further.`;
    case "hint":
      return `The TA marked this criterion ${upper(userStatus)}, which is wrong, and just explained why they think it's right. Open with "Consider this:" and point them to what the criterion actually checks for and what to look at in the step. Never state or imply whether it should pass or fail — they have to decide that themselves.`;
    case "reveal":
      return correct
        ? `The TA marked it ${upper(userStatus)}, which was actually correct, but they second-guessed it and are out of attempts. Tell them ${upper(expectedStatus)} was right, briefly explain why, and ask them to mark it that way again.`
        : `The TA is out of attempts. Tell them this criterion should be a ${upper(expectedStatus)}, briefly explain why, and ask them to re-mark it.`;
    default:
      return "Reply briefly.";
  }
}

function buildFallback(body: PlacementExplainRequestBody): string {
  const { slot, kind, criterionLabel, expectedStep, expectedStatus, correct } = body;
  const label = criterionLabel ?? "this criterion";

  if (kind === "status") {
    switch (slot) {
      case "affirm":
        return `Got it — that's the right call on "${label}".`;
      case "hint":
        return `Consider this: what exactly does "${label}" require, and does this step actually do it?`;
      case "reveal":
        return correct
          ? `Your original call was right — "${label}" is a ${upper(expectedStatus)}. Mark it that way again.`
          : `"${label}" should be a ${upper(expectedStatus)}. Re-mark it.`;
      default:
        return "Okay.";
    }
  }

  switch (slot) {
    case "affirm":
      return `Correct — "${label}" belongs right there.`;
    case "hint":
      return `Consider this: what is "${label}" actually checking for? Look for the step where that happens.`;
    case "reveal":
      return correct
        ? `Your original placement was right — "${label}" belongs on step ${expectedStep ?? "?"}. Drag it back there.`
        : `"${label}" belongs on step ${expectedStep ?? "?"}. Drag it there.`;
    default:
      return "Okay.";
  }
}

function buildPersona(body: PlacementExplainRequestBody): string {
  const studentName = body.answerTitle || "the AI student";
  if (body.kind === "status" && body.speaker === "student") {
    return `You are role-playing as an AI student named "${studentName}" in a calculus tutoring exercise. A teaching assistant (TA) is grading your submitted solution against a rubric, one criterion at a time, and you're talking with them about whether a criterion should pass or fail.`;
  }
  return `You are role-playing as a calculus professor supervising a teaching assistant (TA) who is grading an AI student's solution against a rubric.`;
}

function buildRules(body: PlacementExplainRequestBody): string {
  if (body.kind === "status") {
    const voice =
      body.speaker === "student"
        ? "conversational, in a real student's voice"
        : "collegial and matter-of-fact — a mentor, not a scold";
    return `- Keep it to 1-2 sentences, ${voice}.
- Talk only about whether the step meets the criterion (pass/fail), never about which step it's placed on.
- Never say you will change the mark yourself — the TA always re-marks it.
- Do not greet or sign off. Never break character or mention being an AI.`;
  }
  return `- Keep it to 1-2 sentences, collegial and matter-of-fact — a mentor, not a scold.
- Talk only about where the criterion is placed, never about whether it passes or fails.
- Never say you will move or fix anything yourself — the TA always moves it.
- Do not greet or sign off. You are the professor; never break character or mention being an AI.`;
}

// Shared by both decision trees — the path predates pass/fail discussion using it too.
export async function POST(req: Request) {
  const body: PlacementExplainRequestBody = await req.json();
  const { answerTitle, answerText, question, criterionLabel, stepText, feedback, taMessage } =
    body;

  const where =
    body.kind === "status"
      ? `The criterion is "${criterionLabel ?? "this criterion"}", on the step reading "${stepText ?? ""}".`
      : `The criterion is "${criterionLabel ?? "this criterion"}". The TA currently has it on the step reading "${stepText ?? ""}".`;

  const systemPrompt = `${buildPersona(body)}

The student "${answerTitle || "the AI student"}" answered this question:
${question || "(question not provided)"}

Their solution:
${answerText || "(solution not provided)"}

${where}

Ground truth reasoning for this criterion, for your understanding only — never quote it verbatim:
"${feedback || "(no additional context)"}"

${body.kind === "status" ? buildStatusInstructions(body) : buildPlacementInstructions(body)}

${buildRules(body)}`;

  try {
    const completion = await client.chat.completions.create({
      model: MODELS.GEMINI_FAST,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: taMessage?.trim() || "(no message)" },
      ],
      temperature: 0.7,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    return NextResponse.json({ text: text || buildFallback(body) });
  } catch (error) {
    console.error("placement-explain error, using hardcoded fallback:", error);
    return NextResponse.json({ text: buildFallback(body) });
  }
}
