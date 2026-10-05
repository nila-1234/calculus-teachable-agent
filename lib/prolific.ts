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

/**
 * Reads a launch parameter from storage, falling back to the URL.
 *
 * The URL fallback matters: capture happens in an effect, and anything that
 * runs earlier — the step timer logging a page view, for instance — would
 * otherwise see no Prolific ID and decide the participant is anonymous. That
 * made the identity of every Prolific participant depend on React effect
 * ordering.
 */
function readOrCapture(key: string, param: string): string | null {
  const stored = read(key);
  if (stored) return stored;

  if (typeof window === "undefined") return null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get(param)?.trim();
    if (fromUrl) {
      write(key, fromUrl);
      return fromUrl;
    }
  } catch {
    /* ignore malformed query strings */
  }

  return null;
}

export function getProlificIds(): ProlificIds {
  return {
    pid: getProlificPid(),
    studyId: readOrCapture(STUDY_KEY, URL_PARAMS.study),
    sessionId: readOrCapture(SESSION_KEY, URL_PARAMS.session),
  };
}

export function getProlificPid(): string | null {
  return readOrCapture(PID_KEY, URL_PARAMS.pid);
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
 */
const PROLIFIC_COMPLETION_CODE = "C5J1GCYW";

export const COMPLETION_CODE =
  process.env.NEXT_PUBLIC_PROLIFIC_COMPLETION_CODE?.trim() ||
  PROLIFIC_COMPLETION_CODE;

/**
 * Completion code for the test-question pilot (the /pilot flow).
 *
 * The pilot is a separate Prolific study with its own code, so a pilot
 * submission must not be sent with the main study's code — Prolific would
 * reject it. Same override rules as the main completion code; the pilot's own
 * env var wins if set.
 *
 * ⚠️ Must match the completion code on the pilot's Prolific study.
 */
const PILOT_PROLIFIC_COMPLETION_CODE = "CLAVQVJP";

export const PILOT_COMPLETION_CODE =
  process.env.NEXT_PUBLIC_PILOT_PROLIFIC_COMPLETION_CODE?.trim() ||
  PILOT_PROLIFIC_COMPLETION_CODE;

/**
 * Screen-out code, for a participant who is screened out at the eligibility
 * survey. Prolific pays a reduced rate for a screen-out, so these participants
 * still need a code — a different one from the completers, so the two outcomes
 * are distinguishable on Prolific. Same override rules as the completion code.
 *
 * ⚠️ Must match the screen-out code on the Prolific study.
 */
const PROLIFIC_SCREEN_OUT_CODE = "C182P03K";

export const SCREEN_OUT_CODE =
  process.env.NEXT_PUBLIC_PROLIFIC_SCREEN_OUT_CODE?.trim() ||
  PROLIFIC_SCREEN_OUT_CODE;

/**
 * The Prolific URL that records a submission for a given code. Prolific derives
 * the outcome from the code, so completion and screen-out use the same endpoint
 * with different codes.
 */
export function prolificSubmissionUrl(code: string): string {
  return `https://app.prolific.com/submissions/complete?cc=${encodeURIComponent(
    code
  )}`;
}
