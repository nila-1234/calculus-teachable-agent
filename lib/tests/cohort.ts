import type { LogDoc } from "./report";

/**
 * Which participants a results view covers.
 *
 * "full-pilot": runs on the counterbalanced design. Those participants, and
 * only those, have a form_assigned event (logged on screening, when the
 * pre-test version is decided), so it cleanly separates them from earlier
 * runs on the fixed tests — whatever the date.
 */
export type Cohort = "full-pilot";

export function isCohort(value: unknown): value is Cohort {
  return value === "full-pilot";
}

/**
 * Participant ids used for Claude's test runs (/?pid=claude-test-1, …). Fake
 * data: dropped from every results view and export. Real participants never
 * get such an id (Prolific ids are 24 hex characters).
 */
export const TEST_SUBJECT_PREFIX = "claude-test";

export function isTestSubject(subjectId: string | undefined | null): boolean {
  return !!subjectId && subjectId.toLowerCase().startsWith(TEST_SUBJECT_PREFIX);
}

/** Drops every event of a test run. */
export function dropTestRuns(docs: LogDoc[]): LogDoc[] {
  return docs.filter((d) => !isTestSubject(d.subject_id));
}

/** Every event of the participants in the cohort (all of their events, not just the A/B ones). */
export function filterCohort(docs: LogDoc[], cohort: Cohort): LogDoc[] {
  if (cohort !== "full-pilot") return docs;
  const subjects = new Set(
    docs
      .filter((d) => d.event === "form_assigned" && d.subject_id)
      .map((d) => d.subject_id as string)
  );
  return docs.filter((d) => d.subject_id && subjects.has(d.subject_id));
}
