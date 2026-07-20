import { NextResponse } from "next/server";

type RubricRow = {
  criterionId: string;
  criterion: string;
};

type RubricFitItem = {
  pass: boolean;
  line: number[];
  feedback: string;
};

type RubricFit = Record<string, RubricFitItem>;

type Placement = {
  lineIndex: number; // 0-indexed
  status: "pass" | "fail" | null;
};

type Placements = Record<string, Placement>;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      answerId,
      answerTitle,
      rubric,
      rubricFit,
      placements,
    }: {
      answerId?: string;
      answerTitle?: string;
      rubric?: RubricRow[];
      rubricFit?: RubricFit;
      placements?: Placements;
    } = body;

    const rows = Array.isArray(rubric) ? rubric : [];
    const fit = rubricFit ?? {};
    const placed = placements ?? {};

    const feedback = rows.map((row) => {
      const expected = fit[row.criterionId];
      const placement = placed[row.criterionId];

      if (!expected) {
        return {
          criterionId: row.criterionId,
          criterion: row.criterion,
          placedLine: placement ? placement.lineIndex + 1 : null,
          expectedLines: [],
          lineCorrect: false,
          status: placement?.status ?? null,
          expectedStatus: null,
          statusCorrect: false,
          correct: false,
          feedback: "No rubric fit reference was found for this criterion.",
        };
      }

      const expectedStatus: "pass" | "fail" = expected.pass ? "pass" : "fail";
      const expectedLines = expected.line ?? [];

      if (!placement) {
        return {
          criterionId: row.criterionId,
          criterion: row.criterion,
          placedLine: null,
          expectedLines,
          lineCorrect: false,
          status: null,
          expectedStatus,
          statusCorrect: false,
          correct: false,
          feedback: "This criterion was not placed on a line.",
        };
      }

      const placedLine = placement.lineIndex + 1;
      const lineCorrect = expectedLines.includes(placedLine);
      const statusCorrect = placement.status === expectedStatus;
      const correct = lineCorrect && statusCorrect;

      return {
        criterionId: row.criterionId,
        criterion: row.criterion,
        placedLine,
        expectedLines,
        lineCorrect,
        status: placement.status,
        expectedStatus,
        statusCorrect,
        correct,
        feedback: expected.feedback,
      };
    });

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
