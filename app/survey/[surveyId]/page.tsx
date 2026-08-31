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

function SurveyPageContent() {
  const router = useRouter();
  const params = useParams();
  const query = useSearchParams().toString();
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

    if (
      survey.id === "post" &&
      sessionStorage.getItem("test:posttest:completed") !== "true"
    ) {
      router.replace(query ? `/test/posttest?${query}` : "/test/posttest");
      return;
    }

    const saved = loadSurveyAnswers(survey.id);
    if (survey.id === "post" && !saved["subject-id"]) {
      const preAnswers = loadSurveyAnswers("pre");
      if (preAnswers["subject-id"]) {
        saved["subject-id"] = preAnswers["subject-id"];
        saveSurveyAnswers(survey.id, saved);
      }
    }

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
  const nextHref =
    survey.id === "pre"
      ? query
        ? `/test/pretest?${query}`
        : "/test/pretest"
      : query
        ? `/scenarios?${query}`
        : "/scenarios";

  const saveAnswers = (next: SurveyAnswers) => {
    setAnswers(next);
    saveSurveyAnswers(survey.id, next);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    markSurveyCompleted(survey.id);
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
              onAnswerChange={(itemId, value) =>
                saveAnswers({ ...answers, [itemId]: value })
              }
            />

            <div className="mt-6 flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-400">
                {items.filter((item) => answers[item.id]?.trim()).length} of{" "}
                {items.length} answered
              </span>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                Submit survey
              </Button>
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
                  : "Your responses have been recorded. Thank you for completing the study."}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button variant="secondary" onClick={() => setScreen("form")}>
                  Review answers
                </Button>
                <Button onClick={() => router.push(nextHref)}>
                  {survey.id === "pre" ? "Continue to pre-test" : "Finish"}
                </Button>
              </div>
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
