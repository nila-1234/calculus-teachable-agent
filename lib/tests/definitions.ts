import type { FormId, TestDefinition, TestId, TestItem } from "./types";

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
          mathInput: true,
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
          ["⋮", "⋮", "⋮"],
          ["\\(\\$p\\)", "\\(200 - 10p\\)", "?"],
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
            "The company’s daily revenue is modeled by \\(R(p) = p(200 - 10p)\\), where \\(p\\) is the price of one lunch box.\n\nWhat are the key concepts needed to determine the price that maximizes the company’s daily revenue? Identify the important mathematical concepts the company should find and explain why they are relevant. You do not need to calculate the price.",
          placeholder: "Identify the key concepts and explain why they are relevant…",
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
              text: "The coefficient of \\(p^2\\) in \\(R(p) = 200p - 10p^2\\) is negative, so the graph is a downward-opening parabola (an inverted U). So \\(p = 10\\) produces a maximum.",
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
            "Correct matches: R(p) = p(200 − 10p) and R(p) = 200p − 10p² → 3. Formulate the objective function; R′(p) = 200 − 20p → 5. Find the derivative; 200 − 20p = 0 and p = 10 → 1. Find the critical point; the negative leading coefficient (downward parabola) → 4. Confirm that the critical point is a maximum.",
        },
        {
          id: "2.4",
          kind: "multiple-choice",
          prompt:
            "The model uses the restriction \\(0 \\le p \\le 20\\).\n\nWhy is this restriction meaningful in the food truck situation?",
          choices: [
            {
              id: "A",
              text: "A price above $20 would make the model predict a negative number of lunch boxes sold.",
            },
            {
              id: "B",
              text: "The company’s revenue must always be between $0 and $20.",
            },
            {
              id: "C",
              text: "The derivative of the revenue function can only be calculated for prices between $0 and $20, because outside that interval the revenue formula no longer applies and its slope cannot be found.",
            },
          ],
          reference:
            "A. If the price is more than $20, then 200 − 10p would give a negative number of lunch boxes sold, which is not meaningful in this situation.",
        },
      ],
    },
    {
      id: "q3",
      title: "Question 3",
      scenario:
        "A small workshop builds wooden chairs and wants to decide how many chairs to make per day.\n\nLet \\(x\\) be the number of chairs made per day. The workshop's accountant breaks down the average cost per chair as follows: materials and labor cost 8 dollars per chair; the fixed daily cost of 250 dollars is shared equally among the \\(x\\) chairs; and crowding and overtime add \\(0.4x\\) dollars per chair.\n\nBecause of an existing contract and the workshop's production capacity, it must produce between 30 and 60 chairs per day.\n\nThe workshop wants to determine the daily production level that minimizes its average cost per chair.\n\nA student asks an AI for help:\n\nStudent:\nCan you help me figure out how many chairs the workshop should make per day?\n\nAI:\nSure. First, we can model the average cost per chair as:\n\\(C(x) = 8 + 250/x + 0.4x\\)\nThen we can differentiate:\n\\(C'(x) = -\\frac{250}{x^2} + 0.4\\)\nSetting \\(C'(x) = 0\\) gives \\(x = 25\\).\nSo 25 chairs per day is where the average-cost function reaches its minimum.\n\nStudent:\nOkay, so should I say the workshop should make 25 chairs per day?\n\nAI:\nBased on the minimum we found, yes, 25 chairs per day minimizes the average cost.",
      items: [
        {
          id: "3.1",
          kind: "multiple-choice",
          prompt: "At this point in the conversation, what should the student do?",
          choices: [
            {
              id: "A",
              text: "Accept the AI's recommendation and use 25 chairs as the final answer.",
            },
            {
              id: "B",
              text: "Ask the AI to explain its calculations in more detail before deciding.",
            },
            {
              id: "C",
              text: "Question the AI's recommendation before accepting it.",
            },
            {
              id: "D",
              text: "Start the problem over and solve it independently without the AI.",
            },
          ],
          reference:
            "C. The student should question the AI's recommendation before accepting it. Although the AI found a mathematical minimum at 25 chairs, the original problem says that the workshop must produce between 30 and 60 chairs per day. The AI has not accounted for that requirement when making its recommendation.",
        },
        {
          id: "3.2",
          kind: "free-response",
          prompt:
            "Continue the conversation.\n\nWhat would you say to the AI next?\n\nWrite your next message to the AI. Your goal is to evaluate the AI's response and move the conversation toward an appropriate recommendation for the workshop.",
          placeholder: "Write your next message to the AI…",
          reference:
            "Example: The workshop has to produce between 30 and 60 chairs per day, but you recommended 25. How does that constraint affect your answer? What production level should the workshop choose within the allowed range?",
        },
      ],
    },
  ],
};

