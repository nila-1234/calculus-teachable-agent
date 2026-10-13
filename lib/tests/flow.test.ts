import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFlowSummary } from "./flow";
import type { LogDoc } from "./report";

// One synthetic agent participant who completes every step, so the analysis
// keeps them, with an Apply-Rubric discussion that exercises the flow:
// wrong drag -> "Are you sure?" -> typed "yes" -> "Why?" -> typed reason ->
// hint -> "consider" reply -> look again -> correct drag (challenged? no: the
// professor double-checks only when this event says so).
let t = 0;
const at = () => new Date(Date.UTC(2026, 9, 13, 12, 0, t++)).toISOString();
const S = "subj-1";
const ev = (event: string, scenario_id: string, data: Record<string, unknown> = {}): LogDoc =>
  ({ event, scenario_id, subject_id: S, session_id: "s1", timestamp: at(), data }) as LogDoc;

const grade = (stepIndex: number, placedStep: number, stepCorrect: boolean, status: "pass" | "fail" | null = null) =>
  ev("ai_exchange", "5", {
    route: "grade-lines-feedback",
    request: {
      answerId: "a1",
      answerTitle: "Answer A",
      rubric: [{ criterionId: "c1", criterion: "Finds the derivative" }],
      placements: { c1: { criterionId: "c1", stepIndex, status } },
    },
    response: {
      feedback: [
        {
          criterionId: "c1",
          criterion: "Finds the derivative",
          placedStep,
          expectedStep: 2,
          stepCorrect,
          status,
          expectedStatus: "pass",
          statusCorrect: status === "pass",
          correct: stepCorrect,
          feedback: "",
        },
      ],
    },
  });

const docs: LogDoc[] = [
  ev("screening_completed", "screening", { eligible: true, answers: {} }),
  ev("survey_completed", "pre", { answers: {} }),
  ev("test_completed", "pretest", { answers: {} }),
  ev("condition_assigned", "instruction", { condition: "agent" }),
  // Question task: wrong, then right.
  ev("ai_exchange", "5", {
    route: "question-feedback",
    request: { responses: [{ partId: "p1", partLabel: "Part 1: the model", selectedChoiceText: "R = p + q", selectedChoiceCorrect: false, explanation: "I added them" }] },
    response: { feedbackByPart: { p1: "Revenue multiplies price by quantity." } },
  }),
  ev("ai_exchange", "5", {
    route: "question-feedback",
    request: { responses: [{ partId: "p1", partLabel: "Part 1: the model", selectedChoiceText: "R = p * q", selectedChoiceCorrect: true, explanation: "price times quantity" }] },
    response: { feedbackByPart: { p1: "Right." } },
  }),
  // Create Rubric: imperfect then perfect.
  ev("rubric_decision", "5", { criterion_id: "r1", criterion_label: "Uses derivative", decision: "include" }),
  ev("rubric_decision", "5", { criterion_id: "r2", criterion_label: "Neat handwriting", decision: "include" }),
  ev("rubric_submitted", "5", { decisions: { r1: "include", r2: "include" }, wrongly_included: ["r2"], missed_essential: [], is_perfect: false }),
  ev("rubric_submitted", "5", { decisions: { r1: "include", r2: "exclude" }, wrongly_included: [], missed_essential: [], is_perfect: true }),
  // Apply Rubric: wrong drag onto step 3.
  ev("grade_lines_criterion_graded", "5", { answer_id: "a1", criterion_id: "c1", phase: "placement" }),
  grade(2, 3, false),
  ev("grade_lines_placement_transition", "5", { answer_id: "a1", criterion_id: "c1", from: { kind: "dragging", attempt: 1 }, event: { type: "DROP", correct: false } }),
  // Typed reply to "Are you sure?" — classified.
  ev("ai_exchange", "5", { route: "placement-classify", request: { question: "Are you sure?", reply: "yeah step 3 has the derivative" }, response: { label: "yes" } }),
  ev("grade_lines_placement_transition", "5", { answer_id: "a1", criterion_id: "c1", from: { kind: "chat", node: "askSure", attempt: 1, correct: false, unclear: 0 }, event: { type: "REPLY", label: "yes" } }),
  // Reply to "Why?" — only visible via the explain call that follows.
  ev("grade_lines_placement_transition", "5", { answer_id: "a1", criterion_id: "c1", from: { kind: "chat", node: "askWhy", attempt: 1, correct: false, unclear: 0 }, event: { type: "REPLY", label: null } }),
  ev("ai_exchange", "5", { route: "placement-explain", request: { slot: "hint", speaker: "professor", taMessage: "because it differentiates there" }, response: { text: "Consider where the derivative is first computed." } }),
  // Reply to "Consider" — never reaches an AI call in old runs.
  ev("grade_lines_placement_transition", "5", { answer_id: "a1", criterion_id: "c1", from: { kind: "chat", node: "consider", attempt: 1, correct: false, unclear: 0 }, event: { type: "REPLY", label: null } }),
  // Re-drag onto the right step, accepted unchallenged.
  ev("grade_lines_criterion_graded", "5", { answer_id: "a1", criterion_id: "c1", phase: "placement" }),
  grade(1, 2, true),
  ev("grade_lines_placement_unchallenged", "5", { answer_id: "a1", criterion_id: "c1", attempt: 2 }),
  ev("grade_lines_completed", "5"),
  ev("test_completed", "posttest", { answers: {} }),
  ev("survey_completed", "post", { answers: {} }),
];

