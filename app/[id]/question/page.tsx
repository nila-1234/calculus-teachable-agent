"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthorQuestionPanel from "@/components/author-question-panel";
import { getScenario } from "@/lib/scenarios/registry";
import { parseScenarioId } from "@/lib/scenarios/utils";

export default function AuthorQuestionPage() {
  const router = useRouter();
  const params = useParams();

  const scenarioId = parseScenarioId(params.id);
  const scenario = scenarioId ? getScenario(scenarioId) : null;

  if (!scenarioId || !scenario) {
    return <main className="p-6">Scenario not found.</main>;
  }

  const {
    SCENARIO_PLACEHOLDER,
    QUESTION_PLACEHOLDER,
    QUESTION_PARTS,
    PLOT_DATA_SRC,
  } = scenario.schema;

  const [selectedParts, setSelectedParts] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const selectedChoices = useMemo(() => {
    return QUESTION_PARTS.map((part) => {
      const selectedId = selectedParts[part.id];
      return part.options.find((opt) => opt.id === selectedId);
    });
  }, [QUESTION_PARTS, selectedParts]);

  const allAnswered = QUESTION_PARTS.every((part) => selectedParts[part.id]);

  const isFullyCorrect =
    allAnswered && selectedChoices.every((choice) => choice?.correct);

  const composedQuestion = useMemo(() => {
    if (!allAnswered) return "";

    let result = QUESTION_PLACEHOLDER;

    selectedChoices.forEach((choice, index) => {
      if (!choice) return;
      result = result.replace(`__(${index + 1})__`, choice.text);
    });

    return result;
  }, [QUESTION_PLACEHOLDER, selectedChoices, allAnswered]);

  const handleContinue = () => {
    if (!isFullyCorrect || !allAnswered) return;

    sessionStorage.setItem(
      `scenario:${scenarioId}:authorScenario`,
      SCENARIO_PLACEHOLDER
    );
    sessionStorage.setItem(
      `scenario:${scenarioId}:studentQuestion`,
      composedQuestion
    );
    sessionStorage.setItem(
      `scenario:${scenarioId}:selectedParts`,
      JSON.stringify(selectedParts)
    );
    sessionStorage.setItem(
      `scenario:${scenarioId}:selectedPartsMeta`,
      JSON.stringify(
        selectedChoices.map((choice) => ({
          id: choice?.id,
          correct: choice?.correct,
          feedback: choice?.feedback,
        }))
      )
    );
    sessionStorage.setItem(
      `scenario:${scenarioId}:selectedChoiceCorrect`,
      isFullyCorrect ? "true" : "false"
    );

    router.push(`/${scenarioId}/create-rubric`);
  };

  return (
    <main
      className="min-h-screen p-3 overflow-y-auto"
      style={{ backgroundColor: "var(--lime-8)" }}
    >
      <AuthorQuestionPanel
        scenario={SCENARIO_PLACEHOLDER}
        question={QUESTION_PLACEHOLDER}
        scatterPlotSrc={PLOT_DATA_SRC}
        parts={QUESTION_PARTS}
        selectedParts={selectedParts}
        submitted={submitted}
        isCorrectSelection={submitted && isFullyCorrect}
        onSelectPart={(partId, choiceId) => {
          if (submitted) return;
          setSelectedParts((prev) => ({
            ...prev,
            [partId]: choiceId,
          }));
        }}
        onSubmit={() => {
          if (!allAnswered) return;
          setSubmitted(true);
        }}
        onContinue={handleContinue}
        onTryAgain={() => {
          setSubmitted(false);
          setSelectedParts({});
        }}
      />
    </main>
  );
}