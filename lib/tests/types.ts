export type TestItemKind = "free-response" | "multiple-choice" | "link";

export type TestChoice = {
  id: string;
  text: string;
  /** When selected, show a free-text field (e.g. "Yes, other: ___"). */
  allowsOtherText?: boolean;
};

export type TestItem = {
  id: string;
  kind: TestItemKind;
  prompt: string;
  /** Extra material shown in a bordered panel above the input (e.g. an AI student's answer). */
  context?: string;
  contextLabel?: string;
  choices?: TestChoice[];
  /** For multiple-choice items that also ask the student to explain their choice. */
  explanationPrompt?: string;
  placeholder?: string;
  /** Small note under the item (e.g. "This question is not graded."). */
  note?: string;
  /** Reference solution / grading rubric from the assessment doc. Not shown to students. */
  reference?: string;
};

export type TestSection = {
  id: string;
  title: string;
  /** Scenario text shown above every item of the section. */
  scenario?: string;
  items: TestItem[];
};

export type TestId = "pretest" | "posttest";

export type TestDefinition = {
  id: TestId;
  title: string;
  intro: string[];
  goals: string[];
  sections: TestSection[];
};

export type TestItemAnswer = {
  choiceId?: string;
  text?: string;
  otherText?: string;
  explanation?: string;
};

export type TestAnswers = Record<string, TestItemAnswer>;
