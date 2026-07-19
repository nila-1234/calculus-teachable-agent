import { TestAnswers, TestItem } from "./types";

/**
 * Converts a student's raw typed answer into displayable text with math
 * rendering: `x^2` / `a_1` become inline math, and bare LaTeX commands
 * inserted from the math keypad (\frac{a}{b}, \sqrt{x}, \leq, …) are wrapped
 * so they render. Already-wrapped \( \) / \[ \] segments are preserved.
 */
export function toMathPreview(text: string): string {
  if (!text) return text;

  const parts = text.split(/(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/);

  for (let i = 0; i < parts.length; i += 2) {
    let t = parts[i];
    if (typeof t !== "string") continue;

    // Exponents and subscripts: x^2, x^{n+1}, p^2), a_1
    t = t.replace(/(\w|\))\^\{([^}]*)\}/g, "\\($1^{$2}\\)");
    t = t.replace(/(\w|\))\^(\w+)/g, "\\($1^{$2}\\)");
    t = t.replace(/(\w)_\{([^}]*)\}/g, "\\($1_{$2}\\)");
    t = t.replace(/(\w)_(\w+)/g, "\\($1_{$2}\\)");

    // Bare LaTeX commands from the math keypad: \frac{a}{b}, \sqrt{x}, \leq …
    t = t.replace(
      /(\\[a-zA-Z]+(?:\{[^{}]*\}(?:\{[^{}]*\})?)?)/g,
      "\\($1\\)"
    );

    parts[i] = t;
  }

  return parts.join("");
}

/** Renders a student's answer to an item as text (used for grading and the results page). */
export function formatStudentAnswer(item: TestItem, answers: TestAnswers): string {
  const answer = answers[item.id] || {};

  if (item.kind === "multiple-choice") {
    const choice = item.choices?.find((c) => c.id === answer.choiceId);
    const parts = [
      `Selected choice: ${answer.choiceId ?? "(none)"}${choice ? ` — ${choice.text}` : ""}`,
    ];
    if (answer.otherText) parts.push(`Other: ${answer.otherText}`);
    if (answer.explanation) parts.push(`Explanation: ${answer.explanation}`);
    return parts.join("\n");
  }

  return answer.text?.trim() || "(no answer)";
}
