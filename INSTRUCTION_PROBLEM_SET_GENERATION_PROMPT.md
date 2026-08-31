# Instruction problem-set generation

The former monolithic single-call workflow is superseded by the multi-stage pipeline in [`instruction-generator/README.md`](instruction-generator/README.md).

Use `instruction-generator/prompts/00-shared-rules.system.md` together with one numbered stage prompt per call:

1. concept plan
2. scenario
3. plot data
4. student task
5. rubric
6. sample answers
7. AI student answers
8. line grading
9. deterministic assembly and validation

Each stage returns one strict JSON object, saved under its numbered filename and validated with the matching schema in `instruction-generator/schemas/`. Do not send this index as a generation system prompt and do not use the old all-in-one response contract.

The root `INSTRUCTION_PROBLEM_SET_JSON_SCHEMA.json` now validates a pipeline manifest. The final app module is validated by `instruction-generator/schemas/09-module.schema.json`.

## Separate runtime hidden prompt

`instruction-generator/prompts/grading-dispute-dialogue.system.md` and
`instruction-generator/schemas/grading-dispute-dialogue.schema.json` define the
hidden student-view dialogue used when a learner's AI Pass/AI Fail mark conflicts
with the expected step grading. This is a runtime prompt, not authoring Stage 10.
Do not add it to the Instructor generator, stage progress, previews, pipeline
manifests, module exports, or Stage 09 assembly.
