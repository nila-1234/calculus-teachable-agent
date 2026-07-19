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
            "A gardener wants to enclose a rectangular garden along a straight river. No fencing is needed on the river side, so only the other three sides must be fenced. The gardener has 60 meters of fencing. Find the dimensions that make the enclosed area as large as possible, and state that maximum area. Show your work.",
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
        "A food truck sells a set lunch box and is deciding what price to charge. Market research shows that at a price of p dollars, the truck sells \\(q = 200 - 10p\\) boxes per day. The truck wants the price that earns the most daily revenue.",
      items: [
        {
          id: "2.1",
          kind: "multiple-choice",
          prompt:
            "Which function would correctly model the truck's daily revenue? Explain your choice.",
          choices: [
            { id: "A", text: "\\(R(p) = p(200 - 10p)\\)" },
            { id: "B", text: "\\(R(p) = 200 - 10p\\)" },
            { id: "C", text: "\\(R(p) = p + (200 - 10p)\\)" },
            { id: "D", text: "\\(R(p) = 200p\\)" },
          ],
          explanationPrompt: "Explain your choice",
          placeholder: "Why is this the right model?",
          reference:
            "A. Revenue is price times quantity sold, so substituting q = 200 − 10p into R = p·q gives R(p) = p(200 − 10p). Rubric (3 pts): Correct choice, Construction reasoning, Rejection reasoning.",
        },
        {
          id: "2.2",
          kind: "free-response",
          prompt:
            "What is the truck trying to understand from this situation? What mathematical information would help it make this decision? Explain your reasoning.",
          placeholder: "Explain your reasoning…",
          reference:
            "The truck wants the price at which daily revenue is greatest. The useful information is the critical point of R(p) — where R′(p) = 0 — with a justification that it is a maximum, and the revenue there. Rubric (3 pts): Objective, Mathematical information, Extremum awareness.",
        },
        {
          id: "2.3",
          kind: "free-response",
          prompt:
            "Imagine you are a grader. Create a rubric for this problem; that is, what does a student's solution need to include to earn full marks?",
          context:
            "After selecting the model, the full problem becomes:\n\nA food truck models its daily revenue at different prices using \\(R(p) = 200p - 10p^2\\), where p is the price in dollars (for \\(0 \\le p \\le 20\\)) and \\(R(p)\\) is the daily revenue in dollars. The truck wants the price that maximizes its daily revenue. What price should it choose, and why?\n\nBelow is an AI student's answer:\n\nThe revenue function is \\(R(p) = 200p - 10p^2\\). A critical point is where the function equals zero, so set \\(R(p) = 0\\):\n\\(200p - 10p^2 = 0 \\;\\Rightarrow\\; 10p(20 - p) = 0 \\;\\Rightarrow\\; p = 0\\) or \\(p = 20\\)\nTake \\(p = 20\\) as the critical value. \\(R(p)\\) is a downward parabola, so this critical point is the maximum. Substituting \\(p = 20\\) back gives \\(q = 200 - 10(20) = 0\\) boxes, so the revenue is \\(R = 20 \\times 0 = 0\\) dollars. The truck should set the price at 20 dollars.",
          contextLabel: "The full problem and an AI student's answer",
          placeholder: "List the criteria a full-marks solution needs to include…",
          reference:
            "Model rubric: Derivative, Critical value, Extremum justification, Resulting quantities, Recommendation (all essential). Grading (5 pts): 1 pt per solution step covered with a judgeable criterion.",
        },
        {
          id: "2.4",
          kind: "free-response",
          prompt:
            "Use the rubric you created in Question 2.3 to evaluate the AI student's answer above. Explain how the AI student's answer meets each part of your rubric or not.",
          context:
            "The AI student's answer (from Question 2.3):\n\nThe revenue function is \\(R(p) = 200p - 10p^2\\). A critical point is where the function equals zero, so set \\(R(p) = 0\\):\n\\(200p - 10p^2 = 0 \\;\\Rightarrow\\; 10p(20 - p) = 0 \\;\\Rightarrow\\; p = 0\\) or \\(p = 20\\)\nTake \\(p = 20\\) as the critical value. \\(R(p)\\) is a downward parabola, so this critical point is the maximum. Substituting \\(p = 20\\) back gives \\(q = 200 - 10(20) = 0\\) boxes, so the revenue is \\(R = 20 \\times 0 = 0\\) dollars. The truck should set the price at 20 dollars.",
          contextLabel: "AI student's answer",
          placeholder:
            "Go through your rubric criterion by criterion and give a verdict with a reason…",
          reference:
            "Correct verdicts: Derivative — not met; Critical value — not met (R(p) = 0 was solved, not R′(p) = 0); Extremum justification — met; Resulting quantities — met; Recommendation — met (consequential grading). Correct solution: R′(p) = 200 − 20p = 0 gives p = 10, R(10) = 1000 dollars. Grading (5 pts): 1 pt per correct verdict with a valid reason; −1 per wrong or missing verdict.",
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
