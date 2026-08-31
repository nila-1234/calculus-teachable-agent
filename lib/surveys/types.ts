export type SurveyId = "pre" | "post";

export type SurveyItemKind = "text" | "choice" | "likert" | "open";

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
