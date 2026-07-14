"use client";

import { useMemo, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, Cross2Icon, DragHandleDots2Icon } from "@radix-ui/react-icons";
import MathDisplay from "@/components/math-display";
import Button from "@/components/button";
import { FinalAiAnswer } from "@/lib/scenarios/types";

export type RubricCriterion = {
  id: string;
  label: string;
};

export type LinePlacement = {
  criterionId: string;
  lineIndex: number;
  status: "pass" | "fail" | null;
};

// Keyed by answerId -> criterionId -> placement
export type LinePlacementsState = Record<string, Record<string, LinePlacement>>;

type LineRubricPanelProps = {
  question?: string;
  rubric: RubricCriterion[];
  answers: readonly FinalAiAnswer[];
  placements: LinePlacementsState;
  onPlacementsChange: (answerId: string, placements: Record<string, LinePlacement>) => void;
  currentIndex: number;
  onCurrentIndexChange: (index: number) => void;
};

function splitIntoLines(text: string): string[] {
  return text
    .split("\n\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function LineRubricPanel({
  question,
  rubric,
  answers,
  placements,
  onPlacementsChange,
  currentIndex,
  onCurrentIndexChange,
}: LineRubricPanelProps) {
  const [dragCriterionId, setDragCriterionId] = useState<string | null>(null);
  const [dragOverLine, setDragOverLine] = useState<number | null>(null);
  const [dragOverBank, setDragOverBank] = useState(false);

  const currentAnswer = answers[currentIndex];
  const lines = useMemo(() => splitIntoLines(currentAnswer.text), [currentAnswer.text]);
  const currentPlacements = placements[currentAnswer.id] ?? {};

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < answers.length - 1;

  const unassigned = rubric.filter((criterion) => !currentPlacements[criterion.id]);
  const placementsByLine = (lineIndex: number) =>
    rubric.filter((criterion) => currentPlacements[criterion.id]?.lineIndex === lineIndex);

  const updatePlacements = (next: Record<string, LinePlacement>) => {
    onPlacementsChange(currentAnswer.id, next);
  };

  const assignToLine = (criterionId: string, lineIndex: number) => {
    updatePlacements({
      ...currentPlacements,
      [criterionId]: {
        criterionId,
        lineIndex,
        status: currentPlacements[criterionId]?.status ?? null,
      },
    });
  };

  const unassign = (criterionId: string) => {
    const next = { ...currentPlacements };
    delete next[criterionId];
    updatePlacements(next);
  };

  const setStatus = (criterionId: string, status: "pass" | "fail") => {
    const existing = currentPlacements[criterionId];
    if (!existing) return;
    updatePlacements({
      ...currentPlacements,
      [criterionId]: {
        ...existing,
        status: existing.status === status ? null : status,
      },
    });
  };

  const handleDragStart = (criterionId: string) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", criterionId);
    setDragCriterionId(criterionId);
  };

  const handleDragEnd = () => {
    setDragCriterionId(null);
    setDragOverLine(null);
    setDragOverBank(false);
  };

  const handleLineDrop = (lineIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const criterionId = e.dataTransfer.getData("text/plain") || dragCriterionId;
    if (criterionId) assignToLine(criterionId, lineIndex);
    setDragOverLine(null);
    setDragCriterionId(null);
  };

  const handleBankDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const criterionId = e.dataTransfer.getData("text/plain") || dragCriterionId;
    if (criterionId) unassign(criterionId);
    setDragOverBank(false);
    setDragCriterionId(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-stone-800">Line-by-line rubric mapping</h2>
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Answer {currentIndex + 1} of {answers.length}
        </span>
      </div>

      {question && (
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-400">
            Question
          </span>
          <div className="whitespace-pre-wrap text-base leading-7 text-stone-700">
            <MathDisplay text={question} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-stone-800">{currentAnswer.label}</h3>
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-500">
              Not submitted
            </span>
          </div>

          <p className="mb-4 text-sm text-stone-500">
            Drag a rubric item from the bank onto the line it applies to, then mark it pass or fail.
          </p>

          <div className="flex flex-col gap-2">
            {lines.map((line, lineIndex) => {
              const linePlacements = placementsByLine(lineIndex);
              const isDragOver = dragOverLine === lineIndex;

              return (
                <div
                  key={lineIndex}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverLine(lineIndex);
                  }}
                  onDragLeave={() => setDragOverLine((prev) => (prev === lineIndex ? null : prev))}
                  onDrop={handleLineDrop(lineIndex)}
                  className={`flex gap-3 rounded-xl border-2 border-dashed p-3 transition-colors ${
                    isDragOver
                      ? "border-lime-500 bg-lime-50"
                      : "border-transparent hover:border-stone-200"
                  }`}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-500">
                    {lineIndex + 1}
                  </div>

                  <div className="flex-1">
                    <div className="text-sm leading-7 text-stone-700">
                      <MathDisplay text={line} />
                    </div>

                    {linePlacements.length > 0 ? (
                      <div className="mt-1 flex flex-col gap-2">
                        {linePlacements.map((criterion) => {
                          const placement = currentPlacements[criterion.id];
                          return (
                            <div
                              key={criterion.id}
                              draggable
                              onDragStart={handleDragStart(criterion.id)}
                              onDragEnd={handleDragEnd}
                              className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs"
                            >
                              <DragHandleDots2Icon className="shrink-0 text-stone-400" />
                              <span className="flex-1 font-medium text-stone-700">
                                <MathDisplay text={criterion.label} />
                              </span>
                              <div className="inline-flex shrink-0 gap-1">
                                <button
                                  type="button"
                                  onClick={() => setStatus(criterion.id, "pass")}
                                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                                    placement?.status === "pass"
                                      ? "border-green-600 bg-green-50 text-green-700"
                                      : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
                                  }`}
                                >
                                  Pass
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStatus(criterion.id, "fail")}
                                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                                    placement?.status === "fail"
                                      ? "border-red-600 bg-red-50 text-red-700"
                                      : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
                                  }`}
                                >
                                  Fail
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => unassign(criterion.id)}
                                className="shrink-0 text-stone-400 transition-colors hover:text-stone-600"
                                aria-label="Remove rubric item from this line"
                              >
                                <Cross2Icon />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverBank(true);
          }}
          onDragLeave={() => setDragOverBank(false)}
          onDrop={handleBankDrop}
          className={`h-fit rounded-xl border-2 border-dashed p-4 shadow-sm transition-colors lg:sticky lg:top-6 ${
            dragOverBank ? "border-lime-500 bg-lime-50" : "border-stone-200 bg-white"
          }`}
        >
          <span className="mb-3 block text-xs font-bold uppercase tracking-wider text-stone-400">
            Rubric bank
          </span>

          {unassigned.length === 0 ? (
            <p className="text-xs text-stone-400">
              All rubric items are placed. Drag one back here to unassign it.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {unassigned.map((criterion) => (
                <div
                  key={criterion.id}
                  draggable
                  onDragStart={handleDragStart(criterion.id)}
                  onDragEnd={handleDragEnd}
                  className={`flex cursor-grab items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-700 transition-colors active:cursor-grabbing ${
                    dragCriterionId === criterion.id ? "opacity-40" : ""
                  }`}
                >
                  <DragHandleDots2Icon className="mt-0.5 shrink-0 text-stone-400" />
                  <MathDisplay text={criterion.label} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          disabled={!hasPrevious}
          onClick={() => onCurrentIndexChange(currentIndex - 1)}
        >
          <ArrowLeftIcon />
          Previous
        </Button>

        <Button
          variant="secondary"
          disabled={!hasNext}
          onClick={() => onCurrentIndexChange(currentIndex + 1)}
        >
          Next
          <ArrowRightIcon />
        </Button>
      </div>
    </div>
  );
}
