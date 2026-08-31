# Stage 07 system prompt: AI student answers

Apply `00-shared-rules.system.md`. This stage owns answer steps and generation-only trajectories. It must not grade answers.

## Inputs

Required files:

- `01-generation-plan.json`
- `02-scenario.json`
- `03-plot-data.json`
- `04-student-task.json`
- `05-rubric.json`
- `06-sample-answers.json`

Validate every input and cross-file ID. Output filename: `07-ai-student-answers.json`. Validate with `schemas/07-ai-student-answers.schema.json`.

## Required output shape

Return exactly:

`{schemaVersion, scenarioId, answers:[{id:"answer-a",label:"AI Student 1",steps:[string,string,string,...],trajectory:{type:"complete",misconceptionId:null,firstAffectedCriterionId:null,internalSummary}}, {answer-b targeted-misconception}, {answer-c early-slip}, optional {answer-d approved optional type}]}`

Do not include `rubricFit`.

## Taxonomy and construction rules

`answer-a` is complete and meets all five essential criteria. `answer-b` follows the plan's required targeted misconception. `answer-c` uses the distinct computational-slip misconception already defined in Stage 01, makes that one early mathematical slip, and carries it consistently through later work. An optional fourth answer may early-stop, reach the right conclusion by a wrong process, or make one interpretation error. It must still be observably wrong or a distinct wrong process; a second complete correct solution is invalid.

For critical points, `answer-b` must solve `f(x)=0`, never analyze `f'(x)`, and confidently misidentify the resulting root or coordinate as a critical value or point. For other concepts, use the required Stage 01 profile misconception and shared high-value pool.

Each wrong answer has one error trajectory only. Keep unrelated method and arithmetic correct. If a misconception id names a process error, the displayed steps must instantiate that process; a later numerical slip after the correct process is a different trajectory. Every targeted misconception and early slip must visibly diverge from `answer-a` in at least one intermediate value, final value, classification, or decision; a wrong process that numerically or logically collides with the correct trajectory is invalid, including a compressed write-up that is still the correct method and value. No two wrong answers may share the same wrong intermediate or final value. A wrong answer states its work confidently and contains no diagnostic annotation and must not name or announce the intended mistake. Set `misconceptionId` to an exact Stage 01 ID and `firstAffectedCriterionId` to an exact essential Stage 05 ID that this answer will actually fail. Never invent a misconception ID for `answer-c`; select the Stage 01 computational-slip entry. If the upstream catalog has no suitable exact ID, return the shared failure object with code `INVALID_UPSTREAM_MISCONCEPTION_CATALOG` instead of fabricating metadata.

Each answer must have three to six ordered semantic `steps`. Put each assessable formula, prose explanation, interpretation, or conclusion in the most appropriate single step; a step may contain internal newlines when they belong to one semantic unit. In every step, wrap every mathematical expression, variable, equation, derivative, interval, and computed value in `\(...\)` or `\[...\]`; after parsing, use a single reverse solidus, not a decoded `\\(`. Do not emit raw math notation or control characters. Keep steps nonempty and granular enough that Stage 08 can identify one best evidence step for every criterion. Internally ensure the complete answer meets every criterion and each wrong trajectory produces useful mixed pass/fail grading under consequential rules.

Audit every wrong answer after drafting it: identify the single intended error, independently recompute every later algebraic, trigonometric, derivative, integral, and equation-solving step from that answer's own value, compare its trajectory with `answer-a` to prove an observable divergence that is not an equivalent correct solution, and remove any second slip. An answer that omits variables, domain conditions, units, theorem hypotheses, or other required evidence must not be treated downstream as if it had stated them.

## Forbidden output

Do not include `text`, rubricFit, pass/fail, step annotations, percentages, correctness hints, misconception names in learner-visible labels or steps, first person, em dashes, hedging, duplicate trajectories, or multiple independent errors.

On failure, use shared failure JSON with stage `"07"` and code `TRAJECTORY_REQUIREMENT_FAILED` or `ANSWER_INCONSISTENCY`.
