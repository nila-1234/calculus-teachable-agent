import { NextResponse } from "next/server";
import client from "@/lib/openai";
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
      model: MODELS.GEMINI_FAST,
      messages: [
        {
          role: "system",
          content:
            "You are grading a student's calculus question. Return JSON only with keys score and feedback. Score must be 1-5. Feedback must be 1-2 sentences.",
        },
        {
          role: "user",
          content: `Student question:\n${studentQuestion}`,
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);

    return NextResponse.json({
      score: Math.max(1, Math.min(5, Number(parsed.score) || 3)),
      feedback: parsed.feedback || "No feedback returned.",
    });
  } catch (error: any) {
    console.error("evaluate-question error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to evaluate question." },
      { status: error?.status || 500 }
    );
  }
}