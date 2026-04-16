export const SCENARIO_PLACEHOLDER = `A company is reviewing its daily profit over the past month to better understand an unusual change in performance. Over the past year, the company’s profit has generally been declining, but during this month it went down at first, then rose sharply, and later began to decrease again. The company recently made a change in its marketing strategy, which may have contributed to this fluctuation. The company wants to choose a function that best models this month’s data. The goal is to identify the most important features of this month’s profit pattern so the company can decide which parts of the month deserve closer investigation.`;

export const QUESTION_PLACEHOLDER = `Use the function __(1)__ to model the company’s profit and analyse the company’s situation by finding its __(2)__.`;

export const PLOT_DATA_SRC = `/data/scenarios/2/plot-data.json`;

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

export const QUESTION_PARTS: readonly QuestionPart[] = [
  {
    id: "1",
    label: "Select the function",
    options: [
      {
        id: "f1",
        text: "\\(f(x)=-0.01x^{3}+0.45x^{2}-4x+80\\)",
        correct: true,
        feedback:
          "Correct! This function matches the overall shape of the scatter plot and the story in the scenario. The graph starts by decreasing, then rises to a high point, and later begins decreasing again, which fits the monthly profit pattern shown in the data. The coefficients also create a smooth and realistic curve: the cubic term \\(-0.01x^3\\) is small enough to avoid overly steep changes, while the quadratic and linear terms place the turning points in a reasonable part of the month. This makes the function a strong model for identifying the key features of the company’s profit pattern.",
      },
      {
        id: "f2",
        text: "\\(f(x)=-0.01x^{3}+0.4x^{2}-3x+90\\)",
        correct: false,
        feedback:
          "Incorrect! This function is close to the correct model, but its coefficients make the graph fit the data less accurately. The constant term \\(+90\\) shifts the graph upward, so the model starts too high compared with the early profit values in the scatter plot. Also, changing the quadratic coefficient from \\(0.45\\) to \\(0.4\\) and the linear coefficient from \\(-4\\) to \\(-3\\) changes the shape and location of the turning points. Because of these differences, the curve does not match the low point and later rise in the data as well as the correct function.",
      },
      {
        id: "f3",
        text: "\\(f(x)=18\\sin(0.16x-2.4)+88\\)",
        correct: false,
        feedback:
          "Incorrect! This graph may look similar to the data over part of the month because it rises and falls in a comparable way, but a sine function represents a repeating periodic pattern. That means it suggests the company’s profit would continue to move up and down in regular cycles. In this scenario, the fluctuation is connected to a recent strategy change, so a repeating sinusoidal model is less appropriate than a cubic model. The shape may look convincing locally, but the function type does not fit the situation as well.",
      },
      {
        id: "f4",
        text: "\\(f(x)=-e^{0.17x}+100\\)",
        correct: false,
        feedback:
          "Incorrect! This function does not match the scatter plot because its shape is fundamentally different from the data. An exponential function like this changes in only one general direction and does not create the two turning points shown in the monthly profit pattern. The data decreases, then rises, and then decreases again, but this exponential model cannot capture that type of fluctuation. So the problem is not just a small mismatch in coefficients — the entire function family is not suitable for modeling this situation.",
      },
    ],
  },
  {
    id: "2",
    label: "Select what to analyze",
    options: [
      {
        id: "a1",
        text: "critical points",
        correct: true,
        feedback:
          "Correct! Critical points help identify where profit changes direction and reaches local maximum or minimum values. That makes them the most useful features for analyzing this month’s fluctuation.",
      },
      {
        id: "a2",
        text: "average rate of change over the month",
        correct: false,
        feedback:
          "Incorrect! The average rate of change only summarizes the overall change from the beginning to the end of the month. It does not show the important ups and downs within the month.",
      },
      {
        id: "a3",
        text: "intercepts",
        correct: false,
        feedback:
          "Incorrect! Intercepts only show where the graph crosses the axes. They do not help identify the most important changes in the company’s profit pattern.",
      },
    ],
  },
] as const;

