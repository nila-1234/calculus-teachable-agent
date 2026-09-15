import { logEvent } from "@/lib/logger";

/**
 * Records every exchange between a student and the AI.
 *
 * The scenario pages already log outcomes (which criterion was graded, that
 * feedback arrived) but never what was actually said. Without the exchange
 * itself there is no way to analyse whether a student engaged with the AI or
 * how, and unlike a score it cannot be reconstructed after the run.
 *
 * This wraps window.fetch rather than editing each call site on purpose: the
 * scenario pages are being actively redesigned, and a central interceptor both
 * avoids fighting those edits and captures any AI route added later. If the
 * pages settle down, this can be replaced with explicit per-call logging.
 */

/** Route suffixes under /api that talk to a model on the student's behalf. */
const AI_ROUTES = [
  "ai-student-answers",
  "apply-rubric-feedback",
  "grade-chat",
  "grade-lines-comment",
  "grade-lines-discussion",
  "grade-lines-feedback",
  "question-feedback",
];

/** Keeps a single exchange from bloating the document it is stored in. */
const MAX_FIELD_CHARS = 4000;

let installed = false;

function routeNameFor(url: string): string | null {
  const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
  const match = AI_ROUTES.find(
    (route) => path === `/api/${route}` || path.startsWith(`/api/${route}/`)
  );
  return match ?? null;
}

function truncate(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > MAX_FIELD_CHARS
      ? `${value.slice(0, MAX_FIELD_CHARS)}…[truncated ${value.length - MAX_FIELD_CHARS} chars]`
      : value;
  }

  if (Array.isArray(value)) return value.map(truncate);

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        truncate(v),
      ])
    );
  }

  return value;
}

function parseBody(body: unknown): unknown {
  if (typeof body !== "string") return null;
  try {
    return truncate(JSON.parse(body));
  } catch {
    return truncate(body);
  }
}

/** The scenario the exchange happened in, taken from the route. */
function scenarioIdFromLocation(): string {
  const match = window.location.pathname.match(/^\/(\d+)(\/|$)/);
  return match ? match[1] : "-";
}

export function installAiLogging(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const route = routeNameFor(url);

    // /api/log itself must never be intercepted, or logging would recurse.
    if (!route) return originalFetch(input as RequestInfo, init);

    const startedAt = Date.now();
    const response = await originalFetch(input as RequestInfo, init);

    // Read from a clone so the caller still gets an unconsumed body.
    let responseBody: unknown = null;
    try {
      responseBody = truncate(await response.clone().json());
    } catch {
      responseBody = null;
    }

    void logEvent("ai_exchange", scenarioIdFromLocation(), {
      route,
      path: window.location.pathname,
      ok: response.ok,
      status: response.status,
      duration_ms: Date.now() - startedAt,
      request: parseBody(init?.body),
      response: responseBody,
    });

    return response;
  };
}
