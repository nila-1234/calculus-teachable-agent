"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import MathDisplay from "@/components/math-display";
import type { TestDefinition, TestId, TestItem } from "@/lib/tests/types";

type TestReviewPanelProps = {
  tests: TestDefinition[];
};

function ItemReference({ item }: { item: TestItem }) {
  const isNotGraded = item.note?.toLowerCase().includes("not graded");

  return (
    <div className="mt-5 rounded-xl border border-lime-200 bg-lime-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-lime-800">
        Answer key / grading notes
      </p>
      {item.reference ? (
        <MathDisplay
          text={item.reference}
          className="mt-2 text-sm leading-6 text-stone-700"
        />
      ) : (
        <p className="mt-2 text-sm font-semibold text-stone-600">
          {isNotGraded ? "No graded answer key." : "No answer key provided."}
        </p>
      )}
    </div>
  );
}

export default function TestReviewPanel({ tests }: TestReviewPanelProps) {
  const [activeId, setActiveId] = useState<TestId>(tests[0].id);
  const tabRefs = useRef<Partial<Record<TestId, HTMLButtonElement | null>>>({});
  const activeTest = tests.find((test) => test.id === activeId) ?? tests[0];

  function selectAdjacentTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;

    if (event.key === "ArrowRight") nextIndex = (index + 1) % tests.length;
    else if (event.key === "ArrowLeft")
      nextIndex = (index - 1 + tests.length) % tests.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tests.length - 1;
    else return;

    event.preventDefault();
    const nextId = tests[nextIndex].id;
    setActiveId(nextId);
    tabRefs.current[nextId]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Assessment version"
        className="inline-flex rounded-xl border border-stone-200 bg-stone-200/70 p-1"
      >
        {tests.map((test, index) => {
          const isActive = test.id === activeId;
          const label = test.id === "pretest" ? "Pre-Test" : "Post-Test";

          return (
            <button
              key={test.id}
              ref={(node) => {
                tabRefs.current[test.id] = node;
              }}
              id={`${test.id}-tab`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${test.id}-panel`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveId(test.id)}
              onKeyDown={(event) => selectAdjacentTab(event, index)}
              className={`rounded-lg px-5 py-2 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-600 ${
                isActive
                  ? "bg-lime-600 text-white shadow-sm"
                  : "text-stone-600 hover:bg-white"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        id={`${activeTest.id}-panel`}
        role="tabpanel"
        aria-labelledby={`${activeTest.id}-tab`}
        tabIndex={0}
        className="mt-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-600"
      >
        <div className="rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-lime-700">
            Assessment overview
          </p>
          <h2 className="mt-2 text-2xl font-bold text-stone-800">
            {activeTest.title}
          </h2>
          <div className="mt-4 space-y-2">
            {activeTest.intro.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-6 text-stone-600">
                {paragraph}
              </p>
            ))}
          </div>
          <div className="mt-5 border-t border-stone-200 pt-5">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Assessment goals
            </p>
            <ul className="mt-3 space-y-2">
              {activeTest.goals.map((goal) => (
                <li
                  key={goal}
                  className="flex gap-3 text-sm leading-6 text-stone-600"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-lime-600"
                  />
                  {goal}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 space-y-8">
          {activeTest.sections.map((section) => (
            <section
              key={section.id}
              aria-labelledby={`${activeTest.id}-${section.id}-title`}
            >
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h3
                  id={`${activeTest.id}-${section.id}-title`}
                  className="text-xl font-bold text-stone-800"
                >
                  {section.title}
                </h3>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  {section.items.length}{" "}
                  {section.items.length === 1 ? "item" : "items"}
                </span>
              </div>

              {(section.scenario || section.table || section.tableNote) && (
                <div className="mb-4 rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-400">
                    Scenario
                  </p>
                  {section.scenario && (
                    <MathDisplay
                      text={section.scenario}
                      className="text-sm leading-6 text-stone-700"
                    />
                  )}
                  {section.table && (
                    <div
                      className="mt-4 overflow-x-auto rounded-xl border border-stone-200"
                      tabIndex={0}
                      aria-label={`${section.title} data table; scroll horizontally if needed`}
                    >
                      <table className="min-w-max w-full border-collapse text-left text-sm text-stone-700">
                        <thead className="bg-stone-100">
                          <tr>
                            {section.table.columns.map((column) => (
                              <th
                                key={column}
                                scope="col"
                                className="border-b border-r border-stone-200 px-4 py-3 font-bold last:border-r-0"
                              >
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.table.rows.map((row, rowIndex) => (
                            <tr
                              key={rowIndex}
                              className="border-b border-stone-200 last:border-b-0"
                            >
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={cellIndex}
                                  className="border-r border-stone-200 px-4 py-3 align-top last:border-r-0"
                                >
                                  <MathDisplay
                                    text={cell}
                                    className="text-sm text-stone-700"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {section.tableNote && (
                    <div className="mt-4 rounded-lg bg-stone-50 p-3">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-stone-400">
                        Table note
                      </p>
                      <MathDisplay
                        text={section.tableNote}
                        className="text-sm leading-6 text-stone-700"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4">
                {section.items.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm sm:p-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
                        Item {item.id}
                      </p>
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold capitalize text-stone-500">
                        {item.kind.replace("-", " ")}
                      </span>
                    </div>

                    <MathDisplay
                      text={item.prompt}
                      className="mt-3 text-base font-medium leading-7 text-stone-800"
                    />

                    {item.context && (
                      <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50 p-4">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">
                          {item.contextLabel ?? "Context"}
                        </p>
                        <MathDisplay
                          text={item.context}
                          className="text-sm leading-6 text-stone-700"
                        />
                      </div>
                    )}

                    {item.matchRows && (
                      <div className="mt-5">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">
                          Matching rows
                        </p>
                        <div className="grid gap-2">
                          {item.matchRows.map((row, rowIndex) => (
                            <div
                              key={row.id}
                              className="grid gap-2 rounded-xl border border-stone-200 p-4 sm:grid-cols-[2rem_minmax(0,1fr)]"
                            >
                              <span className="text-xs font-bold text-lime-700">
                                {rowIndex + 1}
                              </span>
                              <MathDisplay
                                text={row.text}
                                className="text-sm leading-6 text-stone-700"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.choices && (
                      <div className="mt-5">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">
                          {item.kind === "matching"
                            ? "Available matches"
                            : "Choices"}
                        </p>
                        <div className="grid gap-2">
                          {item.choices.map((choice) => (
                            <div
                              key={choice.id}
                              className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3 sm:grid-cols-[2rem_minmax(0,1fr)]"
                            >
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-lime-700 shadow-sm">
                                {choice.id}
                              </span>
                              <MathDisplay
                                text={`${choice.text}${
                                  choice.allowsOtherText
                                    ? " (includes a write-in field)"
                                    : ""
                                }`}
                                className="self-center text-sm leading-6 text-stone-700"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.explanationPrompt && (
                      <div className="mt-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
                          Explanation prompt
                        </p>
                        <MathDisplay
                          text={item.explanationPrompt}
                          className="mt-1 text-sm leading-6 text-stone-600"
                        />
                      </div>
                    )}

                    {item.note && (
                      <div className="mt-4 rounded-lg border-l-4 border-stone-300 bg-stone-50 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
                          Note
                        </p>
                        <MathDisplay
                          text={item.note}
                          className="mt-1 text-sm leading-6 text-stone-600"
                        />
                      </div>
                    )}

                    <ItemReference item={item} />
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