export const RUBRIC_OPTIONS = [
  {
    id: "derivative-correct",
    label: "Derivative of the function is computed correctly",
    description:
      "This is an essential criterion because a correct derivative is required to find critical points accurately.",
  },
  {
    id: "solve-fprime-zero",
    label: "Equation \\(f'(x)=0\\) is solved correctly to find all critical numbers",
    description:
      "This is an essential criterion because solving \\(f'(x)=0\\) correctly is necessary to identify all critical numbers.",
  },
  {
    id: "all-critical-points-identified",
    label: "All critical points are correctly identified",
    description:
      "This is an essential criterion because missing any critical point would lead to an incomplete or incorrect analysis.",
  },
  {
    id: "connects-critical-points-to-context",
    label:
      "Correctly connects the critical points to important changes in the company’s profit during the month",
    description:
      "This is an essential criterion because the goal is to identify and explain the day of highest profit.",
  },
  {
    id: "whole-number-simplification",
    label: "The equation is simplified into whole-number coefficients before solving",
    description:
      "This is not required, since simplifying the equation can help but is not necessary for obtaining the correct answer.",
  },
  {
    id: "graph-verification",
    label: "The behavior of the function is verified using a graph or visual inspection",
    description:
      "This is not required, because visual checking may support the answer but does not determine its correctness.",
  },
  {
    id: "nearby-point-check",
    label: "Values of the derivative are checked at nearby points to confirm the result",
    description:
      "This is not required, since checking nearby values is optional and not needed to correctly solve the problem.",
  },
] as const;

export const SAMPLE_ANSWERS = {
  correct: {
    title: "Sample AI Answer 1 (100%)",
    text: `\\(f(x)=-0.01x^3+0.45x^2-4x+80\\)

\\(f'(x)=-0.03x^2+0.9x-4\\)

Set \\(f'(x)=0\\):
\\(-0.03x^2+0.9x-4=0\\)

\\(3x^2-90x+400=0\\)

\\(x=\\frac{90\\pm\\sqrt{3300}}{6}\\)

\\(x\\approx 5.43,\\ 24.57\\)

Now find the points:

\\(f(5.43)\\approx 69.95\\)

\\(f(24.57)\\approx 105.05\\)

Critical points:
\\((5.43,69.95),\\ (24.57,105.05)\\)

Interpretation:
At \\(x\\approx 5.43\\), profit reaches a local minimum, so this is where the company’s profit stops decreasing and begins to rise.
At \\(x\\approx 24.57\\), profit reaches a local maximum, so this is where the profit stops increasing and begins to decrease again.
These points show the most important changes in the company’s profit pattern during the month.`,
  },

  incorrect: {
    title: "Sample AI Answer 2 (0%)",
    text: `\\(f(x)=0.03x^2+0.9x-4\\)

\\(f'(x)=0.06x+0.9\\)

Set \\(f'(x)=0\\):
\\(0.06x+0.9=0\\)

\\(x=-15\\)

Critical point:
\\((-15,f(-15))\\)

So the company’s most important profit change happens before the month even begins, which means the model shows profit just keeps decreasing during the month.`,
  },
} as const;

export const FINAL_AI_ANSWERS = [
  {
    id: "answer-50",
    label: "AI Answer (50%)",
    text: `\\(f'(x)=-0.03x^2+0.9x-4\\)

\\(-0.03x^2+0.9x-4=0\\)

\\(3x^2-90x+400=0\\)

\\(x=\\frac{90\\pm\\sqrt{3300}}{6}\\)

\\(x\\approx 24.57\\)

Critical point: \\(x\\approx 24.57\\)

The derivative is computed correctly and the equation is set up correctly, but the response gives only one critical number and does not explain what it means for the company’s profit pattern.`,
  },
  {
    id: "answer-25",
    label: "AI Answer (25%)",
    text: `\\(f'(x)=-0.03x^2+0.9x-4\\)

\\(-0.03x^2+0.9x-4=0\\)

\\(3x^2-90x+400=0\\)

\\((3x-30)(x-20)=0\\)

\\(x=10,20\\)

Critical points: \\(x=10,20\\)

The derivative is computed correctly, but the factorization is incorrect, so the critical numbers are wrong. The response also gives no interpretation of how those values relate to the company’s profit changes during the month.`,
  },
] as const;