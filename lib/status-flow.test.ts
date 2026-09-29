import { test } from "node:test";
import assert from "node:assert/strict";
import { statusLine, statusSpeaker } from "./status-flow";

test("speaker follows the mark, not correctness", () => {
  assert.equal(statusSpeaker("pass"), "professor");
  assert.equal(statusSpeaker("fail"), "student");
});

test("'are you sure' names the mark and never the expected status", () => {
  const line = statusLine("askSure", { marked: "fail", expected: "pass", placedStep: 2 });
  assert.equal(line, "Are you sure this is a FAIL?");
});

test("why asks about meeting or missing the criterion", () => {
  assert.match(statusLine("askWhy", { marked: "pass", expected: "fail", placedStep: 3 }), /meets/);
  assert.match(statusLine("askWhy", { marked: "fail", expected: "pass", placedStep: 3 }), /misses/);
});

test("after the reveal, a wrong re-mark is told the right status", () => {
  const line = statusLine("revealedWrongStep", { marked: "pass", expected: "fail", placedStep: 1 });
  assert.equal(line, "It should be a FAIL — re-mark it.");
});
