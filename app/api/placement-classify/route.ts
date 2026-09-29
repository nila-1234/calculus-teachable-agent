import { NextResponse } from "next/server";
import client from "@/lib/openai";
import { MODELS } from "@/lib/models";
import type { ReplyLabel } from "@/lib/placement-flow";

type PlacementClassifyRequestBody = {
  // The professor's question the TA is answering, e.g. "Are you sure X belongs on step 3?"
  question?: string;
  reply?: string;
};

const LABELS: readonly ReplyLabel[] = ["yes", "no", "unclear"];

// The only decision the LLM makes in the placement discussion: whether the TA's free-text
// answer to "Are you sure?" stands by the placement, backs off it, or is neither. It is
// never shown the correct step, so it can't judge (or leak) whether the TA is right.
const SYSTEM_PROMPT = `You classify a teaching assistant's reply to a yes/no question about where they placed a rubric item.

Answer with ONLY a JSON object: {"label": "yes" | "no" | "unclear"}.

- "yes": they stand by the placement (e.g. "yes", "yep I'm sure", "I think so", "it belongs there because ...").
- "no": they doubt or abandon it (e.g. "no", "not really", "maybe not", "I should move it", "it should be step 4").
- "unclear": neither — a question back, "I don't know", off-topic, or empty.

Do not judge whether the placement is correct. Only classify what they said.`;

export async function POST(req: Request) {
  const { question, reply }: PlacementClassifyRequestBody = await req.json();

  if (!reply?.trim()) return NextResponse.json({ label: "unclear" });

  try {
    const completion = await client.chat.completions.create({
      model: MODELS.GEMINI_FAST,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Question: ${question ?? "Are you sure?"}\nReply: ${reply}` },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const match = raw.match(/"label"\s*:\s*"(yes|no|unclear)"/);
    const label = match && LABELS.includes(match[1] as ReplyLabel) ? match[1] : "unclear";
    return NextResponse.json({ label });
  } catch (error) {
    // "unclear" re-asks the question, which is the safe fallback when classification fails.
    console.error("placement-classify error, falling back to unclear:", error);
    return NextResponse.json({ label: "unclear" });
  }
}
