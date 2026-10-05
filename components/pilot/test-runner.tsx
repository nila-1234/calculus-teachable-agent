"use client";

import { useMemo, useState } from "react";
import AppHeader from "@/components/app-header";
import Button from "@/components/button";
import StepIntro from "@/components/step-intro";
import TestQuestionPanel from "@/components/test-question-panel";
import { logEvent } from "@/lib/logger";
import type {
  TestAnswers,
  TestDefinition,
  TestItemAnswer,
} from "@/lib/tests/types";

/**
 * Runs one test form in the pilot flow, one question per screen. Logs
 * test_started / test_item_answered / test_completed (tagged for the pilot
 * store via the /pilot route). No Back and no persistence: answers are final,
 * matching the main study.
 */
export default function PilotTestRunner({
  test,
  onComplete,
}: {
  test: TestDefinition;
  onComplete: () => void;
}) {
  const [screenIndex, setScreenIndex] = useState(-1);
  const [answers, setAnswers] = useState<TestAnswers>({});

  const items = useMemo(
    () =>
      test.sections.flatMap((section) =>
        section.items.map((item) => ({ section, item }))
      ),
    [test]
  );

  const current =
    screenIndex >= 0 && screenIndex < items.length ? items[screenIndex] : null;

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
      const selected = item.matchRows.map((row) => answer.matches?.[row.id]);
      return (
        selected.every(Boolean) &&
        new Set(selected).size === selected.length
      );
    }

    return Boolean(answer.text?.trim());
  };

  const handleStart = () => {
    logEvent("test_started", test.id, {});
    setScreenIndex(0);
  };

  const handleNext = () => {
    if (!current) return;
    const { item } = current;
    logEvent("test_item_answered", test.id, {
      item_id: item.id,
      answer: answers[item.id],
    });

    if (screenIndex === items.length - 1) {
      logEvent("test_completed", test.id, { answers });
      onComplete();
      return;
    }
    setScreenIndex(screenIndex + 1);
  };

  return (
    <main className="min-h-screen bg-stone-100">
      <AppHeader />
      <div className="mx-auto max-w-4xl overflow-y-auto p-3 py-6 sm:px-6">
        {screenIndex === -1 && (
          <div className="mx-auto w-full max-w-3xl">
            <StepIntro
              eyebrow="Assessment"
              title={test.title}
              paragraphs={test.intro}
            />
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
                setAnswers((prev) => ({ ...prev, [current.item.id]: next }))
              }
            />

            <div className="mx-auto mt-6 flex w-full max-w-3xl items-center justify-between gap-4">
              <span className="text-xs font-semibold text-stone-400">
                {screenIndex + 1} of {items.length}
              </span>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <span className="text-xs text-stone-400">
                  Once you continue, you cannot change this answer.
                </span>
                <Button onClick={handleNext} disabled={!isAnswered()}>
                  {screenIndex === items.length - 1 ? "Finish test" : "Next"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
