"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import GradeLinesActivity from "@/components/grade-lines-activity";

/** The scenario the study uses; ?scenario=N tries another. */
const DEFAULT_SCENARIO = 5;

/**
 * Internal testing sandbox: only the Apply Rubric discussion with the AI
 * professor and student — no earlier steps, no next page, nothing recorded
 * (see isNonParticipantContext in lib/preview.ts). Not linked from anywhere.
 */
function InternalTestContent() {
  const searchParams = useSearchParams();
  const requested = Number.parseInt(searchParams.get("scenario") ?? "", 10);
  return (
    <GradeLinesActivity
      scenarioId={Number.isFinite(requested) ? requested : DEFAULT_SCENARIO}
      internalTest
    />
  );
}

export default function InternalTestPage() {
  return (
    <Suspense>
      <InternalTestContent />
    </Suspense>
  );
}
