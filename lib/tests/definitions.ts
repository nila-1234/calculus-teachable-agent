import { TestDefinition, TestId } from "./types";

const ASSESSMENT_GOALS = [
  "Procedural computation skills that conventional instruction focuses on.",
  "Higher-order model communication and evaluation skills that our system trains.",
  "Real-life problem solving skills in human-AI collaboration.",
];

const CONSEQUENTIAL_GRADING_NOTE =
  "Deduct 1 point for each criterion not met. Criteria are judged independently (consequential grading): a later step correctly executed on the student's own earlier value still earns its point even if that value is wrong. The Model, Derivative, and Critical value points require the correct values.";

const RUBRIC_CREATION_NOTE =
  "Award 1 point for each of the five solution steps that the student's rubric covers with a judgeable criterion. A criterion counts only if it is specific enough to be marked met or not met on an answer.";

const RUBRIC_APPLICATION_NOTE =
  "Award 1 point for each criterion the student judges with the correct verdict and a valid reason; deduct 1 point for each wrong or missing verdict. An overall impression with no criterion-level verdicts earns 0 points. If the student's own rubric uses different criteria, map each one to the closest model criterion and grade its verdict accordingly.";

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
          maxPoints: 5,
          kind: "free-response",
          prompt:
            "A gardener wants to enclose a rectangular garden along a straight river. No fencing is needed on the river side, so only the other three sides must be fenced. The gardener has 60 meters of fencing. Find the dimensions that make the enclosed area as large as possible, and state that maximum area. Show your work.",
          placeholder: "Show your work here…",
          reference:
            "Let x be each side perpendicular to the river and y the side parallel to it, so 2x + y = 60 and A(x) = x(60 − 2x) = 60x − 2x². A′(x) = 60 − 4x = 0 gives x = 15; A(x) is a downward parabola, so this critical point is the maximum. Then y = 60 − 2(15) = 30, and the maximum area is A = 15 × 30 = 450 m².",
          rubric: {
            criteria: [
              {
                name: "Model",
                description:
                  "Builds the single-variable function from the constraint stated in the scenario.",
              },
              {
                name: "Derivative",
                description: "Correctly computes the derivative of the function.",
              },
              {
                name: "Critical value",
                description:
                  "Correctly sets the derivative equal to zero and solves it to find the critical value.",
              },
              {
                name: "Extremum justification",
                description:
                  "Explains why the critical point is the type of extremum the question asks for.",
              },
              {
                name: "Resulting quantities",
                description:
                  "From the critical value, correctly computes the remaining quantities the question asks for.",
              },
            ],
            scoringNote: CONSEQUENTIAL_GRADING_NOTE,
          },
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
          maxPoints: 3,
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
            "A. Revenue is price times quantity sold, so substituting q = 200 − 10p into R = p·q gives R(p) = p(200 − 10p), a single-variable function of price. B is the quantity sold, not revenue; C adds price and quantity, which has no meaning; D ignores that raising the price reduces sales.",
          rubric: {
            criteria: [
              { name: "Correct choice", description: "Selects A." },
              {
                name: "Construction reasoning",
                description:
                  "Explains revenue as price times quantity with the demand relationship substituted in.",
              },
              {
                name: "Rejection reasoning",
                description:
                  "Rules out at least one alternative on structural grounds.",
              },
            ],
            scoringNote: "Deduct 1 point for each criterion not met.",
          },
        },
        {
          id: "2.2",
          maxPoints: 3,
          kind: "free-response",
          prompt:
            "What is the truck trying to understand from this situation? What mathematical information would help it make this decision? Explain your reasoning.",
          placeholder: "Explain your reasoning…",
          reference:
            "The truck wants the price at which daily revenue is greatest. The useful mathematical information is the critical point of R(p) — the value where R′(p) = 0 — together with a justification that this point is a maximum (for example, from the shape of the function), and the revenue there.",
          rubric: {
            criteria: [
              {
                name: "Objective",
                description: "States the goal (the revenue-maximizing price).",
              },
              {
                name: "Mathematical information",
                description:
                  "Names the critical point / derivative as the relevant information.",
              },
              {
                name: "Extremum awareness",
                description:
                  "Notes that the critical point must be justified as a maximum, not assumed.",
              },
            ],
            scoringNote: "Deduct 1 point for each criterion not met.",
          },
        },
        {
          id: "2.3",
          maxPoints: 5,
          kind: "free-response",
          prompt:
            "Imagine you are a grader. Create a rubric for this problem; that is, what does a student's solution need to include to earn full marks?",
          context:
            "After selecting the model, the full problem becomes:\n\nA food truck models its daily revenue at different prices using \\(R(p) = 200p - 10p^2\\), where p is the price in dollars (for \\(0 \\le p \\le 20\\)) and \\(R(p)\\) is the daily revenue in dollars. The truck wants the price that maximizes its daily revenue. What price should it choose, and why?\n\nBelow is an AI student's answer:\n\nThe revenue function is \\(R(p) = 200p - 10p^2\\). A critical point is where the function equals zero, so set \\(R(p) = 0\\):\n\\(200p - 10p^2 = 0 \\;\\Rightarrow\\; 10p(20 - p) = 0 \\;\\Rightarrow\\; p = 0\\) or \\(p = 20\\)\nTake \\(p = 20\\) as the critical value. \\(R(p)\\) is a downward parabola, so this critical point is the maximum. Substituting \\(p = 20\\) back gives \\(q = 200 - 10(20) = 0\\) boxes, so the revenue is \\(R = 20 \\times 0 = 0\\) dollars. The truck should set the price at 20 dollars.",
          contextLabel: "The full problem and an AI student's answer",
          placeholder: "List the criteria a full-marks solution needs to include…",
          reference:
            "A model rubric contains these essential criteria: Derivative — correctly computes the derivative of the function; Critical value — correctly sets the derivative equal to zero and solves it to find the critical value; Extremum justification — explains why the critical point is the type of extremum the question asks for, for example from the shape of the function; Resulting quantities — from the critical value, correctly computes the remaining quantities the question asks for; Recommendation — states the final recommendation for the scenario using those quantities.",
          rubric: {
            criteria: [
              {
                name: "Derivative",
                description:
                  "The student's rubric covers the derivative step (correctly computing the derivative of the function) with a judgeable criterion.",
              },
              {
                name: "Critical value",
                description:
                  "The student's rubric covers the critical-value step (setting the derivative equal to zero and solving it) with a judgeable criterion.",
              },
              {
                name: "Extremum justification",
                description:
                  "The student's rubric covers justifying why the critical point is the type of extremum the question asks for, with a judgeable criterion.",
              },
              {
                name: "Resulting quantities",
                description:
                  "The student's rubric covers computing the remaining quantities from the critical value, with a judgeable criterion.",
              },
              {
                name: "Recommendation",
                description:
                  "The student's rubric covers stating the final recommendation for the scenario, with a judgeable criterion.",
              },
            ],
            scoringNote: RUBRIC_CREATION_NOTE,
          },
        },
        {
          id: "2.4",
          maxPoints: 5,
          kind: "free-response",
          usesAnswerFrom: "2.3",
          prompt:
            "Use the rubric you created in Question 2.3 to evaluate the AI student's answer above. Explain how the AI student's answer meets each part of your rubric or not.",
          context:
            "The AI student's answer (from Question 2.3):\n\nThe revenue function is \\(R(p) = 200p - 10p^2\\). A critical point is where the function equals zero, so set \\(R(p) = 0\\):\n\\(200p - 10p^2 = 0 \\;\\Rightarrow\\; 10p(20 - p) = 0 \\;\\Rightarrow\\; p = 0\\) or \\(p = 20\\)\nTake \\(p = 20\\) as the critical value. \\(R(p)\\) is a downward parabola, so this critical point is the maximum. Substituting \\(p = 20\\) back gives \\(q = 200 - 10(20) = 0\\) boxes, so the revenue is \\(R = 20 \\times 0 = 0\\) dollars. The truck should set the price at 20 dollars.",
          contextLabel: "AI student's answer",
          placeholder:
            "Go through your rubric criterion by criterion and give a verdict with a reason…",
          reference:
            "Correct evaluation of this AI answer: Does not meet Derivative or Critical value — the derivative never appears; the equation solved is R(p) = 0, where the revenue itself is zero, rather than R′(p) = 0, where its rate of change is zero — so p = 20 is not a critical value. Meets Extremum justification, Resulting quantities, and Recommendation — each criterion is judged independently on the answer's own values: from p = 20 it correctly computes q = 0 and R = 0, correctly states the downward-parabola justification, and states a recommendation. (The correct solution: R′(p) = 200 − 20p = 0 gives p = 10, and R(10) = 1000 dollars.)",
          rubric: {
            criteria: [
              {
                name: "Derivative",
                description:
                  "The student judges the Derivative criterion with the correct verdict — NOT MET (the AI answer solved R(p) = 0, not R′(p) = 0) — and a valid reason.",
              },
              {
                name: "Critical value",
                description:
                  "The student judges the Critical value criterion with the correct verdict — NOT MET (p = 20 is not a critical value) — and a valid reason.",
              },
              {
                name: "Extremum justification",
                description:
                  "The student judges the Extremum justification criterion with the correct verdict — MET (the downward-parabola justification is correctly stated) — and a valid reason.",
              },
              {
                name: "Resulting quantities",
                description:
                  "The student judges the Resulting quantities criterion with the correct verdict — MET (q = 0 and R = 0 are correctly computed from the answer's own p = 20, under consequential grading) — and a valid reason.",
              },
              {
                name: "Recommendation",
                description:
                  "The student judges the Recommendation criterion with the correct verdict — MET (a recommendation is stated) — and a valid reason.",
              },
            ],
            scoringNote: RUBRIC_APPLICATION_NOTE,
            scoring: "net",
          },
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
          maxPoints: 3,
          kind: "link",
          prompt: "Share the link to your AI interaction.",
          placeholder: "https://…",
          note: "Use your AI tool's share feature to create a public link to the full conversation.",
          reference:
            "The conversation should show (a) translating the cost description into a model, arriving at A(x) = 8 + 250/x + 0.4x; and (b) working with the AI to minimize it: A′(x) = 0.4 − 250/x² = 0 gives x² = 625, so x = 25; A″(x) = 500/x³ > 0 so it is a minimum; lowest average cost A(25) = 8 + 10 + 10 = 28 dollars per chair.",
          rubric: {
            criteria: [
              {
                name: "Link",
                description: "Provides a working link to the full AI conversation.",
              },
              {
                name: "Modeling dialogue",
                description:
                  "The conversation shows the model being built from the cost description (not the final answer requested in a single message).",
              },
              {
                name: "Correct result",
                description:
                  "The conversation reaches the correct recommendation (about 25 chairs per day at about 28 dollars per chair).",
              },
            ],
            scoringNote: "Deduct 1 point for each criterion not met.",
          },
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
          maxPoints: 5,
          kind: "free-response",
          prompt:
            "An open-top box is made from a square sheet of cardboard 18 cm on each side by cutting an equal square of side x from each corner and folding up the sides. Find the value of x that maximizes the volume of the box, and state that maximum volume. Show your work.",
          placeholder: "Show your work here…",
          reference:
            "The base is (18 − 2x) by (18 − 2x) and the height is x, so V(x) = x(18 − 2x)². V′(x) = 12x² − 144x + 324 = 12(x − 3)(x − 9). Setting V′(x) = 0 gives x = 3 or x = 9; x = 9 gives a box of zero width, so the candidate is x = 3. V′ changes from positive to negative at x = 3 (or V″(3) = −72 < 0), so it is a maximum. The maximum volume is V(3) = 3 × 12² = 432 cm³.",
          rubric: {
            criteria: [
              {
                name: "Model",
                description:
                  "Builds the single-variable function from the folding description in the scenario.",
              },
              {
                name: "Derivative",
                description: "Correctly computes the derivative of the function.",
              },
              {
                name: "Critical value",
                description:
                  "Correctly sets the derivative equal to zero, solves it, and selects the meaningful root.",
              },
              {
                name: "Extremum justification",
                description:
                  "Verifies that the critical point is the type of extremum the question asks for.",
              },
              {
                name: "Resulting quantities",
                description:
                  "From the critical value, correctly computes the remaining quantities the question asks for.",
              },
            ],
            scoringNote: CONSEQUENTIAL_GRADING_NOTE,
          },
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
          maxPoints: 3,
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
            "A. Revenue is price times quantity sold, so substituting q = 120 − 2p into R = p·q gives R(p) = p(120 − 2p), a single-variable function of price. B is the quantity sold, not revenue; C adds price and quantity, which has no meaning; D ignores that raising the price reduces sales.",
          rubric: {
            criteria: [
              { name: "Correct choice", description: "Selects A." },
              {
                name: "Construction reasoning",
                description:
                  "Explains revenue as price times quantity with the demand relationship substituted in.",
              },
              {
                name: "Rejection reasoning",
                description:
                  "Rules out at least one alternative on structural grounds.",
              },
            ],
            scoringNote: "Deduct 1 point for each criterion not met.",
          },
        },
        {
          id: "2.2",
          maxPoints: 3,
          kind: "free-response",
          prompt:
            "What is the company trying to understand from this situation? What mathematical information would help the company make this decision? Explain your reasoning.",
          placeholder: "Explain your reasoning…",
          reference:
            "The company wants the allowed price that earns the most weekly revenue. The useful mathematical information is the critical point of R(p) — where R′(p) = 0 — checked against the contract cap: if the unconstrained best price is not allowed, the maximum on the allowed range falls at the boundary, so R must be evaluated there.",
          rubric: {
            criteria: [
              {
                name: "Objective",
                description:
                  "States the goal (the revenue-maximizing price within the contract).",
              },
              {
                name: "Mathematical information",
                description:
                  "Names the critical point / derivative as the relevant information.",
              },
              {
                name: "Constraint awareness",
                description:
                  "Notes that the critical value must be checked against the cap, and that the boundary matters if it is not allowed.",
              },
            ],
            scoringNote: "Deduct 1 point for each criterion not met.",
          },
        },
        {
          id: "2.3",
          maxPoints: 5,
          kind: "free-response",
          prompt:
            "Imagine you are a grader. Create a rubric for this problem; that is, what does a student's solution need to include to earn full marks?",
          context:
            "After selecting the model, the full problem becomes:\n\nA company models its weekly revenue at different prices using \\(R(p) = 120p - 2p^2\\), where p is the price in dollars and \\(R(p)\\) is the weekly revenue in dollars. Under its contract, the price may not exceed 20 dollars. The company wants the price that gives the most weekly revenue. What price should the company choose, and why?\n\nBelow is an AI student's answer:\n\nThe revenue function is \\(R(p) = 120p - 2p^2\\). Take the derivative:\n\\(R'(p) = 120 - 4p\\)\nSetting \\(R'(p) = 0\\):\n\\(120 - 4p = 0 \\;\\Rightarrow\\; p = 30\\)\nSubstituting back gives \\(R(30) = 30(120 - 60) = 1800\\). The company should set the price at 30 dollars to earn the most revenue, 1800 dollars per week.",
          contextLabel: "The full problem and an AI student's answer",
          placeholder: "List the criteria a full-marks solution needs to include…",
          reference:
            "A model rubric contains these essential criteria: Derivative — correctly computes the derivative of the function; Critical value — correctly sets the derivative equal to zero and solves it to find the unconstrained critical value; Constraint check — checks the critical value against the constraint stated in the scenario and recognizes whether it is allowed; Endpoint justification — explains why the best allowed value falls at the boundary of the allowed range (for example, the function is still rising there); Endpoint value — computes the function's value at the allowed boundary and states the recommendation for the scenario.",
          rubric: {
            criteria: [
              {
                name: "Derivative",
                description:
                  "The student's rubric covers the derivative step (correctly computing the derivative of the function) with a judgeable criterion.",
              },
              {
                name: "Critical value",
                description:
                  "The student's rubric covers the critical-value step (setting the derivative equal to zero and solving for the unconstrained critical value) with a judgeable criterion.",
              },
              {
                name: "Constraint check",
                description:
                  "The student's rubric covers checking the critical value against the constraint stated in the scenario, with a judgeable criterion.",
              },
              {
                name: "Endpoint justification",
                description:
                  "The student's rubric covers explaining why the best allowed value falls at the boundary of the allowed range, with a judgeable criterion.",
              },
              {
                name: "Endpoint value",
                description:
                  "The student's rubric covers computing the function's value at the allowed boundary and stating the recommendation, with a judgeable criterion.",
              },
            ],
            scoringNote: RUBRIC_CREATION_NOTE,
          },
        },
        {
          id: "2.4",
          maxPoints: 5,
          kind: "free-response",
          usesAnswerFrom: "2.3",
          prompt:
            "Use the rubric you created in Question 2.3 to evaluate the AI student's answer above. Explain how the AI student's answer meets each part of your rubric or not.",
          context:
            "The AI student's answer (from Question 2.3):\n\nThe revenue function is \\(R(p) = 120p - 2p^2\\). Take the derivative:\n\\(R'(p) = 120 - 4p\\)\nSetting \\(R'(p) = 0\\):\n\\(120 - 4p = 0 \\;\\Rightarrow\\; p = 30\\)\nSubstituting back gives \\(R(30) = 30(120 - 60) = 1800\\). The company should set the price at 30 dollars to earn the most revenue, 1800 dollars per week.",
          contextLabel: "AI student's answer",
          placeholder:
            "Go through your rubric criterion by criterion and give a verdict with a reason…",
          reference:
            "Correct evaluation of this AI answer: Meets Derivative and Critical value — R′(p) is computed correctly and p = 30 is solved correctly. Does not meet Constraint check, Endpoint justification, or Endpoint value — the answer never compares p = 30 with the 20-dollar cap, never considers the boundary, and recommends a price the company is not allowed to charge. Each criterion is judged independently, so the correct early steps keep their credit even though the conclusion is wrong. (The correct solution: revenue is still rising at the cap, so the best allowed price is p = 20, where R(20) = 1600 dollars.)",
          rubric: {
            criteria: [
              {
                name: "Derivative",
                description:
                  "The student judges the Derivative criterion with the correct verdict — MET (R′(p) = 120 − 4p is computed correctly) — and a valid reason.",
              },
              {
                name: "Critical value",
                description:
                  "The student judges the Critical value criterion with the correct verdict — MET (p = 30 correctly solves R′(p) = 0) — and a valid reason.",
              },
              {
                name: "Constraint check",
                description:
                  "The student judges the Constraint check criterion with the correct verdict — NOT MET (the answer never compares p = 30 with the 20-dollar cap) — and a valid reason.",
              },
              {
                name: "Endpoint justification",
                description:
                  "The student judges the Endpoint justification criterion with the correct verdict — NOT MET (the boundary of the allowed range is never considered) — and a valid reason.",
              },
              {
                name: "Endpoint value",
                description:
                  "The student judges the Endpoint value criterion with the correct verdict — NOT MET (the answer recommends a price the company is not allowed to charge instead of evaluating R at the cap) — and a valid reason.",
              },
            ],
            scoringNote: RUBRIC_APPLICATION_NOTE,
            scoring: "net",
          },
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
          maxPoints: 3,
          kind: "link",
          prompt: "Share the link to your AI interaction.",
          placeholder: "https://…",
          note: "Use your AI tool's share feature to create a public link to the full conversation.",
          reference:
            "The conversation should show (a) translating the cost description into a model, arriving at C(x) = 4 + 320/x + 0.05x; and (b) working with the AI to minimize it: C′(x) = 0.05 − 320/x² = 0 gives x² = 6400, so x = 80; C″(x) = 640/x³ > 0 so it is a minimum; lowest average cost C(80) = 4 + 4 + 4 = 12 dollars per poster.",
          rubric: {
            criteria: [
              {
                name: "Link",
                description: "Provides a working link to the full AI conversation.",
              },
              {
                name: "Modeling dialogue",
                description:
                  "The conversation shows the model being built from the cost description (not the final answer requested in a single message).",
              },
              {
                name: "Correct result",
                description:
                  "The conversation reaches the correct recommendation (about 80 posters per batch at about 12 dollars per poster).",
              },
            ],
            scoringNote: "Deduct 1 point for each criterion not met.",
          },
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
