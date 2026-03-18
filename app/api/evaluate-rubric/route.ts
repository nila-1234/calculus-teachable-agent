import { NextResponse } from "next/server";
import client from "@/lib/openai";
import { RUBRIC_FOCUS } from "@/lib/prompts";
import { MODELS } from "@/lib/models";

type RubricRow = {
  criteria?: string;
  score?: string;
  remarks?: string;
};

type HumanAssignedRubric = {
  rows?: RubricRow[];
};

function formatRubricForPrompt(rubric: HumanAssignedRubric) {
  const rows = rubric.rows ?? [];

  return rows
    .filter(
      (row) =>
        row.criteria?.trim() || row.score?.trim() || row.remarks?.trim()
    )
    .map((row, index) => {
      return [
        `Row ${index + 1}:`,
        `Criteria: ${row.criteria?.trim() || "(blank)"}`,
        `Score: ${row.score?.trim() || "(blank)"}`,
        `Remarks: ${row.remarks?.trim() || "(blank)"}`,
      ].join("\n");
    })
    .join("\n\n");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const studentQuestion = body.studentQuestion as string | undefined;
    const humanAssignedRubric = body[
      "human-assigned-rubric"
    ] as HumanAssignedRubric | undefined;

    const hasValidQuestion = Boolean(studentQuestion?.trim());

    const rows = humanAssignedRubric?.rows ?? [];
    const hasRubricContent = rows.some(
      (row) =>
        row.criteria?.trim() || row.score?.trim() || row.remarks?.trim()
    );

    if (!hasValidQuestion || !hasRubricContent) {
      return NextResponse.json(
        {
          error:
            'studentQuestion and "human-assigned-rubric" with at least one filled row are required',
        },
        { status: 400 }
      );
    }

    const rubricText = formatRubricForPrompt(humanAssignedRubric!);

    const response = await client.chat.completions.create({
      model: MODELS.GEMINI_PRO_PREVIEW,
      messages: [
        {
          role: "system",
          content: `You are grading a student's rubric for a calculus question.

${RUBRIC_FOCUS}

Give short feedback in 2-4 sentences.
Focus on:
- whether the rubric checks for correct understanding of critical numbers
- whether it distinguishes common misconceptions
- whether it is specific enough to grade student work clearly`,
        },
        {
          role: "user",
          content: `Question:
${studentQuestion}

Human-assigned rubric:
${rubricText}`,
        },
      ],
      temperature: 0.2,
    });

    return NextResponse.json({
      feedback: response.choices[0]?.message?.content || "No feedback returned.",
    });
  } catch (error: any) {
    console.error("evaluate-rubric error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to evaluate rubric." },
      { status: error?.status || 500 }
    );
  }
}

// export async function POST(req: Request) {
//   try {
//     const { studentQuestion, rubric } = await req.json();

//     if (!studentQuestion?.trim() || !rubric?.trim()) {
//       return NextResponse.json(
//         { error: "studentQuestion and rubric are required" },
//         { status: 400 }
//       );
//     }

//     const response = await client.chat.completions.create({
//       model: MODELS.GEMINI_PRO_PREVIEW,
//       messages: [
//         {
//           role: "system",
//           content: `You are grading a student's rubric for a calculus question.

// ${RUBRIC_FOCUS}

// Give short feedback in 2-4 sentences.
// Focus on:
// - whether the rubric checks for correct understanding of critical numbers
// - whether it distinguishes common misconceptions
// - whether it is specific enough to grade student work clearly`,
//         },
//         {
//           role: "user",
//           content: `Question:
// ${studentQuestion}

// Rubric:
// ${rubric}`,
//         },
//       ],
//       temperature: 0.2,
//     });

//     return NextResponse.json({
//       feedback: response.choices[0]?.message?.content || "No feedback returned.",
//     });
//   } catch (error: any) {
//     console.error("evaluate-rubric error:", error);
//     return NextResponse.json(
//       { error: error?.message || "Failed to evaluate rubric." },
//       { status: error?.status || 500 }
//     );
//   }
// }