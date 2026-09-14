export const PREVIEW_PARAM = "preview";

/**
 * Instructor preview mode.
 *
 * The participant flow is strictly linear — you cannot reach the post-survey
 * without completing everything before it. Preview mode exists so an instructor
 * can open any page directly to check its content, without answering anything
 * and without the run being recorded.
 *
 * Two properties matter and are enforced elsewhere:
 *  - logEvent() drops every event while preview is active, so browsing never
 *    pollutes the study data with "unknown" subjects.
 *  - SubjectGuard does not redirect, so pages open without a subject ID.
 */
const PREVIEW_SESSION_KEY = "previewMode";

/** /scenarios and the scenario step routes. */
function isScenarioRoute(pathname: string): boolean {
  return pathname === "/scenarios" || /^\/\d+(\/|$)/.test(pathname);
}

export function isPreviewActive(): boolean {
  if (typeof window === "undefined") return false;

  try {
    if (new URLSearchParams(window.location.search).has(PREVIEW_PARAM)) {
      sessionStorage.setItem(PREVIEW_SESSION_KEY, "1");
      return true;
    }

    // The welcome page is where a real run begins, so reaching it without the
    // flag ends preview for this tab. This stops a leftover marker from
    // silently suppressing a participant's logging.
    if (window.location.pathname === "/") {
      sessionStorage.removeItem(PREVIEW_SESSION_KEY);
      return false;
    }

    // The scenario pages rebuild their query string from scratch
    // (`?questionMode=…&applyRubricMode=…`) and drop the flag, so preview has to
    // survive that — but only within the instructions phase, so every other
    // route still requires the flag explicitly.
    return (
      sessionStorage.getItem(PREVIEW_SESSION_KEY) === "1" &&
      isScenarioRoute(window.location.pathname)
    );
  } catch {
    return false;
  }
}

/** Ends preview for this tab. */
export function clearPreviewMode(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PREVIEW_SESSION_KEY);
  } catch {
    /* ignore unavailable storage */
  }
}

/** Instructor tooling pages are never part of a participant run. */
export function isInstructorRoute(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.pathname.startsWith("/instructor");
}

/**
 * True wherever events must not be recorded: instructor preview, and the
 * instructor tooling pages themselves. The preview hub has no ?preview flag of
 * its own, so without the route check its page views leaked into the logs as
 * subject "unknown".
 */
export function isNonParticipantContext(): boolean {
  return isPreviewActive() || isInstructorRoute();
}

/** Adds the preview flag to a path, preserving any existing query string. */
export function previewHref(path: string): string {
  const [base, existing] = path.split("?");
  const params = new URLSearchParams(existing ?? "");
  params.set(PREVIEW_PARAM, "1");
  return `${base}?${params.toString()}`;
}

export type PreviewPhase = {
  id: string;
  label: string;
  description: string;
  /** Path without the preview flag; previewHref() adds it. */
  path: string;
};

/**
 * The five phases an instructor may want to inspect, in participant order.
 *
 * Instructions enters at the scenario list; from there the scenario's own flow
 * (question -> create-rubric -> grade-lines) takes over, because that phase must
 * stay fully interactive for the AI conversation to be testable.
 */
export const PREVIEW_PHASES: PreviewPhase[] = [
  {
    id: "pre-survey",
    label: "Pre-survey",
    description: "The survey participants complete before anything else.",
    path: "/survey/pre",
  },
  {
    id: "pre-test",
    label: "Pre-test",
    description: "The optimization assessment taken before instruction.",
    path: "/test/pretest",
  },
  {
    id: "instructions",
    label: "Instructions",
    description:
      "The TA scenarios. Fully interactive here, including the AI conversation.",
    path: "/scenarios",
  },
  {
    id: "post-test",
    label: "Post-test",
    description: "The parallel assessment taken after instruction.",
    path: "/test/posttest",
  },
  {
    id: "post-survey",
    label: "Post-survey",
    description: "The closing survey.",
    path: "/survey/post",
  },
];

/**
 * Which phase a path belongs to. Scenario step routes (/1/question and friends)
 * all resolve to the Instructions phase so the bar keeps working inside them.
 */
export function phaseIndexForPath(pathname: string): number {
  if (/^\/\d+(\/|$)/.test(pathname)) {
    return PREVIEW_PHASES.findIndex((phase) => phase.id === "instructions");
  }
  return PREVIEW_PHASES.findIndex((phase) => phase.path === pathname);
}
