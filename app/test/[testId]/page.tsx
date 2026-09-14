"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CheckIcon } from "@radix-ui/react-icons";
import AppHeader from "@/components/app-header";
import StepIntro from "@/components/step-intro";
import TestProgress from "@/components/test-progress";
import TestQuestionPanel from "@/components/test-question-panel";
import Button from "@/components/button";
import { getTest } from "@/lib/tests/definitions";
import { TestAnswers, TestItemAnswer } from "@/lib/tests/types";
import { logEvent } from "@/lib/logger";
import { PREVIEW_PARAM, isPreviewActive } from "@/lib/preview";

function TestPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  // Derived, not stored: no effect needed and it stays correct across navigation.
  const preview = searchParams.has(PREVIEW_PARAM);
  const testId = typeof params.testId === "string" ? params.testId : "";
  const test = getTest(testId);

  // -1 = intro screen, 0..n-1 = question screens, n = complete screen
  const [screenIndex, setScreenIndex] = useState(-1);
  const [answers, setAnswers] = useState<TestAnswers>({});

  const items = useMemo(
    () =>
      test
        ? test.sections.flatMap((section) =>
            section.items.map((item) => ({ section, item }))
          )
        : [],
    [test]
  );

  useEffect(() => {
    if (!test) return;
    // Preview opens any test directly, with no prerequisite and no saved state.
    if (isPreviewActive()) return;

    if (
      test.id === "pretest" &&
      sessionStorage.getItem("survey:pre:completed") !== "true"
    ) {
      router.replace(query ? `/survey/pre?${query}` : "/survey/pre");
      return;
    }

    let restored: TestAnswers = {};
    const saved = sessionStorage.getItem(`test:${test.id}:answers`);
    if (saved) {
      try {
        restored = JSON.parse(saved);
      } catch {
      }
    }

    // Resume at the furthest question reached. Without this, a refresh or a
    // browser-back out of the test would drop the participant at the intro and
    // let them walk forward over answers they had already committed — which
    // would defeat removing the Back button.
    const stored = Number(sessionStorage.getItem(`test:${test.id}:progress`));
    const resumeAt = Number.isInteger(stored) && stored > -1 ? stored : null;

    queueMicrotask(() => {
      setAnswers(restored);
      if (resumeAt !== null) setScreenIndex(resumeAt);
    });
  }, [test, query, router]);

  if (!test) {
    return <main className="p-6">Test not found.</main>;
  }

  const isComplete = screenIndex >= items.length;
  const current = screenIndex >= 0 && !isComplete ? items[screenIndex] : null;

  const progressLabels = [...test.sections.map((s) => s.title), "Complete"];
  const progressStep = isComplete
    ? test.sections.length
    : current
      ? test.sections.findIndex((s) => s.id === current.section.id)
      : 0;

  const saveAnswers = (next: TestAnswers) => {
    setAnswers(next);
    // Preview must not leave participant answers behind in storage.
    if (!preview) {
      sessionStorage.setItem(`test:${test.id}:answers`, JSON.stringify(next));
    }
  };

  const isAnswered = (): boolean => {
    if (!current) return false;
    const { item } = current;
    const answer = answers[item.id] || {};

    if (item.kind === "multiple-choice") {
      if (!answer.choiceId) return false;
      const choice = item.choices?.find((c) => c.id === answer.choiceId);
      if (choice?.allowsOtherText && !answer.otherText?.trim()) return false;
      if (item.explanationPrompt && !answer.explanation?.trim()) return false;
      return true;
    }

    if (item.kind === "matching") {
      if (!item.matchRows?.length) return false;
      const selectedChoices = item.matchRows.map(
        (row) => answer.matches?.[row.id]
      );
      return (
        selectedChoices.every(Boolean) &&
        new Set(selectedChoices).size === selectedChoices.length
      );
    }

    return Boolean(answer.text?.trim());
  };

  /** Answers are final once submitted, so progress only ever moves forward. */
  const advanceTo = (next: number) => {
    setScreenIndex(next);
    // Preview must not write participant state into storage.
    if (!preview) {
      sessionStorage.setItem(`test:${test.id}:progress`, String(next));
    }
  };

  const handleStart = () => {
    logEvent("test_started", test.id, {});
    advanceTo(0);
  };

  const handleNext = () => {
    // Preview steps through without answering; a participant cannot.
    if (!current || (!isAnswered() && !preview)) return;

    const { item } = current;
    logEvent("test_item_answered", test.id, {
      item_id: item.id,
      answer: answers[item.id],
    });

    if (screenIndex === items.length - 1 && !preview) {
      sessionStorage.setItem(`test:${test.id}:completed`, "true");
      logEvent("test_completed", test.id, { answers });
    }

    advanceTo(screenIndex + 1);
  };

  return (
    <main className="min-h-screen bg-stone-100">
      <AppHeader />
      <div className="mx-auto max-w-4xl overflow-y-auto p-3 py-6 sm:px-6">
        {screenIndex >= 0 && (
          <TestProgress labels={progressLabels} currentStep={progressStep} />
        )}

        {screenIndex === -1 && (
          <div className="mx-auto w-full max-w-3xl">
            <StepIntro
              eyebrow="Assessment"
              title={test.title}
              paragraphs={test.intro}
            />

            <div className="rounded-xl border-2 border-stone-200 bg-white p-5 shadow-sm">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">
                What this assessment covers
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-stone-600">
                {test.goals.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ul>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={handleStart}>Start the test</Button>
            </div>
          </div>
        )}

        {current && (
          <>
            <TestQuestionPanel
              section={current.section}
              item={current.item}
              answer={answers[current.item.id] || {}}
              onAnswerChange={(next: TestItemAnswer) =>
                saveAnswers({ ...answers, [current.item.id]: next })
              }
            />

            <div className="mx-auto mt-6 flex w-full max-w-3xl items-center justify-between gap-4">
              <span className="text-xs font-semibold text-stone-400">
                {screenIndex + 1} of {items.length}
              </span>
              <div className="flex flex-wrap items-center justify-end gap-3">
                {!preview && (
                  <span className="text-xs text-stone-400">
                    Please review your answer before continuing. Once you
                    continue, you will not be able to go back and change it.
                  </span>
                )}
                <Button
                  onClick={handleNext}
                  disabled={!isAnswered() && !preview}
                >
                  {screenIndex === items.length - 1 ? "Finish test" : "Next"}
                </Button>
              </div>
            </div>
          </>
        )}

        {isComplete && (
          <div className="mx-auto w-full max-w-3xl">
            <div className="flex flex-col items-center rounded-xl border-2 border-stone-200 bg-white p-10 text-center shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lime-600">
                <CheckIcon className="text-white" width={24} height={24} />
              </span>
              <h2 className="mt-4 text-2xl font-bold text-stone-800">
                {test.id === "pretest" ? "Pre-test complete" : "Post-test complete"}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-stone-500">
                Your answers have been recorded. Thank you for completing this
                assessment.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button
                  onClick={() =>
                    router.push(
                      test.id === "posttest"
                        ? query
                          ? `/survey/post?${query}`
                          : "/survey/post"
                        : query
                          ? `/scenarios?${query}`
                          : "/scenarios"
                    )
                  }
                >
                  {test.id === "posttest"
                    ? "Continue to post-survey"
                    : "Continue"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function TestPage() {
  return (
    <Suspense>
      <TestPageContent />
    </Suspense>
  );
}
