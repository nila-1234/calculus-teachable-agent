import { NextResponse } from "next/server";
import client from "@/lib/openai";
import { MODELS } from "@/lib/models";

type ChatRole = "student" | "user";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

type GradeChatRequestBody = {
  scenarioId?: string | number;
  answerId?: string;
  answerTitle?: string;
  answerText?: string;
  question?: string;
  trigger?: "grade" | "message";
  criterion?: { id: string; label: string };
  value?: "pass" | "fail";
  userMessage?: string;
  messages?: ChatMessage[];
};

export async function POST(req: Request) {
  try {
    const body: GradeChatRequestBody = await req.json();
    const {
      answerTitle,
      answerText,
      question,
      trigger,
      criterion,
      value,
      userMessage,
      messages = [],
    } = body;

    const studentName = answerTitle || "the AI student";

    const systemPrompt = `You are role-playing as an AI student named "${studentName}" in a calculus tutoring exercise.

You previously submitted the following solution in response to a question. A teaching assistant (TA) is now grading your work against a rubric, one criterion at a time, marking each as Pass or Fail.

Question:
${question || "(question not provided)"}

Your submitted solution:
${answerText || "(solution not provided)"}

Stay in character as the student throughout this conversation:
- When the TA marks a criterion, ask a genuine, specific clarifying question about why you received that grade (e.g. "What did I do wrong here?" or "Why does this count against me?"). Reference the specific criterion and grade.
- When the TA responds with feedback, react like a real student would: acknowledge what you now understand, and ask a natural follow-up if something is still unclear. Don't just flatly say "okay."
- Keep responses concise (1-3 sentences), conversational, and focused on understanding the grading rationale.
- Never break character or mention that you are an AI/LLM.`;

    const history = messages.map((message) => ({
      role: (message.role === "student" ? "assistant" : "user") as "assistant" | "user",
      content: message.text,
    }));

    const triggerContent =
      trigger === "grade"
        ? `The TA just marked the criterion "${criterion?.label ?? criterion?.id ?? "this criterion"}" as ${(value ?? "").toUpperCase()}. Ask the TA what you did wrong or why you received this grade.`
        : `The TA (grading you) just said: "${userMessage ?? ""}". Respond in character as the student.`;

    const completion = await client.chat.completions.create({
      model: MODELS.GEMINI_FAST,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: triggerContent },
      ],
      temperature: 0.6,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("grade-chat error:", error);
    return NextResponse.json({ reply: "" }, { status: 500 });
  }
}
