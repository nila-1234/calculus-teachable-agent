import { test } from "node:test";
import assert from "node:assert/strict";
import { getFormTest, getPhaseTest, Q1A_ITEM, getTest } from "./definitions";
import { scoreTest } from "./score";
import { collectSubmissions, type LogDoc } from "./report";
import { buildAiCheck } from "./ai-check";
import { seededShuffle } from "./forms";
import {
  cohortSubjects,
  dropTestRuns,
  filterCohort,
  filterTeamTests,
  isCohort,
  isTeamTestRun,
} from "./cohort";
import { fullFlowSubjects } from "./export";
import { splitScreeningQ1a } from "./screening-q1a";
import { buildPairReport, type GradedSubmission } from "./report";
import type { GradeResult } from "./grade";
import { buildScreeningOutcomes } from "./screening-outcomes";
import { SKILL_CHECK_ANSWERS } from "@/lib/surveys/eligibility";

const ids = (t: ReturnType<typeof getFormTest>) =>
  t.sections.flatMap((s) => s.items.map((i) => i.id));

test("each version has Q1a, Q1b–Q1f, Question 2 and Question 3", () => {
  for (const form of ["A", "B"] as const) {
    assert.deepEqual(ids(getFormTest(form)), [
      "1", "1b", "1c", "1d", "1e", "1f", "2.1", "2.2", "2.3", "2.4", "3.1", "3.2",
    ]);
  }
  // Version A's content is the original pre-test, B's the original post-test.
  assert.equal(Q1A_ITEM.A.prompt, getTest("pretest")!.sections[0].items[0].prompt);
  assert.equal(Q1A_ITEM.B.prompt, getTest("posttest")!.sections[0].items[0].prompt);
});

test("the test taken in a phase leaves out Q1a and shuffles Q1b–Q1f", () => {
  for (const testId of ["pretest", "posttest"] as const) {
    const t = getPhaseTest(testId, "B");
    assert.equal(t.id, testId);
    assert.deepEqual(t.sections[0].items.map((i) => i.id), ["1b", "1c", "1d", "1e", "1f"]);
    assert.equal(t.sections[0].shuffle, true);
    assert.ok(t.sections[0].items.every((i) => i.kind === "short-answer"));
  }
});

test("LearnVia originals are word for word (two per version)", () => {
  const prompt = (form: "A" | "B", id: string) =>
    getFormTest(form).sections[0].items.find((i) => i.id === id)!.prompt;
  assert.match(prompt("A", "1b"), /^A particle moves along a straight line at varying speed in both directions\./);
  assert.match(prompt("A", "1c"), /^A manufacturer builds widgets at a cost of \$5 each\./);
  assert.match(prompt("B", "1e"), /^A rectangular garden with perimeter 36 feet has maximum possible area/);
  assert.match(prompt("B", "1f"), /perimeter 70 inches/);
});

const right: Record<"A" | "B", Record<string, string>> = {
  A: { "1b": "324 cm", "1c": "x = 45", "1d": "400", "1e": "96 ft^2", "1f": "A(x) = 25x - x^2" },
  B: { "1b": "16", "1c": "$25", "1d": "1800 m²", "1e": "81", "1f": "x(35 - x)" },
};

test("Q1b–Q1f are scored against the participant's version", () => {
  for (const form of ["A", "B"] as const) {
    const answers = Object.fromEntries(
      Object.entries(right[form]).map(([id, text]) => [id, { text }])
    );
    const s = scoreTest("pretest", answers, { form, items: Object.keys(right[form]) });
    assert.deepEqual(
      s.items.map((i) => [i.itemId, i.points]),
      ["1b", "1c", "1d", "1e", "1f"].map((id) => [id, 1]),
      form
    );
    // The other version's answers are wrong here.
    const other = form === "A" ? "B" : "A";
    const swapped = Object.fromEntries(
      Object.entries(right[other]).map(([id, text]) => [id, { text }])
    );
    const s2 = scoreTest("pretest", swapped, { form, items: Object.keys(right[form]) });
    assert.equal(s2.items.filter((i) => i.points === 1).length, 0, `${other} answers on ${form}`);
  }
});

