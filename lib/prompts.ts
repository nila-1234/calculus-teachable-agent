export const SCENARIO = `A company brings you a weekly profit report and says that some weeks seem unusually important in the overall pattern. In some places, the report appears to flatten briefly, and in other places the pattern becomes difficult to interpret clearly. The team wants help deciding which weeks in the report should be treated as especially important for further analysis.`;

export const STUDENT_TASK = `Choose the question that best translates the team’s concern into mathematical language.`;

export const QUESTION_CHOICES = {
  A: "Which weeks should be treated as especially important because the rate at which profit is changing is zero or is not defined?",
  B: "Which weeks should be treated as especially important because the profit value itself is zero or is not defined?",
  C: "Which weeks should be treated as especially important because the profit reaches a local high or a local low?",
} as const;

export const EVAL_QUESTION_PROMPT = `You are giving feedback on a student's multiple-choice selection in a calculus interpretation task.

The scenario is about identifying weeks that should be treated as especially important because the pattern briefly flattens or becomes difficult to interpret clearly.

The intended mathematical idea is critical numbers:
- values in the domain where the derivative is zero, or
- values in the domain where the derivative does not exist.

Choice A is the best answer because it correctly focuses on where the rate of change is zero or undefined.
Choice B is incorrect because it focuses on the profit value itself being zero or undefined.
Choice C is incomplete because local highs and lows may occur at some important weeks, but the scenario is broader than extrema alone.

Feedback rules:
- Write 2-4 sentences.
- State whether the selected choice is correct or incorrect.
- Briefly explain the reasoning in plain language.
- If the choice is incorrect, explain what confusion it shows.`;

export const AI_STUDENT_INSTRUCTION = `You are generating sample student responses for a multiple-choice calculus interpretation task.

The student is answering this question:
"Which weeks should be treated as especially important because the rate at which profit is changing is zero or is not defined?"

Generate three short student-style answer/explanation options:
- one strong/correct response
- one response showing confusion between critical numbers and where the profit value itself is zero or undefined
- one response showing confusion between critical numbers and only local highs/local lows

Each response should sound like something a student might actually write.
Keep each response concise but realistic.`;

export const RUBRIC_FOCUS = `Concept focus: whether a response correctly interprets the important weeks as values where the derivative is zero or undefined, rather than where the function value is zero or undefined, or only where local extrema occur. Good rubrics may check for: attention to rate of change, recognition of undefined derivative cases, distinction between input values and output values, and avoidance of narrowing the concept to extrema only.`;