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
/**
 * Rewrites a sum into a canonical order, so "80 - 2x" and "-2x + 80" compare
 * equal. Splits only at the top level: the "-" inside 400/(x-4) is part of a
 * term, not a separator.
 */
/**
 * Orders the factors of a plain product, so "xy" and "yx" agree.
 *
 * Deliberately narrow: only a run of letters with an optional leading number.
 * Anything with an exponent, a slash, or a bracket is left alone, because
 * reordering those would change what they mean.
 */
function sortedFactors(term: string): string {
  const match = term.match(/^([+-]?)(\d*)([a-z]{2,})$/);
  if (!match) return term;
  const [, sign, coefficient, letters] = match;
  return sign + coefficient + [...letters].sort().join("");
}

function sortedTerms(expr: string): string {
  const terms: string[] = [];
  let depth = 0;
  let current = "";
  let sign = "+";

  for (const ch of expr) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;

    if ((ch === "+" || ch === "-") && depth === 0) {
      if (current) {
        terms.push(sign + current);
        current = "";
      }
      sign = ch;
      continue;
    }
    current += ch;
  }
  if (current) terms.push(sign + current);

  return terms.map(sortedFactors).sort().join("");
}

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

  // Deliberately no sign-stripped form here. Collapsing to letters+digits made
  // "8 - x" and "8 + x" both become "8x" (and "3" match "-3"), so a wrong-sign
  // answer was accepted as correct — a real bug caught in piloting. base and
  // the sorted-term forms preserve signs and still tolerate spacing, term
  // order, and factor order.
  return [
    ...new Set([base, withoutLhs, sortedTerms(base), sortedTerms(withoutLhs)]),
  ].filter(Boolean);
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
                    className="text-base leading-7 text-gray-700"
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
            className="my-3 text-base leading-7 text-gray-700"
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
  inSet = false,
}: {
  question: LessonQuestion;
  index: number;
  state: QuestionState;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
  onHint: () => void;
  /** Rendered inside a QuestionSet card: drop the nested card chrome and the
   *  "Question N" label, since the set's pills already number the questions. */
  inSet?: boolean;
}) {
  const chosen = question.choices?.find((c) => c.id === state.response);
  const locked = state.submitted && state.correct;

  return (
    <div
      className={
        inSet ? "" : "rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      }
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        {inSet ? (
          <span />
        ) : (
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Question {index}
          </span>
        )}
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
        className="text-base leading-7 text-gray-800"
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
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
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
                    className="text-sm text-gray-800"
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
          className="mt-4 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-base text-gray-800 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-50 disabled:bg-gray-50"
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
            className="text-sm leading-6 text-gray-700"
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
            <p className="mb-1 text-sm font-semibold text-gray-700">
              Answer: {question.answers[0]}
            </p>
          ) : null}
          {question.correctExplanation && (
            <MathDisplay
              text={question.correctExplanation}
              className="text-sm leading-6 text-gray-700"
            />
          )}
        </div>
      )}

      {state.hintsShown > 0 && (
        <div className="mt-3 space-y-2">
          {question.hints.slice(0, state.hintsShown).map((hint, i) => (
            <div key={i} className="rounded-lg bg-gray-50 p-3">
              <MathDisplay
                text={`Hint ${i + 1}: ${hint}`}
                className="text-sm leading-6 text-gray-600"
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
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400"
          >
            {state.submitted ? "Check again" : "Submit"}
          </button>
        )}
        {state.submitted && !state.correct && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border-2 border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:border-gray-300"
          >
            Try again
          </button>
        )}
        {question.hints.length > state.hintsShown && !locked && (
          <button
            type="button"
            onClick={onHint}
            className="text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            Show a hint
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * A group of related questions shown one at a time with Q1/Q2/… pills, matching
 * the LearnVia "question set" layout: a single card, a done/total count, pill
 * navigation, and a "Next question →" control. Multi-part questions stay
 * together instead of being split into separate stacked cards.
 */
function QuestionSet({
  questions,
  states,
  onChange,
  onSubmit,
  onRetry,
  onHint,
}: {
  questions: LessonQuestion[];
  states: Record<string, QuestionState>;
  onChange: (id: string, value: string) => void;
  onSubmit: (q: LessonQuestion) => void;
  onRetry: (id: string) => void;
  onHint: (q: LessonQuestion) => void;
}) {
  const [current, setCurrent] = useState(0);
  const total = questions.length;
  const done = questions.filter((q) => states[q.id]?.submitted).length;
  const allDone = done === total;
  const q = questions[current];
  const curState = states[q.id] ?? EMPTY;
  const hasNext = current + 1 < total;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
          Question set
        </h3>
        <span className="text-sm text-gray-500">
          {allDone ? "✓ " : ""}
          {done} / {total} answered
        </span>
      </header>

      {total > 1 && (
        <div className="my-3 flex flex-wrap items-center gap-1">
          {questions.map((qq, i) => {
            const isCurrent = i === current;
            const st = states[qq.id];
            const answeredQ = Boolean(st?.submitted);
            const correctQ = Boolean(st?.correct);
            return (
              <button
                key={qq.id}
                type="button"
                onClick={() => setCurrent(i)}
                aria-current={isCurrent}
                className={[
                  "h-9 min-w-[40px] rounded-md border px-2 text-xs font-semibold transition",
                  isCurrent
                    ? "border-blue-600 bg-blue-600 text-white"
                    : correctQ
                      ? "border-green-300 bg-green-50 text-green-800"
                      : answeredQ
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-gray-300 bg-white text-gray-700 hover:border-blue-400",
                ].join(" ")}
              >
                {correctQ ? "✓ " : ""}Q{i + 1}
              </button>
            );
          })}
        </div>
      )}

      <QuestionCard
        key={q.id}
        question={q}
        index={current + 1}
        inSet
        state={curState}
        onChange={(value) => onChange(q.id, value)}
        onSubmit={() => onSubmit(q)}
        onRetry={() => onRetry(q.id)}
        onHint={() => onHint(q)}
      />

      {total > 1 && (
        <div className="mt-6 flex items-center justify-center">
          {allDone ? (
            <div className="flex items-center gap-2 rounded-md bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
              <span aria-hidden>🏁</span> All questions answered
            </div>
          ) : (
            <button
              type="button"
              onClick={() => hasNext && setCurrent((c) => c + 1)}
              disabled={!curState.submitted || !hasNext}
              className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Next question →
            </button>
          )}
        </div>
      )}
    </section>
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
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
            Lesson
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            about {lesson.durationMin} min · {answered} of {questions.length}{" "}
            answered
          </span>
        </div>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          {lesson.title}
        </h1>
      </div>

      {lesson.sections.map((section, si) => (
        <div
          key={si}
          className={
            si > 0
              ? "flex flex-col gap-4 border-t border-gray-200 pt-6"
              : "flex flex-col gap-4"
          }
        >
          {section.kind === "video" ? (
            /* There is no playable video — the source animation is an Arc
               resource that cannot be reproduced here — so the narration is
               shown as the lesson's reading content, not framed as a video. */
            <section className="my-1 text-gray-800">
              <MathDisplay
                text={section.transcript}
                className="text-base leading-7 text-gray-700"
              />
            </section>
          ) : (
            section.body.length > 0 && (
              <section className="my-1 text-gray-800">
                <Body items={section.body} />
              </section>
            )
          )}

          {(section.questions ?? []).length > 0 && (
            <QuestionSet
              questions={section.questions ?? []}
              states={states}
              onChange={(id, value) =>
                update(id, { response: value, submitted: false })
              }
              onSubmit={(question) => submit(question)}
              onRetry={(id) => update(id, { submitted: false, response: "" })}
              onHint={(question) => {
                const hintsShown = states[question.id]?.hintsShown ?? 0;
                update(question.id, { hintsShown: hintsShown + 1 });
                logEvent("lesson_hint_shown", lesson.id, {
                  item_id: question.id,
                  hint_index: hintsShown + 1,
                });
              }}
            />
          )}
        </div>
      ))}

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-gray-200 pt-6">
        <p className="text-sm text-gray-500">
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
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400"
        >
          {completeLabel}
        </button>
      </div>
    </div>
  );
}
