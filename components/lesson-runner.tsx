"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MathDisplay from "@/components/math-display";
import { logEvent } from "@/lib/logger";
import type {
  LessonBodyItem,
  LessonDefinition,
  LessonQuestion,
} from "@/lib/lessons/types";

/**
 * Renders a ported lesson: prose, the video's narration, and its practice
 * questions with the course's own feedback.
 *
 * Every attempt is logged, right or wrong, so first-try correctness is always
 * recoverable from the log — that is the standard analysis metric, and it
 * cannot be reconstructed if only the final state is recorded.
 */

type Attempt = {
  /** 1-based; the first attempt is the one analysis cares about. */
  n: number;
  correct: boolean;
};

type QuestionState = {
  response: string;
  submitted: boolean;
  correct: boolean;
  attempts: Attempt[];
  hintsShown: number;
};

const EMPTY: QuestionState = {
  response: "",
  submitted: false,
  correct: false,
  attempts: [],
  hintsShown: 0,
};

/**
 * Short answers are typed, so the comparison has to tolerate the ways people
 * write the same expression: spaces, a unicode minus, "*" for multiplication,
 * a leading "y =", a trailing period.
 *
 * Deliberately lenient. These items are practice with stakes of none — marking
 * a correct answer wrong teaches nothing and is exactly the failure mode that
 * pushed the screener to multiple choice.
 */
function normalizeAnswer(raw: string): string[] {
  const base = raw
    .trim()
    .toLowerCase()
    .replace(/\\[()[\]]/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/\\cdot|\\times|[*·×]/g, "")
    .replace(/\\left|\\right/g, "")
    .replace(/[{}$]/g, "")
    .replace(/\s+/g, "")
    .replace(/\.$/, "");

  const withoutLhs = base.replace(/^[a-z]+(\([a-z]\))?=/, "");
  const alnum = base.replace(/[^a-z0-9]/g, "");

  return [...new Set([base, withoutLhs, alnum])].filter(Boolean);
}

function matchesAnswer(given: string, accepted: string[]): boolean {
  const mine = new Set(normalizeAnswer(given));
  return accepted.some((a) => normalizeAnswer(a).some((v) => mine.has(v)));
}

