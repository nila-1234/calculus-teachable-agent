"use client";

import { useEffect, useRef } from "react";
import OptionRow, { OptionRowState } from "@/components/option-row";
import MathInputField from "@/components/math-input-field";
import {
  parseMulti,
  parseTyping,
  serializeMulti,
  TYPING_SUFFIX,
  type SurveyAnswers,
  type SurveyDefinition,
  type SurveyItem,
  type TypingSignals,
} from "@/lib/surveys/types";

type SurveyPanelProps = {
  survey: SurveyDefinition;
  answers: SurveyAnswers;
  onAnswerChange: (itemId: string, value: string) => void;
  readOnly?: boolean;
};

const INPUT_CLASS =
  "h-11 w-full rounded-xl border-2 border-stone-200 bg-white px-3 text-sm text-stone-800 placeholder:text-stone-400 transition-colors focus:outline-none focus:border-lime-600 focus:ring-4 focus:ring-lime-50 disabled:bg-stone-50 disabled:text-stone-500";

const TEXTAREA_CLASS =
  "w-full resize-y rounded-xl border-2 border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 transition-colors focus:outline-none focus:border-lime-600 focus:ring-4 focus:ring-lime-50 disabled:bg-stone-50 disabled:text-stone-500";

function LikertScale({
  item,
  value,
  onChange,
  readOnly,
}: {
  item: SurveyItem;
  value: string;
  onChange: (next: string) => void;
  readOnly: boolean;
}) {
  const scale = item.likert;
  if (!scale) return null;

  const values = Array.from(
    { length: scale.max - scale.min + 1 },
    (_, index) => String(scale.min + index)
  );

  return (
    <fieldset className="space-y-3" disabled={readOnly}>
      <legend className="sr-only">{item.prompt}</legend>
      <div className="flex items-start justify-between gap-3 text-xs font-semibold text-stone-500">
        <span className="max-w-[42%] leading-4">
          {scale.min} = {scale.minLabel}
        </span>
        <span className="max-w-[42%] text-right leading-4">
          {scale.max} = {scale.maxLabel}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {values.map((option) => {
          const selected = value === option;

          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              disabled={readOnly}
              onClick={() => onChange(option)}
              className={`flex h-11 items-center justify-center rounded-xl border-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lime-100 focus-visible:border-lime-600 ${
                selected
                  ? "border-lime-600 bg-lime-600 text-white"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
              } disabled:cursor-default`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Records how an open answer is entered — pasted / dropped text, keystrokes,
 * timing, and switching away from the tab — for the screening AI-use check.
 * Signals are kept across reloads by persisting them with the answers.
 */
function useTypingSignals(
  enabled: boolean,
  initialRaw: string | undefined,
  onTyping: ((json: string) => void) | undefined,
  /** The answer box's data-qid, to pick out its keypad inserts. */
  qid?: string
) {
  const signals = useRef<TypingSignals>(parseTyping(initialRaw));
  const hiddenAt = useRef<number | null>(null);
  // Saved answers are restored after the first render, so the signals saved
  // before a reload may only arrive later. Pick them up before counting
  // anything new — otherwise reloading the page would erase a paste.
  const latestRaw = useRef(initialRaw);
  useEffect(() => {
    latestRaw.current = initialRaw;
  });
  const resume = () => {
    if (signals.current.firstFocusAt == null && latestRaw.current) {
      const saved = parseTyping(latestRaw.current);
      if (saved.firstFocusAt != null) signals.current = saved;
    }
  };

  const save = () => onTyping?.(JSON.stringify(signals.current));
  const update = (patch: (s: TypingSignals) => void) => {
    if (!enabled) return;
    resume();
    patch(signals.current);
    save();
  };

  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      // Only once they've started on the question.
      if (signals.current.firstFocusAt == null) return;
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current != null) {
        signals.current.tabAwayCount += 1;
        signals.current.tabAwayMs += Date.now() - hiddenAt.current;
        hiddenAt.current = null;
        onTyping?.(JSON.stringify(signals.current));
      }
    };
    // The math keypad inserts text without keystrokes and announces it with a
    // bubbling "keypad-insert" event from the answer box (math-input-field).
    const onKeypad = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!qid || target?.getAttribute?.("data-qid") !== qid) return;
      const text = String((event as CustomEvent).detail?.text ?? "");
      resume();
      signals.current.keypadChars = (signals.current.keypadChars ?? 0) + text.length;
      if (signals.current.firstFocusAt == null) signals.current.firstFocusAt = Date.now();
      onTyping?.(JSON.stringify(signals.current));
    };
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("keypad-insert", onKeypad);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("keypad-insert", onKeypad);
    };
  }, [enabled, onTyping, qid]);

  if (!enabled) return {};
  return {
    onFocus: () =>
      update((s) => {
        if (s.firstFocusAt == null) s.firstFocusAt = Date.now();
      }),
    onKeyDown: (event: React.KeyboardEvent) =>
      update((s) => {
        if (event.key.length !== 1 && !["Backspace", "Delete", "Enter"].includes(event.key))
          return;
        s.keystrokes += 1;
        if (event.key === "Backspace" || event.key === "Delete") s.backspaces += 1;
        if (s.firstKeyAt == null) s.firstKeyAt = Date.now();
      }),
    onPaste: (event: React.ClipboardEvent) =>
      update((s) => {
        s.pasteCount += 1;
        s.pastedChars += event.clipboardData.getData("text").length;
      }),
    onDrop: (event: React.DragEvent) =>
      update((s) => {
        s.droppedChars += event.dataTransfer.getData("text").length;
      }),
    onInput: (event: React.FormEvent) =>
      update((s) => {
        s.lastInputAt = Date.now();
        // Text the browser reports as typed — counts phone keyboards and input
        // methods, whose keys don't always show up as key presses.
        const native = event.nativeEvent as InputEvent;
        if (
          (native.inputType === "insertText" || native.inputType === "insertCompositionText") &&
          native.data
        ) {
          s.typedChars = (s.typedChars ?? 0) + native.data.length;
        }
      }),
  };
}

