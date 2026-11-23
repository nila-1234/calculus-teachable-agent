// Templated feedback for the placement and pass/fail discussions in /grade-lines, discussion
// mode 3 (see Diagrams/feedback_flow.mmd; the decision tree is lib/feedback-flow.ts). Picks
// which template a TA action gets and fills in what code can; the wording lives in
// feedback-templates.json, built from the Figma tables by Diagrams/build_feedback_templates.py.
//
// Criterion ids with fixed phrases are the rubric option ids of scenario 5
// (public/data/scenarios/5/module.json). For any other criterion the template still works,
// but [criterion] is left for the LLM and there is no example.
//
//   const scenario = feedbackScenario("pass", false, 1);   // "2b": wrong PASS, 1st attempt
//   const fb = getTemplatedFeedback(scenario!, "probe", "maximum-justification",
//     { placedStep: 4, expectedStep: 4, studentName: "Alex" });
//   fb.speaker   // "professor"
//   fb.text      // "What in the student's step 4 shows it correctly justifies the maximum?"
//   fb.complete  // true: nothing left for the LLM, say it as is
//
// When `complete` is false, give the LLM `text`, `llmPlaceholders` and `example`: it writes
// only the bracketed parts and keeps the rest of the wording.
import type { CommentSpeaker } from "./grading-voice";
import { MAX_PLACEMENT_ATTEMPTS } from "./placement-flow";
import type { StatusMark } from "./status-flow";
import bank from "./feedback-templates.json";

// What the TA did: placed the criterion on a step, or marked the step pass / fail.
export type FeedbackAction = "placement" | StatusMark;
export type FeedbackType = "probe" | "sufficient" | "insufficient" | "insufficient_2nd";
// "1a" ... "3c": 1 placement, 2 pass, 3 fail · a correct, b wrong 1st attempt, c wrong later attempt.
export type FeedbackScenario = keyof typeof bank.templates;
// Node ids in feedback_flow.mmd that speak a template: PA, SA, IA, PB, SB, IB, C.
export type FeedbackNode = keyof typeof bank.mermaid_nodes;

// Same shape as the context placementLine already takes, plus the AI student's name: the
// Figma templates call the student "Alex", but each answer has its own (Alex, Bea, ...).
export type FeedbackContext = {
  placedStep: number | null;
  expectedStep: number;
  studentName?: string;
};

export type TemplatedFeedback = {
  scenario: FeedbackScenario;
  type: FeedbackType;
  speaker: CommentSpeaker;
  // Template with the code-fillable slots replaced.
  text: string;
  // Placeholders still in `text`, for the LLM to write.
  llmPlaceholders: string[];
  complete: boolean;
  // Figma example response for this criterion, as a style reference; null for criteria
  // outside scenario 5.
  example: string | null;
  // move_on: the criterion is resolved. try_again: it stays open and the TA acts on it again
  // (after b, and after c, where the answer has been revealed).
  then: "move_on" | "try_again";
};

type TemplateEntry = {
  speaker: string;
  template: string;
  placeholders: string[];
  examples: Record<string, string>;
};
type CriterionPhrases = { criterion: string; criterion_action: string };

const GROUP: Record<FeedbackAction, "1" | "2" | "3"> = { placement: "1", pass: "2", fail: "3" };

// Which scenario a TA action falls into, or null when it gets no feedback: a correct answer
// after the 1st attempt. `attempt` is the same 1-based count as PlacementFlow's. Every wrong
// attempt from MAX_PLACEMENT_ATTEMPTS on is c, so the corrective feedback repeats until the
// TA gets it right. Correct 1st attempts (a) are also sampled, see shouldSampleFeedback.
export function feedbackScenario(
  action: FeedbackAction,
  correct: boolean,
  attempt: number
): FeedbackScenario | null {
  if (correct) return attempt === 1 ? (`${GROUP[action]}a` as FeedbackScenario) : null;
  const branch = attempt < MAX_PLACEMENT_ATTEMPTS ? "b" : "c";
  return `${GROUP[action]}${branch}` as FeedbackScenario;
}

// a is sampled (placement / pass 10%, fail 50%); b and c always get feedback.
export function shouldSampleFeedback(scenario: FeedbackScenario, rand: number = Math.random()) {
  return rand < bank.scenarios[scenario].sample_rate;
}

export function getTemplatedFeedback(
  scenario: FeedbackScenario,
  type: FeedbackType,
  criterionId: string,
  ctx: FeedbackContext
): TemplatedFeedback {
  const entry = (bank.templates[scenario] as Record<string, TemplateEntry | undefined>)[type];
  if (!entry) throw new Error(`No "${type}" feedback in scenario ${scenario}`);
  const phrases = (bank.criteria as Record<string, CriterionPhrases | undefined>)[criterionId];

  const placed = String(ctx.placedStep ?? "?");
  const isPlacement = scenario.startsWith("1");
  const slots: Record<string, string | undefined> = {
    criterion: phrases?.criterion,
    "criterion action": phrases?.criterion_action,
    "selected step": placed,
    X: placed,
    // Placement: where the criterion belongs. Pass / fail: the step being marked.
    Y: isPlacement ? String(ctx.expectedStep) : placed,
  };
  // phrases.criterion is a verb phrase ("computes the derivative"). It fits the probes, which
  // code fills completely. Other templates use [criterion] as a noun ("meets [criterion]"),
  // and the LLM writes those messages anyway, so it gets [criterion] to phrase.
  const needsLlm = entry.placeholders.some((name) => slots[name] === undefined);
  if (needsLlm) delete slots.criterion;

  const llmPlaceholders: string[] = [];
  const named = ctx.studentName
    ? entry.template.replace(/\bAlex\b/g, ctx.studentName)
    : entry.template;
  const text = named.replace(/\[([^\]]+)\]/g, (match: string, name: string) => {
    const value = slots[name];
    if (value !== undefined) return value;
    if (!llmPlaceholders.includes(name)) llmPlaceholders.push(name);
    return match;
  });

  return {
    scenario,
    type,
    speaker: entry.speaker as CommentSpeaker,
    text,
    llmPlaceholders,
    complete: llmPlaceholders.length === 0,
    example: entry.examples[criterionId] ?? null,
    then: bank.scenarios[scenario].then as TemplatedFeedback["then"],
  };
}

// Same as getTemplatedFeedback, addressed by a node id in feedback_flow.mmd. The scenario's
// number comes from the action; its letter comes from the node.
export function templatedFeedbackForNode(
  node: FeedbackNode,
  action: FeedbackAction,
  criterionId: string,
  ctx: FeedbackContext
): TemplatedFeedback {
  const [branch, type] = bank.mermaid_nodes[node];
  const scenario = `${GROUP[action]}${branch}` as FeedbackScenario;
  return getTemplatedFeedback(scenario, type as FeedbackType, criterionId, ctx);
}
