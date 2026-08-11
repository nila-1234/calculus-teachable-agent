import { NextResponse } from "next/server";
import client from "@/lib/openai";
import { MODELS } from "@/lib/models";

type GradeLinesCommentRequestBody = {
  answerTitle?: string;
  answerText?: string;
  question?: string;
  criterionLabel?: string;
  stepText?: string;
  userStatus?: "pass" | "fail" | null;
  expectedStatus?: "pass" | "fail" | null;
  statusCorrect?: boolean;
  placedStep?: number | null;
  expectedStep?: number;
  stepCorrect?: boolean;
};

export async function POST(req: Request) {
  try {
    const body: GradeLinesCommentRequestBody = await req.json();
    const {
      answerTitle,
      answerText,
      question,
      criterionLabel,
      stepText,
      userStatus,
      expectedStatus,
      statusCorrect,
      placedStep,
      expectedStep,
      stepCorrect,
    } = body;

    const studentName = answerTitle || "the AI student";

    const mistakes: string[] = [];
    if (statusCorrect === false) {
      mistakes.push(
        `The TA marked this criterion as ${(userStatus ?? "ungraded").toUpperCase()}, but that grade is actually wrong.`
      );
    }
    if (stepCorrect === false) {
      mistakes.push(
        `The TA attached this criterion to step ${placedStep ?? "?"} of your work, but it doesn't really belong there (it should be tied to step ${expectedStep ?? "a different part of your work"}).`
      );
    }

    const systemPrompt = `You are role-playing as an AI student named "${studentName}" in a calculus tutoring exercise.

You previously submitted the following solution in response to a question. A teaching assistant (TA) is now grading your work step by step: they drag a rubric criterion onto the specific step of your solution it applies to, and mark that criterion Pass or Fail.

Question:
${question || "(question not provided)"}

Your submitted solution:
${answerText || "(solution not provided)"}

The TA just graded the criterion "${criterionLabel ?? "this criterion"}" by attaching it to step ${placedStep ?? "?"} of your work ("${stepText ?? ""}") and marking it ${(userStatus ?? "ungraded").toUpperCase()}.

${mistakes.join(" ")}

Stay in character as the student:
- You don't know the "correct" grading — you just feel something is off about how you were graded, so push back naturally and specifically.
- Ask a genuine, brief, slightly confused question about the grading decision (why this step, why this grade), referencing the specific criterion and step.
- Keep it to 1-2 sentences, conversational, and in a tone that nudges the TA to double check their grading without being certain they're wrong.
- Never break character or mention that you are an AI/LLM, and never reveal or imply you know the "right answer" to the grading.`;

    const completion = await client.chat.completions.create({
      model: MODELS.GEMINI_FAST,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content:
            "Ask your question about this grading decision now, in character.",
        },
      ],
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("grade-lines-comment error:", error);
    return NextResponse.json({ reply: "" }, { status: 500 });
  }
}