const POST_TEST: TestDefinition = {
  id: "posttest",
  title: "Assessment — Optimization (Post-Test)",
  intro: [
    "This assessment has three questions: a worked optimization problem, a multi-part modeling and evaluation exercise, and a real-world problem you analyze together with an AI.",
    "Answer all questions. Show your work where requested. For questions involving an AI response, evaluate the response using both the mathematics and the real-world information in the problem.",
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
            "A community center wants to enclose a rectangular outdoor activity area next to a long building. The side along the building does not require fencing, so fencing is needed only for the two sides perpendicular to the building and the one side parallel to it. The center has 80 meters of fencing.\n\nUse calculus to determine the dimensions of the activity area that maximize its enclosed area and state the maximum area. Show your work.",
          placeholder: "Show your work here…",
          mathInput: true,
          reference:
            "Let x be each side perpendicular to the building and y the side parallel to it, so 2x + y = 80 and A(x) = x(80 − 2x) = 80x − 2x². A′(x) = 80 − 4x = 0 gives x = 20; A is a downward parabola so this is the maximum. y = 40, maximum area 800 m². Rubric (5 pts, consequential grading): Model, Derivative, Critical value, Extremum justification, Resulting quantities.",
        },
      ],
    },
    {
      id: "q2",
      title: "Question 2",
      scenario:
        "A company sells a product online and is deciding what price to charge. Market research predicts that the number of units sold depends on the price.\n\nThe table shows the company's weekly revenue at two example prices:",
      table: {
        columns: [
          "Price per unit",
          "Units sold per week",
          "Weekly revenue",
        ],
        rows: [
          ["$10", "100", "$1000"],
          ["$20", "80", "$1600"],
          ["⋮", "⋮", "⋮"],
          ["\\(\\$p\\)", "\\(120 - 2p\\)", "?"],
        ],
      },
      tableNote:
        "The company wants to determine the price that will produce the greatest weekly revenue.",
      items: [
        {
          id: "2.1",
          kind: "multiple-choice",
          prompt:
            "Based on the relationships shown in the table, which function models the company's weekly revenue?",
          choices: [
            { id: "A", text: "\\(R(p) = p + (120 - 2p)\\)" },
            { id: "B", text: "\\(R(p) = 120 - 2p\\)" },
            { id: "C", text: "\\(R(p) = p(120 - 2p)\\)" },
          ],
          explanationPrompt:
            "Explain how the numerical examples in the table support your choice.",
          placeholder: "Use the values in the table to explain your choice…",
          reference:
            "C. At a price of $10, 10 × 100 = 1000; at a price of $20, 20 × 80 = 1600. The examples show that weekly revenue is found by multiplying price by the number of units sold. Therefore, R(p) = p(120 − 2p).",
        },
        {
          id: "2.2",
          kind: "free-response",
          prompt:
            "The company's weekly revenue is modeled by \\(R(p) = p(120 - 2p)\\), where \\(p\\) is the price of one unit.\n\nWhat are the key concepts needed to determine the price that maximizes the company's weekly revenue? Identify the important mathematical concepts the company should find and explain why they are relevant. You do not need to calculate the price.",
          placeholder: "Identify the key concepts and explain why they are relevant…",
          reference:
            "The company should use the derivative of the revenue function to find a critical point. A critical point occurs where the derivative equals zero or is undefined. It is relevant because it is a point where revenue could reach a maximum or minimum, but the point must be checked to confirm that it is a maximum. Do not require the student to calculate p.",
        },
        {
          id: "2.3",
          kind: "matching",
          prompt:
            "A correct solution to the company's revenue problem is shown below. For each part of the solution, use the dropdown menu to identify its general mathematical purpose.\n\nEach option may be used once or not at all.",
          matchRows: [
            {
              id: "objective",
              text: "\\(R(p) = p(120 - 2p)\\)\n\\(R(p) = 120p - 2p^2\\)",
            },
            {
              id: "derivative",
              text: "\\(R'(p) = 120 - 4p\\)",
            },
            {
              id: "critical-point",
              text: "\\(120 - 4p = 0\\)\n\\(p = 30\\)",
            },
            {
              id: "maximum",
              text: "The coefficient of \\(p^2\\) in \\(R(p) = 120p - 2p^2\\) is negative, so the graph is a downward-opening parabola (an inverted U). So \\(p = 30\\) produces a maximum.",
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
            "Correct matches: R(p) = p(120 − 2p) and R(p) = 120p − 2p² → 3. Formulate the objective function; R′(p) = 120 − 4p → 5. Find the derivative; 120 − 4p = 0 and p = 30 → 1. Find the critical point; the negative leading coefficient (downward parabola) → 4. Confirm that the critical point is a maximum.",
        },
        {
          id: "2.4",
          kind: "multiple-choice",
          prompt:
            "The model uses the restriction \\(0 \\le p \\le 60\\).\n\nWhy is this restriction meaningful in the company's situation?",
          choices: [
            {
              id: "A",
              text: "A price above $60 would make the model predict a negative number of units sold.",
            },
            {
              id: "B",
              text: "The company's revenue must always be between $0 and $60.",
            },
            {
              id: "C",
              text: "The derivative of the revenue function can only be calculated for prices between $0 and $60, because outside that interval the revenue formula no longer applies and its slope cannot be found.",
            },
          ],
          reference:
            "A. If the price is more than $60, then 120 − 2p would give a negative number of units sold, which is not meaningful in this situation.",
        },
      ],
    },
    {
      id: "q3",
      title: "Question 3",
      scenario:
        "A print shop produces a popular poster in batches and wants to decide how many posters to print per batch.\n\nLet \\(x\\) be the number of posters in a batch. The manager breaks down the average cost per poster as follows: materials cost 4 dollars per poster; each production run has a fixed setup cost of 320 dollars, shared equally among the \\(x\\) posters; and storing the finished posters adds \\(0.05x\\) dollars per poster.\n\nBecause of an existing contract and storage requirements, the shop must print between 90 and 120 posters per batch.\n\nThe shop wants the batch size that minimizes its average cost per poster.\n\nA student asks an AI for help:\n\nStudent:\nCan you help me figure out how many posters the shop should print per batch?\n\nAI:\nSure. First, we can model the average cost per poster as:\n\\(C(x) = 4 + 320/x + 0.05x\\)\nThen we can differentiate:\n\\(C'(x) = -\\frac{320}{x^2} + 0.05\\)\nSetting \\(C'(x) = 0\\) gives \\(x = 80\\).\nSo 80 posters per batch is where the average-cost function reaches its minimum.\n\nStudent:\nOkay, so should I say the shop should print 80 posters per batch?\n\nAI:\nYes. Based on the minimum we found, 80 posters per batch minimizes the average cost.",
      items: [
        {
          id: "3.1",
          kind: "multiple-choice",
          prompt: "At this point in the conversation, what should the student do?",
          choices: [
            {
              id: "A",
              text: "Accept the AI's recommendation and use 80 posters as the final answer.",
            },
            {
              id: "B",
              text: "Ask the AI to explain its calculations in more detail before deciding.",
            },
            {
              id: "C",
              text: "Question the AI's recommendation before accepting it.",
            },
            {
              id: "D",
              text: "Start the problem over and solve it independently without the AI.",
            },
          ],
          reference:
            "C. The student should question the AI's recommendation before accepting it. Although the AI found a mathematical minimum at 80 posters, the original problem says that the shop must print between 90 and 120 posters per batch. The AI has not accounted for that requirement when making its recommendation.",
        },
        {
          id: "3.2",
          kind: "free-response",
          prompt:
            "What would you say to the AI next?\n\nWrite your next message to the AI. Your goal is to evaluate the AI's response and move the conversation toward an appropriate recommendation for the print shop.",
          placeholder: "Write your next message to the AI…",
          reference:
            "Example: The shop has to print between 90 and 120 posters per batch, but you recommended 80. How does that constraint affect your answer? What batch size should the shop choose within the allowed range?",
        },
      ],
    },
  ],
};

