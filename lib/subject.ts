import { getProlificPid } from "@/lib/prolific";

const SUBJECT_ID_KEY = "subjectId";

export const UNKNOWN_SUBJECT_ID = "unknown";

/** Lets a researcher hand out pre-assigned ids: /?pid=P01 */
const PID_PARAM = "pid";

/**
 * The identifier every logged event is attributed to.
 *
 * Nobody is ever asked to type this. Participants mistype, leave it blank, or
 * reuse someone else's — and a browser reused for a second participant used to
 * inherit the first one's id, which is exactly how two people end up sharing
 * one identity in the data.
 *
 * Resolved once, in priority order, then stored:
 *
 *   1. ?pid= in the URL      — a researcher handing out pre-assigned ids
 *   2. the Prolific ID       — authoritative for anyone recruited that way
 *   3. a generated id        — so an in-person participant is never "unknown"
 *
 * Storage is localStorage rather than sessionStorage so an id survives a tab
 * close mid-study. The cost is that it also survives into the *next*
 * participant on a shared machine, so clear it between sessions — the Reset
 * button on the ?logcheck badge does exactly that.
 */
function readStored(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(SUBJECT_ID_KEY);
    if (stored) return stored;

    // Migrate an id left behind by the earlier sessionStorage-based build.
    const legacy = sessionStorage.getItem(SUBJECT_ID_KEY);
    if (legacy) {
      localStorage.setItem(SUBJECT_ID_KEY, legacy);
      return legacy;
    }
  } catch {
    /* storage can throw in private-browsing modes */
  }

  return null;
}

function fromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return new URLSearchParams(window.location.search).get(PID_PARAM)?.trim() || null;
  } catch {
    return null;
  }
}

/** Auto-assigned ids are provisional and may be replaced by a real one. */
const GENERATED_PREFIX = "anon-";

function isGenerated(id: string | null): boolean {
  return !!id && id.startsWith(GENERATED_PREFIX);
}

function generateId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  // Prefixed so a generated id is never mistaken for one you assigned.
  return `${GENERATED_PREFIX}${random}`;
}

export function getSubjectId(): string {
  if (typeof window === "undefined") return UNKNOWN_SUBJECT_ID;

  // An explicitly supplied id always wins, even over a stored one, so handing
  // someone a fresh ?pid= link reassigns the machine rather than silently
  // keeping the previous participant's id.
  const supplied = fromUrl();
  if (supplied) {
    setSubjectId(supplied);
    return supplied;
  }

  const stored = readStored();

  // A real identifier always beats a provisional one. Without this, resetting
  // between participants leaves the still-open page free to mint an anon id
  // immediately, and the next participant's Prolific ID would lose to it — so
  // two people would share one identity in the data.
  const prolific = getProlificPid();
  if (prolific && (!stored || isGenerated(stored))) {
    setSubjectId(prolific);
    return prolific;
  }

  if (stored) return stored;

  const generated = generateId();
  setSubjectId(generated);
  return generated;
}

/** True once an id exists — with auto-assignment, effectively always. */
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
