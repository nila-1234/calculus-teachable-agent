"use client";

import { useEffect } from "react";
import { installAiLogging } from "@/lib/ai-logging";
import { captureProlificIds } from "@/lib/prolific";

/**
 * Installs the student/AI exchange recorder once, app-wide.
 *
 * Rendered from the root layout so it covers every scenario step without those
 * pages needing to know about it. logEvent() already drops events in instructor
 * preview, so instructor testing is not recorded.
 */
export default function AiLogger() {
  useEffect(() => {
    installAiLogging();
    // Captured here because this mounts on every page: Prolific's parameters
    // only appear on the landing URL, and the scenario pages later rebuild
    // their query string and would drop them.
    captureProlificIds();
  }, []);

  return null;
}
