# Multi-stage instruction problem-set generator

This directory replaces the former monolithic single-call generator with nine validated JSON stages. Each call combines `prompts/00-shared-rules.system.md` with one numbered system prompt, supplies only the named inputs, and saves the JSON-only response under the required filename.

The directory also contains the separate runtime-only hidden prompt
`prompts/grading-dispute-dialogue.system.md` and its strict response schema
`schemas/grading-dispute-dialogue.schema.json`. They power student-view grading
disputes after module generation. They are not Stage 10, do not consume or
produce pipeline files, and must not appear in Instructor generation progress,
preview, exported modules, or Stage 09 assembly.

## Pipeline

```text
User concept + scenario ID
  -> 01 generation plan
  -> 02 scenario
  -> 03 plot-data decision/data
  -> 04 student task
  -> 05 rubric
  -> 06 sample answers
  -> 07 AI student answers
  -> 08 step grading
  -> 09 assembler/validator
       -> module.json
       -> plot-data.json only when FITTED
```

The stages are separated so model/scenario decisions stabilize before prose, answers, and grading are generated. This makes failures local, gives each call enough prompt space for detailed checks, and prevents answer generation from silently changing an upstream model.

## Exact call order

For every call, use `00-shared-rules.system.md` plus the listed stage prompt as the system instructions. Validate and save the one JSON object before starting the next call.

1. Call `01-concept-plan.system.md` with `CONCEPT`, `SCENARIO_ID`, and optional name/variant fields. Save `01-generation-plan.json`.
2. Call `02-scenario.system.md` with `01-generation-plan.json`. Save `02-scenario.json`.
3. Call `03-plot-data.system.md` with `01-generation-plan.json` and `02-scenario.json`. Save `03-plot-data.json`.
4. Call `04-student-task.system.md` with files 01, 02, and 03. Save `04-student-task.json`.
5. Call `05-rubric.system.md` with files 01, 02, and 04; also include 03 for FITTED checks. Save `05-rubric.json`.
6. Call `06-sample-answers.system.md` with files 01 through 05. Save `06-sample-answers.json`.
7. Call `07-ai-student-answers.system.md` with files 01 through 06. Save `07-ai-student-answers.json`.
8. Call `08-line-grading.system.md` with files 05 and 07, plus files 01, 02, 04, and 06 as mathematical references. Save `08-line-grading.json`.
9. Call `09-assembler-validator.system.md` with all files 01 through 08. Save its response as `09-module.json`.

Every stage uses its same-numbered schema in `schemas/`. A failure JSON stops the pipeline and is not a valid success-stage document.

## Runtime hidden grading dispute

`grading-dispute-dialogue.system.md` is loaded server-side only by the runtime
step-grading dialogue API. It receives one scenario/question, one immutable AI
answer with all steps, one criterion, learner and expected step placement,
learner and expected marks, the criterion grading rationale, prior conversation,
and the current turn. A false negative (`AI Fail` when expected pass) assigns the
`ai-student` role; a false positive (`AI Pass` when expected fail) assigns the
`professor` role. Matching marks produce no dialogue.

Each model turn is strict JSON validated against
`grading-dispute-dialogue.schema.json`, including the server-controlled speaker,
recommended mark, continuation/resolution status, reasoning focus, and an exact
step citation. This runtime contract is intentionally outside the numbered
authoring pipeline.

## File ownership

- `01-generation-plan.json` owns the concept profile, test point, representation, authenticity decision, misconception catalog, and variant.
- `02-scenario.json` owns exact scenario prose, variables, units, decision, constraint, and application asset paths.
- `03-plot-data.json` owns plot enablement, the hidden FITTED source model, and scatter observations. Only its `plotData` object is shipped to learners.
- `04-student-task.json` owns the composed question and both four-option question parts.
- `05-rubric.json` owns five essential and two not-necessary criteria plus temporary criterion type metadata.
- `06-sample-answers.json` owns the canonical correct and one-misconception sample solutions.
- `07-ai-student-answers.json` owns neutral-labeled answer steps and temporary trajectory metadata, but no grading.
- `08-line-grading.json` owns step-level consequential grading for the five essential criteria.
- `09-module.json` is the metadata-stripped application module assembled without creative edits.

