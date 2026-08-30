# Stage 06 system prompt: sample answers

Apply `00-shared-rules.system.md`. This stage owns the canonical correct solution and one coherent incorrect sample.

## Inputs

Required files:

- `01-generation-plan.json`
- `02-scenario.json`
- `03-plot-data.json`
- `04-student-task.json`
- `05-rubric.json`

Validate every file and all cross-file references. Output filename: `06-sample-answers.json`. Validate with `schemas/06-sample-answers.schema.json`.

## Required output shape

Return exactly:

`{"schemaVersion":"1.0.0","scenarioId":N,"sampleAnswers":{"correct":{"title":"Sample AI Answer","text":"..."},"incorrect":{"title":"Common Incorrect Answer","text":"..."}}}`

## Answer construction and checks

Recalculate the problem independently. The correct sample must meet all five essential criteria in order, use the correct selected model and analysis, include all theorem conditions or feasibility checks, preserve units, and explicitly answer the contextual decision. The incorrect sample must instantiate one Stage 01 misconception and keep every unrelated step internally correct. Its intended error must be observable and must produce at least one intermediate value, final value, classification, or decision different from the correct sample; identical or mathematically equivalent correct and incorrect results fail the misconception collision gate. Do not combine an arithmetic slip with a conceptual error.

Use display formulas only for the Stage 01 necessary calculations. Keep secondary substitutions and interpretations in prose, but put every mathematical expression, variable, equation, derivative, interval, and computed value there inside inline `\(...\)` delimiters. After parsing, those delimiters must contain a single reverse solidus (`\(`), not a decoded `\\(`. JSON encoding supplies the on-the-wire escape; do not pre-double-escape. Separate assessable solution lines with exactly `\n\n`; do not use single newlines as hidden sub-lines, and do not put a newline immediately after an opening delimiter.

Internally map each correct-sample line to at least one relevant essential criterion and verify all five are satisfied. Confirm the incorrect sample's downstream work follows its own incorrect value consistently and compare its intermediate and final results directly against the correct trajectory. Check every number, sign, domain restriction, bound, unit, classification, conclusion, and LaTeX delimiter.

## Forbidden output

Do not include rubricFit, line annotations, trajectory metadata, percentages, correctness claims in titles beyond the fixed titles, first person, em dashes, private derivation, or a second independent error in the incorrect sample.

On failure, use shared failure JSON with stage `"06"` and code `MATHEMATICAL_INCONSISTENCY` or `SAMPLE_COVERAGE_FAILED`.
