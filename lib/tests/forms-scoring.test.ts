import { test } from "node:test";
import assert from "node:assert/strict";
import { getFormTest, getPhaseTest, Q1A_ITEM, getTest } from "./definitions";
import { scoreTest } from "./score";
import { collectSubmissions, type LogDoc } from "./report";
import { buildAiCheck } from "./ai-check";
import { seededShuffle } from "./forms";
import { filterCohort, isCohort } from "./cohort";

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

test("the full-pilot cohort keeps every event of A/B participants and nobody else", () => {
  const ev = (subject_id: string, event: string) =>
    ({ event, subject_id, scenario_id: "x", timestamp: "2026-11-23T10:00:00Z", data: {} }) as LogDoc;
  const docs = [
    ev("OLD", "screening_completed"),
    ev("OLD", "test_completed"),
    ev("NEW", "step_entered"),
    ev("NEW", "form_assigned"),
    ev("NEW", "test_completed"),
  ];
  const kept = filterCohort(docs, "full-pilot");
  assert.deepEqual(kept.map((d) => `${d.subject_id}:${d.event}`), [
    "NEW:step_entered",
    "NEW:form_assigned",
    "NEW:test_completed",
  ]);
  assert.ok(isCohort("full-pilot"));
  assert.ok(!isCohort("everyone"));
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
