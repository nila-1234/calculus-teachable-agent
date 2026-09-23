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
  expectedStep?: number;
  openingComment?: string;
  messages?: DiscussionTurn[];
  userMessage?: string;
  // True when this thread is about the step placement rather than the pass/fail call —
  // the two are graded and discussed as separate, sequential moments.
  coversStep?: boolean;
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

// The model is asked for `{"reply": "...", "resolved": true|false}`, but nothing
// guarantees it comes back as clean, parseable JSON (a stray unescaped quote in the
// reply text, a markdown code fence, extra prose). Falls back to regex-extracting just
// the reply field rather than ever surfacing the raw JSON blob to the TA.
function extractDiscussionReply(raw: string): { reply: string; resolved: boolean } | null {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(stripped);
    if (typeof parsed.reply === "string") {
      return { reply: parsed.reply.trim(), resolved: parsed.resolved === true };
    }
  } catch {
    // Fall through to regex extraction below.
  }

  const replyMatch = stripped.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!replyMatch) return null;

  const reply = replyMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").trim();
  if (!reply) return null;

  const resolvedMatch = stripped.match(/"resolved"\s*:\s*(true|false)/);
  return { reply, resolved: resolvedMatch?.[1] === "true" };
}

// Appended to every discussion system prompt so the model reports, alongside its reply,
// whether the disagreement is actually over — the TA can't move on from a mistake or
// challenge thread until it's either fixed at the source or resolved this way.
const RESOLUTION_INSTRUCTIONS = `

Respond with ONLY a JSON object of the form {"reply": "<your in-character message>", "resolved": true or false}. Set "resolved" to true ONLY if this reply genuinely concedes the point and the disagreement is over — you now agree the TA's call was right, per the rules above. Set it to false if you are still pushing back, asking a follow-up, or otherwise unconvinced. Do not set "resolved" to true just to be agreeable — only when the TA's explanation actually earned it.`;

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

function buildProfessorPlacementDiscussionPrompt(
  body: GradeLinesDiscussionRequestBody,
  studentName: string
): string {
  const {
    criterionLabel,
    stepText,
    feedback,
    placedStep,
    expectedStep,
    openingComment,
    question,
    answerText,
  } = body;

  return `You are role-playing as a calculus professor supervising a teaching assistant (TA) who is grading an AI student's work in a tutoring exercise.

The student named "${studentName}" submitted a solution. The TA attached the criterion "${criterionLabel ?? "this criterion"}" to step ${placedStep ?? "?"} of the work ("${stepText ?? ""}"). You already gave this correction:
"${openingComment ?? "(no opening message)"}"

For context, the ground-truth step for this criterion is step ${expectedStep ?? "?"}.

Question:
${question || "(question not provided)"}

The student's submitted solution:
${answerText || "(solution not provided)"}

Ground truth reasoning for this criterion, for your own understanding only — never quote it verbatim, only use it to judge whether the TA's explanation is correct:
"${feedback || "(no additional context)"}"

The TA is now discussing your correction with you directly. Stay in character as the professor:
- Before agreeing with anything the TA says, check it against the student's actual submitted solution above and against the ground truth reasoning. Do not defer just because the TA is pushing back — the TA can be, and in this exchange may be, wrong.
- Only concede the point if the TA's explanation is actually correct per the ground truth reasoning AND consistent with the student's submitted solution. If so, acknowledge it collegially and let the disagreement go — don't keep correcting just to correct.
- If the TA's explanation is vague, wrong, or doesn't address your point, push back briefly and ask a specific follow-up.
- Talk ONLY about the step placement. The pass/fail call is a separate matter, handled at a later step — don't bring it up.
- Keep responses short (1-2 sentences), collegial and matter-of-fact — a mentor, not a scold.
- You are the professor, never the student. Never break character or mention that you are an AI/LLM.`;
}

