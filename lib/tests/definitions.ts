import { TestDefinition, TestId } from "./types";

const ASSESSMENT_GOALS = [
  "Procedural computation skills that conventional instruction focuses on.",
  "Higher-order model communication and evaluation skills that our system trains.",
  "Real-life problem solving skills in human-AI collaboration.",
];

const PRE_TEST: TestDefinition = {
  id: "pretest",
  title: "Assessment — Optimization (Pre-Test)",
  intro: [
    "This assessment has three questions: a worked optimization problem, a multi-part modeling and grading exercise, and a real-world problem you analyze together with an AI.",
    "Answer each part in order. You can go back to revise an answer before finishing the test.",
  ],
  goals: ASSESSMENT_GOALS,
  sections: [
    {
      id: "q1",
      title: "Question 1",
      items: [
        {
          id: "1",
          kind: "free-response",
          prompt:
            "A gardener wants to enclose a rectangular garden along a straight river. The side along the river does not require fencing, so the gardener will fence only the two sides perpendicular to the river and the one side parallel to it. The gardener has 60 meters of fencing.\n\nUse calculus to determine the dimensions of the garden that maximize its enclosed area and state the maximum area. Show your work.",
          placeholder: "Show your work here…",
          reference:
            "Let x be each side perpendicular to the river and y the side parallel to it, so 2x + y = 60 and A(x) = x(60 − 2x) = 60x − 2x². A′(x) = 60 − 4x = 0 gives x = 15; A is a downward parabola so this is the maximum. y = 30, maximum area 450 m². Rubric (5 pts, consequential grading): Model, Derivative, Critical value, Extremum justification, Resulting quantities.",
        },
      ],
    },
    {
      id: "q2",
      title: "Question 2",
      scenario:
        "A food truck company sells lunch boxes and is deciding what price to charge. Market research predicts that the number of lunch boxes sold depends on the price.\n\nThe table shows the company’s daily revenue at two example prices:",
      table: {
        columns: [
          "Price per lunch box",
          "Lunch boxes sold per day",
          "Daily revenue",
        ],
        rows: [
          ["$2", "180", "$360"],
          ["$4", "160", "$640"],
          ["\\(p\\) dollars", "\\(200 - 10p\\)", "?"],
        ],
      },
      tableNote:
        "The company wants to determine the price that will produce the greatest daily revenue.",
      items: [
        {
          id: "2.1",
          kind: "multiple-choice",
          prompt:
            "Based on the relationships shown in the table, which function models the company’s daily revenue?",
          choices: [
            { id: "A", text: "\\(R(p) = p + (200 - 10p)\\)" },
            { id: "B", text: "\\(R(p) = 200 - 10p\\)" },
            { id: "C", text: "\\(R(p) = p(200 - 10p)\\)" },
          ],
          explanationPrompt:
            "Explain how the numerical examples in the table support your choice.",
          placeholder: "Use the values in the table to explain your choice…",
          reference:
            "C. At a price of $2, 2 × 180 = 360; at a price of $4, 4 × 160 = 640. The examples show that daily revenue is found by multiplying price by the number of lunch boxes sold. Therefore, R(p) = p(200 − 10p).",
        },
        {
          id: "2.2",
          kind: "free-response",
          prompt:
            "The company’s daily revenue is modeled by \\(R(p) = p(200 - 10p)\\), where \\(p\\) is the price of one lunch box.\n\nWhat calculus concept could be used to determine the price that maximizes the company’s daily revenue? Identify the important mathematical concept the company should find and explain why it is relevant. You do not need to calculate the price.",
          placeholder: "Identify the calculus concept and explain why it is relevant…",
          reference:
            "The company should use the derivative of the revenue function to find a critical point. A critical point occurs where the derivative equals zero or is undefined. It is relevant because it is a point where revenue could reach a maximum or minimum, but the point must be checked to confirm that it is a maximum. Do not require the student to calculate p.",
        },
        {
          id: "2.3",
          kind: "matching",
          prompt:
            "A correct solution to the food truck problem is shown below. For each part of the solution, use the dropdown menu to identify its general mathematical purpose.\n\nEach option may be used once or not at all.",
          matchRows: [
            {
              id: "objective",
              text: "\\(R(p) = p(200 - 10p)\\)\n\\(R(p) = 200p - 10p^2\\)",
            },
            {
              id: "derivative",
              text: "\\(R'(p) = 200 - 20p\\)",
            },
            {
              id: "critical-point",
              text: "\\(200 - 20p = 0\\)\n\\(\\rightarrow p = 10\\)",
            },
            {
              id: "maximum",
              text: "\\(R''(p) = -20\\)\nSince \\(R''(p)\\) is negative, the shape of the graph is a downward-opening parabola. So \\(p = 10\\) produces a maximum.",
            },
          ],
          choices: [
            { id: "1", text: "Find the critical point." },
            { id: "2", text: "Confirm that the critical point is a minimum." },
            { id: "3", text: "Formulate the objective function." },
            { id: "4", text: "Confirm that the critical point is a maximum." },
            { id: "5", text: "Find the derivative." },
          ],
          reference:
            "Correct matches: R(p) = p(200 − 10p) and R(p) = 200p − 10p² → 3. Formulate the objective function; R′(p) = 200 − 20p → 5. Find the derivative; 200 − 20p = 0 and p = 10 → 1. Find the critical point; R″(p) = −20 and the concavity explanation → 4. Confirm that the critical point is a maximum.",
        },
        {
          id: "2.4",
          kind: "multiple-choice",
          prompt:
            "The model uses the restriction \\(0 \\le p \\le 20\\).\n\nWhy is this restriction meaningful in the food truck situation?",
          choices: [
            {
              id: "A",
              text: "A price cannot be negative, and a price above $20 would make the model predict a negative number of lunch boxes sold.",
            },
            {
              id: "B",
              text: "The company’s revenue must always be between $0 and $20.",
            },
            {
              id: "C",
              text: "The derivative of the revenue function can only be calculated between $0 and $20.",
            },
          ],
          reference:
            "A. The price cannot be less than $0. If the price is more than $20, then 200 − 10p would give a negative number of lunch boxes sold, which is not meaningful in this situation.",
        },
      ],
    },
    {
      id: "q3",
      title: "Question 3",
      scenario:
        "A small workshop builds wooden chairs and wants to decide how many chairs to make per day. Let x be the number of chairs made per day. The workshop's accountant breaks down the average cost per chair as follows: materials and labor cost 8 dollars per chair; the fixed daily cost of 250 dollars is shared equally among the x chairs (\\(250/x\\) dollars per chair); and crowding and overtime add \\(0.4x\\) dollars per chair. The workshop wants the daily production level that makes the average cost per chair as low as possible.\n\nYou will use AI (for example, ChatGPT or Claude) to help analyze this real-world situation. Work through the problem together with the AI, then answer the questions below.",
      items: [
        {
          id: "3.1",
          kind: "link",
          prompt: "Share the link to your AI interaction.",
          placeholder: "https://…",
          note: "Use your AI tool's share feature to create a public link to the full conversation.",
          reference:
            "The conversation should show (a) translating the cost description into A(x) = 8 + 250/x + 0.4x and (b) minimizing it: A′(x) = 0.4 − 250/x² = 0 gives x = 25, a minimum since A″(x) > 0, with lowest average cost A(25) = 28 dollars per chair. Rubric (3 pts): Link, Modeling dialogue, Correct result.",
        },
        {
          id: "3.2",
          kind: "multiple-choice",
          prompt: "Do you think the AI's response is correct?",
          choices: [
            { id: "A", text: "Yes" },
            { id: "B", text: "No" },
          ],
          note: "This is a self-report item used to understand your verification behavior; it is not graded.",
        },
        {
          id: "3.3",
          kind: "multiple-choice",
          prompt:
            "Have you checked the AI's response? If so, how? (You are not graded on this question, so answer faithfully.)",
          choices: [
            { id: "A", text: "No, I trusted it." },
            { id: "B", text: "Yes, I eyeballed it and it seems right." },
            { id: "C", text: "Yes, I manually computed each step to verify." },
            { id: "D", text: "Yes, other:", allowsOtherText: true },
          ],
          note: "This is a self-report item used to understand your verification behavior; it is not graded.",
        },
      ],
    },
  ],
};

