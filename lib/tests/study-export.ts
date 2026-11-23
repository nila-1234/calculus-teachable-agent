import { getSurvey } from "@/lib/surveys/definitions";
import { parseMulti, TYPING_SUFFIX, type SurveyItem } from "@/lib/surveys/types";
import { getFormTest, getTest } from "./definitions";
import { findItem, formatAnswer } from "./format";
import { goalForItem, labelForItem, type Goal } from "./insights";
import { itemKey } from "./answer-key";
import { fullFlowSubjects, minutesPerPhase } from "./export";
import { keystrokeAnswers, type KeystrokeAnswer } from "./ai-check";
import { SCREEN_REASONS, type ScreeningOutcomes } from "./screening-outcomes";
import type { FlowSummary } from "./flow";
import type { GradedSubmission, LogDoc, Submission } from "./report";
import type { FormId, TestId } from "./types";

/**
 * The study's three main exports (participants.csv, answers.csv,
 * screening.csv), built from the same data the dashboard shows. Column names
 * are snake_case; `arm` is "agent" / "control" (the stored "lesson").
 */

type Sheet = { columns: string[]; rows: Record<string, unknown>[] };

const GOALS: Goal[] = ["procedural", "communication", "collaboration"];

/** "confident-formulate" -> "confident_formulate". */
const snake = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const armName = (arm: string | null | undefined) =>
  arm === "lesson" ? "control" : arm === "agent" ? "agent" : "";

const latest = (list: LogDoc[], event: string, scenario?: string) =>
  [...list]
    .filter((d) => d.event === event && (scenario === undefined || d.scenario_id === scenario))
    .sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? ""))
    .pop();

const answersOf = (doc: LogDoc | undefined) =>
  ((doc?.data?.answers ?? {}) as Record<string, unknown>) ?? {};

function bySubject(docs: LogDoc[]): Map<string, LogDoc[]> {
  const map = new Map<string, LogDoc[]>();
  for (const d of docs) {
    if (!d.subject_id) continue;
    map.set(d.subject_id, [...(map.get(d.subject_id) ?? []), d]);
  }
  return map;
}

function armOf(list: LogDoc[]): string | null {
  const c = latest(list, "condition_assigned")?.data?.condition;
  return typeof c === "string" ? c : null;
}

function formOf(list: LogDoc[]): FormId | null {
  const f = list.find((d) => d.event === "form_assigned")?.data?.pretest_form;
  return f === "A" || f === "B" ? f : null;
}

const surveyItems = (id: string): SurveyItem[] =>
  getSurvey(id)?.sections.flatMap((s) => s.items) ?? [];

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Short item name from the item label: "Q2.2 explain concept (show work)" -> "Explain concept". */
function itemName(itemId: string): string {
  const label = labelForItem(itemId).replace(/^Q\S+\s*/, "");
  const name = label.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return name ? name[0].toUpperCase() + name.slice(1) : itemId;
}

/** Per-answer keystroke totals, keyed "subject::step:item" (segments summed). */
function keystrokeIndex(docs: LogDoc[]) {
  const index = new Map<
    string,
    { pastes: number; pasted: number; keys: number; chars: number; flagPaste: boolean; flagShort: boolean; detail: string[] }
  >();
  for (const a of keystrokeAnswers(docs)) {
    const base = a.qid.split("#")[0];
    const key = `${a.subjectId}::${base.includes(":") ? base : `${a.step}:${base}`}`;
    const e =
      index.get(key) ??
      { pastes: 0, pasted: 0, keys: 0, chars: 0, flagPaste: false, flagShort: false, detail: [] };
    e.pastes += a.pastes;
    e.pasted += a.pastedChars;
    e.keys += a.keypresses + a.keypadChars;
    e.chars += a.chars;
    e.flagPaste ||= a.flagPaste;
    e.flagShort ||= a.flagTooShort;
    if (a.flagPaste) e.detail.push(`more than one paste (${a.pastes})`);
    if (a.flagTooShort)
      e.detail.push(`more characters than keys pressed (${a.chars} vs ${a.keypresses + a.keypadChars})`);
    index.set(key, e);
  }
  return index;
}

