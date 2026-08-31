import assert from "node:assert/strict";

import {
  buildPipelineBundle,
  generateInternalScenarioId,
  restoreDraft,
} from "../components/instructor/instruction-generator-draft";
import { formatApiValidationErrors } from "../components/instructor/instruction-generator-errors";
import { assembleModule } from "../lib/instruction-generator/assembler";
import { missingDependencies } from "../lib/instruction-generator/dependencies";
import { buildStage08OutputContract } from "../lib/instruction-generator/stage08-contract";
import type {
  ModuleJson,
  PipelineDocuments,
} from "../lib/instruction-generator/types";
import scenarioOne from "../public/data/scenarios/1/module.json";

const latestStudentContract: ModuleJson = scenarioOne;
assert.ok(latestStudentContract.finalAiAnswers[0].steps.length >= 3);
assert.equal(
  latestStudentContract.finalAiAnswers[0].rubricFit["derivative-correct"].step,
  1,
);

const stage08Contract = buildStage08OutputContract({
  "05": {
    scenarioId: 99,
    rubricOptions: [
      { id: "criterion-one", correct: true },
      { id: "criterion-two", correct: true },
      { id: "criterion-three", correct: true },
      { id: "criterion-four", correct: true },
      { id: "criterion-five", correct: true },
      { id: "distractor-one", correct: false },
      { id: "distractor-two", correct: false },
    ],
  },
  "07": {
    scenarioId: 99,
    answers: [
      { id: "answer-a", steps: ["a1", "a2", "a3"] },
      { id: "answer-b", steps: ["b1", "b2", "b3", "b4"] },
      { id: "answer-c", steps: ["c1", "c2", "c3", "c4", "c5"] },
    ],
  },
});
assert.deepEqual(stage08Contract.expectedAnswerIds, [
  "answer-a",
  "answer-b",
  "answer-c",
]);
assert.deepEqual(stage08Contract.essentialCriterionIds, [
  "criterion-one",
  "criterion-two",
  "criterion-three",
  "criterion-four",
  "criterion-five",
]);
assert.deepEqual(
  stage08Contract.answerStepCounts.map(({ answerId, stepCount }) => ({
    answerId,
    stepCount,
  })),
  [
    { answerId: "answer-a", stepCount: 3 },
    { answerId: "answer-b", stepCount: 4 },
    { answerId: "answer-c", stepCount: 5 },
  ],
);
assert.equal(stage08Contract.exactAnswerGradingCount, 3);
assert.deepEqual(Object.keys(stage08Contract.outputSkeleton), [
  "schemaVersion",
  "scenarioId",
  "answerGradings",
]);
assert.deepEqual(
  Object.keys(stage08Contract.outputSkeleton.answerGradings[0].rubricFit),
  stage08Contract.essentialCriterionIds,
);

const formattedValidationErrors = formatApiValidationErrors({
  message: "Generated Stage 08 document failed validation.",
  documents: { secret: "must not appear" },
  prompt: "must not appear",
  key: "must not appear",
  validationErrors: [
    {
      instancePath: "/answerGradings",
      message: "must NOT have fewer than 3 items",
      schemaPath: "#/properties/answerGradings/minItems",
      params: { prompt: "must not appear" },
    },
    {
      instancePath: `/answerGradings/0/${"x".repeat(200)}`,
      message: `must NOT have additional properties ${"y".repeat(300)}`,
    },
    ...Array.from({ length: 6 }, (_, index) => ({
      instancePath: `/extra/${index}`,
      message: "extra issue",
    })),
  ],
});
assert.equal(formattedValidationErrors.length, 6);
assert.equal(
  formattedValidationErrors[0],
  "/answerGradings: must NOT have fewer than 3 items",
);
assert.ok(formattedValidationErrors[1].length <= 363);
assert.equal(
  formattedValidationErrors.some((item) =>
    /must not appear|documents|prompt|schemaPath|params/i.test(item),
  ),
  false,
);