const POST_TEST: TestDefinition = {
  id: "posttest",
  title: "Assessment — Optimization (Post-Test)",
  intro: [
    "Like the pre-test, this assessment has three questions: a worked optimization problem, a multi-part modeling and grading exercise, and a real-world problem you analyze together with an AI.",
    "Answer each part in order. You can go back to revise an answer before finishing the test.",
  ],
  goals: ASSESSMENT_GOALS,
  sections: [
    {
      id: "q1",
      title: "Question 1",
      items: [
        {
          id: "1",
          kind: "free-response",
          prompt:
            "An open-top box is made from a square sheet of cardboard 18 cm on each side by cutting an equal square of side x from each corner and folding up the sides. Find the value of x that maximizes the volume of the box, and state that maximum volume. Show your work.",
          placeholder: "Show your work here…",
          reference:
            "V(x) = x(18 − 2x)². V′(x) = 12x² − 144x + 324 = 12(x − 3)(x − 9) = 0 gives x = 3 or x = 9; x = 9 gives zero width so the candidate is x = 3, a maximum (V′ changes + to −, or V″(3) = −72 < 0). Maximum volume V(3) = 432 cm³. Rubric (5 pts, consequential grading): Model, Derivative, Critical value, Extremum justification, Resulting quantities.",
        },
      ],
    },
    {
      id: "q2",
      title: "Question 2",
      scenario:
        "A company sells a product through an online sales platform. Market research shows that weekly sales fall by 2 units for every 1-dollar increase in price: at a price of p dollars the company sells \\(q = 120 - 2p\\) units per week. Under its contract with the platform, the price may not exceed 20 dollars. The company wants the price that earns the most weekly revenue.",
      items: [
        {
          id: "2.1",
          kind: "multiple-choice",
          prompt:
            "Which function would correctly model the company's weekly revenue? Explain your choice.",
          choices: [
            { id: "A", text: "\\(R(p) = p(120 - 2p)\\)" },
            { id: "B", text: "\\(R(p) = 120 - 2p\\)" },
            { id: "C", text: "\\(R(p) = p + (120 - 2p)\\)" },
            { id: "D", text: "\\(R(p) = 120p\\)" },
          ],
          explanationPrompt: "Explain your choice",
          placeholder: "Why is this the right model?",
          reference:
            "A. Revenue is price times quantity sold, so substituting q = 120 − 2p into R = p·q gives R(p) = p(120 − 2p). Rubric (3 pts): Correct choice, Construction reasoning, Rejection reasoning.",
        },
        {
          id: "2.2",
          kind: "free-response",
          prompt:
            "What is the company trying to understand from this situation? What mathematical information would help the company make this decision? Explain your reasoning.",
          placeholder: "Explain your reasoning…",
          reference:
            "The company wants the allowed price that earns the most weekly revenue. The useful information is the critical point of R(p) — where R′(p) = 0 — checked against the contract cap; if the unconstrained best price is not allowed, the maximum falls at the boundary. Rubric (3 pts): Objective, Mathematical information, Constraint awareness.",
        },
        {
          id: "2.3",
          kind: "free-response",
          prompt:
            "Imagine you are a grader. Create a rubric for this problem; that is, what does a student's solution need to include to earn full marks?",
          context:
            "After selecting the model, the full problem becomes:\n\nA company models its weekly revenue at different prices using \\(R(p) = 120p - 2p^2\\), where p is the price in dollars and \\(R(p)\\) is the weekly revenue in dollars. Under its contract, the price may not exceed 20 dollars. The company wants the price that gives the most weekly revenue. What price should the company choose, and why?\n\nBelow is an AI student's answer:\n\nThe revenue function is \\(R(p) = 120p - 2p^2\\). Take the derivative:\n\\(R'(p) = 120 - 4p\\)\nSetting \\(R'(p) = 0\\):\n\\(120 - 4p = 0 \\;\\Rightarrow\\; p = 30\\)\nSubstituting back gives \\(R(30) = 30(120 - 60) = 1800\\). The company should set the price at 30 dollars to earn the most revenue, 1800 dollars per week.",
          contextLabel: "The full problem and an AI student's answer",
          placeholder: "List the criteria a full-marks solution needs to include…",
          reference:
            "Model rubric: Derivative, Critical value, Constraint check, Endpoint justification, Endpoint value (all essential). Grading (5 pts): 1 pt per solution step covered with a judgeable criterion.",
        },
        {
          id: "2.4",
          kind: "free-response",
          prompt:
            "Use the rubric you created in Question 2.3 to evaluate the AI student's answer above. Explain how the AI student's answer meets each part of your rubric or not.",
          context:
            "The AI student's answer (from Question 2.3):\n\nThe revenue function is \\(R(p) = 120p - 2p^2\\). Take the derivative:\n\\(R'(p) = 120 - 4p\\)\nSetting \\(R'(p) = 0\\):\n\\(120 - 4p = 0 \\;\\Rightarrow\\; p = 30\\)\nSubstituting back gives \\(R(30) = 30(120 - 60) = 1800\\). The company should set the price at 30 dollars to earn the most revenue, 1800 dollars per week.",
          contextLabel: "AI student's answer",
          placeholder:
            "Go through your rubric criterion by criterion and give a verdict with a reason…",
          reference:
            "Correct verdicts: Derivative — met; Critical value — met; Constraint check — not met; Endpoint justification — not met; Endpoint value — not met (p = 30 exceeds the 20-dollar cap). Correct solution: revenue is still rising at the cap, so p = 20 with R(20) = 1600 dollars. Grading (5 pts): 1 pt per correct verdict with a valid reason; −1 per wrong or missing verdict.",
        },
      ],
    },
    {
      id: "q3",
      title: "Question 3",
      scenario:
        "A print shop produces a popular poster in batches and wants to decide how many posters to print per batch. Let x be the number of posters in a batch. The manager breaks down the average cost per poster as follows: materials cost 4 dollars per poster; each production run has a fixed setup cost of 320 dollars, shared equally among the x posters (\\(320/x\\) dollars per poster); and storing finished posters until they sell adds \\(0.05x\\) dollars per poster. The shop wants the batch size that makes the average cost per poster as low as possible.\n\nYou will use AI (for example, ChatGPT or Claude) to help analyze this real-world situation. Work through the problem together with the AI, then answer the questions below.",
      items: [
        {
          id: "3.1",
          kind: "link",
          prompt: "Share the link to your AI interaction.",
          placeholder: "https://…",
          note: "Use your AI tool's share feature to create a public link to the full conversation.",
          reference:
            "The conversation should show (a) translating the cost description into C(x) = 4 + 320/x + 0.05x and (b) minimizing it: C′(x) = 0.05 − 320/x² = 0 gives x = 80, a minimum since C″(x) > 0, with lowest average cost C(80) = 12 dollars per poster. Rubric (3 pts): Link, Modeling dialogue, Correct result.",
        },
        {
          id: "3.2",
          kind: "multiple-choice",
          prompt: "Do you think the AI's response is correct?",
          choices: [
            { id: "A", text: "Yes" },
            { id: "B", text: "No" },
          ],
          note: "This is a self-report item used to understand your verification behavior; it is not graded.",
        },
        {
          id: "3.3",
          kind: "multiple-choice",
          prompt:
            "Have you checked the AI's response? If so, how? (You are not graded on this question, so answer faithfully.)",
          choices: [
            { id: "A", text: "No, I trusted it." },
            { id: "B", text: "Yes, I eyeballed it and it seems right." },
            { id: "C", text: "Yes, I manually computed each step to verify." },
            { id: "D", text: "Yes, other:", allowsOtherText: true },
          ],
          note: "This is a self-report item used to understand your verification behavior; it is not graded.",
        },
      ],
    },
  ],
};

const TESTS: Record<TestId, TestDefinition> = {
  pretest: PRE_TEST,
  posttest: POST_TEST,
};

export function getTest(id: string): TestDefinition | null {
  if (id === "pretest" || id === "posttest") return TESTS[id];
  return null;
}
