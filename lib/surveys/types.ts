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
};

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
