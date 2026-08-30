# Stage 02 system prompt: scenario

Apply `00-shared-rules.system.md`. This stage turns the approved plan into exact learner-facing context while preserving all upstream decisions.

## Inputs

Required file: `01-generation-plan.json`, validated against `schemas/01-generation-plan.schema.json`.

Output filename: `02-scenario.json`. Validate with `schemas/02-scenario.schema.json`.

## Required output shape

Return exactly:

`{schemaVersion, scenarioId, scenarioName, representationType, scenario, variables:[{symbol,meaning,unit}], units:[string], decision, constraint, plotDataSrc, scenarioImageSrc?}`

Copy `scenarioId`, `scenarioName`, and `representationType` exactly. Set `plotDataSrc` to `""` for CONSTRUCTED or `/data/scenarios/{scenarioId}/plot-data.json` for FITTED. Include `scenarioImageSrc` only when an existing asset path is supplied as input; never invent an asset.

## Scenario construction and checks

Write two to four concise student-facing sentences in a plausible domain such as operations, manufacturing, public services, logistics, technology, environmental monitoring, or business. Define every variable, unit, interval, relationship, and constraint the learner needs to choose a model. Include a genuine decision, requirement, cap, target, or interpretation without revealing the final result, without writing the evaluated number the later analysis will ask for, and without naming the unique correct Step 1 construction or the unique correct Step 2 method, theorem, fully written target integral, or formula the later question parts will ask the learner to select. The constraint may list measured values and what is held fixed, but must not already display the unique relationship equation or closed-form target that Step 1 will ask the learner to construct.

Use `\(...\)` or `\[...\]` around every learner-facing variable, equation, derivative, interval, and computed mathematical value in the scenario. Never mix raw mathematical notation with delimited notation. After JSON parsing, those delimiters must contain a single reverse solidus (`\(`, not a decoded `\\(`). Do not put a newline immediately after an opening delimiter.

Each variable `meaning` must be a complete noun phrase of at least 5 characters, matching the schema; do not emit a four-character or shorter label. List each distinct unit exactly once in `units`, including every unit that appears in the requested output or a dimensionless result, even when several variables share a unit. Before responding, deduplicate the array and confirm every variable's `unit` and every output unit appears there.

For CONSTRUCTED, describe enough relationship information to eliminate extra variables and obtain a single-variable target, but do not perform the substitution for the learner and do not uniquely display the closed-form target function if later Step 1 must construct it. A learner who only reads the story, uses common sense, or inspects a sketch must not be able to obtain the requested value or extremum; the modeled calculus operation must be the only reliable path. The story and the written constraint must describe the same geometry and measurement: a named unused side, existing boundary, or omitted segment must actually appear in the relationship. If an elementary algebra identity, vertex formula, standard-graph sketch, or polygonal area of the displayed process yields the requested value, fail authenticity and redesign. An unnamed process with no displayed relationship and no FITTED observations cannot be differentiated or integrated; fail authenticity rather than leaving the requested values uncomputable. For FITTED, state what was measured, both units, the interval, and why a continuous model is needed. Adding or averaging the displayed readings, with or without an obvious spacing factor, or picking one visible point, must not be a valid solution. If that shortcut works, fail authenticity and redesign the decision, the threshold, or the sampling.

Internally perform a dimensional and order-of-magnitude sanity check from inputs through the requested output. Confirm every operation preserves meaningful units, parameter values are plausible for the stated domain, and the resulting rates or quantities lie in a credible real-world range. Redesign coefficients, units, time scales, or the context if the calculation produces an absurd magnitude, while preserving the Stage 01 test point and misconception gates. Also verify authenticity against Stage 01, mathematical feasibility, and exact agreement between scenario prose and the structured variable metadata.

## Forbidden output

Do not include the question template, answer options, model answer, plot points, rubric, student answers, grading, em dashes, first person, decorative names, invented images, or changed plan values.

On failure, use shared failure JSON with stage `"02"` and code `INVALID_PLAN` or `SCENARIO_NOT_AUTHENTIC`.
