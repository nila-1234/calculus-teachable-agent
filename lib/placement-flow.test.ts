import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INITIAL_PLACEMENT_FLOW,
  MAX_PLACEMENT_ATTEMPTS,
  PlacementEvent,
  PlacementFlow,
  PlacementTransition,
  transitionPlacement,
} from "./placement-flow";

const drop = (correct: boolean): PlacementEvent => ({ type: "DROP", correct });
const reply = (label: "yes" | "no" | "unclear" | null = null): PlacementEvent => ({
  type: "REPLY",
  label,
});

// Runs events in order, returning the last transition.
function run(events: PlacementEvent[], start: PlacementFlow = INITIAL_PLACEMENT_FLOW) {
  let result: PlacementTransition = { next: start, effects: [] };
  for (const event of events) result = transitionPlacement(result.next, event);
  return result;
}

test("drop asks 'are you sure' whether or not it was correct", () => {
  for (const correct of [true, false]) {
    const { next, effects } = run([drop(correct)]);
    assert.equal(next.kind, "chat");
    assert.deepEqual(effects, [{ type: "say", line: "askSure" }]);
  }
});

test("correct + yes -> accepted with affirmation, no 'why'", () => {
  const { next, effects } = run([drop(true), reply("yes")]);
  assert.deepEqual(next, { kind: "resolved", how: "accepted", attempt: 1 });
  assert.deepEqual(effects, [{ type: "explain", slot: "affirm" }]);
});

test("correct + no -> asks what they're unsure about, then unlocks", () => {
  const asked = run([drop(true), reply("no")]);
  assert.deepEqual(asked.effects, [{ type: "say", line: "askUnsureCorrect" }]);
  const { next } = transitionPlacement(asked.next, reply());
  assert.deepEqual(next, { kind: "dragging", attempt: 2 });
});

test("incorrect + no -> asks what's wrong, then unlocks", () => {
  const asked = run([drop(false), reply("no")]);
  assert.deepEqual(asked.effects, [{ type: "say", line: "askUnsureIncorrect" }]);
  assert.deepEqual(transitionPlacement(asked.next, reply()).next, {
    kind: "dragging",
    attempt: 2,
  });
});

test("incorrect + yes -> why -> hint -> unlocks", () => {
  const hinted = run([drop(false), reply("yes"), reply()]);
  assert.deepEqual(hinted.effects, [{ type: "explain", slot: "hint" }]);
  assert.equal(hinted.next.kind === "chat" && hinted.next.node, "consider");
  assert.deepEqual(transitionPlacement(hinted.next, reply()).next, {
    kind: "dragging",
    attempt: 2,
  });
});

test("last attempt tells the step and unlocks, on every non-accept path", () => {
  const paths: PlacementEvent[][] = [
    [drop(true), reply("no"), reply()],
    [drop(false), reply("no"), reply()],
    [drop(false), reply("yes"), reply(), reply()],
  ];
  const lastAttempt: PlacementFlow = { kind: "dragging", attempt: MAX_PLACEMENT_ATTEMPTS };
  for (const events of paths) {
    const { next, effects } = run(events, lastAttempt);
    assert.deepEqual(next, {
      kind: "dragging",
      attempt: MAX_PLACEMENT_ATTEMPTS + 1,
      revealed: true,
    });
    assert.deepEqual(effects, [{ type: "explain", slot: "reveal" }]);
  }
});

test("after the reveal, the TA must drop it on the right step themselves", () => {
  const revealed: PlacementFlow = { kind: "dragging", attempt: 3, revealed: true };
  const wrong = transitionPlacement(revealed, drop(false));
  assert.deepEqual(wrong, {
    next: revealed,
    effects: [{ type: "say", line: "revealedWrongStep" }],
  });
  const right = transitionPlacement(revealed, drop(true));
  assert.deepEqual(right.next, { kind: "resolved", how: "revealed", attempt: 3 });
});

test("correct + yes is still accepted on the last attempt", () => {
  const { next } = run([drop(true), reply("yes")], {
    kind: "dragging",
    attempt: MAX_PLACEMENT_ATTEMPTS,
  });
  assert.equal(next.kind === "resolved" && next.how, "accepted");
});

test("attempts carry across branches", () => {
  // Wrong drop, backed off, then a correct drop the TA also backs off -> told the step.
  const { next } = run([
    drop(false),
    reply("no"),
    reply(),
    drop(true),
    reply("no"),
    reply(),
  ]);
  assert.equal(next.kind === "dragging" && next.revealed, true);
});

test("unclear re-asks once, then counts as no", () => {
  const first = run([drop(true), reply("unclear")]);
  assert.deepEqual(first.effects, [{ type: "say", line: "clarify" }]);
  assert.equal(first.next.kind === "chat" && first.next.node, "askSure");
  const second = transitionPlacement(first.next, reply("unclear"));
  assert.equal(second.next.kind === "chat" && second.next.node, "askUnsure");
});

test("events that don't apply are no-ops", () => {
  const chatting = run([drop(true)]).next;
  assert.deepEqual(transitionPlacement(chatting, drop(false)), { next: chatting, effects: [] });
  assert.deepEqual(transitionPlacement(INITIAL_PLACEMENT_FLOW, reply("yes")), {
    next: INITIAL_PLACEMENT_FLOW,
    effects: [],
  });
});
