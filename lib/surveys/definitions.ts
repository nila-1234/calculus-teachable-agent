import type { SurveyDefinition, SurveyId, SurveyItem, SurveyLikert } from "./types";
import { ALGEBRA_CHECK_OPTIONS, POWER_RULE_OPTIONS } from "./eligibility";

const AGREE_LIKERT: SurveyLikert = {
  min: 1,
  max: 7,
  minLabel: "Strongly disagree",
  maxLabel: "Strongly agree",
};

function likertItem(
  id: string,
  prompt: string,
  scale: SurveyLikert = AGREE_LIKERT
): SurveyItem {
  return { id, kind: "likert", prompt, required: true, likert: scale };
}

function choiceItem(
  id: string,
  prompt: string,
  choices: string[]
): SurveyItem {
  return {
    id,
    kind: "choice",
    prompt,
    required: true,
    choices: choices.map((text) => ({ id: text, text })),
  };
}

function openItem(
  id: string,
  prompt: string,
  required: boolean,
  placeholder: string
): SurveyItem {
  return { id, kind: "open", prompt, required, placeholder };
}

/**
 * Screening runs before consent and decides eligibility. Option labels are the
 * option ids, and lib/surveys/eligibility.ts matches on them — keep the two in
 * step when editing wording.
 */
const SCREENING_SURVEY: SurveyDefinition = {
  id: "screening",
  title: "Screening",
  intro: [
    "Before you begin, please answer a few questions about your mathematics background, including two short mathematics questions.",
    "This takes a couple of minutes and tells us whether the study is a good fit for you.",
  ],
  sections: [
    {
      id: "background",
      title: "Mathematics background",
      shortTitle: "Background",
      items: [
        choiceItem(
          "highest-math",
          "What is the highest level of mathematics you have studied?",
          [
            "High school mathematics",
            "Precalculus or college algebra",
            "Calculus I",
            "Calculus II",
            "Calculus III or higher",
          ]
        ),
        choiceItem(
          "calculus-courses",
          "How many college-level calculus courses have you taken?",
          ["None", "1", "2", "3 or more"]
        ),
        choiceItem(
          "math_courses",
          "How many college-level mathematics courses have you taken? Include all college-level mathematics (calculus, linear algebra, statistics, discrete mathematics, and so on).",
          ["0", "1", "2", "3 or more"]
        ),
        choiceItem(
          "calc_history",
          "Have you ever taken a calculus course?",
          [
            "Never",
            "In high school",
            "In college",
            "Both",
            "I am currently enrolled in a calculus course",
          ]
        ),
        // Skill checks (floor). Options come from eligibility.ts so the graded
        // correct answer is always one of the presented options.
        choiceItem(
          "algebra_check",
          "Anne is in a rowboat on a lake that is 2400 yards wide. She is 800 yards from the dock. She rows toward the dock for m minutes at a speed of 40 yards per minute. Which expression gives Anne's distance from the dock?",
          ALGEBRA_CHECK_OPTIONS
        ),
        choiceItem(
          "power_rule_check",
          "For f(x) = x⁵ + 7, what is the derivative f′(x)?",
          POWER_RULE_OPTIONS
        ),
      ],
    },
  ],
};

const AGREE_STATEMENTS: [string, string][] = [
  [
    "confident-formulate",
    "I am confident in translating a real-world situation into a mathematical problem that can be solved using calculus.",
  ],
  [
    "confident-evaluate",
    "I am confident in determining whether a calculus solution makes sense in the original real-world context.",
  ],
  ["useful", "Calculus is useful for solving real-world problems."],
  [
    "interested",
    "I am interested in learning how calculus can be applied to real-world problems.",
  ],
];

