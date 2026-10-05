import { getSurvey } from "@/lib/surveys/definitions";
import type {
  SurveyChoice,
  SurveyDefinition,
  SurveyItem,
  SurveyLikert,
  SurveySection,
} from "@/lib/surveys/types";

/**
 * Surveys for the /pilot flow.
 *
 * The pre-survey is the live pre-survey plus one motivation question (per Ken,
 * trimmed to a single intrinsic item). It is a choice with an "Other" option
 * followed by an optional free-text item, rather than an inline "Other: ___"
 * field — that keeps the shared survey components untouched. Swap in Jie's exact
 * wording when it arrives.
 *
 * The difficulty survey is new: it closes the pilot by asking how the test felt.
 */

const AGREE_LIKERT: SurveyLikert = {
  min: 1,
  max: 7,
  minLabel: "Strongly disagree",
  maxLabel: "Strongly agree",
};

function choices(texts: string[]): SurveyChoice[] {
  return texts.map((text) => ({ id: text, text }));
}

const MOTIVATION_SECTION: SurveySection = {
  id: "motivation",
  title: "One more question",
  shortTitle: "Motivation",
  items: [
    {
      id: "why-study",
      kind: "choice",
      required: true,
      prompt:
        "Why are you taking part in this study? (Choose the one that fits best.)",
      choices: [
        {
          id: "interest",
          text: "I'm interested in the math and want to try these problems.",
        },
        { id: "payment", text: "Mainly for the payment." },
        { id: "other", text: "Other" },
      ],
    },
    {
      id: "why-study-other",
      kind: "open",
      required: false,
      prompt: 'If you chose "Other" above, please describe in a few words.',
      placeholder: "Your reason…",
    },
  ],
};

const mainPre = getSurvey("pre");

/** Pre-survey for the pilot: the live pre-survey plus the motivation question. */
export const PILOT_PRE_SURVEY: SurveyDefinition | null = mainPre
  ? { ...mainPre, sections: [...mainPre.sections, MOTIVATION_SECTION] }
  : null;

const difficultyItems: SurveyItem[] = [
  {
    id: "difficulty",
    kind: "choice",
    required: true,
    prompt: "Overall, how difficult did you find this test?",
    choices: choices(["Very easy", "Easy", "Moderate", "Hard", "Very hard"]),
  },
  {
    id: "confidence",
    kind: "likert",
    required: true,
    prompt: "I am confident that my answers are correct.",
    likert: AGREE_LIKERT,
  },
  {
    id: "time",
    kind: "choice",
    required: true,
    prompt: "Did you have enough time to complete the test?",
    choices: choices(["More than enough", "Just enough", "Not enough"]),
  },
  {
    id: "unclear",
    kind: "open",
    required: false,
    prompt:
      "Were any questions unclear or confusing? If so, which one(s), and why?",
    placeholder: "Describe anything that was unclear…",
  },
  {
    id: "feedback",
    kind: "open",
    required: false,
    prompt: "Any other feedback on the questions? (optional)",
    placeholder: "Your feedback…",
  },
];

/** Difficulty survey shown at the end of the pilot. */
export const DIFFICULTY_SURVEY: SurveyDefinition = {
  id: "post",
  title: "After the test",
  intro: [
    "Thank you for completing the test. A few quick questions about how it felt.",
    "There are no right or wrong answers.",
  ],
  sections: [
    {
      id: "difficulty",
      title: "About the test",
      shortTitle: "Difficulty",
      items: difficultyItems,
    },
  ],
};
