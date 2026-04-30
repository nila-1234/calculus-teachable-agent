export const SCENARIO_PLACEHOLDER = `A local reservoir's water level fluctuates throughout the day due to rainfall and usage. Engineers are monitoring the water level (in meters) over a 24-hour period. The scatter plot shows the water level at different hours past midnight. Which analysis would best help them identify when the reservoir was at its maximum capacity?`;

export const QUESTION_PLACEHOLDER = `Use the function __(1)__ to model the reservoir's water level and determine the peak capacity by finding its __(2)__.`;

export const PLOT_DATA_SRC = `/data/scenarios/3/plot-data.json`;

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
        text: "\\(f(t)=-0.01t^3 + 0.3t^2 - 2t + 10\\)",
        correct: true,
        feedback: "This cubic model fits the observed rise and fall of water levels, allowing for multiple peaks and troughs during the day.",
      },
      {
        id: "f2",
        text: "\\(f(t)=0.5t + 8\\)",
        correct: false,
        feedback: "A linear model cannot capture the fluctuation (rising and falling) of water levels seen in the data.",
      },
    ],
  },
  {
    id: "2",
    label: "Select what to analyze",
    options: [
      {
        id: "a1",
        text: "Local maxima",
        correct: true,
        feedback: "Finding the local maxima of the function will reveal the specific times when the water level peaked.",
      },
      {
        id: "a2",
        text: "y-intercept",
        correct: false,
        feedback: "The y-intercept only shows the water level at midnight, not the peaks during the day.",
      },
    ],
  },
];