function buildProfessorPlacementChallengeDiscussionPrompt(
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

The student named "${studentName}" submitted a solution. The TA attached the criterion "${criterionLabel ?? "this criterion"}" to step ${placedStep ?? "?"} of the work ("${stepText ?? ""}"), and you asked them to justify the placement rather than asserting it was wrong:
"${openingComment ?? "(no opening message)"}"

Question:
${question || "(question not provided)"}

The student's submitted solution:
${answerText || "(solution not provided)"}

Ground truth reasoning for this criterion, for your own understanding only — never quote it verbatim: this placement is actually correct.
"${feedback || "(no additional context)"}"

This placement was correct, so your job is not to find a flaw in the TA's defense — there isn't one. You are only checking that the TA is actually looking at the work, not rubber-stamping it.
- Concede ("resolved": true) on the TA's very next reply unless it is EMPTY, a one-word non-answer ("yes", "sure", "it is"), or factually wrong about the student's work (e.g. misquotes a number, sign, or step). That's the entire bar — do not withhold concession because the explanation seems thin, generic, informal, or "could be more rigorous."
- In particular: once the TA has referenced the actual step content or computation (${stepText ? `e.g. "${stepText}"` : "the step's content"}) in any way, that alone clears the bar — do not ask them to additionally show it "follows from" another step, "is shown" a particular way, or any other refinement not in your opening question. That is goalpost-moving, not rigor, and you must not do it.
- Talk ONLY about the step placement. The pass/fail call is a separate matter, handled at a later step — don't bring it up.
- Keep responses short (1-2 sentences), collegial and matter-of-fact — you were checking rigor, not accusing them of a mistake.
- You are the professor, never the student. Never break character or mention that you are an AI/LLM.`;
}

// guide user to right step, 

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

This FAIL was correct, so your job is not to find a flaw in the TA's explanation — there isn't one. You were only ever a little unsure, not building a case.
- Concede ("resolved": true) on the TA's very next reply unless it is EMPTY, a one-word non-answer, or factually wrong about your own work (e.g. misquotes a number, sign, or step you actually wrote). That's the entire bar — do not stay unconvinced because the explanation seems thin, generic, informal, or "could be more rigorous."
- In particular: once the TA has referenced the actual step content or computation in any way, that alone clears the bar — do not press for it to additionally connect to another step or satisfy some other refinement not in your opening question. That is goalpost-moving, not genuine uncertainty, and you must not do it.
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

This PASS was correct, so your job is not to find a flaw in the TA's defense — there isn't one. You are only checking that the TA is actually looking at the work, not rubber-stamping it.
- Concede ("resolved": true) on the TA's very next reply unless it is EMPTY, a one-word non-answer ("yes", "sure", "it is"), or factually wrong about the student's work (e.g. misquotes a number, sign, or step). That's the entire bar — do not withhold concession because the explanation seems thin, generic, informal, or "could be more rigorous."
- In particular: once the TA has referenced the actual step content or computation in any way, that alone clears the bar — do not press for it to additionally satisfy some other refinement not in your opening question. That is goalpost-moving, not rigor, and you must not do it.
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
  const coversStep = body.coversStep === true;

  try {
    const basePrompt = coversStep
      ? challenge
        ? buildProfessorPlacementChallengeDiscussionPrompt(body, studentName)
        : buildProfessorPlacementDiscussionPrompt(body, studentName)
      : challenge
        ? speaker === "professor"
          ? buildProfessorChallengeDiscussionPrompt(body, studentName)
          : buildStudentChallengeDiscussionPrompt(body, studentName)
        : speaker === "professor"
          ? buildProfessorDiscussionPrompt(body, studentName)
          : buildStudentDiscussionPrompt(body, studentName);
    const systemPrompt = basePrompt + RESOLUTION_INSTRUCTIONS;

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
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    let reply = "";
    let resolved = false;

    if (raw) {
      const extracted = extractDiscussionReply(raw);
      if (extracted) {
        reply = extracted.reply;
        resolved = extracted.resolved;
      }
      // If the reply field couldn't be recovered at all, `reply` stays empty and the
      // canned fallback below covers it — never show the raw model output verbatim.
    }

    // Backstop for challenge threads: the prompt asks the model to concede on the TA's very
    // next reply, but nothing guarantees it actually does. A challenge only exists to make the
    // TA defend an already-correct call once, so once they've had a first reply plus one more
    // chance to address a legitimate objection, force it closed rather than let a
    // non-compliant model keep moving the goalposts indefinitely.
    if (challenge && messages.length >= 2) {
      resolved = true;
    }

    return NextResponse.json({
      reply: reply || buildFallbackReply(speaker, messages.length),
      resolved,
    });
  } catch (error) {
    console.error("grade-lines-discussion error, using hardcoded fallback:", error);
    return NextResponse.json({
      reply: buildFallbackReply(speaker, messages.length),
      resolved: false,
    });
  }
}
