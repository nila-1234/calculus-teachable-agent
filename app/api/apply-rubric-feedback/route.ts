import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // const { answerTitle, rubric, results } = body;

    let feedback = "Placeholder feedback";

    return NextResponse.json({
      feedback,
    });
  } catch (error) {
    return NextResponse.json(
      {
        feedback: "Failed to generate feedback.",
      },
      { status: 500 }
    );
  }
}