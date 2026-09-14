"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { logEvent } from "@/lib/logger";
import { isNonParticipantContext } from "@/lib/preview";

/**
 * Derives the scenario id from the route so timing events line up with the
 * scenario_id on every other event. Non-scenario routes (surveys, tests) report
 * the step name instead.
 */
function scenarioIdFor(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "welcome";
  if (/^\d+$/.test(segments[0])) return segments[0];
  return segments.slice(0, 2).join("/");
}

/**
 * Emits step_entered / step_exited with a dwell time so time-on-task can be
 * reconstructed per participant per step. Without this the logs only say what
 * happened, not how long any of it took.
 */
export default function StepTimer() {
  const pathname = usePathname();
  const currentPath = useRef<string | null>(null);
  // Set on first navigation; reading the clock during render is impure.
  const enteredAt = useRef(0);
  const exitLogged = useRef(false);

  useEffect(() => {
    if (!pathname) return;
    // No time-on-task for instructor preview or instructor tooling.
    if (isNonParticipantContext()) return;

    const previous = currentPath.current;
    if (previous === pathname) return;

    const now = Date.now();

    if (previous && !exitLogged.current) {
      void logEvent("step_exited", scenarioIdFor(previous), {
        path: previous,
        dwell_ms: now - enteredAt.current,
        reason: "navigated",
      });
    }

    currentPath.current = pathname;
    enteredAt.current = now;
    exitLogged.current = false;

    void logEvent("step_entered", scenarioIdFor(pathname), { path: pathname });
  }, [pathname]);

  useEffect(() => {
    // A participant who closes the tab, backgrounds it, or triggers a full page
    // load never fires a client-side navigation, so the final step would
    // otherwise have no measured duration. pagehide is the one that survives an
    // actual unload; visibilitychange covers backgrounding without leaving.
    const logExit = (reason: string) => {
      if (isNonParticipantContext()) return;
      if (!currentPath.current || exitLogged.current) return;

      exitLogged.current = true;
      void logEvent("step_exited", scenarioIdFor(currentPath.current), {
        path: currentPath.current,
        dwell_ms: Date.now() - enteredAt.current,
        reason,
      });
    };

    const onPageHide = () => logExit("page_hidden");
    const onVisibility = () => {
      if (document.visibilityState === "hidden") logExit("tab_backgrounded");
    };

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
