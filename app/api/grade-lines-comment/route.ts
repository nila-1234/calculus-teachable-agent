import { NextResponse } from "next/server";
import client from "@/lib/openai";
import { MODELS } from "@/lib/models";
import type { CommentSpeaker } from "@/lib/grading-voice";

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
  // Who is speaking, and which mistakes their bubble owns. A criterion can draw both a
  // professor and a student bubble, so each one only addresses the errors assigned to it.
  speaker?: CommentSpeaker;
  coversStep?: boolean;
  coversStatus?: boolean;
  // True when this criterion was actually graded correctly and the bubble is a random
  // challenge to make the TA defend the call, not a correction of a real mistake.
  challenge?: boolean;
};

// Openers rotate deterministically per-criterion (not random) so a given
// criterion's fallback line doesn't flicker between resubmits.
const STUDENT_OPENERS = ["Oh, ", "Oops, ", "Wait, ", "Hmm, I just realized "];
const PROFESSOR_OPENERS = ["Careful — ", "One correction: ", "Not quite — ", "A note here: "];

function pickOpener(seed: string, openers: readonly string[]): string {
  const hash = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return openers[hash % openers.length];
}

// Placeholder replies used when the LLM backend (LiteLLM proxy) is unavailable, so the
// drag-and-drop UI still has something to show in the comment bubble. Built from the same
// request fields the real prompts use, no model call required.
function buildFallbackReply(
  body: GradeLinesCommentRequestBody,
  speaker: CommentSpeaker,
  coversStep: boolean,
  coversStatus: boolean
): string {
  const {
    criterionLabel,
    placedStep,
    expectedStep,
    userStatus,
    expectedStatus,
    feedback,
  } = body;

  const label = criterionLabel ?? "this criterion";
  const reasoning = feedback ? ` ${feedback}` : "";

  if (speaker === "professor") {
    const opener = pickOpener(criterionLabel ?? "criterion", PROFESSOR_OPENERS);

    if (coversStep && coversStatus) {
      return `${opener}"${label}" belongs on step ${expectedStep ?? "?"} rather than step ${placedStep ?? "?"}, and that step should be marked ${(expectedStatus ?? "the other way").toUpperCase()}, not ${(userStatus ?? "what you chose").toUpperCase()}.${reasoning}`;
    }

    if (coversStep) {
      return `${opener}"${label}" applies to step ${expectedStep ?? "?"}, not step ${placedStep ?? "?"} — that's where the student's work is actually addressing it.${reasoning}`;
    }

    if (coversStatus) {
      return `${opener}"${label}" shouldn't be a ${(userStatus ?? "pass").toUpperCase()} here — step ${placedStep ?? "?"} doesn't meet it, so this one is a ${(expectedStatus ?? "fail").toUpperCase()}.${reasoning}`;
    }

    return `${opener}I'd take another look at how "${label}" was graded.${reasoning}`;
  }

  const opener = pickOpener(criterionLabel ?? "criterion", STUDENT_OPENERS);

  if (coversStatus) {
    return `${opener}I thought "${label}" was ${userStatus ?? "graded that way"}, but I think I actually did that on step ${placedStep ?? expectedStep ?? "?"} — shouldn't it be ${expectedStatus ?? "the other call"}?${reasoning}`;
  }

  return `${opener}something about "${label}" feels off to me — mind double-checking it?`;
}

// Placeholder replies for a challenge on a criterion the TA actually got right, used
// when the LLM backend is unavailable.
function buildFallbackChallengeReply(
  body: GradeLinesCommentRequestBody,
  speaker: CommentSpeaker,
  coversStep: boolean
): string {
  const label = body.criterionLabel ?? "this criterion";
  const step = body.placedStep ?? "?";

  if (coversStep) {
    return `Are you sure "${label}" belongs on step ${step}? Why does it apply there?`;
  }

  if (speaker === "professor") {
    return `Are you sure "${label}" earns a pass on step ${step}? Why is it correct?`;
  }

  return `Wait, are you sure I actually got "${label}" wrong on step ${step}?`;
}

