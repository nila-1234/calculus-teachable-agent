"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  flushLogQueue,
  getLogState,
  getServerLogState,
  subscribeLogState,
} from "@/lib/logger";
import { UNKNOWN_SUBJECT_ID, clearSubjectId, getSubjectId } from "@/lib/subject";

type Health =
  | { state: "checking" }
  | { state: "ok"; db: string; env: string; logCount: number }
  | { state: "error"; error: string };

/** The ?logcheck flag never changes for the life of the page. */
const subscribeNothing = () => () => {};
const readForced = () =>
  new URLSearchParams(window.location.search).has("logcheck");

const subjectListeners = new Set<() => void>();
const subscribeSubject = (listener: () => void) => {
  subjectListeners.add(listener);
  return () => {
    subjectListeners.delete(listener);
  };
};
const notifySubject = () => subjectListeners.forEach((listener) => listener());

/**
 * Researcher-facing badge confirming events are actually reaching Firestore.
 *
 * It stays hidden during a normal participant run and only appears when
 * something is wrong — or when opened with ?logcheck, which is how you verify a
 * deployment before a session.
 */
export default function LogStatus() {
  const logState = useSyncExternalStore(
    subscribeLogState,
    getLogState,
    getServerLogState
  );
  const forced = useSyncExternalStore(
    subscribeNothing,
    readForced,
    () => false
  );
  const subjectId = useSyncExternalStore(
    subscribeSubject,
    getSubjectId,
    () => UNKNOWN_SUBJECT_ID
  );

  const [health, setHealth] = useState<Health>({ state: "checking" });

  useEffect(() => {
    // Deliver anything left over from a previous visit that failed to send.
    void flushLogQueue();

    const onOnline = () => void flushLogQueue();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  useEffect(() => {
    if (!forced) return;

    let cancelled = false;
    fetch("/api/log")
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && body?.ok) {
          setHealth({
            state: "ok",
            db: body.db,
            env: body.env,
            logCount: body.logCount,
          });
        } else {
          setHealth({
            state: "error",
            error: body?.error ?? `/api/log responded ${res.status}`,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setHealth({ state: "error", error: String(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [forced]);

  const failing = logState.status === "failing";
  if (!forced && !failing) return null;

  return (
    <div className="fixed bottom-3 right-3 z-50 max-w-xs rounded-lg border-2 border-stone-300 bg-white p-3 text-xs shadow-lg">
      <div className="font-bold uppercase tracking-wider text-stone-500">
        Logging status
      </div>

      {failing ? (
        <p className="mt-1 font-semibold text-red-600">
          Not reaching the database. {logState.queued} event(s) held locally and
          retried automatically.
        </p>
      ) : (
        <p className="mt-1 text-stone-600">
          Queue empty — all events delivered.
        </p>
      )}

      {logState.lastError && (
        <p className="mt-1 break-words text-stone-400">{logState.lastError}</p>
      )}

      {forced && (
        <>
          <div className="mt-2 border-t border-stone-200 pt-2 text-stone-600">
            {health.state === "checking" && <span>Checking connection…</span>}
            {health.state === "ok" && (
              <span>
                Connected to <b>{health.db}</b> ({health.env}) —{" "}
                {health.logCount} log(s) stored.
              </span>
            )}
            {health.state === "error" && (
              <span className="break-words font-semibold text-red-600">
                {health.error}
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-stone-200 pt-2">
            <span className="truncate text-stone-600">
              Subject: <b>{subjectId}</b>
            </span>
            <button
              type="button"
              onClick={() => {
                clearSubjectId();
                notifySubject();
              }}
              className="shrink-0 rounded border border-stone-300 px-2 py-0.5 font-semibold text-stone-600 hover:bg-stone-100"
            >
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  );
}
