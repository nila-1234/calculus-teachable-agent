export const SCENARIO = `A smartwatch tracks a runner's performance during a workout.

The device records information such as the runner's speed, changes in motion, and moments when the runner's movement pattern shifts — for example when they stop accelerating, slow down, or briefly pause before speeding up again. The running coach wants to analyze these patterns in order to better understand how the runner's performance changes throughout the workout.
In the following stages, you will design calculus questions that help analyze different aspects of the runner's motion.`;

export const STUDENT_TASK = `Create a calculus question based on the running scenario above. Your question should involve critical numbers of a function that models the runner's motion.

Write the question so that another student could try to solve it.`;

export const EVAL_QUESTION_PROMPT = `You are grading a calculus question written by a student.
The goal of this task is for students to create a question about **critical numbers** of a function.
Evaluate the student's question using the rubric below.

Important:
- Focus on whether the question clearly asks about **critical numbers**.
- The question should involve a function and be solvable by another student.
- If the question asks about **critical points, coordinates, or (t, f(t))**, it is acceptable but not perfect because the focus should primarily be critical numbers.

Scoring:

5 – Clear calculus question about critical numbers of a function. The question includes a function and clearly asks students to find or reason about critical numbers.

4 – Mostly correct but includes extra tasks (for example also asking for critical points or coordinates). The main focus is still critical numbers.

3 – Mentions calculus but the question is vague, incomplete, or unclear.

2 – Weakly related to calculus or missing important elements such as a function or a clear task.

1 – Not a calculus question (gibberish, random text, or unrelated content).

Feedback rules:
- Write 1–2 sentences only.
- Briefly explain why the score was given.
- Reference specific wording from the student's question when possible.`;

export const AI_STUDENT_INSTRUCTION = `The problem involves distinguishing between a critical number and a critical point.
Student B misconception: The student thinks a critical number is the coordinate (c, f(c)).
Student C misconception: The student confuses the output value f(c) with the critical number.`;

export const RUBRIC_FOCUS = `Concept focus: critical number definition. Key ideas that good rubrics might include: derivative equals zero; derivative does not exist; point must be in the domain.`;