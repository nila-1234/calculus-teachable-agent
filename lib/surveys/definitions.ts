import type { SurveyDefinition, SurveyId, SurveyItem, SurveyLikert } from "./types";

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

function multiItem(
  id: string,
  prompt: string,
  choices: string[]
): SurveyItem {
  return {
    id,
    kind: "multi",
    prompt,
    required: true,
    choices: choices.map((text) => ({ id: text, text })),
  };
}

function textItem(id: string, prompt: string, placeholder: string): SurveyItem {
  return { id, kind: "text", prompt, required: true, placeholder };
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
    "Before you begin, please answer a few questions about your background in mathematics.",
    "This takes about a minute and tells us whether this study is a fit for you.",
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
            "Other college-level mathematics (e.g., linear algebra, differential equations)",
            "I am not sure",
          ]
        ),
        multiItem(
          "calculus-topics",
          "Which calculus topics have you studied? Select all that apply.",
          [
            "Limits and continuity",
            "Derivatives and applications of derivatives",
            "Extrema and the Mean Value Theorem",
            "Integrals and applications of integrals",
            "None of the above",
          ]
        ),
        choiceItem(
          "calculus-courses",
          "How many college-level calculus courses have you taken?",
          ["None", "1", "2", "3 or more", "I am not sure"]
        ),
        choiceItem(
          "last-studied",
          "When was the last time you studied or used calculus?",
          [
            "I am currently studying calculus",
            "Within the past year",
            "More than 1 year ago",
            "I have never studied or used calculus",
          ]
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
      id: "subject",
      title: "Subject ID",
      shortTitle: "ID",
      items: [textItem("subject-id", "Subject ID", "Enter your subject ID")],
    },
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
      id: "subject",
      title: "Subject ID",
      shortTitle: "ID",
      items: [textItem("subject-id", "Subject ID", "Enter your subject ID")],
    },
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
