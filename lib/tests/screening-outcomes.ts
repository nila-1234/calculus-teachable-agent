import type { LogDoc } from "./report";
import {
  AI_CHECK_ITEM,
  SKILL_CHECK_ANSWERS,
} from "@/lib/surveys/eligibility";
import { parseTyping, TYPING_SUFFIX } from "@/lib/surveys/types";

/**
 * Who was screened out, and why — over EVERY participant, not just completers.
 *
 * Reasons come from the screening_completed event (failed_items / reasons, as
 * evaluateEligibility decided them at the time), so a later change to the rules
 * never rewrites why someone was turned away.
 */

export type ScreenGroup = "high" | "low" | "ai";

/** Each failed screening item, as a reason category. */
export const SCREEN_REASONS: Record<string, { label: string; group: ScreenGroup }> = {
  "highest-math": { label: "Too advanced: highest math is Calculus II or beyond", group: "high" },
  "calculus-courses": { label: "Too advanced: 3 or more calculus courses", group: "high" },
  algebra_check: { label: "Algebra check wrong", group: "low" },
  power_rule_check: { label: "Power-rule check wrong", group: "low" },
  [AI_CHECK_ITEM]: {
    label: "Q5: left blank, or possible AI use (pasted, not typed, AI-style wording)",
    group: "ai",
  },
};

export const SCREEN_GROUP_LABELS: Record<ScreenGroup, string> = {
  high: "Above the ceiling",
  low: "Below the floor",
  ai: "Possible AI use",
};

export type ScreeningPerson = {
  subjectId: string;
  /** When screening was submitted (latest attempt), or first seen if never. */
  at: string;
  outcome: "eligible" | "screened-out" | "not-finished";
  /** Screening submissions; more than one means the participant retried. */
  attempts: number;
  /** Failed item ids (keys of SCREEN_REASONS) and the logged reason text. */
  failedItems: string[];
  reasons: string[];
  groups: ScreenGroup[];
  highestMath: string;
  calculusCourses: string;
  algebraCorrect: boolean | null;
  powerRuleCorrect: boolean | null;
  /** Screening Q5 (the pre-test version's Q1a). */
  q5Chars: number;
  q5PastedChars: number;
  q5Text: string;
  pretestForm: string | null;
  /** The furthest step reached in the whole flow. */
  furthest: string;
};

export type ScreeningOutcomes = {
  started: number;
  finished: number;
  eligible: number;
  screenedOut: number;
  notFinished: number;
  /** Screened-out people per reason (one person can have several). */
  byReason: { item: string; label: string; group: ScreenGroup; n: number }[];
  /** Screened-out people per group (one person can be in several). */
  byGroup: { group: ScreenGroup; label: string; n: number }[];
  people: ScreeningPerson[];
};

const FURTHEST: [string, (l: LogDoc[]) => boolean][] = [
  ["Post-survey done", (l) => l.some((d) => d.event === "survey_completed" && d.scenario_id === "post")],
  ["Post-test done", (l) => l.some((d) => d.event === "test_completed" && d.scenario_id === "posttest")],
  ["Instruction started", (l) => l.some((d) => d.event === "condition_assigned")],
  ["Pre-test done", (l) => l.some((d) => d.event === "test_completed" && d.scenario_id === "pretest")],
  ["Pre-survey done", (l) => l.some((d) => d.event === "survey_completed" && d.scenario_id === "pre")],
  ["Consented", (l) => l.some((d) => d.event === "consent_given")],
  ["Finished screening", (l) => l.some((d) => d.event === "screening_completed")],
  ["Opened screening", () => true],
];

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function buildScreeningOutcomes(docs: LogDoc[]): ScreeningOutcomes {
  const bySubject = new Map<string, LogDoc[]>();
  for (const d of docs) {
    if (!d.subject_id) continue;
    bySubject.set(d.subject_id, [...(bySubject.get(d.subject_id) ?? []), d]);
  }

  const people: ScreeningPerson[] = [...bySubject.entries()].map(([subjectId, list]) => {
    const sorted = [...list].sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? ""));
    const attempts = sorted.filter((d) => d.event === "screening_completed");
    const last = attempts[attempts.length - 1];
    const data = (last?.data ?? {}) as Record<string, unknown>;
    const answers = (data.answers && typeof data.answers === "object"
      ? data.answers
      : {}) as Record<string, unknown>;

    const failedItems = Array.isArray(data.failed_items) ? data.failed_items.map(String) : [];
    const reasons = Array.isArray(data.reasons) ? data.reasons.map(String) : [];
    const groups = [
      ...new Set(failedItems.map((i) => SCREEN_REASONS[i]?.group).filter(Boolean)),
    ] as ScreenGroup[];

    const check = (item: string) => {
      const raw = str(answers[item]).trim();
      return raw ? raw === SKILL_CHECK_ANSWERS[item] : null;
    };
    const typing = parseTyping(str(answers[`${AI_CHECK_ITEM}${TYPING_SUFFIX}`]) || undefined);
    const q5Text = str(answers[AI_CHECK_ITEM]);
    const form =
      sorted.find((d) => d.event === "form_assigned")?.data?.pretest_form ?? data.pretest_form;

    return {
      subjectId,
      at: last?.timestamp ?? sorted[0]?.timestamp ?? "",
      outcome: !last ? "not-finished" : data.eligible === true ? "eligible" : "screened-out",
      attempts: attempts.length,
      failedItems,
      reasons,
      groups,
      highestMath: str(answers["highest-math"]),
      calculusCourses: str(answers["calculus-courses"]),
      algebraCorrect: check("algebra_check"),
      powerRuleCorrect: check("power_rule_check"),
      q5Chars: q5Text.length,
      q5PastedChars: typing.pastedChars + typing.droppedChars,
      q5Text: q5Text.slice(0, 1500),
      pretestForm: typeof form === "string" ? form : null,
      furthest: FURTHEST.find(([, reached]) => reached(sorted))![0],
    };
  });

  people.sort((a, b) => a.at.localeCompare(b.at));
  const out = people.filter((p) => p.outcome === "screened-out");

  return {
    started: people.length,
    finished: people.filter((p) => p.outcome !== "not-finished").length,
    eligible: people.filter((p) => p.outcome === "eligible").length,
    screenedOut: out.length,
    notFinished: people.filter((p) => p.outcome === "not-finished").length,
    byReason: Object.entries(SCREEN_REASONS).map(([item, { label, group }]) => ({
      item,
      label,
      group,
      n: out.filter((p) => p.failedItems.includes(item)).length,
    })),
    byGroup: (Object.keys(SCREEN_GROUP_LABELS) as ScreenGroup[]).map((group) => ({
      group,
      label: SCREEN_GROUP_LABELS[group],
      n: out.filter((p) => p.groups.includes(group)).length,
    })),
    people,
  };
}
