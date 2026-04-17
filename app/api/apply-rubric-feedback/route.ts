import { NextResponse } from "next/server";

type RubricRow = {
  criterionId: string;
  criterion: string;
  evaluation: "pass" | "fail" | "";
  remarks: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      answerId,
      answerTitle,
      answerText,
      rubric,
    }: {
      answerId?: string;
      answerTitle?: string;
      answerText?: string;
      rubric?: RubricRow[];
    } = body;

    const rows = Array.isArray(rubric) ? rubric : [];

    const formattedRubric = rows
      .map(
        (row, index) =>
          `${index + 1}. ${row.criterion}\n   Evaluation: ${row.evaluation || "not selected"}\n   Remarks: ${row.remarks?.trim() || "None"}`
      )
      .join("\n\n");

    const feedback = [
      `Received rubric evaluation for ${answerTitle || answerId || "answer"}.`,
      "",
      "Rubric results:",
      formattedRubric || "No rubric rows received.",
    ].join("\n");

    console.log(feedback);

    return NextResponse.json({ feedback });
  } catch (error) {
    return NextResponse.json(
      {
        feedback: "Failed to generate feedback.",
      },
      { status: 500 }
    );
  }
}