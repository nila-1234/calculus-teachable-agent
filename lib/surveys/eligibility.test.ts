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

test("text that appeared without being typed is screened out", () => {
  // 71 characters in the box, 3 keys pressed, nothing pasted: inserted by a script or extension.
  const r = evaluateEligibility(withTyping({ keystrokes: 3, firstFocusAt: 1 }));
  assert.equal(r.eligible, false);
  assert.match(r.reasons.join(" "), /more characters than were typed/);
});

test("keypad symbols and phone-keyboard input count as typed", () => {
  const keypad = evaluateEligibility(withTyping({ keystrokes: 60, keypadChars: 12, firstFocusAt: 1 }));
  assert.equal(keypad.eligible, true, keypad.reasons.join("; "));
  // A phone keyboard may report no key presses, only typed input.
  const phone = evaluateEligibility(withTyping({ keystrokes: 0, typedChars: 75, firstFocusAt: 1 }));
  assert.equal(phone.eligible, true, phone.reasons.join("; "));
});

test("AI-style wording is screened out, even when typed", () => {
  const typed = { keystrokes: 400, firstFocusAt: 1 };
  for (const [answer, marker] of [
    ["Let \\(x\\) be the width, so \\(A = x(60-2x)\\).", "LaTeX"],
    ["A'(x) = 60 - 4x = 0, so $x = 15$.", "LaTeX"],
    ["**Step 1:** set up the constraint 2x + y = 60.", "markdown bold"],
    ["### Solution\n2x + y = 60", "markdown heading"],
    ["Certainly! Here's the step-by-step solution.", "chatbot phrasing"],
  ] as const) {
    const r = evaluateEligibility({
      ...withTyping(typed),
      [AI_CHECK_ITEM]: answer,
    });
    assert.equal(r.eligible, false, answer);
    assert.match(r.reasons.join(" "), new RegExp(marker), answer);
  }
});

test("ordinary typed math is not mistaken for AI wording", () => {
  const r = evaluateEligibility({
    ...withTyping({ keystrokes: 200, keypadChars: 8, firstFocusAt: 1 }),
    [AI_CHECK_ITEM]:
      "2x + y = 60 so y = 60 - 2x. A(x) = x(60-2x) = 60x - 2x^2. A'(x) = 60 - 4x = 0 -> x = 15, y = 30. A'' = -4 < 0 so max. Area = 450 m^2 ($ not needed)",
  });
  assert.equal(r.eligible, true, r.reasons.join("; "));
});
