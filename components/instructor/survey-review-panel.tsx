"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { SurveyDefinition, SurveyId, SurveyItem } from "@/lib/surveys/types";

type SurveyReviewPanelProps = {
  surveys: SurveyDefinition[];
};

function itemKindLabel(item: SurveyItem): string {
  if (item.kind === "likert" && item.likert) {
    return `Likert ${item.likert.min}–${item.likert.max}`;
  }
  if (item.kind === "choice") return "Multiple choice";
  if (item.kind === "open") return "Open response";
  return "Short text";
}

export default function SurveyReviewPanel({ surveys }: SurveyReviewPanelProps) {
  const [activeId, setActiveId] = useState<SurveyId>(surveys[0].id);
  const tabRefs = useRef<Partial<Record<SurveyId, HTMLButtonElement | null>>>({});
  const activeSurvey = surveys.find((survey) => survey.id === activeId) ?? surveys[0];

  function selectAdjacentTab(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    let nextIndex = index;

    if (event.key === "ArrowRight") nextIndex = (index + 1) % surveys.length;
    else if (event.key === "ArrowLeft")
      nextIndex = (index - 1 + surveys.length) % surveys.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = surveys.length - 1;
    else return;

    event.preventDefault();
    const nextId = surveys[nextIndex].id;
    setActiveId(nextId);
    tabRefs.current[nextId]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Survey version"
        className="inline-flex rounded-xl border border-stone-200 bg-stone-200/70 p-1"
      >
        {surveys.map((survey, index) => {
          const isActive = survey.id === activeId;
          const label = survey.id === "pre" ? "Pre-Survey" : "Post-Survey";

          return (
            <button
              key={survey.id}
              ref={(node) => {
                tabRefs.current[survey.id] = node;
              }}
              id={`survey-${survey.id}-tab`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`survey-${survey.id}-panel`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveId(survey.id)}
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
        id={`survey-${activeSurvey.id}-panel`}
        role="tabpanel"
        aria-labelledby={`survey-${activeSurvey.id}-tab`}
        tabIndex={0}
        className="mt-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-600"
      >
        <div className="rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-lime-700">
            Survey overview
          </p>
          <h2 className="mt-2 text-2xl font-bold text-stone-800">
            {activeSurvey.title}
          </h2>
          <div className="mt-4 space-y-2">
            {activeSurvey.intro.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-6 text-stone-600">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-8">
          {activeSurvey.sections.map((section) => (
            <section
              key={section.id}
              aria-labelledby={`survey-${activeSurvey.id}-${section.id}-title`}
            >
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h3
                  id={`survey-${activeSurvey.id}-${section.id}-title`}
                  className="text-xl font-bold text-stone-800"
                >
                  {section.title}
                </h3>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  {section.items.length}{" "}
                  {section.items.length === 1 ? "item" : "items"}
                </span>
              </div>

              <div className="space-y-4">
                {section.items.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm sm:p-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
                        {item.id === "subject-id" ? "Subject ID" : `Item ${item.id}`}
                      </p>
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-500">
                        {itemKindLabel(item)}
                        {item.required ? "" : " · optional"}
                      </span>
                    </div>

                    <p className="mt-3 text-base font-medium leading-7 text-stone-800">
                      {item.prompt}
                    </p>

                    {item.likert && (
                      <p className="mt-3 text-sm leading-6 text-stone-500">
                        {item.likert.min} = {item.likert.minLabel}; {item.likert.max}{" "}
                        = {item.likert.maxLabel}
                      </p>
                    )}

                    {item.choices && (
                      <div className="mt-5">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">
                          Choices
                        </p>
                        <div className="grid gap-2">
                          {item.choices.map((choice) => (
                            <div
                              key={choice.id}
                              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-700"
                            >
                              {choice.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(item.kind === "text" || item.kind === "open") && (
                      <p className="mt-4 text-sm leading-6 text-stone-500">
                        Students enter a {item.kind === "open" ? "written" : "short"}{" "}
                        response
                        {item.placeholder ? ` (${item.placeholder})` : ""}.
                      </p>
                    )}
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
