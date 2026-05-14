import { NextResponse } from "next/server";
import client from "@/lib/openai";

type SelectedResponse = {
  partId: string;
  partLabel: string;
  selectedChoiceId: string;
  selectedChoiceText: string;
  selectedChoiceCorrect?: boolean;
  hardcodedFeedback?: string;
  explanation: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const responses = body.responses as SelectedResponse[];

    if (!Array.isArray(responses)) {
      return NextResponse.json(
        { error: "Missing responses array." },
        { status: 400 }
      );
    }

    const completion = await client.chat.completions.create({
      model: process.env.LITELLM_DEFAULT_MODEL || "wine-gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `
You are giving concise educational feedback on a student's written explanation for a multiple-choice calculus modeling question.

For each response:
- Evaluate whether the student's explanation logically supports the selected choice.
- Mention whether the reasoning connects to the scenario, graph/model behavior, or calculus concept.
- Do not repeat the hardcoded correctness feedback.
- Do not change whether the choice is correct.
- If the explanation is empty, say that no explanation was provided and suggest what should be explained.

Return only valid JSON in this shape:
{
  "feedbackByPart": {
    "partId": "feedback text"
  }
}
          `.trim(),
        },
        {
          role: "user",
          content: JSON.stringify({
            scenario: body.scenario,
            question: body.question,
            responses,
          }),
        },
      ],
      temperature: 0.3,
    });
    
    let parsed: { feedbackByPart?: Record<string, string> } = {};

    try {
      const rawContent = completion.choices[0]?.message?.content || "{}";

      const cleanedContent = rawContent
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();

      parsed = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse question feedback JSON:", parseError);
      console.error("Raw model output:", completion.choices[0]?.message?.content);
    }

    return NextResponse.json({
      feedbackByPart: parsed.feedbackByPart || {},
    });
  } catch (error) {
    console.error("question-feedback error:", error);

    return NextResponse.json(
      { error: "Failed to generate question feedback." },
      { status: 500 }
    );
  }
}