const TESTS: Record<TestId, TestDefinition> = {
  pretest: PRE_TEST,
  posttest: POST_TEST,
};

/**
 * The original fixed tests (pre = Version A, post = Version B, each with only
 * Q1a in Question 1). Still used by the pilot and to read data collected
 * before counterbalancing; the main study now uses getPhaseTest().
 */
export function getTest(id: string): TestDefinition | null {
  if (id === "pretest" || id === "posttest") return TESTS[id];
  return null;
}

/* ===================================================== counterbalanced forms */

/**
 * Question 1's short items per version: Q1b, Q1c, Q1e, Q1f. Four LearnVia
 * Self-Quiz 10.2.8 items, word for word (two in each version); the matching
 * item in the other version is an isomorphic copy — same wording, different
 * numbers. Each pair puts its maximum within the allowed range in one version
 * and at the edge in the other; f asks for the objective function itself.
 * (Q1d, a fencing problem not from LearnVia that mirrored Q1a, was dropped;
 * the ids are kept so scoring and older logs line up.) Answers are verified:
 * A 324, 45, 96, −x² + 25x; B 16, 25, 81, −x² + 35x.
 */
const Q1_SHORT: Record<FormId, TestItem[]> = {
  A: [
    {
      id: "1b",
      kind: "short-answer",
      prompt:
        "A particle moves along a straight line at varying speed in both directions. The distance traveled at time \\(t\\) seconds is \\(d(t) = t^3 - 21t^2 + 144t\\) cm. The maximum distance in the time interval \\(0 \\le t \\le 8\\) is ______ cm.",
      placeholder: "Your answer…",
      reference:
        "LearnVia original (Self-Quiz 10.2.8, particle motion) — within range. 324 cm, at t = 6 (interior critical point; t = 8 gives 320).",
    },
    {
      id: "1c",
      kind: "short-answer",
      prompt:
        "A manufacturer builds widgets at a cost of $5 each. The consumer demand fits the equation \\(d(x) = 170 - 2x\\), where \\(d\\) is the quantity sold (demand) and \\(x\\) is the price the consumer pays for a widget. The manufacturer's total profit (total revenue minus total cost) is \\(P(x) = d(x)(x - 5)\\). Maximum profit occurs at price \\(x =\\) ______.",
      placeholder: "Your answer…",
      reference:
        "LearnVia original (Self-Quiz 10.2.8, profit) — within range. x = 45 (P(x) = −2x² + 180x − 850).",
    },
    {
      id: "1e",
      kind: "short-answer",
      prompt:
        "A rectangular garden with perimeter 40 feet has one side of length \\(x\\) feet, and a design requirement forces \\(12 \\le x \\le 18\\). The maximum possible area is \\(A =\\) ______ ft².",
      placeholder: "Your answer…",
      reference:
        "Isomorphic to the LearnVia garden item (Version B Q1e) — on the edge. 96 ft², at x = 12 (the critical point x = 10 is outside [12, 18]).",
    },
    {
      id: "1f",
      kind: "short-answer",
      prompt:
        "A rectangle of length \\(x\\) and width \\(y\\) inches has perimeter 50 inches. For a maximum area with the given perimeter, the objective function to maximize is area \\(A(x)\\). Written in terms of \\(x\\) only, \\(A(x) =\\) ______.",
      placeholder: "Your answer…",
      reference:
        "Isomorphic to the LearnVia objective-function item (Version B Q1f). A(x) = −x² + 25x (2x + 2y = 50, so y = 25 − x).",
    },
  ],
  B: [
    {
      id: "1b",
      kind: "short-answer",
      prompt:
        "A particle moves along a straight line at varying speed in both directions. The distance traveled at time \\(t\\) seconds is \\(d(t) = t^3 - 9t^2 + 24t\\) cm. The maximum distance in the time interval \\(0 \\le t \\le 1\\) is ______ cm.",
      placeholder: "Your answer…",
      reference:
        "Isomorphic to the LearnVia particle item (Version A Q1b) — on the edge. 16 cm, at t = 1 (the critical points t = 2 and t = 4 are outside [0, 1]).",
    },
    {
      id: "1c",
      kind: "short-answer",
      prompt:
        "A manufacturer builds widgets at a cost of $10 each. The consumer demand fits the equation \\(d(x) = 120 - 2x\\), where \\(d\\) is the quantity sold (demand) and \\(x\\) is the price the consumer pays for a widget. The manufacturer's total profit (total revenue minus total cost) is \\(P(x) = d(x)(x - 10)\\). A price regulation requires \\(10 \\le x \\le 25\\). Maximum profit within that range occurs at price \\(x =\\) ______.",
      placeholder: "Your answer…",
      reference:
        "Isomorphic to the LearnVia profit item (Version A Q1c) — on the edge. x = 25 (the unconstrained best, x = 35, is outside [10, 25]).",
    },
    {
      id: "1e",
      kind: "short-answer",
      prompt:
        "A rectangular garden with perimeter 36 feet has maximum possible area \\(A =\\) ______ ft².",
      placeholder: "Your answer…",
      reference:
        "LearnVia original (Self-Quiz 10.2.8, garden area) — within range. 81 ft² (a 9 × 9 square).",
    },
    {
      id: "1f",
      kind: "short-answer",
      prompt:
        "A rectangle of length \\(x\\) and width \\(y\\) inches has perimeter 70 inches. For a maximum area with the given perimeter, the objective function to maximize is area \\(A(x)\\). Written in terms of \\(x\\) only, \\(A(x) =\\) ______.",
      placeholder: "Your answer…",
      reference:
        "LearnVia original (Self-Quiz 10.2.8, objective function). A(x) = −x² + 35x (2x + 2y = 70, so y = 35 − x).",
    },
  ],
};

