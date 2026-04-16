"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthorQuestionPanel from "@/components/author-question-panel";
import {
  SCENARIO_PLACEHOLDER,
  QUESTION_PLACEHOLDER,
  QUESTION_PARTS,
  PLOT_DATA_SRC,
} from "@/lib/scenarios/2/question-schema";

export default function AuthorQuestionPage() {
  const params = useParams();
  const router = useRouter();

  const [selectedParts, setSelectedParts] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const selectedChoices = useMemo(() => {
    return QUESTION_PARTS.map((part) => {
      const selectedId = selectedParts[part.id];
      return part.options.find((opt) => opt.id === selectedId);
    });
  }, [selectedParts]);

  const allAnswered = QUESTION_PARTS.every(
    (part) => selectedParts[part.id]
  );

  const isFullyCorrect = allAnswered && selectedChoices.every(
    (choice) => choice?.correct
  );

  const composedQuestion = useMemo(() => {
    if (!allAnswered) return "";

    let result = QUESTION_PLACEHOLDER;

    selectedChoices.forEach((choice, index) => {
      if (!choice) return;
      result = result.replace(`__(${index + 1})__`, choice.text);
    });

    return result;
  }, [selectedChoices, allAnswered]);

  const handleSelectPart = (partId: string, choiceId: string) => {
    if (submitted) return;

    setSelectedParts((prev) => ({
      ...prev,
      [partId]: choiceId,
    }));
  };

  const handleSubmit = () => {
    if (!allAnswered) return;
    setSubmitted(true);
  };

  const handleTryAgain = () => {
    setSubmitted(false);
    setSelectedParts({});
  };

  const handleContinue = () => {
    if (!isFullyCorrect || !allAnswered) return;

    sessionStorage.setItem("authorScenario", SCENARIO_PLACEHOLDER);
    sessionStorage.setItem("studentQuestion", composedQuestion);

    sessionStorage.setItem("selectedParts", JSON.stringify(selectedParts));

    sessionStorage.setItem(
      "selectedPartsMeta",
      JSON.stringify(
        selectedChoices.map((choice) => ({
          id: choice?.id,
          correct: choice?.correct,
          feedback: choice?.feedback,
        }))
      )
    );

    sessionStorage.setItem(
      "selectedChoiceCorrect",
      isFullyCorrect ? "true" : "false"
    );

    router.push(`/${params.id}/create-rubric`);
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
        onSelectPart={handleSelectPart}
        onSubmit={handleSubmit}
        onContinue={handleContinue}
        onTryAgain={handleTryAgain}
      />
    </main>
  );
}