import { test } from "node:test";
import assert from "node:assert/strict";
import { extractNumbers, formulaMatches, valueMatches } from "./math-answer";

test("numbers are found however they're written", () => {
  assert.deepEqual(extractNumbers("324 cm"), [324]);
  assert.deepEqual(extractNumbers("$45"), [45]);
  assert.deepEqual(extractNumbers("1,250 m^2"), [1250, 2]);
  assert.deepEqual(extractNumbers("−16"), [-16]);
  assert.ok(valueMatches("at t = 6 the distance is 324 cm", 324));
  assert.ok(!valueMatches("320", 324));
});

test("Q1f formula: equivalent forms are all correct", () => {
  const key = "-x^2 + 35x";
  for (const ok of [
    "-x^2 + 35x",
    "35x - x^2",
    "x(35 - x)",
    "A(x) = 35x − x²",
    "-1*x^2+35*x",
    "x*(35-x)",
    "(35 - x)x",
  ]) {
    assert.ok(formulaMatches(ok, key), ok);
  }
});

test("Q1f formula: wrong or unreadable answers are not", () => {
  const key = "-x^2 + 35x";
  for (const bad of ["x^2 + 35x", "x(70 - x)", "35x", "x*y", "", "area = length × width", "-x^2+25x"]) {
    assert.ok(!formulaMatches(bad, key), bad);
  }
});

test("unary minus binds looser than the power", () => {
  assert.ok(formulaMatches("-x^2", "-(x^2)"));
  assert.ok(!formulaMatches("-x^2", "(-x)^2"));
});
