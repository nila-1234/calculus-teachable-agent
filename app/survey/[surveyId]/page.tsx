"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CheckIcon } from "@radix-ui/react-icons";
import AppHeader from "@/components/app-header";
import Button from "@/components/button";
import StepIntro from "@/components/step-intro";
import SurveyPanel, { areSurveyAnswersComplete } from "@/components/survey-panel";
import TestProgress from "@/components/test-progress";
import { getSurvey } from "@/lib/surveys/definitions";
import {
  isSurveyCompleted,
  loadSurveyAnswers,
  markSurveyCompleted,
  saveSurveyAnswers,
} from "@/lib/surveys/storage";
import type { SurveyAnswers } from "@/lib/surveys/types";
import { logEvent } from "@/lib/logger";
import CompletionCode from "@/components/completion-code";
import { COMPLETION_CODE, getProlificPid } from "@/lib/prolific";
import { PREVIEW_PARAM, isPreviewActive } from "@/lib/preview";
import {
  evaluateEligibility,
  isScreenedOut,
  recordScreeningOutcome,
} from "@/lib/surveys/eligibility";

function SurveyPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const preview = searchParams.has(PREVIEW_PARAM);
  const surveyId = typeof params.surveyId === "string" ? params.surveyId : "";
  const survey = getSurvey(surveyId);

  const [screen, setScreen] = useState<"checking" | "form" | "complete">(
    "checking"
  );
  const [answers, setAnswers] = useState<SurveyAnswers>({});

  const items = useMemo(
    () => (survey ? survey.sections.flatMap((section) => section.items) : []),
    [survey]
  );

  useEffect(() => {
    if (!survey) return;

    // Preview opens either survey directly, always on the form, never resuming
    // a participant's saved answers or their completed state.
    if (isPreviewActive()) {
      queueMicrotask(() => setScreen("form"));
      return;
    }

    // A participant who has already been screened out cannot answer again.
    if (isScreenedOut()) {
      router.replace(query ? `/not-eligible?${query}` : "/not-eligible");
      return;
    }

    // The pre-survey is only reachable once consent has been given.
    if (
      survey.id === "pre" &&
      sessionStorage.getItem("consent:given") !== "true"
    ) {
      router.replace(query ? `/consent?${query}` : "/consent");
      return;
    }

    if (
      survey.id === "post" &&
      sessionStorage.getItem("test:posttest:completed") !== "true"
    ) {
      router.replace(query ? `/test/posttest?${query}` : "/test/posttest");
      return;
    }

    const saved = loadSurveyAnswers(survey.id);

    const nextScreen = isSurveyCompleted(survey.id) ? "complete" : "form";
    queueMicrotask(() => {
      setAnswers(saved);
      setScreen(nextScreen);
    });
  }, [survey, query, router]);

  if (!survey) {
    return <main className="p-6">Survey not found.</main>;
  }

  if (screen === "checking") {
    return <main className="min-h-screen bg-stone-100" />;
  }

  const progressLabels = [
    ...survey.sections.map((section) => section.shortTitle || section.title),
    "Complete",
  ];
  const progressStep = screen === "complete" ? survey.sections.length : 0;
  const canSubmit = areSurveyAnswersComplete(survey, answers);
  const withQuery = (path: string) => (query ? `${path}?${query}` : path);
  const cameFromProlific = Boolean(getProlificPid());

  /**
   * Updates one item. Uses a functional update because two answers changed
   * before React re-renders would otherwise both build on the same stale
   * snapshot and the first would be lost — reachable by clicking two options
   * quickly, and more likely on a multi-select.
   */
  const setAnswer = (itemId: string, value: string) => {
    setAnswers((previous) => {
      const next = { ...previous, [itemId]: value };
      if (!preview) saveSurveyAnswers(survey.id, next);
      return next;
    });
  };

  const handleSubmit = () => {
    if (!canSubmit && !preview) return;

    // Screening decides eligibility and leaves the normal flow entirely.
    // It is deliberately never marked complete: it has no completion screen to
    // return to, and marking it meant coming back showed that screen instead of
    // the questions.
    if (survey.id === "screening") {
      const eligibility = evaluateEligibility(answers);
      if (!preview) recordScreeningOutcome(eligibility.eligible);

      logEvent("screening_completed", survey.id, {
        answers,
        eligible: eligibility.eligible,
        failed_items: eligibility.failedItems,
        reasons: eligibility.reasons,
      });

      if (preview) {
        setScreen("complete");
        return;
      }

      router.replace(
        eligibility.eligible ? withQuery("/consent") : withQuery("/not-eligible")
      );
      return;
    }

    if (!preview) markSurveyCompleted(survey.id);
    logEvent("survey_completed", survey.id, { answers });
    setScreen("complete");
  };

  return (
    <main className="min-h-screen bg-stone-100">
      <AppHeader />
      <div className="mx-auto max-w-4xl overflow-y-auto p-3 py-6 sm:px-6">
        <TestProgress labels={progressLabels} currentStep={progressStep} />

        {screen === "form" && (
          <div className="mx-auto w-full max-w-3xl">
            <StepIntro
              eyebrow="Survey"
              title={survey.title}
              paragraphs={survey.intro}
            />

            <SurveyPanel
              survey={survey}
              answers={answers}
              onAnswerChange={(itemId, value) => setAnswer(itemId, value)}
            />

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <span className="text-xs font-semibold text-stone-400">
                {items.filter((item) => answers[item.id]?.trim()).length} of{" "}
                {items.length} answered
              </span>
              <div className="flex flex-wrap items-center justify-end gap-3">
                {!preview && (
                  <span className="text-xs text-stone-400">
                    Please review your answers before submitting. Once you
                    submit, you will not be able to go back and change them.
                  </span>
                )}
                <Button onClick={handleSubmit} disabled={!canSubmit && !preview}>
                  Submit survey
                </Button>
              </div>
            </div>
          </div>
        )}

        {screen === "complete" && (
          <div className="mx-auto w-full max-w-3xl">
            <div className="flex flex-col items-center rounded-xl border-2 border-stone-200 bg-white p-10 text-center shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lime-600">
                <CheckIcon className="text-white" width={24} height={24} />
              </span>
              <h2 className="mt-4 text-2xl font-bold text-stone-800">
                {survey.id === "pre" ? "Pre-survey complete" : "Post-survey complete"}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-stone-500">
                {survey.id === "pre"
                  ? "Your responses have been recorded. Continue to the pre-test."
                  : "Your responses have been recorded. This is the end of the study — thank you for taking part. You may now close this page."}
              </p>
              {/*
                The post-survey ends the study, so there is nothing to continue
                to. It previously offered "Finish", which navigated back into the
                instruction. The Prolific code is the last thing a participant
                needs, so it goes here.
              */}
              {/*
                Only participants who arrived from Prolific need a code. For
                anyone recruited directly there is nothing to submit, so showing
                a code — or warning that one is missing — would only confuse.
              */}
              {survey.id === "post" && cameFromProlific && (
                <CompletionCode
                  code={COMPLETION_CODE}
                  envVar="NEXT_PUBLIC_PROLIFIC_COMPLETION_CODE"
                />
              )}
              {survey.id === "pre" && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Button onClick={() => router.push(withQuery("/test/pretest"))}>
                    Continue to pre-test
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function SurveyPage() {
  return (
    <Suspense>
      <SurveyPageContent />
    </Suspense>
  );
}
