/**
 * Prolific integration.
 *
 * Prolific launches participants with identifiers in the URL and expects a
 * completion code at the end. Both sides are handled here.
 *
 * The identifiers are captured once and stored, rather than read from the URL
 * whenever they are needed: the scenario pages rebuild their query string from
 * scratch and would drop them partway through the study.
 */

const PID_KEY = "prolific:pid";
const STUDY_KEY = "prolific:study";
const SESSION_KEY = "prolific:session";

/** Prolific's standard launch parameters. */
const URL_PARAMS = {
  pid: "PROLIFIC_PID",
  study: "STUDY_ID",
  session: "SESSION_ID",
} as const;

export type ProlificIds = {
  pid: string | null;
  studyId: string | null;
  sessionId: string | null;
};

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore unavailable storage */
  }
}

/**
 * Stores whatever Prolific put in the URL. Safe to call on every page: it only
 * writes when a value is present, so a later page without the parameters cannot
 * erase what the landing page captured.
 */
export function captureProlificIds(): void {
  if (typeof window === "undefined") return;

  try {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get(URL_PARAMS.pid)?.trim();
    const study = params.get(URL_PARAMS.study)?.trim();
    const session = params.get(URL_PARAMS.session)?.trim();

    if (pid) write(PID_KEY, pid);
    if (study) write(STUDY_KEY, study);
    if (session) write(SESSION_KEY, session);
  } catch {
    /* ignore malformed query strings */
  }
}

export function getProlificIds(): ProlificIds {
  return {
    pid: read(PID_KEY),
    studyId: read(STUDY_KEY),
    sessionId: read(SESSION_KEY),
  };
}

export function getProlificPid(): string | null {
  return read(PID_KEY);
}

/** For resetting between participants on a shared machine. */
export function clearProlificIds(): void {
  if (typeof window === "undefined") return;
  try {
    [PID_KEY, STUDY_KEY, SESSION_KEY].forEach((key) =>
      localStorage.removeItem(key)
    );
  } catch {
    /* ignore unavailable storage */
  }
}

/**
 * Completion code for a finished Prolific submission.
 *
 * Kept in code rather than only as an environment variable. It is not a secret
 * — participants read it off the screen — and being NEXT_PUBLIC_ it is baked in
 * at build time regardless, so an env var buys nothing but a dependency on
 * whoever holds the deployment settings. As a constant, anyone who can open a
 * PR can change it.
 *
 * ⚠️ This must match the completion code on the Prolific study. Recreating the
 * study generates a new one. If they disagree, participants submit a code
 * Prolific rejects and are not paid.
 *
 * The environment variable still wins if set, so a deployment can override
 * without a code change.
 *
 * There is deliberately no screen-out code. Screened-out participants are not
 * compensated in this study, so they are simply told they may close the page.
 */
const PROLIFIC_COMPLETION_CODE = "C5J1GCYW";

export const COMPLETION_CODE =
  process.env.NEXT_PUBLIC_PROLIFIC_COMPLETION_CODE?.trim() ||
  PROLIFIC_COMPLETION_CODE;