const documents: PipelineDocuments = {
  "01": { scenarioId: 99 },
  "02": {
    scenarioId: 99,
    scenario: "A concise scenario.",
    plotDataSrc: "",
  },
  "03": { scenarioId: 99, enabled: false },
  "04": {
    scenarioId: 99,
    question: "What should the learner analyze?",
    questionParts: [
      {
        id: "1",
        label: "Choose a model.",
        options: [
          { id: "a", text: "Model A", correct: true, feedback: "Correct." },
        ],
      },
      {
        id: "2",
        label: "Choose an analysis.",
        options: [
          { id: "a", text: "Analysis A", correct: true, feedback: "Correct." },
        ],
      },
    ],
  },
  "05": {
    scenarioId: 99,
    rubricOptions: [
      {
        id: "derivative",
        label: "Computes the derivative.",
        correct: true,
        feedback: "Required.",
        criterionType: "correctness",
      },
    ],
  },
  "06": {
    scenarioId: 99,
    sampleAnswers: {
      correct: { title: "Correct", text: "Complete work." },
      incorrect: { title: "Incorrect", text: "Incomplete work." },
    },
  },
  "07": {
    scenarioId: 99,
    answers: [
      {
        id: "answer-a",
        label: "Answer A",
        steps: [
          "Define the quantity to analyze.",
          "Differentiate the model.",
          "Use the derivative to reach the conclusion.",
        ],
        trajectory: { type: "complete-correct" },
      },
    ],
  },
  "08": {
    scenarioId: 99,
    answerGradings: [
      {
        answerId: "answer-a",
        rubricFit: {
          derivative: {
            pass: true,
            step: 2,
            feedback: "The derivative is explicit.",
          },
        },
      },
    ],
  },
};

assert.deepEqual(missingDependencies("04", { "01": {}, "02": {} }), ["03"]);
assert.deepEqual(missingDependencies("09", documents), []);

const assembled = assembleModule(documents);
assert.equal(assembled.module.scenario, "A concise scenario.");
assert.equal(assembled.module.rubricOptions[0].id, "derivative");
assert.equal("criterionType" in assembled.module.rubricOptions[0], false);
assert.equal("trajectory" in assembled.module.finalAiAnswers[0], false);
assert.equal("text" in assembled.module.finalAiAnswers[0], false);
assert.deepEqual(assembled.module.finalAiAnswers[0].steps, [
  "Define the quantity to analyze.",
  "Differentiate the model.",
  "Use the derivative to reach the conclusion.",
]);
assert.equal(
  assembled.module.finalAiAnswers[0].rubricFit.derivative.step,
  2,
);
assert.equal(
  "line" in assembled.module.finalAiAnswers[0].rubricFit.derivative,
  false,
);

const restored = restoreDraft({
  inputs: { concept: "optimization", scenarioId: 99, title: null },
  documents: null,
  module: assembled.module,
  stages: [{ status: "running" }],
  validationErrors: ["/answerGradings: requires three items"],
});
assert.equal(restored.inputs.concept, "optimization");
assert.equal(restored.inputs.scenarioId, 99);
assert.equal(restored.stages.length, 9);
assert.equal(restored.stages[0].status, "pending");
assert.deepEqual(restored.validationErrors, [
  "/answerGradings: requires three items",
]);

const restoredStringId = restoreDraft({
  inputs: { concept: "limits", scenarioId: "42" },
});
assert.equal(restoredStringId.inputs.scenarioId, 42);

const restoredDocumentId = restoreDraft({
  inputs: { concept: "derivatives", scenarioId: "" },
  documents: { "01": { scenarioId: 73 } },
});
assert.equal(restoredDocumentId.inputs.scenarioId, 73);

assert.equal(generateInternalScenarioId(() => 0), 1);
assert.equal(generateInternalScenarioId(() => Number.NaN), 1);
assert.ok(Number.isSafeInteger(generateInternalScenarioId(() => 0.5)));
assert.ok(generateInternalScenarioId(() => 0.5) > 0);

const editedModule = { ...assembled.module, scenario: "Edited scenario." };
const bundle = buildPipelineBundle({ ...restored, module: editedModule });
assert.equal(bundle.module?.scenario, "Edited scenario.");
assert.equal(bundle.input, restored.inputs);

console.log("check-instructor-workspace: clean");
