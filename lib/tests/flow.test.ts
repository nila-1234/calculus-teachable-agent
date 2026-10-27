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

// The database returns same-millisecond events in arbitrary order. Reproduce the
// worst case: each discussion step logged in the same instant as the grade /
// reading that caused it, and delivered BEFORE it.
test("same-millisecond ties delivered out of order keep reply-after-question", () => {
  const out = docs.map((d) => ({ ...d }));
  const isT = (d: LogDoc) => d.event === "grade_lines_placement_transition";
  const isG = (d: LogDoc) => d.event === "ai_exchange" && d.data?.route === "grade-lines-feedback";
  const isC = (d: LogDoc) => d.event === "ai_exchange" && d.data?.route === "placement-classify";
  for (let i = 0; i < out.length; i++) {
    // grade -> DROP transition, and classify -> REPLY transition: tie + swap.
    if ((isG(out[i]) || isC(out[i])) && out[i + 1] && isT(out[i + 1])) {
      out[i + 1].timestamp = out[i].timestamp;
      [out[i], out[i + 1]] = [out[i + 1], out[i]];
      i++;
    }
  }
  // The unchallenged acceptance also ties with (and precedes) its grade.
  const ui = out.findIndex((d) => d.event === "grade_lines_placement_unchallenged");
  const gi = out.findIndex((d, j) => j > 10 && isG(d));
  out[ui].timestamp = out[gi].timestamp;
  [out[ui], out[gi]] = [out[gi], out[ui]];

  const a = buildFlowSummary(out).participants[0].instruction.agentTasks.find(
    (x) => x.task === "Apply Rubric"
  )!;
  const lines = a.items[0].turns.map((x) => `${x.speaker}:${x.text}`);
  const idx = (re: RegExp) => lines.findIndex((l) => re.test(l));
  assert.ok(idx(/participant:Dragged .* step 3 — wrong/) === 0, lines.join("\n"));
  assert.ok(idx(/professor:Are you sure/) < idx(/participant:yeah step 3/), lines.join("\n"));
  assert.ok(idx(/participant:yeah step 3/) < idx(/professor:Why do you think/), lines.join("\n"));
  assert.ok(idx(/professor:Why do you think/) < idx(/participant:because it differentiates/));
  assert.ok(idx(/participant:because it differentiates/) < idx(/professor:Consider where/));
  assert.ok(idx(/professor:Take another look/) < idx(/participant:Dragged .* step 2 — correct/));
  assert.match(a.items[0].trigger, /questioned a drag onto the wrong step/);
});

test("exact transcript: AI line, then the participant's reply, even on ties", () => {
  const T = "2026-10-13T13:00:00.000Z";
  const base = docs.slice(0, -3).filter((d) => !String(d.event).startsWith("grade_lines_") && d.data?.route !== "grade-lines-feedback" && d.data?.route !== "placement-classify" && d.data?.route !== "placement-explain");
  const m = (role: string, text: string, ts: string, seq?: number) =>
    ({ ...ev("grade_lines_flow_message", "5", { kind: "placement", answer_id: "a1", criterion_id: "c1", role, text }), timestamp: ts, ...(seq ? { seq } : {}) }) as LogDoc;
  const tr = (from: object, event: object, ts: string, seq?: number) =>
    ({ ...ev("grade_lines_placement_transition", "5", { answer_id: "a1", criterion_id: "c1", from, event }), timestamp: ts, ...(seq ? { seq } : {}) }) as LogDoc;
  const g = { ...grade(2, 3, false), timestamp: T } as LogDoc;
  // Quick reply: the reply, the transition and the AI's next line share one
  // millisecond; delivered in reverse.
  const sure = { kind: "chat", node: "askSure", attempt: 1, correct: false, unclear: 0 };
  const tail = [
    m("professor", "Why do you think step 3 is the right place for it?", "2026-10-13T13:00:05.000Z"),
    tr(sure, { type: "REPLY", label: "yes" }, "2026-10-13T13:00:05.000Z"),
    m("user", "Yes, I'm sure", "2026-10-13T13:00:05.000Z"),
    m("professor", "Are you sure \"Finds the derivative\" belongs on step 3?", T),
    tr({ kind: "dragging", attempt: 1 }, { type: "DROP", correct: false }, T),
    g,
  ];
  const flow = buildFlowSummary([...base, ...tail, ...docs.slice(-3)]);
  const a = flow.participants[0].instruction.agentTasks.find((x) => x.task === "Apply Rubric")!;
  const lines = a.items[0].turns.map((x) => `${x.speaker}:${x.text}`);
  assert.deepEqual(lines, [
    'participant:Dragged "Finds the derivative" onto step 3 — wrong (it belongs on step 2).',
    'professor:Are you sure "Finds the derivative" belongs on step 3?',
    "participant:Yes, I'm sure",
    "professor:Why do you think step 3 is the right place for it?",
  ]);
});

