import type { TestDefinition, TestItem, TestItemAnswer } from "./types";

/** Finds an item and the section it belongs to, for prompt context. */
export function findItem(
  test: TestDefinition,
  itemId: string
): { item: TestItem; scenario?: string } | null {
  for (const section of test.sections) {
    const item = section.items.find((candidate) => candidate.id === itemId);
    if (item) return { item, scenario: section.scenario };
  }
  return null;
}

/**
 * Renders a participant's answer as plain text for the grading prompt.
 * Only the fields relevant to the item's kind are included, so the model is
 * never shown an empty `matches` object for a free-response item and so on.
 */
export function formatAnswer(
  item: TestItem,
  answer: TestItemAnswer | undefined
): string {
  if (!answer) return "(no answer submitted)";

  const parts: string[] = [];

  if (answer.choiceId) {
    const choice = item.choices?.find((c) => c.id === answer.choiceId);
    parts.push(`Selected: ${answer.choiceId}${choice ? ` — ${choice.text}` : ""}`);
  }

  if (answer.matches && Object.keys(answer.matches).length) {
    const rows = Object.entries(answer.matches).map(([rowId, choiceId]) => {
      const row = item.matchRows?.find((r) => r.id === rowId);
      const choice = item.choices?.find((c) => c.id === choiceId);
      return `  ${row?.text ?? rowId} -> ${choice?.text ?? choiceId}`;
    });
    parts.push(`Matches:\n${rows.join("\n")}`);
  }

  if (answer.text?.trim()) parts.push(answer.text.trim());
  if (answer.otherText?.trim()) parts.push(`Other: ${answer.otherText.trim()}`);
  if (answer.explanation?.trim()) {
    parts.push(`Explanation: ${answer.explanation.trim()}`);
  }

  return parts.length ? parts.join("\n\n") : "(no answer submitted)";
}
