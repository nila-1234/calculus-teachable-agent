export const SCENARIO_PLACEHOLDER = `A company is reviewing its daily profit over the past month to better understand its performance and decide which day’s strategy is worth repeating. The scatter plot below shows the company’s daily profit throughout the month. Which of the following questions would best help the company determine which day produced the highest profit pattern worth mimicking?`;

export const QUESTION_PLACEHOLDER = `Use the function __(1)__ to model the company’s profit and analyse the company’s situation by finding its __(2)__.`;

export type Choice = {
  id: string;
  text: string;
  correct?: boolean;
  feedback: string;
};

export type QuestionPart = {
  id: string;
  label: string;
  options: readonly Choice[];
};

export const QUESTION_PARTS: {
  part1: QuestionPart;
  part2: QuestionPart;
} = {
  part1: {
    id: "1",
    label: "Select the function",
    options: [
      {
        id: "f1",
        text: "\\(f(x)=0.05x^3-2x^2+15x+80\\)",
        correct: true,
        feedback:
          "This is the strongest choice because it matches the overall shape of the scatter plot: profit rises early in the month, reaches a high point, then drops before increasing again. This model can produce multiple critical points, which helps identify the company’s best-profit day.",
      },
      {
        id: "f2",
        text: "\\(f(x)=0.05x^3+2x^2+15x+75\\)",
        correct: false,
        feedback:
          "This choice is less appropriate because the positive quadratic term changes the shape of the graph too much. It does not match the pattern in the scatter plot as well as the correct model.",
      },
      {
        id: "f3",
        text: "\\(f(x)=0.5x^3-2x^2+15x+80\\)",
        correct: false,
        feedback:
          "This choice is not the best fit because the larger cubic coefficient makes the function change too rapidly. The graph suggests a smoother trend, so this model exaggerates the behavior.",
      },
    ],
  },

  part2: {
    id: "2",
    label: "Select what to analyze",
    options: [
      {
        id: "a1",
        text: "critical points",
        correct: true,
        feedback:
          "This is the best choice because critical points identify where profit reaches maximum or minimum values, directly answering the company’s question.",
      },
      {
        id: "a2",
        text: "average rate of change over the month",
        correct: false,
        feedback:
          "This only describes overall change and does not identify the specific day when profit was highest.",
      },
      {
        id: "a3",
        text: "intercepts",
        correct: false,
        feedback:
          "Intercepts do not help determine the day of maximum profit.",
      },
    ],
  },
} as const;

export const RUBRIC_OPTIONS = [
  {
    id: "derivative-correct",
    label: "Derivative of the function is computed correctly",
    description:
      "Checks whether the derivative of the selected function is found correctly.",
  },
  {
    id: "solve-fprime-zero",
    label: "Equation \\(f'(x)=0\\) is solved correctly",
    description:
      "Checks whether the derivative equation is solved correctly to find all critical values.",
  },
  {
    id: "all-critical-points-identified",
    label: "All critical points are identified",
    description:
      "Checks whether the response identifies all critical points rather than only one.",
  },
  {
    id: "maximum-profit-identified",
    label:
      "The critical point corresponding to maximum profit is identified correctly",
    description:
      "Checks whether the response determines which critical point represents the highest profit.",
  },
  {
    id: "contextual-interpretation",
    label: "The result is interpreted in context",
    description:
      "Checks whether the answer explains what the result means for the company’s performance.",
  },
  {
    id: "graph-reasoning",
    label: "Graph behavior is used to justify the conclusion",
    description:
      "Checks whether the solution connects algebraic work with the scatter plot trend.",
  },
  {
    id: "avoids-misinterpretation",
    label: "Does not confuse larger x-value with larger profit",
    description:
      "Checks whether the response avoids assuming that a larger x-value automatically implies higher profit.",
  },
] as const;

export const SAMPLE_ANSWERS = {
  correct: {
    title: "Sample AI Answer 1 (Fully Correct)",
    text: `\\(f(x) = 0.05x^3 - 2x^2 + 15x + 80\\)

\\(f'(x) = 0.15x^2 - 4x + 15\\)

\\(0.15x^2 - 4x + 15 = 0\\)

\\(3x^2 - 80x + 300 = 0\\)

\\(x = \\frac{80 \\pm \\sqrt{2800}}{6}\\)

\\(x \\approx 4.5, 22.2\\)

Both are critical points. From the graph, the earlier one corresponds to the highest profit.

So the company should focus on around day 4-5.`,
  },

  incorrect: {
    title: "Sample AI Answer 2 (Fully Incorrect)",
    text: `\\(f(x) = 0.05x^3 - 2x^2 + 15x + 80\\)

\\(f'(x) = 0.15x^2 - 4x + 15\\)

\\(0.15x^2 - 4x + 15 = 0\\)

\\(x = \\frac{800 \\pm \\sqrt{604000}}{6}\\)

\\(x \\approx 3.81, 262.86\\)

So the highest profit happens around day 263.`,
  },
} as const;

export const FINAL_AI_ANSWERS = [
  {
    id: "answer-100",
    label: "AI Answer (100%)",
    text: `\\(f'(x) = 0.15x^2 - 4x + 15\\)

\\(0.15x^2 - 4x + 15 = 0\\)

\\(3x^2 - 80x + 300 = 0\\)

\\(x = \\frac{80 \\pm \\sqrt{2800}}{6}\\)

\\(x \\approx 4.5, 22.2\\)

Both are critical points. From the graph, the earlier one corresponds to the highest profit.

So the company should focus on around day 4-5.`,
  },

  {
    id: "answer-50",
    label: "AI Answer (50%)",
    text: `\\(f'(x) = 0.15x^2 - 4x + 15\\)

\\(0.15x^2 - 4x + 15 = 0\\)

\\(3x^2 - 80x + 300 = 0\\)

\\(x \\approx 4.51\\)

So the critical point is around x = 4.51, which is where profit is highest.`,
  },

  {
    id: "answer-25",
    label: "AI Answer (25%)",
    text: `\\(f'(x) = 0.15x^2 - 4x + 15\\)

\\(0.15x^2 - 4x + 15 = 0\\)

\\(x \\approx 4.51, 22.16\\)

Since 22.16 is larger, that should be the maximum profit day.

So the company should focus on day 22.`,
  },

  {
    id: "answer-0",
    label: "AI Answer (0%)",
    text: `\\(f'(x) = 0.15x^2 - 4x + 15\\)

\\(0.15x^2 - 4x + 15 = 0\\)

\\(x = \\frac{800 \\pm \\sqrt{604000}}{6}\\)

\\(x \\approx 3.81, 262.86\\)

So the highest profit happens around day 263.`,
  },
] as const;