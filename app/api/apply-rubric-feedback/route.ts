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

    type RubricRow = {
      criterionId: string;
      criterion: string;
      evaluation: "pass" | "fail" | "";
    };

    const feedback = rows.map((row) => ({
      criterionId: row.criterionId,
      criterion: row.criterion,
      evaluation: row.evaluation,
      feedback:
        row.evaluation === "pass"
          ? "Good: this answer satisfies this criterion."
          : "Needs work: this answer does not fully satisfy this criterion.",
    }));

    console.log(feedback);

    return NextResponse.json({ feedback });

  } catch (error) {
    return NextResponse.json(
      {
        feedback: [],
      },
      { status: 500 }
    );
  }
}