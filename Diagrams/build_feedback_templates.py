"""Build feedback-templates.json from feedback_templates.csv.

feedback_templates.csv is the editable source: one row per template and criterion, with the
template and example text copied verbatim from the Figma tables on "Page (confirmed flow)".
After editing it, run:
    python3 build_feedback_templates.py

It writes the JSON here and into the app's lib/, which is what the app reads.
The build fails if a branch is missing a row, or if criteria disagree on a template or speaker.

CSV columns read: scenario, feedback_type, criterion_id, "Feedback source" (Prof / Alex),
"Feedback template", "Example response". The other columns are for people reading the CSV.
"""

import csv
import json
import re
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE / "feedback_templates.csv"
OUTS = [HERE / "feedback-templates.json", HERE.parent / "lib" / "feedback-templates.json"]

# The CSV's criterion ids (from the Figma tables) → scenario 5's rubric option ids in the app.
CSV_CRITERIA = {
    "computes_derivative": "derivative",
    "finds_critical_value": "critical-value",
    "justifies_maximum": "maximum-justification",
    "computes_dimensions_and_area": "dimensions-area",
    "evaluates_area_requirement": "requirement-check",
}

# The CSV's "Feedback source" → the app's CommentSpeaker values.
CSV_SPEAKERS = {"Prof": "professor", "Alex": "student"}

# Keyed by scenario 5's rubric option ids in the app. The phrases fill [criterion] and
# [criterion action], so the probes can be completed without the LLM.
CRITERIA = {
    "derivative": {"criterion": "computes the derivative", "criterion_action": "computed the derivative"},
    "critical-value": {"criterion": "finds the critical value", "criterion_action": "found the critical value"},
    "maximum-justification": {"criterion": "justifies the maximum", "criterion_action": "justified the maximum"},
    "dimensions-area": {"criterion": "computes the dimensions and area", "criterion_action": "calculated the dimensions and area"},
    "requirement-check": {"criterion": "evaluates the area requirement", "criterion_action": "evaluated the area requirement"},
}

# Per scenario: share of TA actions that get feedback (only a is sampled), and what follows it.
# move_on = criterion resolved · try_again = it stays open and the TA acts on it again.
SCENARIOS = {
    "1a": {"sample_rate": 0.10, "then": "move_on"},
    "1b": {"sample_rate": 1.0, "then": "try_again"},
    "1c": {"sample_rate": 1.0, "then": "try_again"},
    "2a": {"sample_rate": 0.10, "then": "move_on"},
    "2b": {"sample_rate": 1.0, "then": "try_again"},
    "2c": {"sample_rate": 1.0, "then": "try_again"},
    "3a": {"sample_rate": 0.50, "then": "move_on"},
    "3b": {"sample_rate": 1.0, "then": "try_again"},
    "3c": {"sample_rate": 1.0, "then": "try_again"},
}

# Feedback types each branch has (c skips the probe).
TYPES = {"a": ["probe", "sufficient", "insufficient"], "b": ["probe", "sufficient", "insufficient"], "c": ["insufficient_2nd"]}

# Node ids in feedback_flow.mmd → [branch, feedback type].
MERMAID_NODES = {
    "PA": ["a", "probe"], "SA": ["a", "sufficient"], "IA": ["a", "insufficient"],
    "PB": ["b", "probe"], "SB": ["b", "sufficient"], "IB": ["b", "insufficient"],
    "C": ["c", "insufficient_2nd"],
}

# The app's CommentSpeaker values (Figma calls them Prof and Alex).
SPEAKERS = {"professor", "student"}


def spoken_text(template: str) -> str:
    """Some Figma templates are wrapped in quote marks; drop them."""
    for q_open, q_close in [("“", "”"), ('"', '"')]:
        if len(template) >= 2 and template.startswith(q_open) and template.endswith(q_close):
            return template[1:-1]
    return template


def main() -> None:
    with SRC.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    templates = {sc: {} for sc in SCENARIOS}
    errors = []
    for i, row in enumerate(rows, start=2):  # line 1 is the header
        sc, ft = row["scenario"], row["feedback_type"]
        cid = CSV_CRITERIA.get(row["criterion_id"], row["criterion_id"])
        who = CSV_SPEAKERS.get(row["Feedback source"], row["Feedback source"])
        where = f"line {i} ({sc}.{ft}.{row['criterion_id']})"
        if sc not in SCENARIOS or ft not in TYPES[sc[1]] or cid not in CRITERIA or who not in SPEAKERS:
            errors.append(f"{where}: unknown scenario, feedback type, criterion or speaker")
            continue
        template = spoken_text(row["Feedback template"])
        entry = templates[sc].setdefault(ft, {
            "speaker": who,
            "template": template,
            "placeholders": list(dict.fromkeys(re.findall(r"\[([^\]]+)\]", template))),
            "examples": {},
        })
        if (entry["template"], entry["speaker"]) != (template, who):
            errors.append(f"{where}: template or speaker differs from the other criteria")
        if cid in entry["examples"]:
            errors.append(f"{where}: duplicate row")
        entry["examples"][cid] = row["Example response"]

    for sc in SCENARIOS:
        for ft in TYPES[sc[1]]:
            missing = [cid for cid in CRITERIA if cid not in templates[sc].get(ft, {}).get("examples", {})]
            if missing:
                errors.append(f"{sc}.{ft}: no row for {', '.join(missing)}")
    if errors:
        raise SystemExit("Build failed:\n  " + "\n  ".join(errors))

    out = {
        "source": "Figma 'Calculus TA Chat Flow' → feedback_templates.csv → build_feedback_templates.py. Do not edit by hand.",
        "criteria": CRITERIA,
        "scenarios": SCENARIOS,
        "mermaid_nodes": MERMAID_NODES,
        "templates": {sc: {ft: templates[sc][ft] for ft in TYPES[sc[1]]} for sc in SCENARIOS},
    }
    text = json.dumps(out, ensure_ascii=False, indent=2) + "\n"
    for path in OUTS:
        path.write_text(text, encoding="utf-8")
    count = sum(len(t) for t in out["templates"].values())
    print(f"Wrote {', '.join(str(p.relative_to(HERE.parent)) for p in OUTS)}: {count} templates, {len(rows)} examples")


if __name__ == "__main__":
    main()
