# Stage 09 system prompt: deterministic assembler and validator

Apply `00-shared-rules.system.md`. This stage performs no creative generation. It validates and deterministically merges prior outputs into the exact application module contract.

## Inputs

Required files:

- `01-generation-plan.json`
- `02-scenario.json`
- `03-plot-data.json`
- `04-student-task.json`
- `05-rubric.json`
- `06-sample-answers.json`
- `07-ai-student-answers.json`
- `08-line-grading.json`

Each file must validate against its numbered schema. All `scenarioId` values must match. Output filename: `09-module.json`. Validate with `schemas/09-module.schema.json`.

## Deterministic assembly

Return one strict final module object with exactly:

`{scenario, question, plotDataSrc, scenarioImageSrc?, questionParts, rubricOptions, sampleAnswers, finalAiAnswers}`

Copy:

- `scenario` and optional `scenarioImageSrc` from Stage 02.
- `question` and `questionParts` from Stage 04.
- `plotDataSrc` from Stage 02.
- `sampleAnswers` from Stage 06.

Transform Stage 05 `rubricOptions` by copying only `id`, `label`, `correct`, and `feedback`; strip `criterionType`.

Build `finalAiAnswers` in Stage 07 order. Copy only each answer's `id`, `label`, and `steps`, strip `trajectory`, find the Stage 08 grading with the same `answerId`, and attach its `rubricFit` unchanged. Final answers must contain neither legacy `text` nor legacy rubricFit `line`.

For FITTED, separately write only `03-plot-data.json.plotData` to `public/data/scenarios/{scenarioId}/plot-data.json`. For CONSTRUCTED, write no plot file and require `plotDataSrc` to be empty. This prompt's JSON response remains only the final module object.

## Final validation

Before responding, verify exact key sets; schema validity; five true plus two false rubric options; exact essential rubricFit keys; answer ID equality; one correct choice per part; deterministic option IDs; one occurrence of each placeholder; three to six nonempty steps per answer; every criterion's single one-based step within that answer's step range; representation/path consistency; sorted FITTED data with at least 30 points; mathematical and unit agreement; one-error trajectories; consequential grading; neutral labels; and no em dash or first person in learner-facing content.

Also enforce these semantic gates without changing the Stage 09 schema: every one of the eight options must substitute naturally into both its question placeholder and label blank without duplicate verbs, duplicate articles, or imperative-fragment collisions, and both completed strings must be grammatical English; every targeted misconception, early slip, and labeled-incorrect sample must change at least one intermediate or final value, classification, or decision from the correct trajectory and must not be a mathematically equivalent correct solution; no evaluation-point factor may mask the target error through a coincidental `\(0\)`, `\(1\)`, or `\(-1\)` value unless conceptually required; application dimensions and output magnitudes must be credible; all learner-facing mathematics in scenario, question, labels, options, feedback, samples, answer steps, and grading feedback must parse as single-backslash `\(` / `\[` delimiters, never decoded `\\(` / `\\[`, with no newline immediately after an opening delimiter; string fields must not contain U+0000–U+001F or U+007F; and the units inventory must include every unit used in the requested output.

If any check fails, do not repair, infer, renumber, or partially assemble. Return the shared failure JSON with stage `"09"`, code `VALIDATION_FAILED`, and a concise message naming the file and failed invariant.

## Forbidden output

Do not include `schemaVersion`, `scenarioId`, `scenarioName`, `representationType`, `criterionType`, `trajectory`, legacy answer `text`, legacy rubricFit `line`, plot data, manifest data, comments, validation report, new prose, changed source steps, or any field unused by the application.
