"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CheckIcon } from "@radix-ui/react-icons";
import AppHeader from "@/components/app-header";
import StepIntro from "@/components/step-intro";
import TestProgress from "@/components/test-progress";
import TestQuestionPanel from "@/components/test-question-panel";
import Button from "@/components/button";
import { getPhaseTest } from "@/lib/tests/definitions";
import { formForPhase, seededShuffle } from "@/lib/tests/forms";
import { getSubjectId } from "@/lib/subject";
import type { FormId, TestAnswers, TestId, TestItemAnswer } from "@/lib/tests/types";

/** Marks test events from the counterbalanced design (version + Q1b, Q1c, Q1e, Q1f). */
const TEST_DESIGN_VERSION = 2;
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
  const isPhase = testId === "pretest" || testId === "posttest";

  // The participant's version for this phase. Read after mount: it lives in
  // localStorage, so the server can't know it. Preview may pick one with ?form=.
  const [form, setForm] = useState<FormId | null>(null);
  const formParam = searchParams.get("form");
  useEffect(() => {
    if (!isPhase) return;
    const chosen: FormId =
      preview && (formParam === "A" || formParam === "B")
        ? formParam
        : formForPhase(testId as TestId);
    queueMicrotask(() => setForm(chosen));
  }, [isPhase, preview, formParam, testId]);

  const test = useMemo(
    () => (isPhase && form ? getPhaseTest(testId as TestId, form) : null),
    [isPhase, form, testId]
  );

  // -1 = intro screen, 0..n-1 = question screens, n = complete screen
  const [screenIndex, setScreenIndex] = useState(-1);
  const [answers, setAnswers] = useState<TestAnswers>({});

  // Q1b, Q1c, Q1e, Q1f come in a per-participant random order, stable across reloads.
  // Labels follow what is shown — Q1.1, Q1.2 … in display order, Q2.1 … — never
  // the item ids, which would give away the original order.
  const items = useMemo(
    () =>
      test
        ? test.sections.flatMap((section, sectionIndex) => {
            const list = section.shuffle
              ? seededShuffle(section.items, `${getSubjectId()}:${test.id}:${section.id}`)
              : section.items;
            const n = sectionIndex + 1;
            return list.map((item, index) => ({
              section,
              item,
              label: list.length > 1 ? `Q${n}.${index + 1}` : `Q${n}`,
            }));
          })
        : [],
    [test]
  );

  // Screens: a shuffled section (Question 1) is one page with all its parts;
  // every other question keeps a page of its own.
  const screens = useMemo(() => {
    const out: (typeof items)[] = [];
    for (const entry of items) {
      const last = out[out.length - 1];
      if (entry.section.shuffle && last?.[0].section.id === entry.section.id) last.push(entry);
      else out.push([entry]);
    }
    return out;
  }, [items]);

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

  if (!isPhase) {
    return <main className="p-6">Test not found.</main>;
  }
  if (!test) return null; // version still loading (one frame)

  const isComplete = screenIndex >= screens.length;
  const current = screenIndex >= 0 && !isComplete ? screens[screenIndex] : null;

  const progressLabels = [...test.sections.map((s) => s.title), "Complete"];
  const progressStep = isComplete
    ? test.sections.length
    : current
      ? test.sections.findIndex((s) => s.id === current[0].section.id)
      : 0;

  const saveAnswers = (next: TestAnswers) => {
    setAnswers(next);
    // Preview must not leave participant answers behind in storage.
    if (!preview) {
      sessionStorage.setItem(`test:${test.id}:answers`, JSON.stringify(next));
    }
  };

  /** Every question on the screen is answered. */
  const isAnswered = (): boolean =>
    Boolean(current?.length) && current!.every(({ item }) => isItemAnswered(item));

  const isItemAnswered = (item: (typeof items)[number]["item"]): boolean => {
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
    logEvent("test_started", test.id, {
      form,
      version: TEST_DESIGN_VERSION,
      order: items.map((entry) => entry.item.id),
    });
    advanceTo(0);
  };

  const handleNext = () => {
    // Preview steps through without answering; a participant cannot.
    if (!current || (!isAnswered() && !preview)) return;

    for (const entry of current) {
      logEvent("test_item_answered", test.id, {
        item_id: entry.item.id,
        answer: answers[entry.item.id],
        form,
        version: TEST_DESIGN_VERSION,
        // Position in the whole test, in the order shown, and its label there.
        position: items.indexOf(entry) + 1,
        label: entry.label,
      });
    }

    if (screenIndex === screens.length - 1 && !preview) {
      sessionStorage.setItem(`test:${test.id}:completed`, "true");
      logEvent("test_completed", test.id, {
        answers,
        form,
        version: TEST_DESIGN_VERSION,
        // Exactly what this participant was given, in order: scored against these.
        items: items.map((entry) => entry.item.id),
      });
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
            <div className="space-y-4">
              {current.map((entry, index) => (
                <TestQuestionPanel
                  key={entry.item.id}
                  section={entry.section}
                  item={entry.item}
                  label={entry.label}
                  // A section's shared scenario is shown once, above its first part.
                  hideScenario={index > 0}
                  qidPrefix={test.id}
                  answer={answers[entry.item.id] || {}}
                  onAnswerChange={(next: TestItemAnswer) =>
                    saveAnswers({ ...answers, [entry.item.id]: next })
                  }
                />
              ))}
            </div>

            <div className="mx-auto mt-6 flex w-full max-w-3xl items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/*
                  Back exists only in preview. The tests are several screens in
                  one route, so an instructor otherwise has no way to look at an
                  earlier question without restarting — while a participant must
                  not be able to revise a committed answer.
                */}
                {preview && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setScreenIndex((previous) => Math.max(previous - 1, 0))
                    }
                    disabled={screenIndex === 0}
                  >
                    Back
                  </Button>
                )}
                <span className="text-xs font-semibold text-stone-400">
                  {screenIndex + 1} of {screens.length}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                {!preview && (
                  <span className="text-xs text-stone-400">
                    {current.length > 1
                      ? "Answer every part, then review your answers before continuing. Once you continue, you will not be able to go back and change them."
                      : "Please review your answer before continuing. Once you continue, you will not be able to go back and change it."}
                  </span>
                )}
                <Button
                  onClick={handleNext}
                  disabled={!isAnswered() && !preview}
                >
                  {screenIndex === screens.length - 1 ? "Finish test" : "Next"}
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
