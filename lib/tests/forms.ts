import { getSubjectId, UNKNOWN_SUBJECT_ID } from "@/lib/subject";
import type { FormId, TestId } from "./types";

/**
 * Counterbalancing: which test version a participant takes as the pre-test.
 *
 * Half take Version A first and Version B after the instruction, half the
 * reverse. Decided once per participant — before screening, because screening
 * asks the pre-test version's Q1a — and kept for the rest of their run.
 *
 * The split is a hash of the participant id with its own salt, so it is stable
 * across reloads and devices and independent of the instruction-arm
 * assignment (which hashes the bare id). Balanced in expectation, not by
 * construction; the analysis reports the counts.
 */

const SALT = "test-form:";

/**
 * TEMPORARY OVERRIDE — give every NEW participant this pre-test version
 * ("A" = A pre / B post, "B" = B pre / A post). Set back to null to restore
 * the random split. Participants who already have a version keep it.
 */
const FORCE_PRETEST_FORM: FormId | null = "A";

/** FNV-1a — a stable, well-spread mapping from an id to a bucket. */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Keyed by subject, so the next participant on a shared machine isn't handed this one's version. */
const cacheKey = () => `pretestForm:${getSubjectId()}`;

export const otherForm = (form: FormId): FormId => (form === "A" ? "B" : "A");

/** The version this participant takes as the pre-test. */
export function getPretestForm(): FormId {
  if (typeof window === "undefined") return "A";
  try {
    const cached = localStorage.getItem(cacheKey());
    if (cached === "A" || cached === "B") return cached;
  } catch {
    /* storage unavailable: fall through to a fresh, still-stable assignment */
  }
  const subject = getSubjectId();
  const form: FormId = FORCE_PRETEST_FORM
    ? FORCE_PRETEST_FORM
    : subject && subject !== UNKNOWN_SUBJECT_ID
      ? hash(`${SALT}${subject}`) % 2 === 0
        ? "A"
        : "B"
      : Math.random() < 0.5
        ? "A"
        : "B";
  try {
    localStorage.setItem(cacheKey(), form);
  } catch {
    /* ignore */
  }
  return form;
}

/** The version a participant takes in a given phase. */
export function formForPhase(testId: TestId): FormId {
  const pre = getPretestForm();
  return testId === "pretest" ? pre : otherForm(pre);
}

/**
 * A per-participant, stable shuffle (seeded by participant id and phase), so a
 * reload shows the same order and different people see different orders.
 */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let state = hash(seed) || 1;
  const random = () => {
    // xorshift32
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
