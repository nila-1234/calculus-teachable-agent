"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import InstructionPreview from "./instruction-preview";
import ModuleEditor from "./module-editor";
import {
  buildPipelineBundle,
  createEmptyDraft,
  generateInternalScenarioId,
  isModule,
  isPlotData,
  isRecord,
  normalizeInstructionModule,
  restoreDraft,
  STAGE_LABELS,
  STORAGE_KEY,
} from "./instruction-generator-draft";
import { formatApiValidationErrors } from "./instruction-generator-errors";
import type {
  DraftState,
  GeneratorInputs,
  StageStatus,
} from "./instruction-generator-types";

function statusStyle(status: StageStatus) {
  if (status === "success") return "border-lime-300 bg-lime-50 text-lime-800";
  if (status === "running")
    return "border-lime-500 bg-white text-stone-900 ring-2 ring-lime-200";
  if (status === "error") return "border-red-300 bg-red-50 text-red-700";
  return "border-stone-200 bg-stone-50 text-stone-500";
}

function statusText(status: StageStatus) {
  if (status === "success") return "Complete";
  if (status === "running") return "Running";
  if (status === "error") return "Failed";
  return "Waiting";
}

function friendlyApiError(status: number, message: string) {
  const text = message.trim();
  if (
    status === 503 ||
    status === 401 ||
    status === 403 ||
    /api key|credential|openai|not configured|missing.*key|environment variable/i.test(
      text,
    )
  ) {
    return "The generator API is not configured. Ask an administrator to add the required AI provider credentials, then retry this stage.";
  }
  return text || `Generation failed with HTTP ${status}.`;
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function InstructionGeneratorWorkspace() {
  const [draft, setDraft] = useState<DraftState>(createEmptyDraft);
  const [hydrated, setHydrated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setDraft(restoreDraft(JSON.parse(stored)));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft, hydrated]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const isRunning = draft.stages.some((stage) => stage.status === "running");
  const completedCount = draft.stages.filter(
    (stage) => stage.status === "success",
  ).length;
  const canGenerate = draft.inputs.concept.trim().length > 0 && !isRunning;
  const fittedPlot =
    Boolean(draft.plotData) &&
    (!draft.plotData?.representation ||
      /fitted/i.test(
        `${draft.plotData.representation} ${JSON.stringify(
          draft.documents["01"] ?? "",
        )}`,
      ));

  const setInput = (
    key: Exclude<keyof GeneratorInputs, "scenarioId">,
    value: string,
  ) => {
    setDraft((current) => ({
      ...current,
      inputs: { ...current.inputs, [key]: value },
    }));
  };

  const setStageStatus = (stage: string, status: StageStatus) => {
    setDraft((current) => ({
      ...current,
      stages: current.stages.map((item) =>
        item.stage === stage ? { ...item, status } : item,
      ),
    }));
  };

  const runPipeline = async (startIndex: number, scenarioId: number) => {
    if (isRunning) return;

    const controller = new AbortController();
    abortRef.current = controller;

    let documents =
      startIndex === 0 ? {} : { ...draft.documents };
    let generatedModule = startIndex === 0 ? null : draft.module;
    let generatedPlot = startIndex === 0 ? null : draft.plotData;

    setDraft((current) => ({
      ...current,
      inputs: { ...current.inputs, scenarioId },
      documents,
      module: generatedModule,
      plotData: generatedPlot,
      error: "",
      validationErrors: [],
      failedStage: null,
      stages: current.stages.map((stage, index) => ({
        ...stage,
        status:
          index < startIndex && stage.status === "success"
            ? "success"
            : "pending",
      })),
    }));

    for (let index = startIndex; index < STAGE_LABELS.length; index += 1) {
      const stage = String(index + 1).padStart(2, "0");
      setStageStatus(stage, "running");
      let validationErrors: string[] = [];

      try {
        const response = await fetch("/api/instructor/generate-stage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stage,
            input: {
              concept: draft.inputs.concept.trim(),
              scenarioId,
              ...(draft.inputs.title.trim()
                ? { optionalScenarioName: draft.inputs.title.trim() }
                : {}),
              ...(draft.inputs.variant.trim()
                ? { optionalProfileVariant: draft.inputs.variant.trim() }
                : {}),
            },
            documents,
          }),
          signal: controller.signal,
        });

        const rawText = await response.text();
        let payload: unknown = rawText;
        if (rawText) {
          try {
            payload = JSON.parse(rawText);
          } catch {
            payload = rawText;
          }
        }

        if (!response.ok) {
          validationErrors = formatApiValidationErrors(payload);
          const serverMessage =
            isRecord(payload) && typeof payload.error === "string"
              ? payload.error
              : isRecord(payload) && typeof payload.message === "string"
                ? payload.message
                : typeof payload === "string"
                  ? payload
                  : "";
          throw new Error(friendlyApiError(response.status, serverMessage));
        }

        const envelope = isRecord(payload) ? payload : null;
        const document =
          envelope && Object.prototype.hasOwnProperty.call(envelope, "document")
            ? envelope.document
            : payload;
        documents = { ...documents, [stage]: document };

        const moduleCandidate =
          envelope?.module ??
          (isRecord(document) ? document.module : undefined) ??
          document;
        if (isModule(moduleCandidate)) {
          generatedModule = normalizeInstructionModule(moduleCandidate);
        }

        const plotCandidate =
          envelope?.plotData ??
          (isRecord(document) ? document.plotData : undefined) ??
          document;
        if (isPlotData(plotCandidate)) generatedPlot = plotCandidate;

        setDraft((current) => ({
          ...current,
          documents,
          module: generatedModule,
          plotData: generatedPlot,
          stages: current.stages.map((item) =>
            item.stage === stage ? { ...item, status: "success" } : item,
          ),
        }));
      } catch (error) {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : "Unexpected generation error.";
        setDraft((current) => ({
          ...current,
          documents,
          module: generatedModule,
          plotData: generatedPlot,
          failedStage: stage,
          error: message,
          validationErrors,
          stages: current.stages.map((item) =>
            item.stage === stage ? { ...item, status: "error" } : item,
          ),
        }));
        return;
      }
    }

    abortRef.current = null;
  };

  const handleGenerate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canGenerate) return;

    const scenarioId = generateInternalScenarioId();
    const nextDraft = {
      ...draft,
      inputs: { ...draft.inputs, scenarioId },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDraft));
    setDraft(nextDraft);
    void runPipeline(0, scenarioId);
  };

  const handleRetry = () => {
    const index = draft.stages.findIndex(
      (stage) => stage.stage === draft.failedStage,
    );
    if (index >= 0 && draft.inputs.scenarioId) {
      void runPipeline(index, draft.inputs.scenarioId);
    }
  };

  const handleClear = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    window.localStorage.removeItem(STORAGE_KEY);
    setDraft(createEmptyDraft());
  };

  if (!hydrated) {
    return (
      <div className="rounded-3xl border border-stone-200 bg-white p-8 text-sm text-stone-500 shadow-sm">
        Restoring your instruction draft…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 bg-stone-900 px-5 py-5 text-white sm:px-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime-300">
            Pipeline setup
          </p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">Build an instruction module</h2>
              <p className="mt-1 text-sm text-stone-300">
                Nine focused stages produce an editable, learner-ready draft.
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-lime-200">
              {completedCount}/9 complete
            </span>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="space-y-5 p-5 sm:p-7">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-sm font-bold text-stone-700">
                Calculus concept <span className="text-red-600">*</span>
              </span>
              <textarea
                aria-label="Calculus concept"
                value={draft.inputs.concept}
                onChange={(event) => setInput("concept", event.target.value)}
                placeholder="e.g. optimization, critical points, derivatives, or a full sentence"
                className="min-h-24 w-full resize-y rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-lime-600 focus:bg-white focus:ring-2 focus:ring-lime-200"
                required
              />
            </label>
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-sm font-bold text-stone-700">
                Scenario title or name{" "}
                <span className="font-normal text-stone-400">optional</span>
              </span>
              <input
                aria-label="Scenario title or name"
                value={draft.inputs.title}
                onChange={(event) => setInput("title", event.target.value)}
                placeholder="e.g. Monthly profit investigation; leave blank for Stage 01 to name it"
                className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-lime-600 focus:bg-white focus:ring-2 focus:ring-lime-200"
              />
            </label>
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-sm font-bold text-stone-700">
                Variant guidance <span className="font-normal text-stone-400">optional</span>
              </span>
              <input
                aria-label="Variant guidance"
                value={draft.inputs.variant}
                onChange={(event) => setInput("variant", event.target.value)}
                placeholder="e.g. environmental context, moderate difficulty"
                className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-lime-600 focus:bg-white focus:ring-2 focus:ring-lime-200"
              />
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-9" aria-live="polite">
            {draft.stages.map((stage) => (
              <div
                key={stage.stage}
                className={`rounded-xl border px-3 py-2.5 transition ${statusStyle(stage.status)}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold">
                    {stage.stage}
                  </span>
                  {stage.status === "running" ? (
                    <span className="size-2 animate-pulse rounded-full bg-lime-600" />
                  ) : null}
                </div>
                <p className="mt-1 truncate text-xs font-bold" title={stage.label}>
                  {stage.label}
                </p>
                <p className="mt-0.5 text-[10px]">{statusText(stage.status)}</p>
              </div>
            ))}
          </div>

          {draft.error ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              <p className="font-bold">
                Stage {draft.failedStage} could not be completed
              </p>
              <p className="mt-1">{draft.error}</p>
              {draft.validationErrors.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-xs">
                  {draft.validationErrors.map((validationError, index) => (
                    <li key={`${index}-${validationError}`}>{validationError}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!canGenerate}
              className="rounded-xl bg-lime-600 px-5 py-2.5 text-sm font-bold text-stone-950 shadow-sm transition hover:bg-lime-500 focus:outline-none focus:ring-2 focus:ring-lime-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
            >
              {isRunning ? "Generating…" : "Generate stages 01–09"}
            </button>
            {draft.failedStage ? (
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRunning}
                className="rounded-xl border border-lime-700 bg-white px-5 py-2.5 text-sm font-bold text-lime-800 transition hover:bg-lime-50 focus:outline-none focus:ring-2 focus:ring-lime-600 focus:ring-offset-2 disabled:opacity-50"
              >
                Retry from stage {draft.failedStage}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleClear}
              className="rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-bold text-stone-600 transition hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
            >
              Clear draft
            </button>
          </div>
          <p className="text-xs text-stone-500">
            A full generation starts a new pipeline. If a stage fails, retrying
            continues the same pipeline.
          </p>
        </form>
      </section>

      {draft.module ? (
        <>
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div>
              <p className="font-bold text-stone-900">Export pipeline artifacts</p>
              <p className="text-xs text-stone-500">
                Downloads reflect your latest edits and generated documents.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadJson("module.json", draft.module)}
                className="rounded-lg bg-stone-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-2"
              >
                Download module.json
              </button>
              {fittedPlot && draft.plotData ? (
                <button
                  type="button"
                  onClick={() =>
                    downloadJson("plot-data.json", draft.plotData)
                  }
                  className="rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-bold text-stone-700 transition hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-2"
                >
                  Download plot-data.json
                </button>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  downloadJson(
                    "pipeline-bundle.json",
                    buildPipelineBundle(draft),
                  )
                }
                className="rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-bold text-stone-700 transition hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-2"
              >
                Download pipeline bundle
              </button>
            </div>
          </section>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-700">
                  Structured editor
                </p>
                <h2 className="mt-1 text-xl font-bold text-stone-900">
                  Refine final draft
                </h2>
              </div>
              <ModuleEditor
                module={draft.module}
                onChange={(module) =>
                  setDraft((current) => ({ ...current, module }))
                }
              />
            </section>

            <section className="rounded-3xl border border-stone-300 bg-stone-100 p-3 shadow-sm sm:p-5 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
              <div className="mb-4 flex items-center justify-between gap-3 px-1">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-700">
                    Expanded preview
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-stone-900">
                    Student-facing module
                  </h2>
                </div>
                <span className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-bold text-stone-500">
                  Live
                </span>
              </div>
              <InstructionPreview
                module={draft.module}
                plotData={draft.plotData}
              />
            </section>
          </div>
        </>
      ) : (
        <section className="rounded-3xl border border-dashed border-stone-300 bg-stone-100/70 px-6 py-14 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-lime-200 text-xl font-black text-lime-900">
            09
          </div>
          <h2 className="mt-4 text-lg font-bold text-stone-800">
            Your editor and preview will appear here
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
            Complete all pipeline stages to inspect, edit, preview, and download
            the assembled instruction module.
          </p>
        </section>
      )}
    </div>
  );
}
