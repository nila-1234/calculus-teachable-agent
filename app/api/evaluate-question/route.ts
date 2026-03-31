import { NextResponse } from "next/server";
import client from "@/lib/openai";
import { EVAL_QUESTION_PROMPT } from "@/lib/prompts";
import { MODELS } from "@/lib/models";

type ChoiceId = "A" | "B" | "C";

const CHOICE_EXPLANATIONS: Record<ChoiceId, string> = {
  A: "Correct. This choice focuses on where the rate of change is zero or undefined, which matches the idea of identifying especially important weeks based on the pattern flattening or becoming non-smooth.",
  B: "Incorrect. This choice focuses on where the profit value itself is zero or undefined, which is different from identifying weeks where the pattern's behavior is especially important.",
  C: "Incorrect. This choice narrows the idea to only local highs and lows. Those may occur at some important weeks, but the scenario is broader than extrema alone.",
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const selectedChoice = body.selectedChoice as ChoiceId | undefined;
    const selectedQuestion = body.selectedQuestion as string | undefined;

    if (
      !selectedChoice ||
      !["A", "B", "C"].includes(selectedChoice) ||
      !selectedQuestion?.trim()
    ) {
      return NextResponse.json(
        { error: "selectedChoice and selectedQuestion are required" },
        { status: 400 }
      );
    }

//     const response = await client.chat.completions.create({
//       model: MODELS.GEMINI_PRO_PREVIEW,
//       messages: [
//         {
//           role: "system",
//           content: EVAL_QUESTION_PROMPT,
//         },
//         {
//           role: "user",
//           content: `The student selected choice ${selectedChoice}.

// Selected question:
// ${selectedQuestion}

// Reference explanation:
// ${CHOICE_EXPLANATIONS[selectedChoice]}

// Write feedback for the student now.`,
//         },
//       ],
//       temperature: 0.2,
//     });

    const feedback =
      // response.choices[0]?.message?.content?.trim() ||
      CHOICE_EXPLANATIONS[selectedChoice];

    return NextResponse.json({ feedback });
  } catch (error: any) {
    console.error("evaluate-question error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to evaluate question." },
      { status: error?.status || 500 }
    );
  }
}