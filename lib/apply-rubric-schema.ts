export const APPLY_RUBRIC_ANSWERS = [
  {
    id: "answer-1",
    title: "AI Student Answer 1",
    text: `AI answer:
\\(f'(x) = \\frac{d}{dx}(-2x^2 + 12x + 2) = -4x + 12\\)

Critical number:
\\(-4x + 12 = 0\\)
\\(x = 3\\)
\\(f(3) = 20\\)

Therefore, the critical point is \\((3, 20)\\).`,
  },
  {
    id: "answer-2",
    title: "AI Student Answer 2",
    text: `I used the derivative to find the critical point.
\\(f(x) = -2x^2 + 12x + 2\\)
\\(f'(x) = -4x + 12\\)

Then I solved:
\\(-4x + 12 = 0\\)
\\(x = 4\\)

Plugging that back in:
\\(f(4) = -2(4)^2 + 12(4) + 2\\)
\\(= -32 + 48 + 2 = 18\\)

So I got \\((4, 18)\\) as the critical point.`,
  },
] as const;