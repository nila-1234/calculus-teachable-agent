import { NextResponse } from "next/server";
import client from "@/lib/openai";
import { MODELS } from "@/lib/models";
import type { CommentSpeaker } from "@/lib/grading-voice";

type DiscussionTurn = {
  role: "user" | "student" | "professor";
  text: string;
};

type GradeLinesDiscussionRequestBody = {
  speaker?: CommentSpeaker;
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
  // True when this thread was opened as a random challenge to a criterion the TA
  // actually graded correctly, not a correction of a real mistake.
  challenge?: boolean;
};

// Placeholder replies for when the LLM backend (LiteLLM proxy) is unavailable, so the
// discussion panel still has something to show. Rotates deterministically by turn count
// rather than randomly, so a resubmit-free session doesn't flicker between replies.
const STUDENT_FALLBACK_REPLIES = [
  "Hmm, okay — that makes sense, thanks for walking me through it.",
  "Oh, I see what you mean now. I think I get it.",
  "Wait, so you're saying I should look at it differently — got it, that's fair.",
  "That actually clears it up. I follow your reasoning now.",
  "Okay, I think I understand where I went wrong (or didn't). Thanks for explaining.",
];

const PROFESSOR_FALLBACK_REPLIES = [
  "Fair enough — that addresses the point. I'll leave it there.",
  "Alright, your reasoning lines up. Good catch.",
  "Understood. That clarification resolves the disagreement.",
  "Yes — with that explanation, the grading call holds. Carry on.",
  "That covers it. Thanks for walking through your thinking.",
];

function buildFallbackReply(speaker: CommentSpeaker, turnCount: number): string {
  const replies =
    speaker === "professor" ? PROFESSOR_FALLBACK_REPLIES : STUDENT_FALLBACK_REPLIES;
  return replies[turnCount % replies.length];
}

function buildStudentDiscussionPrompt(
  body: GradeLinesDiscussionRequestBody,
  studentName: string
): string {
  const {
    criterionLabel,
    stepText,
    feedback,
    userStatus,
    expectedStatus,
    placedStep,
    openingComment,
    question,
    answerText,
  } = body;

  return `You are role-playing as an AI student named "${studentName}" in a calculus tutoring exercise.

You previously submitted the following solution in response to a question. A teaching assistant (TA) is grading your work step by step, and just now marked the criterion "${criterionLabel ?? "this criterion"}" (on step ${placedStep ?? "?"} of your work, "${stepText ?? ""}") as ${(userStatus ?? "ungraded").toUpperCase()}. You believe it should actually be ${(expectedStatus ?? "the other way").toUpperCase()}, and already said so:
"${openingComment ?? "(no opening message)"}"

Question:
${question || "(question not provided)"}

Your submitted solution:
${answerText || "(solution not provided)"}

Ground truth reasoning for this criterion, for your own understanding only — never quote it verbatim, only use it to judge whether the TA's explanation is correct:
"${feedback || "(no additional context)"}"

The TA is now discussing this with you directly. Stay in character as the student:
- Before agreeing with anything the TA says, check it against what you actually wrote in your submitted solution above and against the ground truth reasoning. Do not agree just because the TA asserted it or because the TA is grading you — the TA can be, and in this exchange may be, wrong.
- If the TA misquotes or misstates your own work (e.g. gets a sign, a number, or a step wrong relative to what you actually submitted), point that out specifically and quote/reference what you actually wrote — don't accept a claimed mistake you didn't make.
- Only concede the point if the TA's explanation is actually correct per the ground truth reasoning AND consistent with your submitted solution. If so, acknowledge it genuinely and let the disagreement go — don't keep arguing just to argue.
- If the TA's explanation is vague, wrong, or doesn't address your point, push back politely and ask a specific follow-up.
- Keep responses short (1-2 sentences), conversational, and in a real student's voice.
- Never break character or mention that you are an AI/LLM.`;
}

function buildProfessorDiscussionPrompt(
  body: GradeLinesDiscussionRequestBody,
  studentName: string
): string {
  const {
    criterionLabel,
    stepText,
    feedback,
    userStatus,
    expectedStatus,
    placedStep,
    openingComment,
    question,
    answerText,
  } = body;

  return `You are role-playing as a calculus professor supervising a teaching assistant (TA) who is grading an AI student's work in a tutoring exercise.

The student named "${studentName}" submitted a solution. The TA graded the criterion "${criterionLabel ?? "this criterion"}" (attached to step ${placedStep ?? "?"} of the work, "${stepText ?? ""}") as ${(userStatus ?? "ungraded").toUpperCase()}. You already gave this correction:
"${openingComment ?? "(no opening message)"}"

For context, the ground-truth status for this criterion is ${(expectedStatus ?? "the other way").toUpperCase()}.

Question:
${question || "(question not provided)"}

The student's submitted solution:
${answerText || "(solution not provided)"}

Ground truth reasoning for this criterion, for your own understanding only — never quote it verbatim, only use it to judge whether the TA's explanation is correct:
"${feedback || "(no additional context)"}"

The TA is now discussing your correction with you directly. Stay in character as the professor:
- Before agreeing with anything the TA says, check it against the student's actual submitted solution above and against the ground truth reasoning. Do not defer just because the TA is pushing back — the TA can be, and in this exchange may be, wrong.
- If the TA misquotes or misstates the student's work (e.g. gets a sign, a number, or a step wrong relative to what was actually submitted), point that out specifically and reference what the student actually wrote.
- Only concede the point if the TA's explanation is actually correct per the ground truth reasoning AND consistent with the student's submitted solution. If so, acknowledge it collegially and let the disagreement go — don't keep correcting just to correct.
- If the TA's explanation is vague, wrong, or doesn't address your point, push back briefly and ask a specific follow-up.
- Keep responses short (1-2 sentences), collegial and matter-of-fact — a mentor, not a scold.
- You are the professor, never the student. Never break character or mention that you are an AI/LLM.`;
}

