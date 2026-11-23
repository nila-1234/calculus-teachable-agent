# TA feedback flow

Chatbot logic and wording for feedback on the TA's three actions: placing a rubric criterion on a step, marking a step PASS, or marking it FAIL.
Source of truth: Figma board "Calculus TA Chat Flow", page "Page (confirmed flow)".

In the app this is **discussion mode 3**: open /grade-lines with `?discussionMode=3`.
Mode 2 (the default) is still the older "Are you sure?" flow in `docs/step_placement_discussion_flow.mmd` and `docs/evaluation_discussion_flow.mmd`, kept so the pilot logs can be replayed.

| File | What it is | Edit it? |
|---|---|---|
| `feedback_flow.mmd` | The decision flow: which branch runs and who speaks | Yes, when the logic changes (then update `lib/feedback-flow.ts` to match) |
| `feedback_templates.csv` | Every template and example response, copied verbatim from the three Figma tables | Yes, when the wording changes |
| `build_feedback_templates.py` | Turns the CSV into the JSON and checks that no row is missing | Run it |
| `feedback-templates.json` | Generated from the CSV; also written to `lib/`, which is what the app reads | No |
| `feedback-templates.ts` | Reference copy of the lookup helper. The live one is `lib/feedback-templates.ts` | No, edit the `lib/` one |

The CSV columns the build reads are `scenario`, `feedback_type`, `criterion_id`, `Feedback source` (`Prof` / `Alex`) and `Feedback template`, plus `Example response`. The other columns are for people reading it.

## How they fit together

Each feedback node in `feedback_flow.mmd` is labelled with a template key such as `nb.sufficient`. Here `n` is the TA's action: 1 = placement, 2 = PASS, 3 = FAIL.
That key points to `templates["1b"]["sufficient"]` in the JSON, which gives the speaker, the template and an example response for each criterion.
The build maps the CSV's criterion ids (`computes_derivative`, ...) to scenario 5's rubric option ids (`derivative`, `critical-value`, `dimensions-area`, `maximum-justification`, `requirement-check`), and `Prof` / `Alex` to the app's `professor` / `student`.

## Changing wording

1. Edit `feedback_templates.csv` (and the matching Figma table).
2. Run `python3 Diagrams/build_feedback_templates.py`. It writes the JSON here and to `lib/feedback-templates.json`. The build fails if a branch is missing a row, or if criteria disagree on a template or speaker.

## In the app

| Piece | File |
|---|---|
| Decision tree (which branch, what to say) | `lib/feedback-flow.ts`, tested in `lib/feedback-flow.test.ts` |
| Templates: picks one and fills step numbers, criterion and student name | `lib/feedback-templates.ts` |
| LLM judges whether the TA's explanation is sufficient | `app/api/feedback-diagnose/route.ts` |
| LLM fills the bracketed gaps code can't | `app/api/feedback-write/route.ts` |
| Wiring | `components/grade-lines-activity.tsx` (mode 3 branches) |

Probes for scenario 5's criteria are filled entirely by code. Everything else goes through `feedback-write`, which gets the template, the TA's explanation and the Figma example as a style guide.
Other scenarios use the same templates, but the LLM also phrases the criterion and there are no examples.
The templates say "Alex"; the app swaps in the name of the student whose answer is being graded (Alex, Bea, Charlie).

Mode 3 logs under its own event names: `grade_lines_placement_feedback_transition`, `grade_lines_status_feedback_transition`, `grade_lines_feedback_message` and `grade_lines_feedback_diagnosis`.

## Preview the flow

Paste `feedback_flow.mmd` into https://mermaid.live.
