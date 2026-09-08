---
name: instruction-generator-cautions
description: >-
  Applies tested calculus instruction-problem-set cautions when generating,
  reviewing, scoring, or revising nine-stage instruction packages. Use when
  the user generates or reviews an instruction problem set, inspects
  Exact_Test_Run_Outputs, the AI generation evaluation table, or asks about
  prompt versus skill-only concept traps.
---

# Instruction-generator cautions

Reviewer/generator caution list, **not** system-prompt hard constraints. Do not copy concept-specific traps into `instruction-generator/prompts/`. System prompts stay generic; this skill holds the tested examples.

## When to use

Apply while:

- generating a new instruction problem set (stages 01–09)
- reviewing a downloaded `module.json` / `pipeline-bundle.json`
- updating evaluation records or deciding prompt versus skill-only changes

This is the **only** caution skill. Concept-named iteration reviews were retired; keep using the evaluation table and JSON outputs.

## How to apply

1. Run generic **structural** checks first (also in the system prompts): decoded `\(` not `\\(`; option-insertion English; labeled-wrong work actually wrong; `correctness` fails on a wrong value; `method` passes when the later operation is correct on that answer’s own value; scenario does not spoil Step 1/2; no U+0000–U+001F or U+007F; `meaning` ≥ 5 characters; output units present.
2. Run generic **authenticity** checks (also in Stages 02/04/05): calculus is necessary; the story or a sketch cannot yield the requested value; FITTED hand-adding or hand-averaging of visible readings fails; Step 1 is construction not transcription; a correct option does not contain the computed result; the rubric does not make one valid method the only essential construction.
3. Then apply **only the matching concept** cautions below. They are review questions, not new prompt rules.
4. If a failure is cross-concept and structural or authenticity-generic, fix the earliest owner stage prompt. If it names a method, function, or one test’s geometry, keep it here.

A high `/100` score can still fail authenticity.

## Product fit (do not put in prompts)

The 2-step shell is for **teachable modeling scenarios** (constraint → construct or fit a model → choose an analysis), not drill worksheets.

- **Fits:** optimization, related rates, accumulation / net change; critical points when the model is not an obvious parabola.
- **Often fake tasks:** continuity as polynomial join; algebraic / removable limits; Riemann with no \(f\) or readings; L'Hôpital as a method-name quiz.
- **Can fit, often degenerates:** MVT, average value, linear approximation, area between curves, implicit differentiation, FTC, volumes, chain rule, u-substitution.

Do not treat later `/100` scores as proof that prompts got worse. Early six-concept runs were structural pass/fail on template-friendly concepts. Comparable `/100` pairs: continuity 74→66 (real regression plus stricter spoilers); limits 73→70 (old holes closed, new model-as-intermediate hole); Riemann 68→69 (structure better, authenticity still fail).

Stage 09 is `assembleModule` (schema/IDs), not a semantic authenticity gate. Schema retries make legal JSON; they do not make calculus necessary or wrong work actually wrong. Labeled-wrong work that is mathematically correct should get full Stage 08 credit — that is a Stage 06/07 generation failure, not a grader bug.

## Shared checks (every package)

- After `JSON.parse`, delimiters are `\(` / `\[`, not `\\(` / `\\[`.
- After substituting each of the eight options, stem and label are grammatical English.
- `__(1)__` / `__(2)__` sit outside math delimiters so insertion cannot nest `\(` .
- Every labeled-incorrect sample or AI answer is mathematically unequal to the correct solution.
- Correctness criteria fail on wrong values; method criteria pass when the later operation is correct on that answer’s own value.
- Scenario / constraint / decision texts do not name the correct Step 1 construction or Step 2 method.
- U+0000–U+001F and U+007F are absent; every variable `meaning` is at least 5 characters; every output unit (including dimensionless results) is in the inventory.
- If the student never opens Step 1, they cannot know the unique model from the scenario.
- If they never compute, they cannot pick the correct Step 2 option because it already contains the number.
- CONSTRUCTED: common sense or reading the story cannot yield the requested value or extremum.
- FITTED: adding or averaging visible points (with obvious spacing) cannot answer the decision.
- Calculus is actually necessary (not elementary algebra, direct substitution, or a memorized identity).