test("without a version, scoring is the original fixed test (pilot, older data)", () => {
  const s = scoreTest("pretest", { "1": { text: "x" } });
  assert.ok(!s.items.some((i) => i.itemId === "1b"));
  assert.equal(s.totalMaxPoints, 22);
});

test("the screening Q1a becomes the pre-test's Q1a; the post-test has none", () => {
  const ev = (event: string, scenario_id: string, data: Record<string, unknown>, ts: string) =>
    ({ event, scenario_id, subject_id: "S", timestamp: ts, data }) as LogDoc;
  const subs = collectSubmissions([
    ev("screening_completed", "screening", { answers: { q1a: "2x + y = 80 …" }, pretest_form: "B" }, "2026-11-23T10:00:00Z"),
    ev("test_completed", "pretest", { answers: { "1b": { text: "16" } }, form: "B", version: 2, items: ["1b"] }, "2026-11-23T10:10:00Z"),
    ev("test_completed", "posttest", { answers: { "1b": { text: "324" } }, form: "A", version: 2, items: ["1b"] }, "2026-11-23T11:00:00Z"),
  ]);
  const pre = subs.find((s) => s.testId === "pretest")!;
  const post = subs.find((s) => s.testId === "posttest")!;
  assert.equal(pre.form, "B");
  assert.deepEqual(pre.items, ["1", "1b"]);
  assert.equal(pre.answers["1"]?.text, "2x + y = 80 …");
  assert.equal(post.form, "A");
  assert.equal(post.answers["1"], undefined);
});

test("AI-use check flags, following the keystroke-tracker rules", () => {
  const log = (qid: string, data: Record<string, unknown>) =>
    ({ event: "keystroke_log", scenario_id: "pretest", subject_id: "S", timestamp: "2026-11-23T10:00:00Z", data: { qid, ...data } }) as LogDoc;
  const check = buildAiCheck([
    log("pretest:2.2", { keypresses: 120, pastes: 0, text: "x".repeat(100) }),
    log("pretest:3.2", { keypresses: 3, pastes: 1, pasted_chars: 200, text: "y".repeat(200) }),
    log("pretest:1f", { keypresses: 4, keypad_chars: 4, pastes: 0, text: "x^2+" }),
    log("pretest:1b", { keypresses: 40, pastes: 2, text: "324" }),
  ]);
  const flagged = Object.fromEntries(check.flagged.map((a) => [a.qid, [a.flagPaste, a.flagTooShort]]));
  assert.deepEqual(flagged, {
    "pretest:3.2": [false, true], // one paste, but far more characters than keys
    "pretest:1b": [true, false], // more than one paste
  });
  assert.equal(check.people[0].nWithPastes, 1);
  assert.equal(check.people[0].nTooShort, 1);
  assert.equal(check.people[0].flagged, true);
});

test("the study cohort is everyone screened since the start, with all their events", () => {
  const ev = (subject_id: string, event: string, timestamp: string) =>
    ({ event, subject_id, scenario_id: "x", timestamp, data: {} }) as LogDoc;
  const start = "2026-12-01T00:00:00.000Z";
  const docs = [
    // Earlier A/B pilot participant: screened before the start.
    ev("OLD", "form_assigned", "2026-11-20T10:00:00.000Z"),
    ev("OLD", "test_completed", "2026-12-02T10:00:00.000Z"),
    // New recruit: their welcome-page view a moment before screening still counts.
    ev("NEW", "step_entered", "2026-12-02T09:59:59.000Z"),
    ev("NEW", "form_assigned", "2026-12-02T10:00:00.000Z"),
    ev("NEW", "test_completed", "2026-12-02T10:30:00.000Z"),
    // Never screened at all.
    ev("NOSCREEN", "step_entered", "2026-12-02T10:00:00.000Z"),
  ];
  assert.deepEqual([...cohortSubjects(docs, start)], ["NEW"]);
  assert.deepEqual(
    filterCohort(docs, start).map((d) => `${d.subject_id}:${d.event}`),
    ["NEW:step_entered", "NEW:form_assigned", "NEW:test_completed"]
  );
  assert.ok(isCohort("study"));
  assert.ok(!isCohort("full-pilot"));
});

