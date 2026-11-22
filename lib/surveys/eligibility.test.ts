import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AI_CHECK_ITEM,
  ALGEBRA_CHECK_OPTIONS,
  POWER_RULE_OPTIONS,
  evaluateEligibility,
} from "./eligibility";
import { EMPTY_TYPING, TYPING_SUFFIX } from "./types";

// Someone who should be eligible on everything except the AI-use check.
const base = {
  "highest-math": "Calculus I",
  "calculus-courses": "1",
  algebra_check: ALGEBRA_CHECK_OPTIONS[1],
  power_rule_check: POWER_RULE_OPTIONS[2],
  [AI_CHECK_ITEM]: "It tells you how fast the function is changing at a point — the slope.",
};
const withTyping = (patch: Partial<typeof EMPTY_TYPING>) => ({
  ...base,
  [`${AI_CHECK_ITEM}${TYPING_SUFFIX}`]: JSON.stringify({ ...EMPTY_TYPING, ...patch }),
});

test("a typed answer is eligible", () => {
  const r = evaluateEligibility(withTyping({ keystrokes: 80, firstFocusAt: 1 }));
  assert.equal(r.eligible, true, r.reasons.join("; "));
});

test("a pasted answer is screened out", () => {
  const r = evaluateEligibility(withTyping({ pastedChars: 72, pasteCount: 1, keystrokes: 2 }));
  assert.equal(r.eligible, false);
  assert.ok(r.failedItems.includes(AI_CHECK_ITEM));
  assert.match(r.reasons.join(" "), /72 characters pasted in/);
});

test("dropping text in counts like pasting", () => {
  const r = evaluateEligibility(withTyping({ droppedChars: 60 }));
  assert.equal(r.eligible, false);
});

test("pasting a single word or symbol is allowed", () => {
  const r = evaluateEligibility(withTyping({ pastedChars: 5, pasteCount: 1, keystrokes: 70 }));
  assert.equal(r.eligible, true, r.reasons.join("; "));
});

test("answers without the AI-check question (older runs) are unaffected", () => {
  const { [AI_CHECK_ITEM]: _removed, ...older } = base;
  void _removed;
  assert.equal(evaluateEligibility(older).eligible, true);
});
