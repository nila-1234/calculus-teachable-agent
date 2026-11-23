import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FeedbackEvent,
  FeedbackFlow,
  FeedbackTransition,
  INITIAL_FEEDBACK_FLOW,
  transitionFeedback,
} from "./feedback-flow";
import { FeedbackAction, getTemplatedFeedback } from "./feedback-templates";

// rand 0 is always sampled; rand 0.99 never is.
const act = (action: FeedbackAction, correct: boolean, rand = 0): FeedbackEvent => ({
  type: "ACT",
  action,
  correct,
  rand,
});
const explain = (sufficient: boolean): FeedbackEvent => ({ type: "EXPLAIN", sufficient });

function run(events: FeedbackEvent[], start: FeedbackFlow = INITIAL_FEEDBACK_FLOW) {
  let result: FeedbackTransition = { next: start, effects: [] };
  for (const event of events) result = transitionFeedback(result.next, event);
  return result;
}

const ACTIONS: [FeedbackAction, string][] = [
  ["placement", "1"],
  ["pass", "2"],
  ["fail", "3"],
];

test("a: a sampled correct 1st attempt is probed, then moves on either way", () => {
  for (const [action, n] of ACTIONS) {
    const probed = run([act(action, true)]);
    assert.equal(probed.next.kind, "chat");
    assert.deepEqual(probed.effects, [{ type: "say", scenario: `${n}a`, feedback: "probe" }]);

    for (const sufficient of [true, false]) {
      const { next, effects } = run([act(action, true), explain(sufficient)]);
      assert.deepEqual(next, { kind: "resolved", how: "discussed", attempt: 1 });
      assert.deepEqual(effects, [
        { type: "say", scenario: `${n}a`, feedback: sufficient ? "sufficient" : "insufficient" },
      ]);
    }
  }
});

test("a: sampling rates are 10% for placement and PASS, 50% for FAIL", () => {
  const probed = (action: FeedbackAction, rand: number) =>
    run([act(action, true, rand)]).next.kind === "chat";
  assert.equal(probed("placement", 0.09), true);
  assert.equal(probed("placement", 0.1), false);
  assert.equal(probed("pass", 0.09), true);
  assert.equal(probed("pass", 0.1), false);
  assert.equal(probed("fail", 0.49), true);
  assert.equal(probed("fail", 0.5), false);
});

test("a: an unsampled correct 1st attempt moves on with no feedback", () => {
  const { next, effects } = run([act("placement", true, 0.99)]);
  assert.deepEqual(next, { kind: "resolved", how: "unprobed", attempt: 1 });
  assert.deepEqual(effects, []);
});

test("b: a wrong 1st attempt is always probed, then tried again either way", () => {
  for (const [action, n] of ACTIONS) {
    const probed = run([act(action, false, 0.99)]);
    assert.equal(probed.next.kind, "chat");
    assert.deepEqual(probed.effects, [{ type: "say", scenario: `${n}b`, feedback: "probe" }]);

    for (const sufficient of [true, false]) {
      const { next, effects } = run([act(action, false), explain(sufficient)]);
      assert.deepEqual(next, { kind: "dragging", attempt: 2 });
      assert.deepEqual(effects, [
        { type: "say", scenario: `${n}b`, feedback: sufficient ? "sufficient" : "insufficient" },
      ]);
    }
  }
});

test("correct on the 2nd attempt moves on with no feedback", () => {
  const { next, effects } = run([act("pass", false), explain(true), act("fail", true)]);
  assert.deepEqual(next, { kind: "resolved", how: "unprobed", attempt: 2 });
  assert.deepEqual(effects, []);
});

test("c: wrong on the 2nd attempt skips the probe, reveals, and stays open", () => {
  for (const [action, n] of ACTIONS) {
    const { next, effects } = run([act(action, false), explain(false), act(action, false)]);
    assert.deepEqual(next, { kind: "dragging", attempt: 3 });
    assert.deepEqual(effects, [{ type: "say", scenario: `${n}c`, feedback: "insufficient_2nd" }]);
  }
});

test("c repeats on every further wrong attempt until the TA gets it right", () => {
  const wrong = [act("placement", false), explain(false), act("placement", false)];
  const again = run([...wrong, act("placement", false)]);
  assert.deepEqual(again.next, { kind: "dragging", attempt: 4 });
  assert.deepEqual(again.effects, [{ type: "say", scenario: "1c", feedback: "insufficient_2nd" }]);

  const fixed = run([...wrong, act("placement", true)]);
  assert.deepEqual(fixed.next, { kind: "resolved", how: "unprobed", attempt: 3 });
  assert.deepEqual(fixed.effects, []);
});

test("events that don't apply are ignored", () => {
  const chat = run([act("placement", false)]).next;
  assert.deepEqual(transitionFeedback(chat, act("placement", true)), { next: chat, effects: [] });
  assert.deepEqual(transitionFeedback(INITIAL_FEEDBACK_FLOW, explain(true)), {
    next: INITIAL_FEEDBACK_FLOW,
    effects: [],
  });
  const done = run([act("placement", true, 0.99)]).next;
  assert.deepEqual(transitionFeedback(done, act("placement", false)), { next: done, effects: [] });
});

test("speakers: probe and sufficient are Prof for placement / PASS, the student for FAIL", () => {
  const ctx = { placedStep: 2, expectedStep: 2, studentName: "Bea" };
  const speaker = (scenario: "1a" | "2b" | "3a" | "3b" | "3c", type: "probe" | "sufficient" | "insufficient" | "insufficient_2nd") =>
    getTemplatedFeedback(scenario, type, "derivative", ctx).speaker;
  assert.equal(speaker("1a", "probe"), "professor");
  assert.equal(speaker("2b", "sufficient"), "professor");
  assert.equal(speaker("3a", "probe"), "student");
  assert.equal(speaker("3b", "sufficient"), "student");
  assert.equal(speaker("3b", "insufficient"), "professor");
  assert.equal(speaker("3c", "insufficient_2nd"), "professor");
});

test("templates use the answer's own student name instead of Alex", () => {
  const fb = getTemplatedFeedback("3c", "insufficient_2nd", "derivative", {
    placedStep: 2,
    expectedStep: 2,
    studentName: "Bea",
  });
  assert.match(fb.text, /Bea's step 2/);
  assert.doesNotMatch(fb.text, /Alex/);
});

test("scenario 5 probes are filled by code; other scenarios leave [criterion] to the LLM", () => {
  const ctx = { placedStep: 3, expectedStep: 3 };
  const known = getTemplatedFeedback("1b", "probe", "critical-value", ctx);
  assert.equal(known.complete, true);
  assert.equal(
    known.text,
    "What about step 3 makes you think this is where the student finds the critical value?"
  );

  const other = getTemplatedFeedback("1b", "probe", "solves-critical-price", ctx);
  assert.equal(other.complete, false);
  assert.deepEqual(other.llmPlaceholders, ["criterion"]);
  assert.equal(other.example, null);
});