// Placement doubt on a criterion that's actually attached to the right step. Always the
// professor — a student wouldn't second-guess where their own work was tagged.
function buildProfessorPlacementChallengePrompt(
  body: GradeLinesCommentRequestBody,
  studentName: string
): string {
  const { answerText, question, criterionLabel, stepText, feedback, placedStep } = body;

  return `You are role-playing as a calculus professor supervising a teaching assistant (TA) who is grading an AI student's work in a tutoring exercise.

The student named "${studentName}" submitted the following solution. The TA just attached the criterion "${criterionLabel ?? "this criterion"}" to step ${placedStep ?? "?"} of the work ("${stepText ?? ""}").

Question:
${question || "(question not provided)"}

The student's submitted solution:
${answerText || "(solution not provided)"}

Ground truth reasoning for this criterion, for your own understanding only — never quote it verbatim: this placement is actually correct, so don't claim it's wrong.
"${feedback || "(no additional context)"}"

Write a short, skeptical-but-fair rebuttal to the TA:
- Directly challenge the placement with a pointed question — literally ask something like "Are you sure this belongs on step ${placedStep ?? "?"}?" or "Why does this apply here?" Don't hedge into a vague request like "can you explain why..." — put them on the spot.
- Reference step ${placedStep ?? "?"} specifically, not a generic "this step."
- You expect them to be able to defend it, and if they do, you'll accept it — but the opening line itself should read as doubt, not curiosity.
- Keep it to 1 sentence, brief and matter-of-fact, not accusatory.
- Do not greet or sign off. Open with the question itself.
- You are the professor, never the student. Never break character or mention that you are an AI/LLM.`;
}

function buildStudentChallengePrompt(
  body: GradeLinesCommentRequestBody,
  studentName: string
): string {
  const { answerText, question, criterionLabel, stepText, feedback, placedStep } = body;

  return `You are role-playing as an AI student named "${studentName}" in a calculus tutoring exercise.

You previously submitted the following solution in response to a question. A teaching assistant (TA) is grading your work step by step, and just now marked the criterion "${criterionLabel ?? "this criterion"}" (on step ${placedStep ?? "?"} of your work, "${stepText ?? ""}") as FAIL.

Question:
${question || "(question not provided)"}

Your submitted solution:
${answerText || "(solution not provided)"}

Ground truth reasoning for this criterion, for your own understanding only — never quote it verbatim: this FAIL is actually correct, so do not claim you were wrongly failed.
"${feedback || "(no additional context)"}"

Write a short, genuinely uncertain reaction from the student — NOT a confident objection:
- You have a nagging feeling you should push back, but you're not sure you're actually right.
- Directly challenge the call with a pointed question — literally ask something like "Are you sure I got this wrong?" or "Wait, why is this a fail?" Don't just muse or make a vague observation; put the question to the TA and make them answer it.
- Reference your own work on step ${placedStep ?? "?"} specifically — don't ask something generic that could apply to any criterion.
- Keep it to 1 sentence, tentative and a little anxious, but still a direct question.
- Never break character or mention that you are an AI/LLM.`;
}

function buildProfessorChallengePrompt(
  body: GradeLinesCommentRequestBody,
  studentName: string
): string {
  const { answerText, question, criterionLabel, stepText, feedback, placedStep } = body;

  return `You are role-playing as a calculus professor supervising a teaching assistant (TA) who is grading an AI student's work in a tutoring exercise.

The student named "${studentName}" submitted the following solution. The TA just graded the criterion "${criterionLabel ?? "this criterion"}" by attaching it to step ${placedStep ?? "?"} of the work ("${stepText ?? ""}") and marking it PASS.

Question:
${question || "(question not provided)"}

The student's submitted solution:
${answerText || "(solution not provided)"}

Ground truth reasoning for this criterion, for your own understanding only — never quote it verbatim: this PASS is actually correct, so don't claim it's wrong.
"${feedback || "(no additional context)"}"

Write a short, skeptical-but-fair rebuttal to the TA:
- Directly challenge the call with a pointed question — literally ask something like "Are you sure this deserves a pass?" or "Why is this correct?" Don't hedge into a vague request like "can you explain how..." — put them on the spot and make them defend the specific call.
- Reference step ${placedStep ?? "?"} of the student's work specifically — don't ask something generic that could apply to any criterion.
- You expect them to be able to defend it, and if they do, you'll accept it — but the opening line itself should read as doubt, not curiosity.
- Keep it to 1 sentence, brief and matter-of-fact, not accusatory.
- Do not greet or sign off. Open with the question itself.
- You are the professor, never the student. Never break character or mention that you are an AI/LLM.`;
}

function buildStudentPrompt(
  body: GradeLinesCommentRequestBody,
  studentName: string,
  mistakes: string[]
): string {
  const {
    answerText,
    question,
    criterionLabel,
    stepText,
    feedback,
    userStatus,
    placedStep,
    expectedStep,
  } = body;

  return `You are role-playing as an AI student named "${studentName}" in a calculus tutoring exercise.

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
- Talk ONLY about the pass/fail call listed above. Do not comment on which step the criterion was attached to — a professor handles that separately.
- Naturally mention the relevant step number in the sentence (e.g. "on step ${placedStep ?? expectedStep ?? "N"}"), not as TA jargon like "expected step."
- Volunteer the correct reasoning in your own words, grounded in the context above — don't invent new math facts that weren't given to you.
- Keep it to 1-2 sentences, conversational, a little embarrassed/humble — this is the student admitting or catching something, not defending themselves.
- Never break character or mention that you are an AI/LLM.`;
}

