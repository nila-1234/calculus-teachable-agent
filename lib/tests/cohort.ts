import type { LogDoc } from "./report";

/**
 * Which participants a results view covers.
 *
 * "study": the new study's recruits — everyone whose screening (the
 * form_assigned event, logged when the screening page assigns the pre-test
 * version) happened at or after STUDY_START. Earlier runs, including the
 * earlier A/B full pilot, are left out; /instructor/analysis still shows them.
 */
export type Cohort = "study";

export function isCohort(value: unknown): value is Cohort {
  return value === "study";
}

/**
 * When the new study begins. Participants screened before this are not part of
 * it.
 *
 * ⚠️ Set to the launch time before recruiting starts. Until then it sits at the
 * start of testing so the team's own `test-` runs show up on the dashboard.
 *
 * Kept in code (like the Prolific codes) so anyone who can open a PR can see
 * and change it; the STUDY_START environment variable wins if set, so a
 * deployment can move it without a code change. ISO 8601, UTC.
 */
const STUDY_START_DEFAULT = "2026-11-23T16:00:00Z";

export function studyStart(): string {
  const raw = process.env.STUDY_START?.trim() || STUDY_START_DEFAULT;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`STUDY_START is not a valid date: ${raw}`);
  }
  // Event timestamps are client-side ISO strings (toISOString), so comparing
  // against the same format orders them correctly as strings.
  return parsed.toISOString();
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

/** Drops every event of a Claude test run. */
export function dropTestRuns(docs: LogDoc[]): LogDoc[] {
  return docs.filter((d) => !isTestSubject(d.subject_id));
}

/**
 * The team's own test runs (/?pid=test-corina-1, …), used to check the pipeline
 * end to end. Hidden from results by default; the study dashboard can show them
 * on request. They also never count toward the arm balance (/api/assign).
 */
export const TEAM_TEST_PREFIX = "test-";

export function isTeamTestRun(subjectId: string | undefined | null): boolean {
  return !!subjectId && subjectId.toLowerCase().startsWith(TEAM_TEST_PREFIX);
}

/** Drops (or, with includeTeamTests, keeps) the team's own test runs. */
export function filterTeamTests(docs: LogDoc[], includeTeamTests: boolean): LogDoc[] {
  return includeTeamTests ? docs : docs.filter((d) => !isTeamTestRun(d.subject_id));
}

/**
 * Subjects in the study cohort: screened (form_assigned) at or after `start`.
 * Pure, so the dashboard query and the tests agree on who is in.
 */
export function cohortSubjects(docs: LogDoc[], start: string): Set<string> {
  return new Set(
    docs
      .filter(
        (d) =>
          d.event === "form_assigned" &&
          d.subject_id &&
          (d.timestamp ?? "") >= start
      )
      .map((d) => d.subject_id as string)
  );
}

/** Every event of the participants in the cohort (all of their events). */
export function filterCohort(docs: LogDoc[], start: string): LogDoc[] {
  const subjects = cohortSubjects(docs, start);
  return docs.filter((d) => d.subject_id && subjects.has(d.subject_id));
}
