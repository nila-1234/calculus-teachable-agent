import { NextResponse } from "next/server";
import client from "@/lib/openai";
import { AI_STUDENT_INSTRUCTION } from "@/lib/prompts";
import { MODELS } from "@/lib/models";

export async function POST(req: Request) {
  try {
    const { studentQuestion } = await req.json();

    if (!studentQuestion?.trim()) {
      return NextResponse.json(
        { error: "studentQuestion is required" },
        { status: 400 }
      );
    }

    const response = await client.chat.completions.create({
      model: MODELS.GEMINI_PRO_PREVIEW,
      messages: [
        {
          role: "system",
          content: `You are simulating three calculus students answering a question.

Generate THREE answers:

Student A – Correct solution
Student B – A common misconception: the student confuses a critical number with a critical point and reports answers as coordinates (t, v(t)).
Student C – Another misconception: the student believes critical numbers are the OUTPUT values of the function (v(t)) rather than the input values t.

Important rules:
- Each answer should be short (3–5 sentences).
- The reasoning should sound like a real student explanation.
- Student A must give the correct method and answer.
- Students B and C must clearly show the misunderstanding described above.
- Do not mention that these are misconceptions.

Additional concept instruction:
${AI_STUDENT_INSTRUCTION}

Return JSON only with key "answers", where answers is an array of exactly 3 objects with keys: label, text, correct.`,
        },
        {
          role: "user",
          content: `Question:\n${studentQuestion}`,
        },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content || "{}";
    return NextResponse.json(JSON.parse(raw));
  } catch (error: any) {
    console.error("ai-student-answers error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate AI student answers." },
      { status: error?.status || 500 }
    );
  }
}