test("agent participant: every task shows how they responded", () => {
  const flow = buildFlowSummary(docs);
  assert.equal(flow.completers, 1);
  const instr = flow.participants[0].instruction;
  const byTask = Object.fromEntries(instr.agentTasks.map((t) => [t.task, t]));

  // Question: both attempts, with choice, explanation and AI feedback.
  const q = byTask["Question"];
  assert.ok(q, "Question task present");
  assert.match(q.summary, /0\/1 parts correct on the first try/);
  const qTexts = q.items[0].turns.map((x) => x.text).join(" | ");
  assert.match(qTexts, /chose "R = p \+ q" — wrong/);
  assert.match(qTexts, /Explanation: I added them/);
  assert.match(qTexts, /Revenue multiplies price by quantity/);
  assert.match(q.items[0].outcome, /Correct on attempt 2/);

  // Create Rubric: names, not ids.
  const r = byTask["Create Rubric"];
  assert.match(r.summary, /Perfect on submission 2 of 2/);
  assert.match(r.items[0].outcome, /Wrongly included: Neat handwriting/);

  // Apply Rubric: the participant's moves and replies, in order.
  const a = byTask["Apply Rubric"];
  const turns = a.items[0].turns;
  const lines = turns.map((x) => `${x.speaker}:${x.text}`);
  console.log(lines.join("\n"));
  assert.match(a.items[0].trigger, /questioned a drag onto the wrong step/);
  assert.match(lines[0], /participant:Dragged "Finds the derivative" onto step 3 — wrong \(it belongs on step 2\)/);
  assert.ok(lines.some((l) => /professor:Are you sure "Finds the derivative" belongs on step 3\?/.test(l)));
  assert.ok(lines.includes("participant:yeah step 3 has the derivative"));
  assert.ok(lines.some((l) => /professor:Why do you think step 3/.test(l)));
  assert.ok(lines.includes("participant:because it differentiates there"), "reply recovered from explain call");
  assert.ok(lines.includes("professor:Consider where the derivative is first computed."));
  assert.ok(lines.some((l) => /participant:\(typed a reply .* not saved/.test(l)), "unsaved reply flagged, not invented");
  assert.ok(lines.some((l) => /professor:Take another look/.test(l)));
  assert.ok(lines.some((l) => /participant:Dragged .* onto step 2 — correct/.test(l)));
  assert.match(a.items[0].outcome, /Accepted/);
  assert.equal(instr.agentExactTranscript, false);

  // Score: first-try (wrong) placement.
  const part = instr.agentParts.find((p) => p.part === "Apply Rubric");
  assert.match(part!.scoreLabel, /0\/1 placed on the right step/);
});

test("newer runs use the exact logged transcript", () => {
  const extra = [
    ev("grade_lines_flow_message", "5", { kind: "placement", answer_id: "a1", criterion_id: "c1", role: "professor", text: "Are you sure?" }),
    ev("grade_lines_flow_message", "5", { kind: "placement", answer_id: "a1", criterion_id: "c1", role: "user", text: "Exactly what I typed" }),
  ];
  const flow = buildFlowSummary([...docs.slice(0, -3), ...extra, ...docs.slice(-3)]);
  const instr = flow.participants[0].instruction;
  assert.equal(instr.agentExactTranscript, true);
  const a = instr.agentTasks.find((x) => x.task === "Apply Rubric")!;
  const lines = a.items[0].turns.map((x) => `${x.speaker}:${x.text}`);
  assert.ok(lines.includes("participant:Exactly what I typed"));
  assert.ok(!lines.some((l) => /not saved/.test(l)));
});
