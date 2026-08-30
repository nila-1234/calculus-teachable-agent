import MathDisplay from "@/components/math-display";
import type {
  InstructionModule,
  PlotData,
  RubricFitItem,
} from "./instruction-generator-types";

type InstructionPreviewProps = {
  module: InstructionModule;
  plotData: PlotData | null;
};

function PreviewSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime-700">
        {eyebrow}
      </p>
      {title ? (
        <h3 className="mt-1 text-lg font-bold text-stone-900">{title}</h3>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatusPill({
  positive,
  positiveText,
  negativeText,
}: {
  positive: boolean;
  positiveText: string;
  negativeText: string;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
        positive
          ? "bg-lime-100 text-lime-800"
          : "bg-stone-200 text-stone-600"
      }`}
    >
      {positive ? positiveText : negativeText}
    </span>
  );
}

function PlotPreview({ plotData }: { plotData: PlotData }) {
  const points = Array.isArray(plotData.data) ? plotData.data : [];
  const keys = points.length > 0 ? Object.keys(points[0]) : [];

  return (
    <PreviewSection eyebrow="Data visualization" title={plotData.title || "Plot data"}>
      <div className="mb-3 flex flex-wrap gap-2 text-xs text-stone-600">
        {plotData.representation ? (
          <span className="rounded-full bg-lime-100 px-2.5 py-1 font-semibold text-lime-800">
            {plotData.representation}
          </span>
        ) : null}
        {plotData.xAxisLabel ? <span>X: {plotData.xAxisLabel}</span> : null}
        {plotData.yAxisLabel ? <span>Y: {plotData.yAxisLabel}</span> : null}
        <span>{points.length} points</span>
      </div>
      {points.length > 0 && keys.length > 0 ? (
        <div className="max-h-72 overflow-auto rounded-xl border border-stone-200">
          <table className="w-full min-w-72 border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-stone-100 text-stone-600">
              <tr>
                {keys.map((key) => (
                  <th key={key} className="px-3 py-2 font-bold">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((point, index) => (
                <tr key={index} className="border-t border-stone-100">
                  {keys.map((key) => (
                    <td key={key} className="px-3 py-2 text-stone-700">
                      {String(point[key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-stone-500">No numeric points were returned.</p>
      )}
    </PreviewSection>
  );
}

function Grading({ criterionId, fit }: { criterionId: string; fit: RubricFitItem }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs text-stone-600">{criterionId}</span>
        <StatusPill
          positive={Boolean(fit.pass)}
          positiveText="Pass"
          negativeText="Needs work"
        />
      </div>
      <p className="mt-2 text-xs font-semibold text-stone-500">
        Evidence step: {fit.step}
      </p>
      {fit.feedback ? (
        <MathDisplay text={fit.feedback} className="mt-2 text-sm text-stone-700" />
      ) : null}
    </div>
  );
}

export default function InstructionPreview({
  module,
  plotData,
}: InstructionPreviewProps) {
  return (
    <div className="space-y-5">
      <PreviewSection eyebrow="Scenario">
        <MathDisplay
          text={module.scenario || "No scenario generated."}
          className="text-base leading-7 text-stone-700"
        />
      </PreviewSection>

      {plotData ? <PlotPreview plotData={plotData} /> : null}

      <PreviewSection eyebrow="Student task" title="Question">
        <MathDisplay
          text={module.question || "No question generated."}
          className="text-base font-semibold leading-7 text-stone-900"
        />
        <div className="mt-5 space-y-5">
          {(module.questionParts ?? []).map((part, partIndex) => (
            <div key={part.id ?? partIndex}>
              <MathDisplay
                text={part.label ?? `Part ${partIndex + 1}`}
                className="mb-3 text-sm font-bold text-stone-800"
              />
              <div className="space-y-2.5">
                {(part.options ?? []).map((option, optionIndex) => (
                  <div
                    key={option.id ?? optionIndex}
                    className={`rounded-xl border p-3 ${
                      option.correct
                        ? "border-lime-300 bg-lime-50"
                        : "border-stone-200 bg-stone-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <MathDisplay
                        text={option.text ?? ""}
                        className="text-sm font-semibold text-stone-800"
                      />
                      <StatusPill
                        positive={Boolean(option.correct)}
                        positiveText="Correct"
                        negativeText="Distractor"
                      />
                    </div>
                    {option.feedback ? (
                      <MathDisplay
                        text={option.feedback}
                        className="mt-2 border-t border-stone-200 pt-2 text-xs leading-5 text-stone-600"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PreviewSection>

      <PreviewSection eyebrow="Rubric" title="Evaluation criteria">
        <div className="space-y-2.5">
          {(module.rubricOptions ?? []).map((rubric, index) => (
            <div
              key={rubric.id ?? index}
              className="rounded-xl border border-stone-200 bg-stone-50 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <MathDisplay
                  text={rubric.label ?? ""}
                  className="text-sm font-semibold text-stone-800"
                />
                <StatusPill
                  positive={Boolean(rubric.correct)}
                  positiveText="Essential"
                  negativeText="Optional"
                />
              </div>
              {rubric.feedback ? (
                <MathDisplay
                  text={rubric.feedback}
                  className="mt-2 text-xs leading-5 text-stone-600"
                />
              ) : null}
            </div>
          ))}
        </div>
      </PreviewSection>

      <PreviewSection eyebrow="Reference answers" title="Sample responses">
        <div className="grid gap-3">
          {(["correct", "incorrect"] as const).map((kind) => {
            const answer = module.sampleAnswers?.[kind];
            if (!answer) return null;
            return (
              <article
                key={kind}
                className={`rounded-xl border p-4 ${
                  kind === "correct"
                    ? "border-lime-300 bg-lime-50"
                    : "border-stone-200 bg-stone-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-bold text-stone-900">{answer.title}</h4>
                  <StatusPill
                    positive={kind === "correct"}
                    positiveText="Correct"
                    negativeText="Incorrect"
                  />
                </div>
                <MathDisplay
                  text={answer.text ?? ""}
                  className="mt-3 text-sm leading-6 text-stone-700"
                />
              </article>
            );
          })}
        </div>
      </PreviewSection>

      <PreviewSection eyebrow="AI students" title="Answers & criterion grading">
        <div className="space-y-4">
          {(module.finalAiAnswers ?? []).map((answer, answerIndex) => (
            <article
              key={answer.id ?? answerIndex}
              className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
            >
              <h4 className="font-bold text-stone-900">
                {answer.label || `AI Student ${answerIndex + 1}`}
              </h4>
              <ol className="mt-3 space-y-2">
                {answer.steps.map((step, stepIndex) => (
                  <li
                    key={stepIndex}
                    className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-2"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-white text-xs font-bold text-stone-600 shadow-sm ring-1 ring-stone-200">
                      {stepIndex + 1}
                    </span>
                    <MathDisplay
                      text={step}
                      className="pt-1 text-sm leading-6 text-stone-700"
                    />
                  </li>
                ))}
              </ol>
              <div className="mt-4 space-y-2">
                {Object.entries(answer.rubricFit ?? {}).map(
                  ([criterionId, fit]) => (
                    <Grading
                      key={criterionId}
                      criterionId={criterionId}
                      fit={fit}
                    />
                  ),
                )}
              </div>
            </article>
          ))}
        </div>
      </PreviewSection>
    </div>
  );
}
