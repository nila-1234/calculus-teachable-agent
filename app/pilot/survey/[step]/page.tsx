"use client";

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/app-header";
import PilotSurveyRunner from "@/components/pilot/survey-runner";
import { getSurvey } from "@/lib/surveys/definitions";
import { DIFFICULTY_SURVEY, PILOT_PRE_SURVEY } from "@/lib/pilot/surveys";
import type { SurveyDefinition } from "@/lib/surveys/types";

/**
 * The survey steps of the pilot: screening (collected, never screened out),
 * the pre-survey, and the closing difficulty survey. Screening here skips the
 * eligibility check entirely — everyone proceeds.
 */
type StepConfig = {
  survey: SurveyDefinition | null;
  event: string;
  next: string;
  submitLabel?: string;
};

function PilotSurveyStep() {
  const params = useParams();
  const router = useRouter();
  const query = useSearchParams().toString();
  const step = typeof params.step === "string" ? params.step : "";
  const withQuery = (path: string) => (query ? `${path}?${query}` : path);

  const configs: Record<string, StepConfig> = {
    screening: {
      survey: getSurvey("screening"),
      event: "screening_completed",
      next: "/pilot/survey/pre",
    },
    pre: {
      survey: PILOT_PRE_SURVEY,
      event: "survey_completed",
      next: "/pilot/test",
    },
    difficulty: {
      survey: DIFFICULTY_SURVEY,
      event: "survey_completed",
      next: "/pilot/complete",
      submitLabel: "Finish",
    },
  };

  const config = configs[step];

  if (!config || !config.survey) {
    return (
      <main className="min-h-screen bg-stone-100">
        <AppHeader />
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <p className="text-sm text-stone-500">This page is not available.</p>
        </div>
      </main>
    );
  }

  return (
    <PilotSurveyRunner
      survey={config.survey}
      event={config.event}
      submitLabel={config.submitLabel}
      onComplete={() => router.push(withQuery(config.next))}
    />
  );
}

export default function PilotSurveyPage() {
  return (
    <Suspense>
      <PilotSurveyStep />
    </Suspense>
  );
}
