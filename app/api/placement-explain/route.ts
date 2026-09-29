import { NextResponse } from "next/server";
import client from "@/lib/openai";
import { MODELS } from "@/lib/models";
import type { PlacementExplainSlot } from "@/lib/placement-flow";

type PlacementExplainRequestBody = {
  slot?: PlacementExplainSlot;
  answerTitle?: string;
  answerText?: string;
  question?: string;
  criterionLabel?: string;
  placedStep?: number | null;
  stepText?: string;
  expectedStep?: number;
  expectedStepText?: string;
  feedback?: string;
  // Whether the TA's current drop is on the right step.
  correct?: boolean;
  // The TA's most recent message, for the reply to acknowledge.
  taMessage?: string;
};

// Writes the text of one professor line. Which line gets said — and what happens to the
// item afterwards — is already decided by lib/placement-flow.ts; this only phrases it.
function buildInstructions(body: PlacementExplainRequestBody): string {
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

function buildFallback(body: PlacementExplainRequestBody): string {
  const { slot, criterionLabel, expectedStep, correct } = body;
  const label = criterionLabel ?? "this criterion";
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

export async function POST(req: Request) {
  const body: PlacementExplainRequestBody = await req.json();
  const { answerTitle, answerText, question, criterionLabel, stepText, feedback, taMessage } =
    body;

  const systemPrompt = `You are role-playing as a calculus professor supervising a teaching assistant (TA) who is placing rubric criteria onto the steps of an AI student's solution.

The student "${answerTitle || "the AI student"}" answered this question:
${question || "(question not provided)"}

Their solution:
${answerText || "(solution not provided)"}

The criterion is "${criterionLabel ?? "this criterion"}". The TA currently has it on the step reading "${stepText ?? ""}".

Ground truth reasoning for this criterion, for your understanding only — never quote it verbatim:
"${feedback || "(no additional context)"}"

${buildInstructions(body)}

- Keep it to 1-2 sentences, collegial and matter-of-fact — a mentor, not a scold.
- Talk only about where the criterion is placed, never about whether it passes or fails.
- Never say you will move or fix anything yourself — the TA always moves it.
- Do not greet or sign off. You are the professor; never break character or mention being an AI.`;

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
