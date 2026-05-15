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

You will receive each response with:
- the selected option text
- whether the selected option is correct
- the selected option's hardcoded feedback
- the student's free-text explanation

Evaluate the selection and explanation separately.

Classify each response into one of these cases:
1. Correct selection + correct explanation
2. Correct selection + weak/incorrect explanation
3. Incorrect selection + explanation that matches the misconception
4. Incorrect selection + explanation that shows some correct reasoning but does not justify the selected option

For each response:
- Point out any mismatch between the selected option and the student's explanation.
- If the option is correct but the explanation is weak, explain what is missing.
- If the option is incorrect, explain why the selected option is incorrect using the hardcoded feedback as the source of truth.
- If the explanation contains correct reasoning for a different option, explicitly say that the reasoning does not support the selected choice.
- Do not ask the student to revise, retry, or choose again.
- Do not simply repeat the hardcoded feedback.
- Keep feedback specific to the option and explanation.

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