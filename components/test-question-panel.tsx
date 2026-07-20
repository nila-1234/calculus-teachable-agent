"use client";

import MathDisplay from "@/components/math-display";
import OptionRow, { OptionRowState } from "@/components/option-row";
import { TestItem, TestItemAnswer, TestSection } from "@/lib/tests/types";

type TestQuestionPanelProps = {
  section: TestSection;
  item: TestItem;
  answer: TestItemAnswer;
  onAnswerChange: (next: TestItemAnswer) => void;
};

const TEXTAREA_CLASS =
  "w-full resize-y rounded-xl border-2 border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 transition-colors focus:outline-none focus:border-lime-600 focus:ring-4 focus:ring-lime-50";

export default function TestQuestionPanel({
  section,
  item,
  answer,
  onAnswerChange,
}: TestQuestionPanelProps) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {section.scenario && (
        <div className="rounded-xl border-2 border-stone-200 bg-white p-5 shadow-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">
            {section.title} · Scenario
          </p>
          <MathDisplay
            text={section.scenario}
            className="text-sm leading-6 text-stone-700"
          />
        </div>
      )}

      <div className="rounded-xl border-2 border-stone-200 bg-white p-5 shadow-sm">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">
          {section.items.length > 1 ? `Question ${item.id}` : section.title}
        </p>

        <MathDisplay
          text={item.prompt}
          className="text-base font-medium leading-7 text-stone-800"
        />

        {item.context && (
          <div className="mt-4 rounded-xl border-2 border-stone-100 bg-stone-50 p-4">
            {item.contextLabel && (
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">
                {item.contextLabel}
              </p>
            )}
            <MathDisplay
              text={item.context}
              className="text-sm leading-6 text-stone-700"
            />
          </div>
        )}

        <div className="mt-4 space-y-3">
          {item.kind === "multiple-choice" && item.choices && (
            <div className="space-y-2">
              {item.choices.map((choice, index) => {
                const isSelected = answer.choiceId === choice.id;
                const state: OptionRowState = isSelected ? "selected" : "default";

                return (
                  <div key={choice.id} className="space-y-2">
                    <OptionRow
                      index={index}
                      text={choice.text}
                      state={state}
                      onClick={() =>
                        onAnswerChange({ ...answer, choiceId: choice.id })
                      }
                    />
                    {choice.allowsOtherText && isSelected && (
                      <input
                        type="text"
                        autoFocus
                        placeholder="Please specify…"
                        value={answer.otherText || ""}
                        onChange={(e) =>
                          onAnswerChange({ ...answer, otherText: e.target.value })
                        }
                        className="h-11 w-full rounded-xl border-2 border-stone-200 bg-white px-3 text-sm text-stone-800 placeholder:text-stone-400 transition-colors focus:outline-none focus:border-lime-600 focus:ring-4 focus:ring-lime-50"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {item.kind === "multiple-choice" && item.explanationPrompt && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-stone-600">
                {item.explanationPrompt}
              </p>
              <textarea
                placeholder={item.placeholder || "Explain your reasoning…"}
                value={answer.explanation || ""}
                onChange={(e) =>
                  onAnswerChange({ ...answer, explanation: e.target.value })
                }
                rows={4}
                className={TEXTAREA_CLASS}
              />
            </div>
          )}

          {item.kind === "free-response" && (
            <textarea
              placeholder={item.placeholder || "Type your answer…"}
              value={answer.text || ""}
              onChange={(e) => onAnswerChange({ ...answer, text: e.target.value })}
              rows={10}
              className={TEXTAREA_CLASS}
            />
          )}

          {item.kind === "link" && (
            <input
              type="url"
              placeholder={item.placeholder || "https://…"}
              value={answer.text || ""}
              onChange={(e) => onAnswerChange({ ...answer, text: e.target.value })}
              className="h-11 w-full rounded-xl border-2 border-stone-200 bg-white px-3 text-sm text-stone-800 placeholder:text-stone-400 transition-colors focus:outline-none focus:border-lime-600 focus:ring-4 focus:ring-lime-50"
            />
          )}

          {item.note && (
            <p className="text-xs leading-5 text-stone-400">{item.note}</p>
          )}
        </div>
      </div>
    </div>
  );
}
