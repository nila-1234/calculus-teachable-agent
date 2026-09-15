import { parseMulti, type SurveyAnswers } from "./types";

/**
 * Screening rules: who is filtered out before the study begins.
 *
 * The study targets participants who have met calculus but are not specialists,
 * so both over- and under-qualified people are excluded. These are transcribed
 * from the options marked in red in the study design doc — the single place to
 * edit if the criteria change.
 */

/**
 * Choosing any of these answers makes a participant ineligible. Keys are item
 * ids; values are option ids, which are the option labels themselves.
 */
export const INELIGIBLE_OPTIONS: Record<string, string[]> = {
  // Too advanced, or unable to place themselves.
  "highest-math": [
    "Calculus III or higher",
    "Other college-level mathematics (e.g., linear algebra, differential equations)",
    "I am not sure",
  ],
  // No calculus exposure at all.
  "calculus-topics": ["None of the above"],
  // Too many courses, or unable to say.
  "calculus-courses": ["3 or more", "I am not sure"],
  // Never studied it.
  "last-studied": ["I have never studied or used calculus"],
};

export type EligibilityResult = {
  eligible: boolean;
  /** Item ids that triggered exclusion, for the record. */
  failedItems: string[];
  /** The specific disqualifying options chosen. */
  reasons: string[];
};

/**
 * A multi-select item disqualifies only when a disqualifying option was
 * actually selected — "None of the above" alongside real topics would be
 * contradictory, but it is still treated as disqualifying because the
 * participant asserted no exposure.
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
