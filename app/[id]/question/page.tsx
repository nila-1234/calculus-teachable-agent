"use client";

import { Suspense, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AuthorQuestionPanel from "@/components/author-question-panel";
import { getScenario } from "@/lib/scenarios/registry";
import { parseScenarioId } from "@/lib/scenarios/utils";

function AuthorQuestionPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const mode = parseInt(searchParams.get("mode") || "1", 10);

  const scenarioId = parseScenarioId(params.id);
  const scenario = scenarioId ? getScenario(scenarioId) : null;

  const [selectedParts, setSelectedParts] = useState<Record<string, string>>({});
  const [submittedParts, setSubmittedParts] = useState<Record<string, boolean>>({});
  const [activePartIndex, setActivePartIndex] = useState(0);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [llmFeedback, setLlmFeedback] = useState<Record<string, string>>({});
  const [loadingFeedback, setLoadingFeedback] = useState<Record<string, boolean>>({});

  if (!scenarioId || !scenario) {
    return <main className="p-6">Scenario not found.</main>;
  }

  const {
    SCENARIO_PLACEHOLDER,
    QUESTION_PLACEHOLDER,
    QUESTION_PARTS,
    PLOT_DATA_SRC,
  } = scenario.schema;

  const selectedChoices = QUESTION_PARTS.map((part) => {
    const selectedId = selectedParts[part.id];
    return part.options.find((opt) => opt.id === selectedId);
  });

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

  const handleSubmitPart = async (partId: string) => {
    if (!selectedParts[partId]) return;

    setSubmittedParts((prev) => ({ ...prev, [partId]: true }));

    if (mode === 2) {
      const part = QUESTION_PARTS.find((p) => p.id === partId);
      if (!part) return;

      const selectedId = selectedParts[partId];
      const selectedChoice = part.options.find((opt) => opt.id === selectedId);
      if (!selectedChoice) return;

      setLoadingFeedback((prev) => ({ ...prev, [partId]: true }));

      try {
        const res = await fetch("/api/question-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario: SCENARIO_PLACEHOLDER,
            question: QUESTION_PLACEHOLDER,
            responses: [
              {
                partId,
                partLabel: part.label,
                selectedChoiceId: selectedId,
                selectedChoiceText: selectedChoice.text,
                selectedChoiceCorrect: selectedChoice.correct,
                hardcodedFeedback: selectedChoice.feedback,
                explanation: explanations[partId] || "",
              },
            ],
          }),
        });

        const data = await res.json();
        if (data.feedbackByPart?.[partId]) {
          setLlmFeedback((prev) => ({
            ...prev,
            [partId]: data.feedbackByPart[partId],
          }));
        }
      } catch (e) {
        console.error("Failed to get LLM feedback:", e);
      } finally {
        setLoadingFeedback((prev) => ({ ...prev, [partId]: false }));
      }
    }
  };

  const handleTryAgainPart = (partId: string) => {
    setSubmittedParts((prev) => ({ ...prev, [partId]: false }));
    setSelectedParts((prev) => {
      const next = { ...prev };
      delete next[partId];
      return next;
    });
    setExplanations((prev) => {
      const next = { ...prev };
      delete next[partId];
      return next;
    });
    setLlmFeedback((prev) => {
      const next = { ...prev };
      delete next[partId];
      return next;
    });
  };

  const handleNextPart = () => {
    const currentPart = QUESTION_PARTS[activePartIndex];
    const selectedId = selectedParts[currentPart.id];
    const selectedChoice = currentPart.options.find((opt) => opt.id === selectedId);

    if (!selectedChoice?.correct) return;

    setActivePartIndex((prev) => Math.min(prev + 1, QUESTION_PARTS.length - 1));
  };

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
        onSelectPart={(partId, choiceId) => {
          if (submittedParts[partId]) return;
          setSelectedParts((prev) => ({ ...prev, [partId]: choiceId }));
        }}
        submittedParts={submittedParts}
        activePartIndex={activePartIndex}
        onSubmitPart={handleSubmitPart}
        onTryAgainPart={handleTryAgainPart}
        onNextPart={handleNextPart}
        onContinue={handleContinue}
        mode={mode}
        explanations={explanations}
        onExplanationChange={(partId, value) =>
          setExplanations((prev) => ({ ...prev, [partId]: value }))
        }
        llmFeedback={llmFeedback}
        loadingFeedback={loadingFeedback}
      />
    </main>
  );
}

export default function AuthorQuestionPage() {
  return (
    <Suspense>
      <AuthorQuestionPageContent />
    </Suspense>
  );
}
