"use client";

import { useState } from "react";
import AppHeader from "@/components/app-header";
import Button from "@/components/button";
import SurveyPanel, { areSurveyAnswersComplete } from "@/components/survey-panel";
import { logEvent } from "@/lib/logger";
import type { SurveyAnswers, SurveyDefinition } from "@/lib/surveys/types";

/**
 * Runs one survey in the pilot flow: render it, require the required items, log
 * completion, then hand off. Deliberately lean — no prerequisites, no
 * screen-out, no persistence — because the pilot collects everyone and never
 * gates. Events are tagged for the pilot store automatically (the /pilot route).
 */
export default function PilotSurveyRunner({
  survey,
  event,
  onComplete,
  submitLabel = "Continue",
}: {
  survey: SurveyDefinition;
  event: string;
  onComplete: () => void;
  submitLabel?: string;
}) {
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const items = survey.sections.flatMap((section) => section.items);
  const canSubmit = areSurveyAnswersComplete(survey, answers);

  const handleSubmit = () => {
    logEvent(event, survey.id, { answers });
    onComplete();
  };

  return (
    <main className="min-h-screen bg-stone-100">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="mb-3 text-2xl font-bold text-stone-800">{survey.title}</h1>
        {survey.intro.map((paragraph, i) => (
          <p key={i} className="mb-2 text-sm leading-6 text-stone-600">
            {paragraph}
          </p>
        ))}

        <div className="mt-6">
          <SurveyPanel
            survey={survey}
            answers={answers}
            onAnswerChange={(id, value) =>
              setAnswers((prev) => ({ ...prev, [id]: value }))
            }
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <span className="text-xs font-semibold text-stone-400">
            {items.filter((it) => answers[it.id]?.trim()).length} of{" "}
            {items.length} answered
          </span>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </main>
  );
}
