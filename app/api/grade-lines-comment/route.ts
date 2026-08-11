import { NextResponse } from "next/server";
import client from "@/lib/openai";
import { MODELS } from "@/lib/models";

type GradeLinesCommentRequestBody = {
  answerTitle?: string;
  answerText?: string;
  question?: string;
  criterionLabel?: string;
  stepText?: string;
  expectedStepText?: string;
  feedback?: string;
  userStatus?: "pass" | "fail" | null;
  expectedStatus?: "pass" | "fail" | null;
  statusCorrect?: boolean;
  placedStep?: number | null;
  expectedStep?: number;
  stepCorrect?: boolean;
};

// Openers rotate deterministically per-criterion (not random) so a given
// criterion's fallback line doesn't flicker between resubmits.
const OPENERS = ["Oh, ", "Oops, ", "Wait, ", "Hmm, I just realized "];

function pickOpener(seed: string): string {
  const hash = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return OPENERS[hash % OPENERS.length];
}

// Placeholder self-assessment used when the LLM backend (LiteLLM proxy) is
// unavailable, so the drag-and-drop UI still has something to show in the
// AI-student comment bubble. Builds a plausible-sounding line from the same
// request fields the real prompt uses, no model call required.
function buildFallbackReply(body: GradeLinesCommentRequestBody): string {
  const {
    criterionLabel,
    placedStep,
    expectedStep,
    userStatus,
    expectedStatus,
    statusCorrect,
    stepCorrect,
    feedback,
  } = body;

  const opener = pickOpener(criterionLabel ?? "criterion");
  const label = criterionLabel ?? "this criterion";
  const reasoning = feedback ? ` ${feedback}` : "";

  if (stepCorrect === false && statusCorrect === false) {
    return `${opener}I don't think "${label}" is right the way you graded it — I was thinking that belonged on step ${expectedStep ?? "?"}, not step ${placedStep ?? "?"}, and it's probably ${expectedStatus ?? "the other call"} instead of ${userStatus ?? "what you marked"}.${reasoning}`;
  }

  if (stepCorrect === false) {
    return `${opener}I think "${label}" actually belongs on step ${expectedStep ?? "?"}, not step ${placedStep ?? "?"}.${reasoning}`;
  }

  if (statusCorrect === false) {
    return `${opener}I thought "${label}" was ${userStatus ?? "graded that way"}, but I think it's actually ${expectedStatus ?? "the other call"}.${reasoning}`;
  }

  return `${opener}something about "${label}" feels off to me — mind double-checking it?`;
}

export async function POST(req: Request) {
  const body: GradeLinesCommentRequestBody = await req.json();
  const {
    answerTitle,
    answerText,
    question,
    criterionLabel,
    stepText,
    expectedStepText,
    feedback,
    userStatus,
    expectedStatus,
    statusCorrect,
    placedStep,
    expectedStep,
    stepCorrect,
  } = body;

  const studentName = answerTitle || "the AI student";

  try {
    const mistakes: string[] = [];
    if (statusCorrect === false) {
      mistakes.push(
        `The TA marked this criterion as ${(userStatus ?? "ungraded").toUpperCase()}, but that's actually the wrong call — it should be ${(expectedStatus ?? "the other way").toUpperCase()}.`
      );
    }
    if (stepCorrect === false) {
      mistakes.push(
        `The TA attached this criterion to step ${placedStep ?? "?"} of your work ("${stepText ?? ""}"), but it really belongs on step ${expectedStep ?? "?"} ("${expectedStepText ?? ""}") instead.`
      );
    }

    const systemPrompt = `You are role-playing as an AI student named "${studentName}" in a calculus tutoring exercise.

You previously submitted the following solution in response to a question. A teaching assistant (TA) is grading your work step by step: they drag a rubric criterion onto the specific step of your solution it applies to, and mark that criterion Pass or Fail.

Question:
${question || "(question not provided)"}

Your submitted solution:
${answerText || "(solution not provided)"}

The TA just graded the criterion "${criterionLabel ?? "this criterion"}" by attaching it to step ${placedStep ?? "?"} of your work ("${stepText ?? ""}") and marking it ${(userStatus ?? "ungraded").toUpperCase()}.

Here is the real reason that grading is off, for your own understanding only — do not quote it verbatim, put it in your own words as if you just noticed it yourself:
"${feedback || "(no additional context)"}"

${mistakes.join(" ")}

Write this as a short self-assessment from the student, like you just re-read your own work and caught something — NOT a question aimed at the TA:
- Open in a tone like "Oh—", "Oops, ", "Wait, ", or "Hmm, I just realized" — you're catching your own mistake or a mis-grade, not interrogating the TA.
- Naturally mention the relevant step number in the sentence (e.g. "on step ${placedStep ?? expectedStep ?? "N"}"), not as TA jargon like "expected step."
- Volunteer the correct reasoning in your own words, grounded in the context above — don't invent new math facts that weren't given to you.
- Keep it to 1-2 sentences, conversational, a little embarrassed/humble — this is the student admitting or catching something, not defending themselves.
- Never break character or mention that you are an AI/LLM.`;

    const completion = await client.chat.completions.create({
      model: MODELS.GEMINI_FAST,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: "Give your self-assessment now, in character.",
        },
      ],
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content?.trim();

    return NextResponse.json({ reply: reply || buildFallbackReply(body) });
  } catch (error) {
    console.error("grade-lines-comment error, using hardcoded fallback:", error);
    return NextResponse.json({ reply: buildFallbackReply(body) });
  }
}
