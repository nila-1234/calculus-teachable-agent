"use client";

import OptionRow, { OptionRowState } from "@/components/option-row";
import type { SurveyAnswers, SurveyDefinition, SurveyItem } from "@/lib/surveys/types";

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

function SurveyItemCard({
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
  const label =
    item.id === "subject-id" ? "Subject ID" : `Question ${item.id}`;

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

      <p className="text-base font-medium leading-7 text-stone-800">
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
            value={value}
            disabled={readOnly}
            placeholder={item.placeholder}
            onChange={(event) => onChange(event.target.value)}
            className={INPUT_CLASS}
          />
        )}

        {item.kind === "open" && (
          <textarea
            value={value}
            disabled={readOnly}
            placeholder={item.placeholder || "Write your response…"}
            onChange={(event) => onChange(event.target.value)}
            rows={5}
            className={TEXTAREA_CLASS}
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
