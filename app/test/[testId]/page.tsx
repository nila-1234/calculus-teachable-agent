"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckIcon } from "@radix-ui/react-icons";
import AppHeader from "@/components/app-header";
import StepIntro from "@/components/step-intro";
import TestProgress from "@/components/test-progress";
import TestQuestionPanel from "@/components/test-question-panel";
import Button from "@/components/button";
import { getTest } from "@/lib/tests/definitions";
import { TestAnswers, TestItemAnswer } from "@/lib/tests/types";
import { logEvent } from "@/lib/logger";

export default function TestPage() {
  const router = useRouter();
  const params = useParams();
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
    const saved = sessionStorage.getItem(`test:${test.id}:answers`);
    if (saved) {
      try {
        setAnswers(JSON.parse(saved));
      } catch {
      }
    }
  }, [test]);

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
    sessionStorage.setItem(`test:${test.id}:answers`, JSON.stringify(next));
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

    return Boolean(answer.text?.trim());
  };

  const handleStart = () => {
    logEvent("test_started", test.id, {});
    setScreenIndex(0);
  };

  const handleBack = () => {
    setScreenIndex((prev) => Math.max(prev - 1, -1));
  };

  const handleNext = () => {
    if (!current || !isAnswered()) return;

    const { item } = current;
    logEvent("test_item_answered", test.id, {
      item_id: item.id,
      answer: answers[item.id],
    });

    if (screenIndex === items.length - 1) {
      sessionStorage.setItem(`test:${test.id}:completed`, "true");
      logEvent("test_completed", test.id, { answers });
    }

    setScreenIndex((prev) => prev + 1);
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

            <div className="mx-auto mt-6 flex w-full max-w-3xl items-center justify-between">
              <Button variant="secondary" onClick={handleBack}>
                Back
              </Button>
              <span className="text-xs font-semibold text-stone-400">
                {screenIndex + 1} of {items.length}
              </span>
              <Button onClick={handleNext} disabled={!isAnswered()}>
                {screenIndex === items.length - 1 ? "Finish test" : "Next"}
              </Button>
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
              <Button className="mt-6" onClick={() => router.push("/test")}>
                Back to assessments
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
