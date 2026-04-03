export const RUBRIC_OPTIONS = [
  {
    id: "derivative-correct",
    label: "Derivative of the function is computed correctly",
    description:
      "Checks whether the derivative expression is found correctly from the original function.",
  },
  {
    id: "solve-fprime-zero",
    label: "Equation \\(f'(x)=0\\) is solved correctly",
    description:
      "Checks whether the work correctly solves the derivative equation to find the critical \\(x\\)-value.",
  },
  {
    id: "critical-point-identified",
    label: "Critical point \\((x, f(x))\\) is identified correctly",
    description:
      "Checks whether the answer correctly computes and states the critical point as both the \\(x\\)-value and corresponding function value.",
  },
  {
    id: "profit-trend-interpretation",
    label: "Result is interpreted in terms of the profit trend",
    description:
      "Checks whether the result is explained in context, such as identifying when profit is highest or what the point means for the trend.",
  },
  {
    id: "derivative-simplified",
    label: "Derivative expression is simplified before solving",
    description:
      "Checks whether the derivative is written in a clean simplified form before setting it equal to zero.",
  },
  {
    id: "second-derivative-check",
    label: "Second derivative is used to verify the critical point",
    description:
      "Checks whether the answer uses the second derivative or another verification step to justify the nature of the critical point.",
  },
  {
    id: "multiple-methods",
    label: "Multiple solution methods are demonstrated and compared",
    description:
      "Checks whether the response shows more than one valid approach and compares them meaningfully.",
  },
] as const;

export const SAMPLE_ANSWERS = {
  correct: {
    title: "Sample AI Answer 1 (Fully Correct)",
    text: `We are given the function \\(f(x) = -2x^2 + 12x + 2\\).

First, take the derivative:
\\(f'(x) = -4x + 12\\)

Set the derivative equal to 0 to find critical points:
\\(-4x + 12 = 0\\)
\\(-4x = -12\\)
\\(x = 3\\)

Now substitute back into the original function:
\\(f(3) = -2(3)^2 + 12(3) + 2\\)
\\(= -18 + 36 + 2\\)
\\(= 20\\)

So the critical point is \\((3, 20)\\).

Since the parabola opens downward (negative leading coefficient), this point represents the maximum profit. This means the company achieves its highest profit on day 3.`,
  },
  incorrect: {
    title: "Sample AI Answer 2 (Fully Incorrect)",
    text: `We are given the function \\(f(x) = -2x^2 + 12x + 2\\).

First, take the derivative:
\\(f'(x) = -2x + 12\\)

Set the derivative equal to 0:
\\(-2x + 12 = 0\\)
\\(x = 6\\)

Now substitute back into the function:
\\(f(6) = -2(6)^2 + 12(6) + 2\\)
\\(= -72 + 72 + 2\\)
\\(= 2\\)

So the critical point is \\((6, 2)\\).

This shows that the maximum profit happens at \\(x = 6\\).`,
  },
} as const;