function Body({ items }: { items: LessonBodyItem[] }) {
  return (
    <>
      {items.map((item, i) => {
        if (item.type === "img") {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={item.src}
              alt=""
              className="mx-auto my-4 max-h-72 w-auto max-w-full rounded-lg"
            />
          );
        }
        if (item.type === "list") {
          return (
            <ul key={i} className="my-3 list-disc space-y-1.5 pl-6">
              {item.items.map((li, j) => (
                <li key={j}>
                  <MathDisplay
                    text={li}
                    className="text-base leading-7 text-stone-700"
                  />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <MathDisplay
            key={i}
            text={item.text}
            className="my-3 text-base leading-7 text-stone-700"
          />
        );
      })}
    </>
  );
}

function QuestionCard({
  question,
  index,
  state,
  onChange,
  onSubmit,
  onRetry,
  onHint,
}: {
  question: LessonQuestion;
  index: number;
  state: QuestionState;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
  onHint: () => void;
}) {
  const chosen = question.choices?.find((c) => c.id === state.response);
  const locked = state.submitted && state.correct;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
          Question {index}
        </span>
        {state.submitted && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              state.correct
                ? "bg-lime-50 text-lime-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {state.correct ? "Correct" : "Not yet"}
          </span>
        )}
      </div>

      <MathDisplay
        text={question.prompt}
        className="text-base leading-7 text-stone-800"
      />

      {question.promptImages.map((src) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          className="mx-auto my-4 max-h-64 w-auto max-w-full rounded-lg"
        />
      ))}

      {question.kind === "choice" ? (
        <div className="mt-4 flex flex-col gap-2">
          {question.choices?.map((choice) => {
            const selected = state.response === choice.id;
            const reveal = state.submitted && selected;
            return (
              <button
                key={choice.id}
                type="button"
                disabled={locked}
                onClick={() => onChange(choice.id)}
                className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                  reveal && choice.correct
                    ? "border-lime-600 bg-lime-50"
                    : reveal
                      ? "border-amber-500 bg-amber-50"
                      : selected
                        ? "border-lime-600 bg-white"
                        : "border-stone-200 bg-white hover:border-stone-300"
                } ${locked ? "cursor-default opacity-90" : ""}`}
              >
                {choice.labelImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={choice.labelImage}
                    alt=""
                    className="max-h-40 w-auto max-w-full"
                  />
                ) : (
                  <MathDisplay
                    text={choice.label}
                    className="text-sm text-stone-800"
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <input
          type="text"
          value={state.response}
          disabled={locked}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && state.response.trim()) onSubmit();
          }}
          placeholder="Type your answer — use ^ for powers, e.g. x^2"
          className="mt-4 w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-base text-stone-800 placeholder:text-stone-400 focus:border-lime-600 focus:outline-none focus:ring-4 focus:ring-lime-50 disabled:bg-stone-50"
        />
      )}

      {/* The course ships a per-distractor explanation, which is the whole
          pedagogical value of these items — show the one for what was chosen. */}
      {state.submitted && chosen?.explanation && (
        <div
          className={`mt-4 rounded-lg p-4 ${
            state.correct ? "bg-lime-50" : "bg-amber-50"
          }`}
        >
          <MathDisplay
            text={chosen.explanation}
            className="text-sm leading-6 text-stone-700"
          />
        </div>
      )}

      {state.submitted && question.kind === "short" && (
        <div
          className={`mt-4 rounded-lg p-4 ${
            state.correct ? "bg-lime-50" : "bg-amber-50"
          }`}
        >
          {!state.correct && question.answers?.length ? (
            <p className="mb-1 text-sm font-semibold text-stone-700">
              Answer: {question.answers[0]}
            </p>
          ) : null}
          {question.correctExplanation && (
            <MathDisplay
              text={question.correctExplanation}
              className="text-sm leading-6 text-stone-700"
            />
          )}
        </div>
      )}

      {state.hintsShown > 0 && (
        <div className="mt-3 space-y-2">
          {question.hints.slice(0, state.hintsShown).map((hint, i) => (
            <div key={i} className="rounded-lg bg-stone-50 p-3">
              <MathDisplay
                text={`Hint ${i + 1}: ${hint}`}
                className="text-sm leading-6 text-stone-600"
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!locked && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={!state.response.trim()}
            className="rounded-lg bg-lime-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-lime-700 disabled:bg-stone-200 disabled:text-stone-400"
          >
            {state.submitted ? "Check again" : "Submit"}
          </button>
        )}
        {state.submitted && !state.correct && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border-2 border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600 hover:border-stone-300"
          >
            Try again
          </button>
        )}
        {question.hints.length > state.hintsShown && !locked && (
          <button
            type="button"
            onClick={onHint}
            className="text-sm font-semibold text-lime-700 hover:text-lime-800"
          >
            Show a hint
          </button>
        )}
      </div>
    </div>
  );
}

export default function LessonRunner({
  lesson,
  onComplete,
  completeLabel,
}: {
  lesson: LessonDefinition;
  onComplete: () => void;
  completeLabel: string;
}) {
  const [states, setStates] = useState<Record<string, QuestionState>>({});

  // Clock reads are impure, so this is filled on the first commit rather than
  // during render. Null until then, which only costs the duration on a lesson
  // finished within the same tick — impossible for a 16-minute activity.
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const questions = useMemo(
    () => lesson.sections.flatMap((s) => s.questions ?? []),
    [lesson]
  );

  // Question numbers run across the whole lesson, so they are derived up front
  // rather than by incrementing a variable while rendering.
  const numberOf = useMemo(() => {
    const map = new Map<string, number>();
    questions.forEach((q, i) => map.set(q.id, i + 1));
    return map;
  }, [questions]);

  const answered = questions.filter((q) => states[q.id]?.submitted).length;
  const correct = questions.filter((q) => states[q.id]?.correct).length;

  const update = (id: string, patch: Partial<QuestionState>) =>
    setStates((prev) => ({
      ...prev,
      [id]: { ...EMPTY, ...prev[id], ...patch },
    }));

  const submit = (question: LessonQuestion) => {
    const state = states[question.id] ?? EMPTY;
    const value = state.response.trim();
    if (!value) return;

    const isCorrect =
      question.kind === "choice"
        ? Boolean(question.choices?.find((c) => c.id === value)?.correct)
        : matchesAnswer(value, question.answers ?? []);

    const attempts = [
      ...state.attempts,
      { n: state.attempts.length + 1, correct: isCorrect },
    ];

    update(question.id, { submitted: true, correct: isCorrect, attempts });

    // Logged on every attempt, not just the last, so attempts[0].correct — the
    // first-try metric — is always computable from the event stream.
    logEvent("lesson_item_attempted", lesson.id, {
      item_id: question.id,
      kind: question.kind,
      response: value,
      is_correct: isCorrect,
      attempt: attempts.length,
      hints_used: state.hintsShown,
    });
  };

  const finish = () => {
    logEvent("lesson_completed", lesson.id, {
      answered,
      correct,
      total: questions.length,
      seconds: startedAt.current
        ? Math.round((Date.now() - startedAt.current) / 1000)
        : null,
      first_try_correct: questions.filter(
        (q) => states[q.id]?.attempts[0]?.correct
      ).length,
    });
    onComplete();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold text-stone-800">{lesson.title}</h1>
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            {answered} of {questions.length} answered · about{" "}
            {lesson.durationMin} min
          </span>
        </div>
      </div>

      {lesson.sections.map((section, si) => (
        <div key={si} className="flex flex-col gap-4">
          {section.kind === "video" ? (
            <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-400">
                Walkthrough
              </span>
              {/* The source animation is not a video file and cannot be
                  reproduced outside the original player, so the narration is
                  shown as text rather than dropping the content entirely. */}
              <MathDisplay
                text={section.transcript}
                className="text-base leading-7 text-stone-700"
              />
            </div>
          ) : (
            section.body.length > 0 && (
              <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
                <Body items={section.body} />
              </div>
            )
          )}

          {(section.questions ?? []).map((question) => {
            const state = states[question.id] ?? EMPTY;
            return (
              <QuestionCard
                key={question.id}
                question={question}
                index={numberOf.get(question.id) ?? 0}
                state={state}
                onChange={(value) =>
                  update(question.id, { response: value, submitted: false })
                }
                onSubmit={() => submit(question)}
                onRetry={() =>
                  update(question.id, { submitted: false, response: "" })
                }
                onHint={() => {
                  update(question.id, { hintsShown: state.hintsShown + 1 });
                  logEvent("lesson_hint_shown", lesson.id, {
                    item_id: question.id,
                    hint_index: state.hintsShown + 1,
                  });
                }}
              />
            );
          })}
        </div>
      ))}

      <div className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-stone-500">
          {answered === questions.length
            ? "All questions answered."
            : `${questions.length - answered} question${
                questions.length - answered === 1 ? "" : "s"
              } left.`}
        </p>
        <button
          type="button"
          onClick={finish}
          disabled={answered < questions.length}
          className="rounded-lg bg-lime-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-lime-700 disabled:bg-stone-200 disabled:text-stone-400"
        >
          {completeLabel}
        </button>
      </div>
    </div>
  );
}
