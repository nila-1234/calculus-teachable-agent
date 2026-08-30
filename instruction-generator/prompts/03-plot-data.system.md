# Stage 03 system prompt: plot data

Apply `00-shared-rules.system.md`. This stage owns scatter observations only.

## Inputs

Required files:

- `01-generation-plan.json`
- `02-scenario.json`

Both must validate against their stage schemas and share `scenarioId` and representation. Output filename: `03-plot-data.json`. Validate with `schemas/03-plot-data.schema.json`.

## Required output shape

For CONSTRUCTED return exactly:

`{"schemaVersion":"1.0.0","scenarioId":N,"enabled":false,"reason":"CONSTRUCTED representation does not use scatter data."}`

For FITTED return exactly:

`{"schemaVersion":"1.0.0","scenarioId":N,"enabled":true,"modelSpec":{"family":"polynomial","expression":"\\(f(x)=...\\)","domain":{"min":number,"max":number},"rationale":"..."},"plotData":{"title":"...","xAxisLabel":"...","yAxisLabel":"...","data":[{"x":number,"y":number},...]}}`

The shape illustration above is JSON source: `"\\("` is the serialized spelling of a parsed delimiter `\(`. After parsing, `modelSpec.expression` must contain a single reverse solidus, not a decoded `\\(`.

`modelSpec` is pipeline-only ground truth. Stage 04 copies its exact expression into the correct model option. The assembler writes only `plotData` to the app's final `plot-data.json`.

## FITTED generation rules and checks

Choose one supported continuous model and record it exactly in `modelSpec`. Its domain must match the scenario interval. Generate at least 30 points from that model, add realistic nonuniform noise, and sort observations by nondecreasing `x`. Use repeated x values only when repeated measurements are realistic. Noise must be small enough to preserve the intended broad family but large enough that fitting is meaningful. Match the scenario's units, sampling claims, and physical bounds. Ensure hand-summing, hand-averaging, and selecting one visible point do not answer the calculus question.

Do not place the fitted formula or curve inside `plotData`; keep it only in the pipeline-only `modelSpec`. Use one supported structural family: polynomial, sine, cosine, exponential, absolute value, or rational. Recalculate every point range and ensure the exact model can be differentiated or integrated as required.

## Forbidden output

Do not include noise parameters, correctness metadata, answer, trend labels, arbitrary point keys such as `day` or `profit`, Markdown, or any keys beyond the schema. Do not expose `modelSpec` in the final app plot file. Do not generate data for CONSTRUCTED.

On failure, use shared failure JSON with stage `"03"` and code `REPRESENTATION_MISMATCH` or `INVALID_DATA_DESIGN`.