function buildProfessorPrompt(
  body: GradeLinesCommentRequestBody,
  studentName: string,
  mistakes: string[]
): string {
  const {
    answerText,
    question,
    criterionLabel,
    stepText,
    expectedStepText,
    feedback,
    userStatus,
    placedStep,
    expectedStep,
  } = body;

  return `You are role-playing as a calculus professor supervising a teaching assistant (TA) who is grading an AI student's work in a tutoring exercise.

The student named "${studentName}" submitted the following solution in response to a question. The TA grades it step by step: they drag a rubric criterion onto the specific step of the solution it applies to, and mark that criterion Pass or Fail.

Question:
${question || "(question not provided)"}

The student's submitted solution:
${answerText || "(solution not provided)"}

The TA just graded the criterion "${criterionLabel ?? "this criterion"}" by attaching it to step ${placedStep ?? "?"} of the work ("${stepText ?? ""}") and marking it ${(userStatus ?? "ungraded").toUpperCase()}. For reference, step ${expectedStep ?? "?"} of the solution reads "${expectedStepText ?? ""}".

Here is the underlying reason that grading is off — do not quote it verbatim, put it in your own words:
"${feedback || "(no additional context)"}"

${mistakes.join(" ")}

Write a short correction addressed directly to the TA:
- Address ONLY the mistakes listed above. If the pass/fail call is not listed, say nothing about it; if the step placement is not listed, say nothing about it. Another character may be covering the rest.
- Say what was marked, what it should be instead, and briefly why, grounded in the context above — don't invent new math facts that weren't given to you.
- Mention the step number naturally in the sentence (e.g. "on step ${expectedStep ?? placedStep ?? "N"}"), never jargon like "expected step."
- Collegial and matter-of-fact — a mentor catching a grading slip, not scolding, and not hedging.
- Do not greet or sign off ("Hi there", "Quick note", "Just so you know") — open with the correction itself.
- Keep it to 1-2 sentences.
- You are the professor, never the student. Never break character or mention that you are an AI/LLM.`;
}

export async function POST(req: Request) {
  const body: GradeLinesCommentRequestBody = await req.json();
  const {
    answerTitle,
    stepText,
    expectedStepText,
    userStatus,
    expectedStatus,
    placedStep,
    expectedStep,
  } = body;

  const speaker: CommentSpeaker = body.speaker === "professor" ? "professor" : "student";
  // Default to covering everything so a caller that omits the flags behaves as before.
  const coversStep = body.coversStep ?? true;
  const coversStatus = body.coversStatus ?? true;
  const challenge = body.challenge === true;

  const studentName = answerTitle || "the AI student";

  try {
    let systemPrompt: string;

    if (challenge) {
      systemPrompt = coversStep
        ? buildProfessorPlacementChallengePrompt(body, studentName)
        : speaker === "professor"
          ? buildProfessorChallengePrompt(body, studentName)
          : buildStudentChallengePrompt(body, studentName);
    } else {
      const mistakes: string[] = [];
      if (coversStatus) {
        mistakes.push(
          speaker === "professor"
            ? `The TA marked this criterion as ${(userStatus ?? "ungraded").toUpperCase()}, but that's the wrong call — it should be ${(expectedStatus ?? "the other way").toUpperCase()}.`
            : `The TA marked this criterion as ${(userStatus ?? "ungraded").toUpperCase()}, but that's actually the wrong call — it should be ${(expectedStatus ?? "the other way").toUpperCase()}.`
        );
      }
      if (coversStep) {
        mistakes.push(
          `The TA attached this criterion to step ${placedStep ?? "?"} of the work ("${stepText ?? ""}"), but it really belongs on step ${expectedStep ?? "?"} ("${expectedStepText ?? ""}") instead.`
        );
      }

      systemPrompt =
        speaker === "professor"
          ? buildProfessorPrompt(body, studentName, mistakes)
          : buildStudentPrompt(body, studentName, mistakes);
    }

    const completion = await client.chat.completions.create({
      model: MODELS.GEMINI_FAST,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            speaker === "professor"
              ? "Give your correction to the TA now, in character."
              : "Give your self-assessment now, in character.",
        },
      ],
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content?.trim();

    return NextResponse.json({
      speaker,
      reply:
        reply ||
        (challenge
          ? buildFallbackChallengeReply(body, speaker, coversStep)
          : buildFallbackReply(body, speaker, coversStep, coversStatus)),
    });
  } catch (error) {
    console.error("grade-lines-comment error, using hardcoded fallback:", error);
    return NextResponse.json({
      speaker,
      reply: challenge
        ? buildFallbackChallengeReply(body, speaker, coversStep)
        : buildFallbackReply(body, speaker, coversStep, coversStatus),
    });
  }
}