/** Flagged keystroke answers per subject (the AI-use rule). */
function flaggedCount(answers: KeystrokeAnswer[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of answers) {
    if (a.flagPaste || a.flagTooShort) out.set(a.subjectId, (out.get(a.subjectId) ?? 0) + 1);
  }
  return out;
}

/* ------------------------------------------------------------ participants -- */

export function buildParticipantsSheet(
  docs: LogDoc[],
  graded: GradedSubmission[],
  flow: FlowSummary
): Sheet {
  const completers = fullFlowSubjects(docs);
  const lists = bySubject(docs);
  const gradeOf = (s: string, t: TestId) =>
    graded.find((g) => g.submission.subjectId === s && g.submission.testId === t)?.result;
  const detailOf = new Map(flow.participants.map((p) => [p.subjectId, p]));
  const flags = flaggedCount(keystrokeAnswers(docs));

  // Demographic (choice / select-all) columns from the pre-survey definition.
  const pre = surveyItems("pre");
  const post = surveyItems("post");
  const postLikert = new Set(post.filter((i) => i.kind === "likert").map((i) => i.id));
  const preLikert = new Set(pre.filter((i) => i.kind === "likert").map((i) => i.id));
  const demographic: string[] = [];
  for (const item of pre) {
    if (item.kind === "choice") demographic.push(snake(item.id));
    if (item.kind === "multi")
      for (const c of item.choices ?? []) demographic.push(`${snake(item.id)}__${snake(c.id)}`);
  }
  const ratingCol = (survey: "pre" | "post", id: string) =>
    preLikert.has(id) && postLikert.has(id) ? `${survey}_${snake(id)}` : snake(id);
  const ratings = [
    ...pre.filter((i) => i.kind === "likert").map((i) => ratingCol("pre", i.id)),
    ...post.filter((i) => i.kind === "likert").map((i) => ratingCol("post", i.id)),
  ];

  const rows = [...completers].sort().map((subject) => {
    const list = lists.get(subject) ?? [];
    const arm = armOf(list);
    const row: Record<string, unknown> = {
      participant_id: subject,
      arm: armName(arm),
      test_version: formOf(list) ?? "",
    };

    const preAns = answersOf(latest(list, "survey_completed", "pre"));
    const postAns = answersOf(latest(list, "survey_completed", "post"));
    for (const item of pre) {
      if (item.kind === "choice") row[snake(item.id)] = String(preAns[item.id] ?? "");
      if (item.kind === "multi") {
        const chosen = parseMulti(String(preAns[item.id] ?? ""));
        for (const c of item.choices ?? [])
          row[`${snake(item.id)}__${snake(c.id)}`] = chosen.includes(c.id) ? 1 : 0;
      }
      if (item.kind === "likert") row[ratingCol("pre", item.id)] = preAns[item.id] ?? "";
    }
    for (const item of post)
      if (item.kind === "likert") row[ratingCol("post", item.id)] = postAns[item.id] ?? "";

    const preG = gradeOf(subject, "pretest");
    const postG = gradeOf(subject, "posttest");
    row.pre_total = preG?.totalPoints ?? "";
    row.post_total = postG?.totalPoints ?? "";
    row.total_max = preG?.totalMaxPoints ?? postG?.totalMaxPoints ?? "";
    row.total_gain = preG && postG ? postG.totalPoints - preG.totalPoints : "";

    for (const goal of GOALS) {
      const pctOf = (r: typeof preG) => {
        const items = (r?.items ?? []).filter((i) => goalForItem(i.itemId) === goal);
        const max = items.reduce((s, i) => s + i.maxPoints, 0);
        return max ? (items.reduce((s, i) => s + (i.points ?? 0), 0) / max) * 100 : null;
      };
      const a = pctOf(preG);
      const b = pctOf(postG);
      row[`${goal}_pre_pct`] = a == null ? "" : round1(a);
      row[`${goal}_post_pct`] = b == null ? "" : round1(b);
      row[`${goal}_gain_pts`] = a == null || b == null ? "" : round1(b - a);
    }

    const minutes = minutesPerPhase(list);
    const detail = detailOf.get(subject);
    const instr = detail?.instruction;
    const lessonMin = (label: string) => {
      const s = instr?.lessonTimes.find((t) => t.lesson === label)?.seconds;
      return s == null ? "" : round1(s / 60);
    };
    const partMin = (part: string) => {
      const s = instr?.agentParts.find((p) => p.part === part)?.seconds;
      return s == null ? "" : round1(s / 60);
    };
    row.min_pre_survey = minutes.pre_survey;
    row.min_pre_test = minutes.pretest;
    row.min_instruction = instr?.minutes != null ? round1(instr.minutes) : minutes.scenarios;
    row.min_post_test = minutes.posttest;
    row.min_post_survey = minutes.post_survey;
    row.min_lesson_1 = arm === "lesson" ? lessonMin("Lesson 1") : "";
    row.min_lesson_2 = arm === "lesson" ? lessonMin("Lesson 2") : "";
    row.min_question = arm === "agent" ? partMin("Question") : "";
    row.min_create_rubric = arm === "agent" ? partMin("Create Rubric") : "";
    row.min_apply_rubric = arm === "agent" ? partMin("Apply Rubric") : "";
    row.total_minutes = detail?.totalMin != null ? round1(detail.totalMin) : "";

    const n = flags.get(subject) ?? 0;
    row.ai_flagged = n > 0 ? "yes" : "no";
    row.n_flagged_answers = n;
    return row;
  });

  return {
    rows,
    columns: [
      "participant_id",
      "arm",
      "test_version",
      ...demographic,
      ...ratings,
      "pre_total",
      "post_total",
      "total_max",
      "total_gain",
      ...GOALS.flatMap((g) => [`${g}_pre_pct`, `${g}_post_pct`, `${g}_gain_pts`]),
      "min_pre_survey",
      "min_pre_test",
      "min_instruction",
      "min_post_test",
      "min_post_survey",
      "min_lesson_1",
      "min_lesson_2",
      "min_question",
      "min_create_rubric",
      "min_apply_rubric",
      "total_minutes",
      "ai_flagged",
      "n_flagged_answers",
    ],
  };
}