function SurveyItemCard({
  item,
  value,
  onChange,
  readOnly,
  typingRaw,
  onTyping,
  surveyId,
  number,
}: {
  item: SurveyItem;
  value: string;
  onChange: (next: string) => void;
  readOnly: boolean;
  typingRaw?: string;
  onTyping?: (json: string) => void;
  surveyId: string;
  /** Position in the survey as shown (Q1, Q2, …); ids are never shown. */
  number: number;
}) {
  const qid = `${surveyId}:${item.id}`;
  const typingHandlers = useTypingSignals(
    Boolean(item.trackTyping && item.kind === "open" && !readOnly),
    typingRaw,
    onTyping,
    qid
  );
  const label = item.id === "subject-id" ? "Subject ID" : `Q${number}`;

  return (
    <div className="rounded-xl border-2 border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
          {label}
        </p>
        {!item.required && (
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
            Optional
          </span>
        )}
      </div>

      <p className="whitespace-pre-line text-base font-medium leading-7 text-stone-800">
        {item.prompt}
      </p>

      <div className="mt-4 space-y-3">
        {item.kind === "choice" && item.choices && (
          <div className="space-y-2">
            {item.choices.map((choice, index) => {
              const selected = value === choice.id;
              const state: OptionRowState = selected ? "selected" : "default";

              return (
                <OptionRow
                  key={choice.id}
                  index={index}
                  text={choice.text}
                  state={state}
                  disabled={readOnly}
                  onClick={() => {
                    if (!readOnly) onChange(choice.id);
                  }}
                />
              );
            })}
          </div>
        )}

        {item.kind === "multi" && item.choices && (
          <div className="space-y-2">
            {item.choices.map((choice, index) => {
              const chosen = parseMulti(value);
              const selected = chosen.includes(choice.id);

              return (
                <OptionRow
                  key={choice.id}
                  index={index}
                  text={choice.text}
                  state={selected ? "selected" : "default"}
                  disabled={readOnly}
                  onClick={() => {
                    if (readOnly) return;
                    // Toggle, preserving the option order of the definition.
                    const next = selected
                      ? chosen.filter((id) => id !== choice.id)
                      : [...chosen, choice.id];
                    const ordered = item.choices!
                      .map((c) => c.id)
                      .filter((id) => next.includes(id));
                    onChange(serializeMulti(ordered));
                  }}
                />
              );
            })}
          </div>
        )}

        {item.kind === "likert" && (
          <LikertScale
            item={item}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
          />
        )}

        {item.kind === "text" && (
          <input
            type="text"
            data-qid={qid}
            value={value}
            disabled={readOnly}
            placeholder={item.placeholder}
            onChange={(event) => onChange(event.target.value)}
            className={INPUT_CLASS}
          />
        )}

        {item.kind === "open" && item.mathInput && !readOnly && (
          <MathInputField
            qid={qid}
            value={value}
            onChange={onChange}
            placeholder={item.placeholder || "Show your work here…"}
            rows={8}
            textareaProps={typingHandlers}
          />
        )}

        {item.kind === "open" && (!item.mathInput || readOnly) && (
          <textarea
            data-qid={qid}
            value={value}
            disabled={readOnly}
            placeholder={item.placeholder || "Write your response…"}
            onChange={(event) => onChange(event.target.value)}
            rows={5}
            className={TEXTAREA_CLASS}
            {...typingHandlers}
          />
        )}
      </div>
    </div>
  );
}

export default function SurveyPanel({
  survey,
  answers,
  onAnswerChange,
  readOnly = false,
}: SurveyPanelProps) {
  // Questions are numbered Q1, Q2, … across the whole survey, in display order.
  const numbers = new Map<string, number>();
  for (const item of survey.sections.flatMap((section) => section.items)) {
    if (item.id !== "subject-id") numbers.set(item.id, numbers.size + 1);
  }
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      {survey.sections.map((section) => (
        <section key={section.id} aria-labelledby={`${survey.id}-${section.id}`}>
          <h3
            id={`${survey.id}-${section.id}`}
            className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-400"
          >
            {section.title}
          </h3>
          <div className="space-y-4">
            {section.items.map((item) => (
              <SurveyItemCard
                key={item.id}
                item={item}
                value={answers[item.id] || ""}
                onChange={(next) => onAnswerChange(item.id, next)}
                readOnly={readOnly}
                surveyId={survey.id}
                number={numbers.get(item.id) ?? 0}
                typingRaw={
                  item.trackTyping ? answers[`${item.id}${TYPING_SUFFIX}`] : undefined
                }
                onTyping={
                  item.trackTyping
                    ? (json) => onAnswerChange(`${item.id}${TYPING_SUFFIX}`, json)
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function isSurveyItemAnswered(item: SurveyItem, value: string): boolean {
  if (!item.required) return true;
  return Boolean(value.trim());
}

export function areSurveyAnswersComplete(
  survey: SurveyDefinition,
  answers: SurveyAnswers
): boolean {
  return survey.sections
    .flatMap((section) => section.items)
    .every((item) => isSurveyItemAnswered(item, answers[item.id] || ""));
}