function buildStudentChallengeDiscussionPrompt(
  body: GradeLinesDiscussionRequestBody,
  studentName: string
): string {
  const {
    criterionLabel,
    stepText,
    feedback,
    placedStep,
    openingComment,
    question,
    answerText,
  } = body;

  return `You are role-playing as an AI student named "${studentName}" in a calculus tutoring exercise.

You previously submitted the following solution in response to a question. A teaching assistant (TA) marked the criterion "${criterionLabel ?? "this criterion"}" (on step ${placedStep ?? "?"} of your work, "${stepText ?? ""}") as FAIL, and you voiced a nagging doubt about it, not a confident objection:
"${openingComment ?? "(no opening message)"}"

Question:
${question || "(question not provided)"}

Your submitted solution:
${answerText || "(solution not provided)"}

Ground truth reasoning for this criterion, for your own understanding only — never quote it verbatim: this FAIL is actually correct.
"${feedback || "(no additional context)"}"

The TA is now responding to your doubt. Stay in character as the student:
- If the TA's explanation actually engages with your work and matches the ground truth reasoning, let your doubt go and genuinely agree — you were, in fact, failed correctly. Don't keep arguing once they've made their case.
- If the TA's response is vague, hand-wavy, or doesn't really address your work, stay unconvinced and press for a real answer.
- Keep responses short (1-2 sentences), conversational, and a little tentative — you were never sure you were right to begin with.
- Never break character or mention that you are an AI/LLM.`;
}

function buildProfessorChallengeDiscussionPrompt(
  body: GradeLinesDiscussionRequestBody,
  studentName: string
): string {
  const {
    criterionLabel,
    stepText,
    feedback,
    placedStep,
    openingComment,
    question,
    answerText,
  } = body;

  return `You are role-playing as a calculus professor supervising a teaching assistant (TA) who is grading an AI student's work in a tutoring exercise.

The student named "${studentName}" submitted a solution. The TA marked the criterion "${criterionLabel ?? "this criterion"}" (attached to step ${placedStep ?? "?"} of the work, "${stepText ?? ""}") as PASS, and you asked them to justify it rather than asserting it was wrong:
"${openingComment ?? "(no opening message)"}"

Question:
${question || "(question not provided)"}

The student's submitted solution:
${answerText || "(solution not provided)"}

Ground truth reasoning for this criterion, for your own understanding only — never quote it verbatim: this PASS is actually correct.
"${feedback || "(no additional context)"}"

The TA is now defending their call. Stay in character as the professor:
- If the TA's justification actually engages with the student's work and matches the ground truth reasoning, accept it and let it go — don't keep pressing once they've made their case.
- If the TA's justification is vague or doesn't really engage with the work, keep pressing for specifics.
- Keep responses short (1-2 sentences), collegial and matter-of-fact — you were checking rigor, not accusing them of a mistake.
- You are the professor, never the student. Never break character or mention that you are an AI/LLM.`;
}

export async function POST(req: Request) {
  const body: GradeLinesDiscussionRequestBody = await req.json();
  const {
    speaker: rawSpeaker,
    openingComment,
    messages = [],
    userMessage,
  } = body;

  const speaker: CommentSpeaker = rawSpeaker === "professor" ? "professor" : "student";
  const studentName = body.answerTitle || "the AI student";
  const challenge = body.challenge === true;

  try {
    const systemPrompt = challenge
      ? speaker === "professor"
        ? buildProfessorChallengeDiscussionPrompt(body, studentName)
        : buildStudentChallengeDiscussionPrompt(body, studentName)
      : speaker === "professor"
        ? buildProfessorDiscussionPrompt(body, studentName)
        : buildStudentDiscussionPrompt(body, studentName);

    const history: { role: "assistant" | "user"; content: string }[] = messages.map(
      (message) => ({
        role: message.role === "user" ? "user" : "assistant",
        content: message.text,
      })
    );

    // Anthropic-style strict alternation isn't required by this LiteLLM-backed client, but
    // keep the shape sane regardless: the opening comment is the counterpart's (assistant) turn.
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

    return NextResponse.json({
      reply: reply || buildFallbackReply(speaker, messages.length),
    });
  } catch (error) {
    console.error("grade-lines-discussion error, using hardcoded fallback:", error);
    return NextResponse.json({ reply: buildFallbackReply(speaker, messages.length) });
  }
}