// ---- LearnVia: every try, and per-lesson time from the event clock ----
test("lesson: each try with time and answer; passed-on-try; lesson times not double counted", async () => {
  const { getLesson } = await import("@/lib/lessons/definitions");
  const q1 = getLesson("lesson-1")!.sections.flatMap((s) => s.questions ?? [])[0];
  const wrong = q1.choices?.find((c) => !c.correct);
  const right = q1.choices?.find((c) => c.correct);
  const base = Date.UTC(2026, 9, 27, 14, 0, 0);
  const L = (event: string, scenario_id: string, sec: number, data: Record<string, unknown> = {}) =>
    ({ event, scenario_id, subject_id: "L1", session_id: "ls", timestamp: new Date(base + sec * 1000).toISOString(), data }) as LogDoc;
  const lessonDocs: LogDoc[] = [
    L("screening_completed", "screening", 0, { eligible: true, answers: {} }),
    L("survey_completed", "pre", 1, { answers: {} }),
    L("test_completed", "pretest", 2, { answers: {} }),
    L("condition_assigned", "instruction", 3, { condition: "lesson" }),
    L("lesson_started", "lesson-1", 10),
    L("lesson_item_attempted", "lesson-1", 130, { item_id: q1.id, response: wrong?.id ?? "x", is_correct: false, attempt: 1 }),
    L("lesson_hint_shown", "lesson-1", 140, { item_id: q1.id }),
    L("lesson_item_attempted", "lesson-1", 160, { item_id: q1.id, response: wrong?.id ?? "x", is_correct: false, attempt: 2 }),
    L("lesson_item_attempted", "lesson-1", 175, { item_id: q1.id, response: right?.id ?? "y", is_correct: true, attempt: 3 }),
    // Lesson 1 truly took 600 s (10 → 610).
    L("lesson_completed", "lesson-1", 610, { seconds: 600 }),
    L("lesson_started", "lesson-2", 620),
    // Lesson 2 took 300 s, but its own timer kept counting from Lesson 1 (900).
    L("lesson_completed", "lesson-2", 920, { seconds: 910 }),
    L("test_completed", "posttest", 1000, { answers: {} }),
    L("survey_completed", "post", 1100, { answers: {} }),
  ];
  const flow = buildFlowSummary(lessonDocs);
  assert.equal(flow.completers, 1);
  const instr = flow.participants[0].instruction;

  assert.deepEqual(
    instr.lessonTimes.map((t) => [t.lesson, t.seconds]),
    [["Lesson 1", 600], ["Lesson 2", 300]]
  );
  const total = flow.phases.find((p) => p.key === "lesson")!;
  assert.equal(total.medianMin, 15, "total = 600 + 300 s, not 600 + 910");

  const item = instr.lesson.find((i) => i.itemId === q1.id)!;
  assert.equal(item.number, 1);
  assert.equal(item.passedOnTry, 3);
  assert.equal(item.firstTryCorrect, false);
  assert.deepEqual(item.tries.map((t) => t.correct), [false, false, true]);
  assert.deepEqual(item.tries.map((t) => t.seconds), [120, 30, 15], "time per try");
  assert.deepEqual(item.tries.map((t) => t.hintsBefore), [0, 1, 1]);
  assert.ok(item.tries.every((t) => t.at), "every try has a timestamp");
  if (wrong?.label) assert.equal(item.tries[0].response, wrong.label, "answer shown as option text");
});

// ---- Instruction step time survives a tab switch ----
test("agent Question time keeps counting after a tab switch", () => {
  const out = docs.map((d) => ({ ...d }));
  const q0 = Date.parse(out.find((d) => d.event === "condition_assigned")!.timestamp!) + 1000;
  const at2 = (s: number) => new Date(q0 + s * 1000).toISOString();
  const steps: LogDoc[] = [
    { event: "step_entered", scenario_id: "5", subject_id: S, session_id: "s1", timestamp: at2(0), data: { path: "/5/question" } },
    // Old timer: stopped for good when the tab was backgrounded 10 s in.
    { event: "step_exited", scenario_id: "5", subject_id: S, session_id: "s1", timestamp: at2(10), data: { path: "/5/question", dwell_ms: 10000, reason: "tab_backgrounded" } },
    { event: "step_entered", scenario_id: "5", subject_id: S, session_id: "s1", timestamp: at2(300), data: { path: "/5/create-rubric" } },
    { event: "step_entered", scenario_id: "5", subject_id: S, session_id: "s1", timestamp: at2(420), data: { path: "/5/grade-lines" } },
  ] as LogDoc[];
  const flow = buildFlowSummary([...out, ...steps]);
  const parts = flow.participants[0].instruction.agentParts;
  assert.equal(parts.find((p) => p.part === "Question")?.seconds, 300, "not 10");
  assert.equal(parts.find((p) => p.part === "Create Rubric")?.seconds, 120);
});

// ---- Moves that are never graded now appear ----
test("dragging a criterion back to the bank shows in the transcript", () => {
  const extra = { ...ev("grade_lines_move", "5", { answer_id: "a1", criterion_id: "c1", action: "removed", from_step: 3, to_step: null }), timestamp: docs[docs.length - 4].timestamp } as LogDoc;
  const flow = buildFlowSummary([...docs.slice(0, -3), extra, ...docs.slice(-3)]);
  const a = flow.participants[0].instruction.agentTasks.find((x) => x.task === "Apply Rubric")!;
  const lines = a.items.flatMap((i) => i.turns.map((t) => t.text));
  assert.ok(lines.some((l) => /back to the criteria bank \(off step 3\)/.test(l)), lines.join("\n"));
});