## Regeneration boundaries

Regenerating a stage invalidates that stage and every downstream stage that consumes it. Stage 03 can be regenerated without changing Stage 02 only if its units, interval, sampling claims, and intended function structure remain unchanged; otherwise regenerate Stage 04 onward. Stage 05 changes invalidate Stages 06 through 09. Stage 07 can be regenerated while preserving Stages 01 through 06, but Stage 08 and 09 must then be rerun because answer steps change. Stage 08 alone may be regenerated without invalidating content stages. Stage 09 may always be rerun from unchanged validated inputs.

Never patch a downstream file to compensate for an upstream inconsistency. Regenerate from the earliest owner of the incorrect value.

## Example invocation input

```text
CONCEPT: critical points / definition and identification
SCENARIO_ID: 10
OPTIONAL_SCENARIO_NAME: Equipment Load Changes
OPTIONAL_PROFILE_VARIANT: defined nondifferentiable critical point
```

Example working filenames are `01-generation-plan.json`, `02-scenario.json`, ..., `09-module.json`. This example intentionally does not provide a complete generated problem.

## Validation

After each response:

1. Parse it as one JSON object.
2. Validate it with the matching Draft 2020-12 schema.
3. Confirm `schemaVersion` and `scenarioId` equality across intermediate files.
4. Run the schema's `$comment` semantic checks, including ID references, representation/path agreement, counts, sorted points, and mathematical consistency.
5. Stop on the shared failure object or any schema/semantic error.

After Stage 09, verify every answer contains three to six semantic `steps` and every `rubricFit.step` is a valid one-based location. Confirm each question part has one correct option, rubric counts are 5+2, FITTED data has at least 30 sorted noisy `{x,y}` points, and consequential grading treats downstream method independently from upstream correctness.

Optionally create a pipeline manifest with `schemaVersion`, `scenarioId`, and an ordered `outputs` array containing `{filename, document}` for files 01 through 09. Validate it against the root `INSTRUCTION_PROBLEM_SET_JSON_SCHEMA.json`. A validator must register the nine local stage schemas under their declared `$id` values so the manifest's cross-file references resolve without network access.

## Assemble into the application

Create `public/data/scenarios/{scenarioId}/` if needed.

- Copy `09-module.json` to `public/data/scenarios/{scenarioId}/module.json`.
- For FITTED, extract only `03-plot-data.json.plotData` and save that exact four-key object as `public/data/scenarios/{scenarioId}/plot-data.json`. Never copy the pipeline-only `modelSpec` into the application file.
- For CONSTRUCTED, do not create `plot-data.json`; the module path must be `""`.

Then register the scenario manually:

- import and add it in `lib/scenarios/registry.ts`;
- add its homepage metadata in `app/page.tsx`;
- add it to `scripts/seed-scenarios.ts`;
- ensure any optional `scenarioImageSrc` points to an existing file under `public/images/`.

The final module follows the current `origin/main` step-based contract: every AI answer contains `steps: string[]`, and every essential `rubricFit` item contains `pass`, one-based `step`, and `feedback`.

## Direct mapping to application variables

- `02-scenario.json.scenario` becomes `module.json.scenario`.
- `02-scenario.json.plotDataSrc` becomes `module.json.plotDataSrc`.
- `04-student-task.json.question` becomes `module.json.question`.
- `04-student-task.json.questionParts` becomes `module.json.questionParts`.
- `05-rubric.json.rubricOptions` becomes `module.json.rubricOptions` after removing `criterionType`.
- `06-sample-answers.json.sampleAnswers` becomes `module.json.sampleAnswers`.
- `07-ai-student-answers.json.answers` becomes `module.json.finalAiAnswers` after removing `trajectory` and merging `08-line-grading.json.rubricFit`.
