const SUBJECT_ID_KEY = "subjectId";

export const UNKNOWN_SUBJECT_ID = "unknown";

/**
 * The subject ID lives in localStorage rather than sessionStorage so a
 * participant who closes the tab (or reopens the study in a new one) keeps the
 * same ID. sessionStorage is per-tab and is dropped on close, which silently
 * re-tagged every later event as "unknown".
 *
 * The trade-off is that the ID now outlives the browser session, so the same
 * machine reused for a second participant would inherit the first one's ID.
 * Call clearSubjectId() between participants — the researcher badge exposes it.
 */
export function getSubjectId(): string {
  if (typeof window === "undefined") return UNKNOWN_SUBJECT_ID;

  try {
    const stored = localStorage.getItem(SUBJECT_ID_KEY);
    if (stored) return stored;

    // Migrate any ID left behind by the previous sessionStorage-based build so
    // a participant mid-study doesn't get split across two IDs.
    const legacy = sessionStorage.getItem(SUBJECT_ID_KEY);
    if (legacy) {
      localStorage.setItem(SUBJECT_ID_KEY, legacy);
      return legacy;
    }
  } catch {
    // Storage can throw in private-browsing modes; fall through to unknown.
  }

  return UNKNOWN_SUBJECT_ID;
}

export function hasSubjectId(): boolean {
  return getSubjectId() !== UNKNOWN_SUBJECT_ID;
}

export function setSubjectId(id: string): void {
  if (typeof window === "undefined") return;

  const trimmed = id.trim();
  if (!trimmed) return;

  try {
    localStorage.setItem(SUBJECT_ID_KEY, trimmed);
  } catch {
    /* ignore unavailable storage */
  }
}

export function clearSubjectId(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(SUBJECT_ID_KEY);
    sessionStorage.removeItem(SUBJECT_ID_KEY);
  } catch {
    /* ignore unavailable storage */
  }
}
