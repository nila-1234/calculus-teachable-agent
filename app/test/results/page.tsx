"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockClosedIcon } from "@radix-ui/react-icons";
import AppHeader from "@/components/app-header";
import TestResultsPanel from "@/components/test-results-panel";
import Button from "@/components/button";
import { getTest } from "@/lib/tests/definitions";
import { GradedItem, TestAnswers, TestId } from "@/lib/tests/types";
import { logEvent } from "@/lib/logger";

const TESTS: { id: TestId; label: string }[] = [
  { id: "pretest", label: "Pre-Test results" },
  { id: "posttest", label: "Post-Test results" },
];

type PerTestState = {
  results: GradedItem[] | null;
  loading: boolean;
  error: string | null;
};

const INITIAL_STATE: Record<TestId, PerTestState> = {
  pretest: { results: null, loading: false, error: null },
  posttest: { results: null, loading: false, error: null },
};

export default function TestResultsPage() {
  const router = useRouter();
  // null = still checking; false = locked; true = both tests finished
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [grading, setGrading] = useState<Record<TestId, PerTestState>>(INITIAL_STATE);
  const [answersByTest, setAnswersByTest] = useState<Partial<Record<TestId, TestAnswers>>>({});

  const setTestState = (testId: TestId, patch: Partial<PerTestState>) => {
    setGrading((prev) => ({ ...prev, [testId]: { ...prev[testId], ...patch } }));
  };

  const gradeTest = useCallback(async (testId: TestId) => {
    const savedAnswers = sessionStorage.getItem(`test:${testId}:answers`);
    if (!savedAnswers) {
      setTestState(testId, {
        error: "No saved answers were found for this test in the current session.",
      });
      return;
    }

    setTestState(testId, { loading: true, error: null });
    try {
      const res = await fetch("/api/grade-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, answers: JSON.parse(savedAnswers) }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Grading failed. Please try again.");
      }
      setTestState(testId, { results: data.results });
      sessionStorage.setItem(`test:${testId}:grading`, JSON.stringify(data.results));
      logEvent("test_graded", testId, { results: data.results });
    } catch (e) {
      setTestState(testId, {
        error: e instanceof Error ? e.message : "Grading failed. Please try again.",
      });
    } finally {
      setTestState(testId, { loading: false });
    }
  }, []);

  useEffect(() => {
    const bothComplete = TESTS.every(
      ({ id }) => sessionStorage.getItem(`test:${id}:completed`) === "true"
    );
    setUnlocked(bothComplete);
    if (!bothComplete) return;

    const loadedAnswers: Partial<Record<TestId, TestAnswers>> = {};
    TESTS.forEach(({ id }) => {
      const saved = sessionStorage.getItem(`test:${id}:answers`);
      if (saved) {
        try {
          loadedAnswers[id] = JSON.parse(saved);
        } catch {
        }
      }
    });
    setAnswersByTest(loadedAnswers);

    TESTS.forEach(({ id }) => {
      const saved = sessionStorage.getItem(`test:${id}:grading`);
      if (saved) {
        try {
          setTestState(id, { results: JSON.parse(saved) });
          return;
        } catch {
        }
      }
      gradeTest(id);
    });
  }, [gradeTest]);

  return (
    <main className="min-h-screen bg-stone-100">
      <AppHeader />
      <div className="mx-auto max-w-4xl overflow-y-auto p-3 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-stone-400">
            Optimization Assessments
          </p>
          <h1 className="text-2xl font-bold text-stone-800">
            Grading &amp; Feedback
          </h1>

          {unlocked === false && (
            <div className="mt-6 flex flex-col items-center rounded-xl border-2 border-stone-200 bg-white p-10 text-center shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-200">
                <LockClosedIcon className="text-stone-500" width={22} height={22} />
              </span>
              <h2 className="mt-4 text-xl font-bold text-stone-800">
                Results are locked
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-stone-500">
                Grading and feedback become available only after you have
                finished both the pre-test and the post-test.
              </p>
              <Button className="mt-6" onClick={() => router.push("/test")}>
                Back to assessments
              </Button>
            </div>
          )}

          {unlocked && (
            <div className="mt-6 space-y-8">
              {TESTS.map(({ id, label }) => (
                <TestResultsPanel
                  key={id}
                  title={label}
                  results={grading[id].results}
                  loading={grading[id].loading}
                  error={grading[id].error}
                  onRetry={() => gradeTest(id)}
                  test={getTest(id)}
                  answers={answersByTest[id] ?? null}
                />
              ))}

              <div className="flex justify-center">
                <Button variant="secondary" onClick={() => router.push("/test")}>
                  Back to assessments
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
