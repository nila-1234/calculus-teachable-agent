"use client";

import type {
  AiAnswer,
  Choice,
  InstructionModule,
  QuestionPart,
  RubricFitItem,
  RubricOption,
  SampleAnswer,
} from "./instruction-generator-types";

type ModuleEditorProps = {
  module: InstructionModule;
  onChange: (module: InstructionModule) => void;
};

const inputClass =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-lime-600 focus:ring-2 focus:ring-lime-200";
const textareaClass = `${inputClass} min-h-24 resize-y`;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.12em] text-stone-500">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const Element = multiline ? "textarea" : "input";
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-stone-600">{label}</span>
      <Element
        className={multiline ? textareaClass : inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export default function ModuleEditor({ module, onChange }: ModuleEditorProps) {
  const updateRoot = (key: keyof InstructionModule, value: unknown) => {
    onChange({ ...module, [key]: value });
  };

  const updatePart = (partIndex: number, nextPart: QuestionPart) => {
    const parts = [...(module.questionParts ?? [])];
    parts[partIndex] = nextPart;
    updateRoot("questionParts", parts);
  };

  const updateOption = (
    partIndex: number,
    optionIndex: number,
    nextOption: Choice,
  ) => {
    const part = module.questionParts?.[partIndex] ?? {};
    const options = [...(part.options ?? [])];
    options[optionIndex] = nextOption;
    updatePart(partIndex, { ...part, options });
  };

  const updateRubric = (index: number, next: RubricOption) => {
    const options = [...(module.rubricOptions ?? [])];
    options[index] = next;
    updateRoot("rubricOptions", options);
  };

  const updateSample = (
    kind: "correct" | "incorrect",
    next: SampleAnswer,
  ) => {
    updateRoot("sampleAnswers", {
      ...(module.sampleAnswers ?? {}),
      [kind]: next,
    });
  };

  const updateAnswer = (index: number, next: AiAnswer) => {
    const answers = [...(module.finalAiAnswers ?? [])];
    answers[index] = next;
    updateRoot("finalAiAnswers", answers);
  };

  const updateAnswerStep = (
    answerIndex: number,
    stepIndex: number,
    value: string,
  ) => {
    const answer = module.finalAiAnswers?.[answerIndex];
    if (!answer) return;
    const steps = [...answer.steps];
    steps[stepIndex] = value;
    updateAnswer(answerIndex, { ...answer, steps });
  };

  const updateFit = (
    answerIndex: number,
    criterionId: string,
    next: RubricFitItem,
  ) => {
    const answer = module.finalAiAnswers?.[answerIndex];
    if (!answer) return;
    updateAnswer(answerIndex, {
      ...answer,
      rubricFit: { ...answer.rubricFit, [criterionId]: next },
    });
  };

  return (
    <div className="space-y-5">
      <Section title="Scenario & question">
        <Field
          label="Scenario"
          value={module.scenario ?? ""}
          multiline
          onChange={(value) => updateRoot("scenario", value)}
        />
        <Field
          label="Question"
          value={module.question ?? ""}
          multiline
          onChange={(value) => updateRoot("question", value)}
        />
      </Section>

      {(module.questionParts ?? []).map((part, partIndex) => (
        <Section key={part.id ?? partIndex} title={`Question part ${partIndex + 1}`}>
          <Field
            label="Label"
            value={part.label ?? ""}
            onChange={(value) => updatePart(partIndex, { ...part, label: value })}
          />
          {(part.options ?? []).map((option, optionIndex) => (
            <div
              key={option.id ?? optionIndex}
              className="space-y-3 rounded-xl border border-stone-200 bg-white p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-stone-500">
                  Option {optionIndex + 1}
                </span>
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                  <input
                    type="checkbox"
                    className="size-4 accent-lime-600"
                    checked={Boolean(option.correct)}
                    onChange={(event) =>
                      updateOption(partIndex, optionIndex, {
                        ...option,
                        correct: event.target.checked,
                      })
                    }
                  />
                  Correct
                </label>
              </div>
              <Field
                label="Text"
                value={option.text ?? ""}
                onChange={(value) =>
                  updateOption(partIndex, optionIndex, { ...option, text: value })
                }
              />
              <Field
                label="Feedback"
                value={option.feedback ?? ""}
                multiline
                onChange={(value) =>
                  updateOption(partIndex, optionIndex, {
                    ...option,
                    feedback: value,
                  })
                }
              />
            </div>
          ))}
        </Section>
      ))}

      <Section title="Rubric">
        {(module.rubricOptions ?? []).map((rubric, index) => (
          <div
            key={rubric.id ?? index}
            className="space-y-3 rounded-xl border border-stone-200 bg-white p-3"
          >
            <label className="flex items-center gap-2 text-xs font-semibold text-stone-600">
              <input
                type="checkbox"
                className="size-4 accent-lime-600"
                checked={Boolean(rubric.correct)}
                onChange={(event) =>
                  updateRubric(index, {
                    ...rubric,
                    correct: event.target.checked,
                  })
                }
              />
              Essential / correct
            </label>
            <Field
              label={`Criterion ${index + 1}`}
              value={rubric.label ?? ""}
              onChange={(value) =>
                updateRubric(index, { ...rubric, label: value })
              }
            />
            <Field
              label="Feedback"
              value={rubric.feedback ?? ""}
              multiline
              onChange={(value) =>
                updateRubric(index, { ...rubric, feedback: value })
              }
            />
          </div>
        ))}
      </Section>

      <Section title="Sample answers">
        {(["correct", "incorrect"] as const).map((kind) => {
          const sample = module.sampleAnswers?.[kind] ?? {};
          return (
            <div
              key={kind}
              className="space-y-3 rounded-xl border border-stone-200 bg-white p-3"
            >
              <p className="text-xs font-bold capitalize text-stone-500">{kind}</p>
              <Field
                label="Title"
                value={sample.title ?? ""}
                onChange={(value) => updateSample(kind, { ...sample, title: value })}
              />
              <Field
                label="Answer"
                value={sample.text ?? ""}
                multiline
                onChange={(value) => updateSample(kind, { ...sample, text: value })}
              />
            </div>
          );
        })}
      </Section>

      {(module.finalAiAnswers ?? []).map((answer, answerIndex) => {
        const criterionIds = Array.from(
          new Set([
            ...(module.rubricOptions ?? [])
              .filter((criterion) => criterion.correct && criterion.id)
              .map((criterion) => criterion.id as string),
            ...Object.keys(answer.rubricFit),
          ]),
        );

        return (
          <Section
            key={answer.id || answerIndex}
            title={`AI answer ${answerIndex + 1}`}
          >
            <Field
              label="Label"
              value={answer.label}
              onChange={(value) =>
                updateAnswer(answerIndex, { ...answer, label: value })
              }
            />
            <div className="space-y-3">
              <p className="text-xs font-semibold text-stone-600">Steps</p>
              {answer.steps.map((step, stepIndex) => (
                <div
                  key={stepIndex}
                  className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-2"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-stone-200 text-xs font-bold text-stone-600">
                    {stepIndex + 1}
                  </span>
                  <textarea
                    aria-label={`Step ${stepIndex + 1}`}
                    className={textareaClass}
                    value={step}
                    onChange={(event) =>
                      updateAnswerStep(
                        answerIndex,
                        stepIndex,
                        event.target.value,
                      )
                    }
                  />
                </div>
              ))}
            </div>
            {criterionIds.map((criterionId) => {
              const fit = answer.rubricFit[criterionId] ?? {
                pass: false,
                step: 1,
                feedback: "",
              };
              return (
                <div
                  key={criterionId}
                  className="space-y-3 rounded-xl border border-stone-200 bg-white p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-mono text-xs text-stone-500">
                      {criterionId}
                    </span>
                    <label className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                      <input
                        type="checkbox"
                        className="size-4 accent-lime-600"
                        checked={fit.pass}
                        onChange={(event) =>
                          updateFit(answerIndex, criterionId, {
                            ...fit,
                            pass: event.target.checked,
                          })
                        }
                      />
                      Pass
                    </label>
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-stone-600">
                      Evidence step
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(answer.steps.length, 1)}
                      className={inputClass}
                      value={fit.step}
                      onChange={(event) => {
                        const step = Number.parseInt(event.target.value, 10);
                        if (step >= 1 && step <= answer.steps.length) {
                          updateFit(answerIndex, criterionId, { ...fit, step });
                        }
                      }}
                    />
                  </label>
                  <Field
                    label="Feedback"
                    value={fit.feedback}
                    multiline
                    onChange={(value) =>
                      updateFit(answerIndex, criterionId, {
                        ...fit,
                        feedback: value,
                      })
                    }
                  />
                </div>
              );
            })}
          </Section>
        );
      })}
    </div>
  );
}