test("the team's test- runs are hidden unless asked for; real ids are not caught", () => {
  assert.ok(isTeamTestRun("test-corina-1"));
  assert.ok(isTeamTestRun("TEST-2"));
  assert.ok(!isTeamTestRun("5f1a2b3c4d5e6f7a8b9c0d1e"));
  assert.ok(!isTeamTestRun("anon-test1234"));
  assert.ok(!isTeamTestRun("claude-test-1"));
  const ev = (subject_id: string) =>
    ({ event: "form_assigned", subject_id, scenario_id: "screening", timestamp: "t", data: {} }) as LogDoc;
  const docs = [ev("test-corina-1"), ev("5f1a2b3c4d5e6f7a8b9c0d1e")];
  assert.deepEqual(filterTeamTests(docs, false).map((d) => d.subject_id), ["5f1a2b3c4d5e6f7a8b9c0d1e"]);
  assert.equal(filterTeamTests(docs, true).length, 2);
});

test("only a run that finished every step counts as finished (and so gets graded)", () => {
  const ev = (subject_id: string, event: string, scenario_id: string, data: Record<string, unknown> = {}) =>
    ({ event, subject_id, scenario_id, timestamp: "2026-12-02T10:00:00.000Z", data }) as LogDoc;
  const run = (id: string, arm: string) => [
    ev(id, "screening_completed", "screening"),
    ev(id, "survey_completed", "pre"),
    ev(id, "test_completed", "pretest"),
    ev(id, "condition_assigned", "instruction", { condition: arm }),
    ev(id, arm === "lesson" ? "lesson_completed" : "grade_lines_completed", "x"),
    ev(id, "test_completed", "posttest"),
    ev(id, "survey_completed", "post"),
  ];
  const docs = [
    ...run("DONE-LESSON", "lesson"),
    ...run("DONE-AGENT", "agent"),
    // Stopped after the pre-test.
    ...run("STOPPED", "agent").slice(0, 3),
  ];
  assert.deepEqual([...fullFlowSubjects(docs)].sort(), ["DONE-AGENT", "DONE-LESSON"]);
});

test("Claude's test runs are dropped; real participants are kept", () => {
  const ev = (subject_id: string) =>
    ({ event: "form_assigned", subject_id, scenario_id: "screening", timestamp: "t", data: {} }) as LogDoc;
  const kept = dropTestRuns([ev("claude-test-1"), ev("Claude-Test-2"), ev("5f1a2b3c4d5e6f7a8b9c0d1e")]);
  assert.deepEqual(kept.map((d) => d.subject_id), ["5f1a2b3c4d5e6f7a8b9c0d1e"]);
});

test("screening outcomes: who was screened out and why, plus non-finishers", () => {
  const ev = (subject_id: string, event: string, data: Record<string, unknown>, ts: string) =>
    ({ event, subject_id, scenario_id: "screening", timestamp: ts, data }) as LogDoc;
  const ok = { "highest-math": "Calculus I", "calculus-courses": "1", algebra_check: SKILL_CHECK_ANSWERS.algebra_check, power_rule_check: SKILL_CHECK_ANSWERS.power_rule_check, q1a: "x = 20" };
  const s = buildScreeningOutcomes([
    ev("E", "screening_completed", { answers: ok, eligible: true, failed_items: [], reasons: [] }, "2026-11-23T10:00:00Z"),
    ev("E", "consent_given", {}, "2026-11-23T10:01:00Z"),
    ev("H", "screening_completed", { answers: { ...ok, "highest-math": "Calculus II" }, eligible: false, failed_items: ["highest-math"], reasons: ["Calculus II"] }, "2026-11-23T10:02:00Z"),
    ev("L", "screening_completed", { answers: { ...ok, algebra_check: "wrong" }, eligible: false, failed_items: ["algebra_check", "q1a"], reasons: ["algebra_check: incorrect", "q1a: 300 characters pasted in (possible AI use)"] }, "2026-11-23T10:03:00Z"),
    ev("L", "screening_completed", { answers: ok, eligible: true, failed_items: [], reasons: [] }, "2026-11-23T10:04:00Z"),
    ev("N", "form_assigned", { pretest_form: "A" }, "2026-11-23T10:05:00Z"),
  ]);
  assert.deepEqual(
    [s.started, s.finished, s.eligible, s.screenedOut, s.notFinished],
    [4, 3, 2, 1, 1]
  );
  const by = Object.fromEntries(s.people.map((p) => [p.subjectId, p]));
  assert.equal(by.E.furthest, "Consented");
  assert.deepEqual(by.H.groups, ["high"]);
  assert.equal(s.byReason.find((r) => r.item === "highest-math")!.n, 1);
  // L retried and passed: the latest attempt decides, and the retry is visible.
  assert.equal(by.L.outcome, "eligible");
  assert.equal(by.L.attempts, 2);
  assert.equal(by.N.outcome, "not-finished");
  assert.equal(by.N.pretestForm, "A");
});

