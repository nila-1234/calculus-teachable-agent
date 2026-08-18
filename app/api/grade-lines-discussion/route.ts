import { NextResponse } from "next/server";
import client from "@/lib/openai";
import { MODELS } from "@/lib/models";

type DiscussionTurn = {
  role: "user" | "student";
  text: string;
};

type GradeLinesDiscussionRequestBody = {
  answerTitle?: string;
  answerText?: string;
  question?: string;
  criterionLabel?: string;
  stepText?: string;
  feedback?: string;
  userStatus?: "pass" | "fail" | null;
  expectedStatus?: "pass" | "fail" | null;
  placedStep?: number | null;
  openingComment?: string;
  messages?: DiscussionTurn[];
  userMessage?: string;
};

// Placeholder replies for when the LLM backend (LiteLLM proxy) is unavailable, so the
// discussion panel still has something to show. Rotates deterministically by turn count
// rather than randomly, so a resubmit-free session doesn't flicker between replies.
const FALLBACK_REPLIES = [
  "Hmm, okay — that makes sense, thanks for walking me through it.",
  "Oh, I see what you mean now. I think I get it.",
  "Wait, so you're saying I should look at it differently — got it, that's fair.",
  "That actually clears it up. I follow your reasoning now.",
  "Okay, I think I understand where I went wrong (or didn't). Thanks for explaining.",
];

function buildFallbackReply(turnCount: number): string {
  return FALLBACK_REPLIES[turnCount % FALLBACK_REPLIES.length];
}

export async function POST(req: Request) {
  const body: GradeLinesDiscussionRequestBody = await req.json();
  const {
    answerTitle,
    answerText,
    question,
    criterionLabel,
    stepText,
    feedback,
    userStatus,
    expectedStatus,
    placedStep,
    openingComment,
    messages = [],
    userMessage,
  } = body;

  const studentName = answerTitle || "the AI student";

  try {
    const systemPrompt = `You are role-playing as an AI student named "${studentName}" in a calculus tutoring exercise.

You previously submitted the following solution in response to a question. A teaching assistant (TA) is grading your work step by step, and just now marked the criterion "${criterionLabel ?? "this criterion"}" (on step ${placedStep ?? "?"} of your work, "${stepText ?? ""}") as ${(userStatus ?? "ungraded").toUpperCase()}. You believe it should actually be ${(expectedStatus ?? "the other way").toUpperCase()}, and already said so:
"${openingComment ?? "(no opening message)"}"

Question:
${question || "(question not provided)"}

Your submitted solution:
${answerText || "(solution not provided)"}

Ground truth reasoning for this criterion, for your own understanding only — never quote it verbatim, only use it to judge whether the TA's explanation is correct:
"${feedback || "(no additional context)"}"

The TA is now discussing this with you directly. Stay in character as the student:
- If the TA's explanation is convincing and lines up with the ground truth reasoning above, acknowledge it genuinely and let the disagreement go — don't keep arguing just to argue.
- If the TA's explanation is vague, wrong, or doesn't address your point, push back politely and ask a specific follow-up.
- Keep responses short (1-2 sentences), conversational, and in a real student's voice.
- Never break character or mention that you are an AI/LLM.`;

    const history: { role: "assistant" | "user"; content: string }[] = messages.map(
      (message) => ({
        role: message.role === "student" ? "assistant" : "user",
        content: message.text,
      })
    );

    // Anthropic-style strict alternation isn't required by this LiteLLM-backed client, but
    // keep the shape sane regardless: the opening rebuttal is the student's (assistant) turn.
    if (history.length === 0 || history[0]?.role !== "assistant") {
      history.unshift({ role: "assistant", content: openingComment ?? "" });
    }

    const completion = await client.chat.completions.create({
      model: MODELS.GEMINI_FAST,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userMessage ?? "" },
      ],
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content?.trim();

    return NextResponse.json({ reply: reply || buildFallbackReply(messages.length) });
  } catch (error) {
    console.error("grade-lines-discussion error, using hardcoded fallback:", error);
    return NextResponse.json({ reply: buildFallbackReply(messages.length) });
  }
}
