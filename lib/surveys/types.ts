export type SurveyId = "screening" | "pre" | "post";

export type SurveyItemKind =
  | "text"
  | "choice"
  /** Select all that apply. Stored as the chosen ids joined by "|". */
  | "multi"
  | "likert"
  | "open";

export type SurveyChoice = {
  id: string;
  text: string;
};

export type SurveyLikert = {
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
};

export type SurveyItem = {
  id: string;
  kind: SurveyItemKind;
  prompt: string;
  required: boolean;
  placeholder?: string;
  choices?: SurveyChoice[];
  likert?: SurveyLikert;
  /**
   * Open items only: record how the answer was entered (pasted / dropped text,
   * keystrokes, timing, tab switches) under `${id}${TYPING_SUFFIX}`. Used by
   * the screening AI-use check.
   */
  trackTyping?: boolean;
};

/** Answers key suffix under which an item's typing signals are stored. */
export const TYPING_SUFFIX = "::typing";

/** How an open answer was entered. Times are epoch ms; counts are totals. */
export type TypingSignals = {
  pastedChars: number;
  pasteCount: number;
  droppedChars: number;
  keystrokes: number;
  backspaces: number;
  firstFocusAt: number | null;
  firstKeyAt: number | null;
  lastInputAt: number | null;
  tabAwayCount: number;
  tabAwayMs: number;
};

export const EMPTY_TYPING: TypingSignals = {
  pastedChars: 0,
  pasteCount: 0,
  droppedChars: 0,
  keystrokes: 0,
  backspaces: 0,
  firstFocusAt: null,
  firstKeyAt: null,
  lastInputAt: null,
  tabAwayCount: 0,
  tabAwayMs: 0,
};

export function parseTyping(raw: string | undefined): TypingSignals {
  if (!raw) return { ...EMPTY_TYPING };
  try {
    return { ...EMPTY_TYPING, ...(JSON.parse(raw) as Partial<TypingSignals>) };
  } catch {
    return { ...EMPTY_TYPING };
  }
}

export type SurveySection = {
  id: string;
  title: string;
  /** Shorter label for the in-page progress bar. */
  shortTitle?: string;
  items: SurveyItem[];
};

export type SurveyDefinition = {
  id: SurveyId;
  title: string;
  intro: string[];
  sections: SurveySection[];
};

export type SurveyAnswers = Record<string, string>;

/** Separator for multi-select answers, kept out of every option label. */
export const MULTI_SEPARATOR = "|";

export function parseMulti(value: string | undefined): string[] {
  return (value ?? "").split(MULTI_SEPARATOR).filter(Boolean);
}

export function serializeMulti(values: string[]): string {
  return values.join(MULTI_SEPARATOR);
}
