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

const PRE_SURVEY: SurveyDefinition = {
  id: "pre",
  title: "Pre-Survey — Pilot Study",
  intro: [
    "Please complete this short survey before the pre-test. There are no right or wrong answers.",
    "Your responses help us understand your academic background and how you currently work with calculus and AI tools.",
  ],
  sections: [
    {
      id: "subject",
      title: "Subject ID",
      shortTitle: "ID",
      items: [textItem("subject-id", "Subject ID", "Enter your subject ID")],
    },
    {
      id: "academic",
      title: "Academic background",
      shortTitle: "Academic",
      items: [
        choiceItem("1", "Year in school", [
          "Freshman",
          "Sophomore",
          "Junior",
          "Senior",
          "Master’s",
          "PhD",
          "Other",
          "Prefer not to say",
        ]),
        textItem("2", "Major or field of study", "Your major or field of study"),
        textItem(
          "3",
          "What calculus or math course are you currently taking, or have most recently taken?",
          "Course name"
        ),
        choiceItem("4", "How many college-level calculus courses have you taken?", [
          "0",
          "1",
          "2",
          "3",
          "4+",
        ]),
        likertItem("5", "How comfortable are you with calculus?", {
          min: 1,
          max: 7,
          minLabel: "Very uncomfortable",
          maxLabel: "Very comfortable",
        }),
        likertItem(
          "6",
          "How confident are you in solving calculus problems involving functions, graphs, derivatives, or optimization?",
          {
            min: 1,
            max: 7,
            minLabel: "Not confident",
            maxLabel: "Very confident",
          }
        ),
      ],
    },
    {
      id: "ai",
      title: "AI and learning background",
      shortTitle: "AI & learning",
      items: [
        choiceItem(
          "7",
          "How often do you use AI tools such as ChatGPT, Gemini, Copilot, or Claude for learning?",
          ["Never", "Rarely", "Sometimes", "Often", "Very often"]
        ),
        likertItem("8", "I can effectively explain what I need to an AI tool."),
        likertItem(
          "9",
          "I am confident in judging whether an AI-generated math solution is correct."
        ),
        likertItem(
          "10",
          "I am comfortable giving feedback to an AI system when its answer is incomplete or incorrect."
        ),
      ],
    },
    {
      id: "reasoning",
      title: "Calculus reasoning",
      shortTitle: "Reasoning",
      items: [
        likertItem(
          "11",
          "I can identify what mathematical concept is needed to solve a real-world calculus problem."
        ),
        likertItem(
          "12",
          "I can create a calculus question from a real-world situation."
        ),
        likertItem(
          "13",
          "I can evaluate whether a calculus solution correctly connects the math to the real-world context."
        ),
        openItem(
          "14",
          "What do you usually find most challenging when solving or explaining calculus problems?",
          true,
          "Write your response…"
        ),
      ],
    },
  ],
};

const POST_SURVEY: SurveyDefinition = {
  id: "post",
  title: "Post-Survey — Pilot Study",
  intro: [
    "Please complete this short survey after the post-test. There are no right or wrong answers.",
    "Your responses help us understand how the tool felt to use and what you took away from the session.",
  ],
  sections: [
    {
      id: "subject",
      title: "Subject ID",
      shortTitle: "ID",
      items: [textItem("subject-id", "Subject ID", "Enter your subject ID")],
    },
    {
      id: "experience",
      title: "Experience with the tool",
      shortTitle: "Experience",
      items: [
        likertItem("1", "The tool was easy to understand."),
        likertItem("2", "The tool was easy to use."),
        likertItem("3", "The instructions in the tool were clear."),
        likertItem(
          "4",
          "The tool helped me think more carefully about calculus reasoning."
        ),
        likertItem(
          "5",
          "The tool helped me notice mistakes or weaknesses in AI-generated calculus answers."
        ),
        likertItem(
          "6",
          "The tool helped me understand how to create or evaluate real-world calculus problems."
        ),
      ],
    },
    {
      id: "reflection",
      title: "Learning and reflection",
      shortTitle: "Reflection",
      items: [
        likertItem(
          "7",
          "After using the tool, I feel more confident creating calculus questions from real-world situations."
        ),
        likertItem(
          "8",
          "After using the tool, I feel more confident evaluating AI-generated calculus solutions."
        ),
        openItem(
          "9",
          "What strategy did you use while interacting with the AI agent?",
          true,
          "Write your response…"
        ),
        openItem(
          "10",
          "What, if anything, did you learn from this interaction?",
          true,
          "Write your response…"
        ),
        openItem(
          "11",
          "What parts of the tool were confusing or frustrating?",
          true,
          "Write your response…"
        ),
        openItem(
          "12",
          "What would you change about the tool?",
          true,
          "Write your response…"
        ),
        openItem(
          "13",
          "Any other comments or suggestions?",
          false,
          "Optional comments…"
        ),
      ],
    },
  ],
};

const SURVEYS: Record<SurveyId, SurveyDefinition> = {
  pre: PRE_SURVEY,
  post: POST_SURVEY,
};

export function getSurvey(id: string): SurveyDefinition | null {
  if (id === "pre" || id === "post") return SURVEYS[id];
  return null;
}

export function listSurveys(): SurveyDefinition[] {
  return [PRE_SURVEY, POST_SURVEY];
}