const PRE_SURVEY: SurveyDefinition = {
  id: "pre",
  title: "Pre-Survey",
  intro: [
    "Please complete this short survey before the pre-test. There are no right or wrong answers.",
    "Your responses help us understand your background and how you currently work with calculus and AI tools.",
  ],
  sections: [
    {
      id: "about-you",
      title: "About you",
      shortTitle: "About you",
      items: [
        choiceItem("age", "What is your age?", [
          "18–20",
          "21–24",
          "25–34",
          "35–44",
          "45–54",
          "55+",
        ]),
        choiceItem(
          "education",
          "What is the highest level of education you have completed?",
          [
            "High school or equivalent",
            "Some college or university, but no degree",
            "Associate degree or equivalent",
            "Bachelor’s degree",
            "Master’s degree",
            "Doctoral or professional degree",
            "Other",
            "Prefer not to say",
          ]
        ),
        choiceItem(
          "field",
          "What is your primary field of study or work?",
          [
            "STEM (science, technology, engineering, mathematics)",
            "Social sciences",
            "Business or economics",
            "Humanities or arts",
            "Education",
            "Other",
            "Prefer not to say",
          ]
        ),
        choiceItem(
          "first-language",
          "What is your first language (the language you learned first)?",
          [
            "English",
            "Spanish",
            "Hindi",
            "Portuguese",
            "French",
            "Chinese (Mandarin)",
            "Other",
            "Prefer not to say",
          ]
        ),
      ],
    },
    {
      id: "experience",
      title: "Calculus and AI experience",
      shortTitle: "Experience",
      items: [
        choiceItem(
          "learned-real-world",
          "Have you learned how calculus can be used to solve real-world problems as part of a course?",
          ["Yes", "No", "Not sure"]
        ),
        choiceItem(
          "used-real-world",
          "Have you personally used calculus to solve a real-world problem (e.g., in a class project, research, work, or another activity)?",
          ["Yes", "No", "Not sure"]
        ),
        choiceItem(
          "ai-frequency",
          "How often do you use AI tools (e.g., ChatGPT, Claude, Gemini) for learning or solving problems?",
          ["Never", "Rarely", "Sometimes", "Often", "Very often"]
        ),
      ],
    },
    {
      id: "attitudes",
      title:
        "For each statement, please indicate how much you agree or disagree.",
      shortTitle: "Attitudes",
      items: AGREE_STATEMENTS.map(([id, prompt]) => likertItem(id, prompt)),
    },
  ],
};

const POST_SURVEY: SurveyDefinition = {
  id: "post",
  title: "Post-Survey",
  intro: [
    "Thank you for completing the activity. This last survey asks about your experience.",
    "There are no right or wrong answers.",
  ],
  sections: [
    {
      id: "attitudes",
      title:
        "For each statement, please indicate how much you agree or disagree.",
      shortTitle: "Attitudes",
      items: [
        ...AGREE_STATEMENTS.map(([id, prompt]) => likertItem(id, prompt)),
        likertItem(
          "instruction-formulate",
          "The instruction helped me understand how to formulate real-world calculus problems."
        ),
        likertItem(
          "instruction-evaluate",
          "The instruction helped me understand how to evaluate real-world calculus problems."
        ),
        likertItem(
          "instruction-ai",
          "The instruction prepared me to better work with AI on real-world calculus problem-solving tasks."
        ),
      ],
    },
    {
      id: "reflection",
      title: "Your experience",
      shortTitle: "Reflection",
      items: [
        openItem(
          "learned",
          "What, if anything, did you learn from this activity?",
          true,
          "Your answer…"
        ),
        openItem(
          "difficult",
          "What, if anything, was confusing, difficult, or frustrating about the activity?",
          true,
          "Your answer…"
        ),
        openItem(
          "comments",
          "Do you have any other comments or feedback about the activity? (Optional)",
          false,
          "Optional"
        ),
      ],
    },
  ],
};

const SURVEYS: Record<SurveyId, SurveyDefinition> = {
  screening: SCREENING_SURVEY,
  pre: PRE_SURVEY,
  post: POST_SURVEY,
};

export function getSurvey(id: string): SurveyDefinition | null {
  if (id === "screening" || id === "pre" || id === "post") return SURVEYS[id];
  return null;
}

export function listSurveys(): SurveyDefinition[] {
  return [SCREENING_SURVEY, PRE_SURVEY, POST_SURVEY];
}