/* ------------------------------------------------------------------ answers -- */

export const ANSWER_COLUMNS = [
  "participant_id",
  "arm",
  "step",
  "item_id",
  "item_name",
  "answer_text",
  "score",
  "max_score",
  "rubric_points_met",
  "seconds",
  "n_pastes",
  "chars_pasted",
  "keys_pressed",
  "final_chars",
  "flagged",
  "flag_reason",
];

const SCREENING_NAMES: Record<string, string> = {
  "highest-math": "Highest math",
  "calculus-courses": "Calculus courses",
  algebra_check: "Algebra check",
  power_rule_check: "Power-rule check",
  q1a: "Worked problem (Q5 / pre-test Q1a)",
};

/**
 * One row per participant × item × step, for everyone in the cohort:
 * screening, pre-survey, pre-test, instruction, post-test, post-survey.
 * Screening Q1a carries its grade (it is graded with the pre-test).
 */
export function buildAnswersSheet(
  docs: LogDoc[],
  graded: GradedSubmission[],
  fullGrades: GradedSubmission[],
  submissions: Submission[],
  flow: FlowSummary,
  /** Response seconds by "subject::test::item", from the insights. */
  seconds: Map<string, number>
): Sheet {
  const lists = bySubject(docs);
  const keys = keystrokeIndex(docs);
  const detailOf = new Map(flow.participants.map((p) => [p.subjectId, p]));
  const rows: Record<string, unknown>[] = [];

  const push = (
    subject: string,
    arm: string | null,
    step: string,
    stepKey: string,
    itemId: string,
    name: string,
    answer: string,
    extra: Partial<Record<string, unknown>> = {}
  ) => {
    const k = keys.get(`${subject}::${stepKey}:${itemId}`);
    rows.push({
      participant_id: subject,
      arm: armName(arm),
      step,
      item_id: itemId,
      item_name: name,
      answer_text: answer,
      score: "",
      max_score: "",
      rubric_points_met: "",
      seconds: "",
      n_pastes: k?.pastes ?? "",
      chars_pasted: k?.pasted ?? "",
      keys_pressed: k?.keys ?? "",
      final_chars: k?.chars ?? "",
      flagged: k ? (k.flagPaste || k.flagShort ? "yes" : "no") : "",
      flag_reason: k?.detail.join("; ") ?? "",
      ...extra,
    });
  };

  const gradeOf = (set: GradedSubmission[], s: string, t: TestId) =>
    set.find((g) => g.submission.subjectId === s && g.submission.testId === t)?.result;

  for (const [subject, list] of [...lists.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const arm = armOf(list);

    // Screening (latest submission).
    const scr = answersOf(latest(list, "screening_completed"));
    const q1a = gradeOf(fullGrades, subject, "pretest");
    const q1aItem = q1a?.items.find((i) => i.itemId === "1");
    const q1aOpen = q1a?.openItems.find((i) => i.itemId === "1");
    for (const item of surveyItems("screening")) {
      if (scr[item.id] === undefined) continue;
      const extra: Record<string, unknown> = {};
      if (item.id === "algebra_check" || item.id === "power_rule_check") {
        const correct = latest(list, "screening_completed")?.data?.failed_items;
        const failed = Array.isArray(correct) && correct.map(String).includes(item.id);
        extra.score = failed ? 0 : 1;
        extra.max_score = 1;
      }
      if (item.id === "q1a" && q1aItem) {
        extra.score = q1aItem.points ?? "";
        extra.max_score = q1aItem.maxPoints;
        extra.rubric_points_met = (q1aOpen?.criteria ?? [])
          .filter((c) => c.verdict === "met")
          .map((c) => c.id)
          .join("; ");
      }
      push(subject, arm, "screening", "screening", item.id, SCREENING_NAMES[item.id] ?? item.prompt, String(scr[item.id] ?? ""), extra);
    }

    // Surveys.
    for (const [survey, step] of [["pre", "pre_survey"], ["post", "post_survey"]] as const) {
      const ans = answersOf(latest(list, "survey_completed", survey));
      for (const item of surveyItems(survey)) {
        const v = ans[item.id];
        if (v === undefined || v === null || v === "" || item.id.endsWith(TYPING_SUFFIX)) continue;
        const text = item.kind === "multi" ? parseMulti(String(v)).join("; ") : String(v);
        push(subject, arm, step, survey, item.id, item.prompt, text);
      }
    }

    // Tests: every item answered, with its grade where there is one.
    for (const [testId, step] of [["pretest", "pre_test"], ["posttest", "post_test"]] as const) {
      const sub = submissions.find((s) => s.subjectId === subject && s.testId === testId);
      if (!sub) continue;
      const test = sub.form ? getFormTest(sub.form) : getTest(testId);
      const result = gradeOf(graded, subject, testId);
      const ids = Object.keys(sub.answers).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      for (const itemId of ids) {
        // Screening Q1a is reported under screening, not repeated here.
        if (itemId === "1" && sub.form && testId === "pretest") continue;
        const found = test ? findItem(test, itemId) : null;
        const scored = result?.items.find((i) => i.itemId === itemId);
        const open = result?.openItems.find((i) => i.itemId === itemId);
        const secs = seconds.get(`${subject}::${testId}::${itemId}`);
        push(
          subject,
          arm,
          step,
          testId,
          itemId,
          itemName(itemId),
          found ? formatAnswer(found.item, sub.answers[itemId]) : JSON.stringify(sub.answers[itemId]),
          {
            score: scored?.points ?? "",
            max_score: scored?.maxPoints ?? itemKey(testId, itemId, sub.form)?.maxPoints ?? "",
            rubric_points_met: (open?.criteria ?? [])
              .filter((c) => c.verdict === "met")
              .map((c) => c.id)
              .join("; "),
            seconds: secs == null ? "" : Math.round(secs),
          }
        );
      }
    }

    // Instruction (completers): lesson questions, or the agent's tasks.
    const instr = detailOf.get(subject)?.instruction;
    for (const q of instr?.lesson ?? []) {
      const last = q.tries[q.tries.length - 1];
      push(subject, arm, "instruction", q.lesson.toLowerCase().replace(/\s+/g, "-"), `${q.lesson} Q${q.number}`, q.prompt.slice(0, 120), last?.response ?? "", {
        score: q.firstTryCorrect ? 1 : 0,
        max_score: 1,
        seconds: q.tries.reduce((s, t) => s + (t.seconds ?? 0), 0) || "",
      });
    }
    for (const part of instr?.agentParts ?? []) {
      push(subject, arm, "instruction", "agent", part.part, part.part, part.scoreLabel, {
        score: part.rate == null ? "" : round1(part.rate * 100) / 100,
        max_score: part.rate == null ? "" : 1,
        seconds: part.seconds == null ? "" : Math.round(part.seconds),
      });
    }
  }

  return { rows, columns: ANSWER_COLUMNS };
}

/* ---------------------------------------------------------------- screening -- */

export function buildScreeningSheet(
  outcomes: ScreeningOutcomes,
  fullGrades: GradedSubmission[]
): Sheet {
  // Q1a rubric criteria, from the answer key (both versions).
  const criteria = [
    ...new Set(
      (["A", "B"] as FormId[]).flatMap((f) => {
        const k = itemKey("pretest", "1", f);
        return k && k.kind === "open" ? k.criteria.map((c) => c.id) : [];
      })
    ),
  ];

  const rows = outcomes.people.map((p) => {
    const grade = fullGrades.find(
      (g) => g.submission.subjectId === p.subjectId && g.submission.testId === "pretest"
    )?.result;
    const item = grade?.items.find((i) => i.itemId === "1");
    const open = grade?.openItems.find((i) => i.itemId === "1");
    const finished = p.outcome !== "not-finished";
    const row: Record<string, unknown> = {
      participant_id: p.subjectId,
      arm: armName(p.arm),
      test_version: p.pretestForm ?? "",
      outcome:
        p.outcome === "eligible" ? "eligible" : p.outcome === "screened-out" ? "screened_out" : "did_not_finish",
      furthest_step: p.furthest,
      highest_math: p.highestMath,
      calculus_courses: p.calculusCourses,
      algebra_check: p.algebraCorrect == null ? "" : p.algebraCorrect ? "correct" : "incorrect",
      power_rule_check: p.powerRuleCorrect == null ? "" : p.powerRuleCorrect ? "correct" : "incorrect",
      paste_check: !finished ? "" : p.failedItems.includes("q1a") ? "fail" : "pass",
      chars_pasted: finished ? p.q5PastedChars : "",
      screened_out_reasons: p.failedItems.map((i) => SCREEN_REASONS[i]?.label ?? i).join("; "),
      q1a_score: item?.points ?? "",
      q1a_max: item?.maxPoints ?? "",
    };
    for (const c of criteria) {
      const v = open?.criteria.find((x) => x.id === c)?.verdict;
      row[`q1a_${snake(c)}`] = v == null ? "" : v === "met" ? 1 : 0;
    }
    return row;
  });

  return {
    rows,
    columns: [
      "participant_id",
      "arm",
      "test_version",
      "outcome",
      "furthest_step",
      "highest_math",
      "calculus_courses",
      "algebra_check",
      "power_rule_check",
      "paste_check",
      "chars_pasted",
      "screened_out_reasons",
      "q1a_score",
      "q1a_max",
      ...criteria.map((c) => `q1a_${snake(c)}`),
    ],
  };
}

