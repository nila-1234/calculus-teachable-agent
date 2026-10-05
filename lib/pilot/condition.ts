import { getSubjectId } from "@/lib/subject";
import type { PilotForm } from "@/lib/pilot/tests";

/**
 * Which pilot form a participant takes: A (pretest) or B (posttest).
 *
 * Resolved against /api/pilot-assign so the split is balanced by construction,
 * then cached per subject. If the server is unreachable it falls back to a hash
 * of the subject id and caches that, because a participant flipping forms
 * mid-test would ruin their data; the fallback is reported back on the next
 * call and recorded server-side as "client-fallback". Mirrors the main study's
 * condition resolver, in its own namespace.
 */

const FORMS: PilotForm[] = ["A", "B"];

/**
 * TEMPORARY OVERRIDE — force every new participant onto one form.
 * "B" collects the posttest only; set back to null to restore balanced A/B.
 * (A matching override exists in app/api/pilot-assign/route.ts — flip both.)
 */
const FORCE_FORM: PilotForm | null = "B";

/** Lets an instructor preview a specific form: ?form=B */
const FORM_PARAM = "form";

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function cacheKey(): string {
  return `pilot:form:${getSubjectId()}`;
}

function readCache(): PilotForm | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(cacheKey());
    return FORMS.includes(stored as PilotForm) ? (stored as PilotForm) : null;
  } catch {
    return null;
  }
}

function writeCache(form: PilotForm): void {
  try {
    localStorage.setItem(cacheKey(), form);
  } catch {
    /* ignore unavailable storage */
  }
}

function fallbackForm(): PilotForm {
  return FORMS[hash(getSubjectId()) % FORMS.length];
}

/** Instructor preview: ?form=B, default A. Never contacts the server. */
export function previewForm(): PilotForm {
  if (typeof window === "undefined") return "A";
  try {
    const forced = new URLSearchParams(window.location.search).get(FORM_PARAM);
    if (forced && FORMS.includes(forced as PilotForm)) return forced as PilotForm;
  } catch {
    /* ignore malformed query strings */
  }
  return "A";
}

export async function resolvePilotForm(): Promise<PilotForm> {
  // Temporary override: hand everyone the forced form and record it server-side.
  if (FORCE_FORM) {
    writeCache(FORCE_FORM);
    void fetch("/api/pilot-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject_id: getSubjectId(), preferred: FORCE_FORM }),
    }).catch(() => {});
    return FORCE_FORM;
  }

  const cached = readCache();
  if (cached) return cached;

  const fallback = fallbackForm();

  try {
    const res = await fetch("/api/pilot-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject_id: getSubjectId() }),
    });
    const data = await res.json();
    if (res.ok && FORMS.includes(data?.form)) {
      writeCache(data.form as PilotForm);
      return data.form as PilotForm;
    }
  } catch (err) {
    console.error("Pilot form assignment unreachable, falling back:", err);
  }

  writeCache(fallback);
  void fetch("/api/pilot-assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject_id: getSubjectId(), preferred: fallback }),
  }).catch(() => {});

  return fallback;
}

/** The already-decided form, cached; fallback before one exists. */
export function getPilotForm(): PilotForm {
  if (FORCE_FORM) return FORCE_FORM;
  if (typeof window === "undefined") return "A";
  return readCache() ?? fallbackForm();
}