/** Each version's Q1a (the worked problem). Asked in screening, not the test. */
export const Q1A_ITEM: Record<FormId, TestItem> = {
  A: PRE_TEST.sections[0].items[0],
  B: POST_TEST.sections[0].items[0],
};

/** The legacy test that carries a version's Question 2 and Question 3. */
const FORM_BASE: Record<FormId, TestDefinition> = { A: PRE_TEST, B: POST_TEST };

/**
 * Everything in one version: Q1a, Q1b, Q1c, Q1e, Q1f, Question 2, Question 3. Used to
 * grade and to look up any item's wording, whichever phase it was taken in.
 */
export function getFormTest(form: FormId): TestDefinition {
  const base = FORM_BASE[form];
  const [q1, ...rest] = base.sections;
  return {
    ...base,
    form,
    sections: [{ ...q1, items: [Q1A_ITEM[form], ...Q1_SHORT[form]] }, ...rest],
  };
}

const PHASE_TITLES: Record<TestId, string> = {
  pretest: "Assessment — Optimization (Pre-Test)",
  posttest: "Assessment — Optimization (Post-Test)",
};

const PHASE_INTROS: Record<TestId, string[]> = {
  pretest: [
    "This assessment has three questions: four short calculus problems, a multi-part modeling and grading exercise, and a real-world problem you analyze together with an AI.",
    "Use the math keypad under each answer box to enter symbols such as powers and square roots.",
    "Answer each question in order. Once you continue past a question you cannot go back and change your answer.",
  ],
  posttest: [
    "This assessment has three questions: four short calculus problems, a multi-part modeling and evaluation exercise, and a real-world problem you analyze together with an AI.",
    "For questions involving an AI response, evaluate the response using both the mathematics and the real-world information in the problem. Use the math keypad under each answer box to enter symbols such as powers and square roots.",
    "Answer each question in order. Once you continue past a question you cannot go back and change your answer.",
  ],
};

/**
 * The test a participant takes in a phase, from their assigned version: Q1a
 * is left out (it was asked in screening), and Q1b, Q1c, Q1e, Q1f appear in random order.
 */
export function getPhaseTest(testId: TestId, form: FormId): TestDefinition {
  const full = getFormTest(form);
  const [q1, ...rest] = full.sections;
  return {
    ...full,
    id: testId,
    title: PHASE_TITLES[testId],
    intro: PHASE_INTROS[testId],
    sections: [
      { ...q1, items: q1.items.filter((item) => item.id !== "1"), shuffle: true },
      ...rest,
    ],
  };
}
