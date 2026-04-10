"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthorQuestionPanel from "@/components/author-question-panel";
import {
  SCENARIO_PLACEHOLDER,
  QUESTION_PLACEHOLDER,
  QUESTION_PARTS,
} from "@/lib/question-schema";

export default function AuthorQuestionPage() {
  const router = useRouter();

  const [selectedPart1, setSelectedPart1] = useState("");
  const [selectedPart2, setSelectedPart2] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const selectedChoice1 = useMemo(
    () =>
      QUESTION_PARTS.part1.options.find((choice) => choice.id === selectedPart1),
    [selectedPart1]
  );

  const selectedChoice2 = useMemo(
    () =>
      QUESTION_PARTS.part2.options.find((choice) => choice.id === selectedPart2),
    [selectedPart2]
  );

  const isFullyCorrect = Boolean(
    selectedChoice1?.correct && selectedChoice2?.correct
  );

  const composedQuestion = useMemo(() => {
    if (!selectedChoice1 || !selectedChoice2) return "";

    return `Use the function ${selectedChoice1.text} to model the company’s profit and analyse the company’s situation by finding its ${selectedChoice2.text}.`;
  }, [selectedChoice1, selectedChoice2]);

  const handleSelectPart1 = (id: string) => {
    if (submitted) return;
    setSelectedPart1(id);
  };

  const handleSelectPart2 = (id: string) => {
    if (submitted) return;
    setSelectedPart2(id);
  };

  const handleSubmit = () => {
    if (!selectedPart1 || !selectedPart2) return;
    setSubmitted(true);
  };

  const handleTryAgain = () => {
    setSubmitted(false);
    setSelectedPart1("");
    setSelectedPart2("");
  };

  const handleContinue = () => {
    if (!isFullyCorrect || !selectedChoice1 || !selectedChoice2) return;

    sessionStorage.setItem("authorScenario", SCENARIO_PLACEHOLDER);
    sessionStorage.setItem("studentQuestion", composedQuestion);

    sessionStorage.setItem("selectedPart1", selectedChoice1.id);
    sessionStorage.setItem("selectedPart2", selectedChoice2.id);

    sessionStorage.setItem(
      "selectedPart1Correct",
      selectedChoice1.correct ? "true" : "false"
    );
    sessionStorage.setItem(
      "selectedPart2Correct",
      selectedChoice2.correct ? "true" : "false"
    );

    sessionStorage.setItem("selectedPart1Feedback", selectedChoice1.feedback);
    sessionStorage.setItem("selectedPart2Feedback", selectedChoice2.feedback);

    sessionStorage.setItem(
      "selectedChoiceCorrect",
      isFullyCorrect ? "true" : "false"
    );

    router.push("/create-rubric");
  };

  return (
    <main
      className="min-h-screen p-3 overflow-y-auto"
      style={{ backgroundColor: "var(--lime-8)" }}
    >
      <AuthorQuestionPanel
        scenario={SCENARIO_PLACEHOLDER}
        question={QUESTION_PLACEHOLDER}
        scatterPlotSrc="/data/plot-data.json"
        part1={QUESTION_PARTS.part1}
        part2={QUESTION_PARTS.part2}
        selectedPart1={selectedPart1}
        selectedPart2={selectedPart2}
        submitted={submitted}
        selectedFeedbackPart1={submitted ? selectedChoice1?.feedback || "" : ""}
        selectedFeedbackPart2={submitted ? selectedChoice2?.feedback || "" : ""}
        isCorrectSelection={submitted && isFullyCorrect}
        onSelectPart1={handleSelectPart1}
        onSelectPart2={handleSelectPart2}
        onSubmit={handleSubmit}
        onContinue={handleContinue}
        onTryAgain={handleTryAgain}
      />
    </main>
  );
}