## Per-concept cautions

Short traps and questions. Apply only the matching concept.

### Optimization

Interior max must need \(A'\) (or equivalent). Constraint must not already write both the geometric relation and the objective. If the story names a wall, unused side, or gate, the fence equation must actually drop that segment. A required \(f(x)=0\) trajectory must not produce an obviously zero boundary output. Endpoints / feasibility still get compared.

### Critical points

`answer-b` must solve \(f(x)=0\) and never analyze \(f'(x)\). A claimed nondifferentiable point must exist on the original model. A given quadratic whose vertex is obvious from algebra or a sketch skips \(f'\). Step 1 must construct a model, not restate \(f'\). Omitting \(f\) entirely makes the values uncomputable. FITTED with a smooth stationary input plus a defined corner can pass; the exact stationary input must still need \(f'\).

### Accumulation / net change

A definite integral of a displayed rate is required. Samples are not interval quantities. \(r(t)\) must exist as a formula or FITTED readings. \(\int r\) is not a uniquely incorrect model when \(r\) is already named. Linear \(r\) is a triangle/trapezoid shortcut. Endpoint-rate subtraction must differ numerically from the integral. Independently recompute the antiderivative at both bounds; a quadratic rate can still ship a wrong boxed net change.

### Average value

Distinct from average rate of change. Scenario must not write \(\frac{1}{b-a}\int_a^b f\) before Step 2. Avoid endpoint-symmetric functions when the wrong trajectory is average rate (that yields an operationally absurd \(0\)). FITTED averages sitting on a pass/fail threshold invite hand-averaging. Stage 08 must pass divide-by-interval-length on that answer’s own integral.

### Related rates

A compressed eliminate-then-differentiate-in-\(t\) answer is the **correct** process, not substitute-before-differentiating. Constraint must not already supply the similar-triangle / volume formula and given rate. A numerical slip on a given rate is not the substitute-before-differentiating misconception. Watch `U+0000` inside `\pi` and `meaning` shorter than 5 characters (`time` fails).

### Mean Value Theorem

If hypothesis checking is essential, the scenario must not already assert continuity and differentiability. Hypothesis evidence belongs in the answers. An omitted negative root should fail the *solve* criterion, not only a later filter. Computational slips should be one-step mistakes on the actual derivative.

### Continuity

Polynomial join conditions are algebra; “limit” language does not make calculus necessary. Omitting verification language is not a wrong trajectory if the equation and answer are correct. Listing LHL, RHL, and the point value in the constraint spoils Step 1. Blank+option grammar and verification criteria that conflict with consequential grading have both appeared.

### Chain rule

At the evaluation point, the inner derivative must be finite and not \(0\), \(1\), or \(-1\). After Step 2 insertion, no duplicate verb. Magnitudes must be physically plausible (sensor rates like \(10^{12}\) fail).

### Linear approximation

Stated geometry must literally determine the modeled output (“nearly square” ≠ side \(\sqrt{\text{area}}\)). Forbidding \(\sqrt{x_0}\) by policy is not authenticity. A symbolic linearization is valid under a setup stem. A signed differential is not the physical estimate. Wrong answers must not announce their own mistakes.

### Implicit differentiation

Compare every declared wrong derivative line with the reference line. Solving for \(y\) then differentiating is valid unless the stem requires implicit differentiation. Restating the given implicit equation is transcription, not Step 1. Do not fail a correctly applied product rule on \(xy\).

### Riemann sums

A rate function or readings must exist; a symbolic \(\Delta x\) recipe with no \(f\) cannot decide a pumped total. Grade the sample-point expression that is written. A labeled wrong-process answer has been a concise correct sum. Inspect raw strings for `U+007F`.

### Fundamental Theorem of Calculus

Notation-only copies of the same definite integral are not uniquely incorrect models. Scenario must not already display the target integral. Stage 07 must instantiate the Stage 01 required trajectory (for example upper-endpoint-only).

### U-substitution

An alternate \(u\) that yields the same value is not a false model. Inner expression named in the scenario spoils Step 1. \(10^5-1=10^5-1^5\) is not a value-changing slip. Binomial expansion of \((1+x^2)^n\) need not change the integrand. Labeled wrong-process answers have been fully correct evaluations.

### Volumes (revolution or short `volumes`)

Washer/disk and shell about the same axis can both be correct; do not make one method the only essential construction unless the stem requires it. Do not put the cubic result in the option text. Short input `volumes` may generate known cross-sections, not revolution. Planar-area values must not receive volume-unit credit. Watch nested `__(n)__` inside `\(...\)`.

### Limits

The simplified equivalent of a removable-discontinuity quotient is not a uniquely incorrect model. Do not print the limit value in the option. Do not mark the original indeterminate quotient incorrect, or put the differentiated reduction in Step 1. Scenario must not already say substitution is indeterminate and a simplified form is needed.

### Area between curves

Equal-area pieces make an unsplit signed integral \(0\), so signed-versus-geometric area is too obvious. Do not announce the order change in the scenario. Reversing both pieces is not a reason to credit the evaluation. The required one-piece-integral trajectory must actually be instantiated.

### L'Hôpital

Do not name the rule or the exact limit in the constraint. A still-indeterminate first derivative ratio must not display the reference limit. Standard limits such as \(\lim_{x\to 0^+}(1-\cos x)/x^2=\frac12\) let students skip the rule. Watch newlines immediately after `\(` .

## Score chart (holistic `/100` reviews)

| Concept | Package | Score |
|---|---|---|
| Continuity | downloaded module | 74 |
| Chain rule | website | 74 |
| Linear approximation | website | 78 |
| Implicit differentiation | website 10021 | 62 |
| Implicit differentiation | user download | 74 |
| Riemann sums | website | 68 |
| Fundamental Theorem of Calculus | website batch2 | 70 |
| U-substitution | user download | 42 |
| Volumes of revolution | website batch2 | 80 |
| Volumes of revolution | user download | 64 |
| Limits | website batch3 | 73 |
| Related rates | website batch3 rerun | 66 |
| Average value | website batch3 | 78 |
| Area between curves | user download | 60 |
| L'Hopital | website batch4 rerun | 70 |
| Mean Value Theorem | website batch4 | 74 |
| Continuity | website retest 10101 | 66 |
| Volumes (cross-section) | website retest 10102 | 72 |
| Riemann sums | website retest 10103 | 69 |
| Optimization | website retest 10104 | 76 |
| Limits | website retest 10105 | 70 |
| Optimization | website fit retest 10201 | 75 |
| Critical points | website fit retest 10202 | 64 |
| Related rates | website fit retest 10203 | 78 |
| Accumulation | website fit retest 10206 | 68 |
| Optimization | website fit-pass 10501 | 80 |
| Critical points | website fit-pass 10502 | 76 |
| Related rates | website fit-pass 10503 | 82 |
| Accumulation | website fit-pass 10504 | 72 |

Earlier monolithic tests (optimization, critical points, accumulation, plus early average value / related rates / MVT) were structural pass/fail, not `/100`.

## Sources that remain

- Evaluation table: `/Users/gaogaode/Desktop/Calculus_Generator_Documents/AI_Generation_Evaluation_Table.docx`
- Exact outputs: `/Users/gaogaode/Desktop/Calculus_Generator_Documents/Exact_Test_Run_Outputs/`
- System prompts: `instruction-generator/prompts/`
