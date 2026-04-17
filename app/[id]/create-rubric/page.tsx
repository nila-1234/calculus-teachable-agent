"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CreateRubricPanel from "@/components/create-rubric-panel";
import { getScenario } from "@/lib/scenarios/registry";
import { parseScenarioId } from "@/lib/scenarios/utils";

export default function CreateRubricPage() {
  const router = useRouter();
  const params = useParams();

  const scenarioId = parseScenarioId(params.id);
  const scenario = scenarioId ? getScenario(scenarioId) : null;

  if (!scenarioId || !scenario) {
    return <main className="p-6">Scenario not found.</main>;
  }

  const { RUBRIC_OPTIONS, SAMPLE_ANSWERS } = scenario.schema;

  const [question, setQuestion] = useState("");
  const [selectedRubricIds, setSelectedRubricIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setQuestion(
      sessionStorage.getItem(`scenario:${scenarioId}:studentQuestion`) ||
      "Question placeholder"
    );
  }, [scenarioId]);

  const handleToggleRubric = (id: string) => {
    setSelectedRubricIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    sessionStorage.setItem(
      `scenario:${scenarioId}:selectedRubricIds`,
      JSON.stringify(selectedRubricIds)
    );
    router.push(`/${scenarioId}/apply-rubric`);
  };

  // const handleSubmit = () => {
  //   setFeedback("Placeholder feedback");
  //   setSubmitted(true);
  // };

  const handleSubmit = () => {
    const selectedOptions = RUBRIC_OPTIONS.filter((option) =>
      selectedRubricIds.includes(option.id)
    );

    if (selectedOptions.length === 0) return;

    const correctSelections = selectedOptions.filter((o) => o.correct);
    const incorrectSelections = selectedOptions.filter((o) => !o.correct);
    const allCorrectOptions = RUBRIC_OPTIONS.filter((o) => o.correct);

    const parts: string[] = [];

    if (
      incorrectSelections.length === 0 &&
      correctSelections.length === allCorrectOptions.length
    ) {
      parts.push(
        "Perfect. You selected all and only the essential rubric criteria."
      );
    } else if (incorrectSelections.length === 0) {
      parts.push(
        "Good selection. All chosen criteria are correct, but some essential ones are missing."
      );
    } else {
      parts.push(
        "Some selected criteria are not essential and should be reconsidered."
      );
    }

    if (correctSelections.length > 0) {
      parts.push(
        "Correct criteria:\n" +
        correctSelections.map((option) => `- ${option.feedback}`).join("\n")
      );
    }

    if (incorrectSelections.length > 0) {
      parts.push(
        "Incorrect criteria:\n" +
        incorrectSelections.map((option) => `- ${option.feedback}`).join("\n")
      );
    }

    setFeedback(parts.join("\n\n"));
    setSubmitted(true);
  };

  return (
    <main
      className="min-h-screen p-3 overflow-y-auto"
      style={{ backgroundColor: "var(--lime-8)" }}
    >
      <div className="flex-1 min-h-0">
        <CreateRubricPanel
          question={question}
          correctSample={SAMPLE_ANSWERS.correct}
          incorrectSample={SAMPLE_ANSWERS.incorrect}
          rubricOptions={RUBRIC_OPTIONS}
          selectedRubricIds={selectedRubricIds}
          onToggleRubric={handleToggleRubric}
          onContinue={handleContinue}
          onSubmit={handleSubmit}
          feedback={feedback}
          submitted={submitted}
        />
      </div>
    </main>
  );
}