test("the Q1 shuffle is a stable permutation per participant", () => {
  const items = ["1b", "1c", "1d", "1e", "1f"];
  const a = seededShuffle(items, "P1:pretest:q1");
  assert.deepEqual([...a].sort(), items);
  assert.deepEqual(seededShuffle(items, "P1:pretest:q1"), a);
  const orders = new Set(
    Array.from({ length: 30 }, (_, i) => seededShuffle(items, `P${i}:pretest:q1`).join(","))
  );
  assert.ok(orders.size > 5, "different participants see different orders");
});

test("screening Q1a is taken out of the A/B pre-test, so pre and post are out of the same points", () => {
  const item = (itemId: string, points: number, maxPoints: number, kind = "value") =>
    ({ itemId, kind, points, maxPoints, needsGrading: false }) as unknown as GradeResult["items"][number];
  const result = (testId: "pretest" | "posttest", items: GradeResult["items"]): GradeResult => ({
    testId,
    items,
    openItems: items
      .filter((i) => i.itemId === "1")
      .map((i) => ({ itemId: "1", points: i.points ?? 0, maxPoints: i.maxPoints, criteria: [{ id: "model", verdict: "met", comment: "" }], needsReview: false })),
    autoPoints: 0,
    autoMaxPoints: 0,
    totalPoints: items.reduce((s, i) => s + (i.points ?? 0), 0),
    totalMaxPoints: items.reduce((s, i) => s + i.maxPoints, 0),
    complete: true,
    ungraded: [],
    needsReview: [],
    gradingError: null,
    gradedBy: "test",
  });
  const graded: GradedSubmission[] = [
    {
      submission: { subjectId: "S", testId: "pretest", submittedAt: "t", form: "B", items: ["1", "1b"], answers: { "1": { text: "work" }, "1b": { text: "16" } } },
      result: result("pretest", [item("1", 4, 5, "open"), item("1b", 1, 1)]),
    },
    {
      submission: { subjectId: "S", testId: "posttest", submittedAt: "t", form: "A", items: ["1b"], answers: { "1b": { text: "324" } } },
      result: result("posttest", [item("1b", 0, 1)]),
    },
    // Legacy fixed tests (no version) asked Q1a in both tests: left alone.
    {
      submission: { subjectId: "OLD", testId: "pretest", submittedAt: "t", answers: { "1": { text: "x" } } },
      result: result("pretest", [item("1", 3, 5, "open")]),
    },
  ];

  const { comparable, screeningQ1a } = splitScreeningQ1a(graded);
  const pre = comparable[0];
  assert.equal(pre.result.totalPoints, 1);
  assert.equal(pre.result.totalMaxPoints, 1);
  assert.ok(!pre.result.items.some((i) => i.itemId === "1"));
  assert.ok(!("1" in pre.submission.answers));
  assert.deepEqual(pre.submission.items, ["1b"]);
  assert.equal(comparable[2].result.totalMaxPoints, 5, "legacy pre-test keeps its Q1a");

  assert.equal(screeningQ1a.length, 1);
  assert.deepEqual(
    { s: screeningQ1a[0].subjectId, p: screeningQ1a[0].points, m: screeningQ1a[0].maxPoints, a: screeningQ1a[0].answer, f: screeningQ1a[0].form },
    { s: "S", p: 4, m: 5, a: "work", f: "B" }
  );

  const pair = buildPairReport(comparable).rows.find((r) => r.subject_id === "S");
  assert.equal(pair?.max_points, 1);
  assert.equal(pair?.gain, -1);
});
