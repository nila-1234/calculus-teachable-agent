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
