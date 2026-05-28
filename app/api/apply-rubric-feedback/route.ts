import { NextResponse } from "next/server";

type Evaluation = "pass" | "fail" | "";

type RubricRow = {
  criterionId: string;
  criterion: string;
  evaluation: Evaluation;
};

type RubricFitItem = {
  pass: boolean;
  feedback: string;
};

type RubricFit = Record<string, RubricFitItem>;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      answerId,
      answerTitle,
      rubric,
      rubricFit,
      explanations,
    }: {
      answerId?: string;
      answerTitle?: string;
      rubric?: RubricRow[];
      rubricFit?: RubricFit;
      explanations?: Record<string, string>;
    } = body;

    void explanations;

    const rows = Array.isArray(rubric) ? rubric : {};
    const fit = rubricFit ?? {};

    const feedback = Array.isArray(rows)
      ? rows.map((row) => {
        const expected = fit[row.criterionId];

        if (!expected) {
          return {
            criterionId: row.criterionId,
            criterion: row.criterion,
            evaluation: row.evaluation,
            correct: false,
            expectedEvaluation: null,
            feedback: "No rubric fit reference was found for this criterion.",
          };
        }

        const expectedEvaluation: "pass" | "fail" = expected.pass
          ? "pass"
          : "fail";

        const userWasCorrect = row.evaluation === expectedEvaluation;

        return {
          criterionId: row.criterionId,
          criterion: row.criterion,
          evaluation: row.evaluation,
          correct: userWasCorrect,
          expectedEvaluation,
          feedback: expected.feedback,
        };
      })
      : [];

    return NextResponse.json({
      answerId,
      answerTitle,
      feedback,
    });
  } catch (error) {
    return NextResponse.json(
      {
        feedback: [],
      },
      { status: 500 }
    );
  }
}