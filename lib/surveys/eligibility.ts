import { parseMulti, type SurveyAnswers } from "./types";

/**
 * Screening rules: who is filtered out before the study begins.
 *
 * The study targets participants who have met calculus but are not specialists,
 * so both over- and under-qualified people are excluded:
 *
 *  - Ceiling (self-report): highest level of mathematics, number of calculus
 *    courses, and number of college mathematics courses of any kind.
 *  - Currently enrolled in a calculus course — excluded so the study material
 *    is not concurrent coursework.
 *  - Floor (skill checks): two multiple-choice questions that must be answered
 *    correctly. Demonstrated ability is a stronger floor than any self-report,
 *    which is why the earlier self-report floor items ("which topics", "when
 *    last studied") were dropped. The items are adapted from the parallel
 *    product-rule study (Eason Chen), which found typed skill checks
 *    over-rejected on surface form and switched to multiple choice.
 *
 * Option ids are the option labels themselves, and lib/surveys/definitions.ts
 * builds the same items — the two must stay in step. The skill-check option
 * lists live here and are imported by definitions, so a correct answer can
 * never drift out of the presented option set.
 */

/** Option lists for the two skill-check items, shared with definitions.ts. */
export const ALGEBRA_CHECK_OPTIONS = [
  "\\(800 + 40m\\)",
  "\\(800 - 40m\\)",
  "\\(2400 - 40m\\)",
  "\\(40m - 800\\)",
];
export const POWER_RULE_OPTIONS = [
  "\\(5x^4 + 7\\)",
  "\\(x^4\\)",
  "\\(5x^4\\)",
  "\\(5x^5 + 7x\\)",
];

/**
 * The correct answer for each skill check, taken by index from the option
 * lists above so it is always exactly one of the presented options. A
 * participant is eligible only if they choose these — any other answer, or
 * none, is disqualifying.
 */
export const SKILL_CHECK_ANSWERS: Record<string, string> = {
  algebra_check: ALGEBRA_CHECK_OPTIONS[1],
  power_rule_check: POWER_RULE_OPTIONS[2],
};

/**
 * Choosing any of these answers makes a participant ineligible. Keys are item
 * ids; values are option ids, which are the option labels themselves.
 */
export const INELIGIBLE_OPTIONS: Record<string, string[]> = {
  // Ceiling: Calculus II or beyond is past the applied-optimization material
  // this study teaches (0929, Ken).
  "highest-math": ["Calculus II", "Calculus III or higher"],
  // Ceiling: too many calculus courses.
  "calculus-courses": ["3 or more"],
  // Ceiling: too many college mathematics courses of any kind.
  math_courses: ["3 or more"],
  // Currently taking calculus, so the material would be concurrent coursework
  // rather than something learned in the study.
  calc_history: ["I am currently enrolled in a calculus course"],
};

export type EligibilityResult = {
  eligible: boolean;
  /** Item ids that triggered exclusion, for the record. */
  failedItems: string[];
  /** The disqualifying options chosen, or a skill-check failure note. */
  reasons: string[];
};

/**
 * A participant fails if they pick a disqualifying option on any self-report
 * item, or if they get either skill check wrong.
 *
 * The skill checks are defined by their one correct answer, so a wrong or blank
 * response fails — the opposite of the self-report items, where only the listed
 * options fail. The items are required, so a blank is defensive only.
 */
export function evaluateEligibility(answers: SurveyAnswers): EligibilityResult {
  const failedItems: string[] = [];
  const reasons: string[] = [];

  for (const [itemId, disqualifying] of Object.entries(INELIGIBLE_OPTIONS)) {
    const raw = answers[itemId] ?? "";
    const chosen = raw.includes("|") ? parseMulti(raw) : raw ? [raw] : [];

    const hits = chosen.filter((choice) => disqualifying.includes(choice));
    if (hits.length) {
      failedItems.push(itemId);
      reasons.push(...hits);
    }
  }

  for (const [itemId, correct] of Object.entries(SKILL_CHECK_ANSWERS)) {
    const raw = (answers[itemId] ?? "").trim();
    if (raw !== correct) {
      failedItems.push(itemId);
      reasons.push(`${itemId}: ${raw ? "incorrect" : "unanswered"}`);
    }
  }

  return { eligible: failedItems.length === 0, failedItems, reasons };
}


/**
 * Remembering the outcome so a screened-out participant cannot simply answer
 * again with different answers.
 *
 * localStorage rather than sessionStorage: sessionStorage is cleared when the
 * tab closes, which is exactly the "come back and retry" case this blocks.
 *
 * LIMITATION: this is browser-scoped, so a different browser, a private window,
 * or cleared site data defeats it. Enforcing it properly needs a server-side
 * record keyed on a participant identifier that exists *before* screening —
 * the Prolific ID from the launch URL is the natural one, since the subject ID
 * is not collected until the pre-survey. Every screening attempt is logged with
 * its answers and outcome, so retries are at least detectable after the fact.
 */
const SCREENING_OUTCOME_KEY = "screening:outcome";

export type ScreeningOutcome = "eligible" | "ineligible";

export function recordScreeningOutcome(eligible: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      SCREENING_OUTCOME_KEY,
      eligible ? "eligible" : "ineligible"
    );
  } catch {
    /* ignore unavailable storage */
  }
}

export function getScreeningOutcome(): ScreeningOutcome | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(SCREENING_OUTCOME_KEY);
    return value === "eligible" || value === "ineligible" ? value : null;
  } catch {
    return null;
  }
}

export function isScreenedOut(): boolean {
  return getScreeningOutcome() === "ineligible";
}

/** For resetting between participants on a shared machine. */
export function clearScreeningOutcome(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SCREENING_OUTCOME_KEY);
  } catch {
    /* ignore unavailable storage */
  }
}
