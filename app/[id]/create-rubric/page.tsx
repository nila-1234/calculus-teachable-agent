"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CreateRubricPanel, {
  RubricDecision,
} from "@/components/create-rubric-panel";
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
  const [rubricDecisions, setRubricDecisions] = useState<
    Record<string, RubricDecision>
  >({});
  const [submitted, setSubmitted] = useState(false);
  const [isPerfect, setIsPerfect] = useState(false);

  useEffect(() => {
    setQuestion(
      sessionStorage.getItem(`scenario:${scenarioId}:studentQuestion`) ||
      "Question placeholder"
    );
  }, [scenarioId]);

  const selectedRubricIds = useMemo(
    () =>
      RUBRIC_OPTIONS.filter((option) => rubricDecisions[option.id] === "include")
        .map((option) => option.id),
    [RUBRIC_OPTIONS, rubricDecisions]
  );

  const allCriteriaDecided = RUBRIC_OPTIONS.every(
    (option) => rubricDecisions[option.id]
  );

  const handleSetRubricDecision = (id: string, decision: RubricDecision) => {
    if (submitted) return;

    setRubricDecisions((prev) => ({
      ...prev,
      [id]: decision,
    }));
  };

  const handleContinue = () => {
    sessionStorage.setItem(
      `scenario:${scenarioId}:selectedRubricIds`,
      JSON.stringify(selectedRubricIds)
    );

    router.push(`/${scenarioId}/apply-rubric`);
  };

  const handleTryAgain = () => {
    setSubmitted(false);
    setIsPerfect(false);
  };

  const handleSubmit = () => {
    if (!allCriteriaDecided) return;

    const includedOptions = RUBRIC_OPTIONS.filter(
      (option) => rubricDecisions[option.id] === "include"
    );

    const wronglyIncluded = includedOptions.filter((option) => !option.correct);
    const missedEssential = RUBRIC_OPTIONS.filter(
      (option) => option.correct && rubricDecisions[option.id] === "exclude"
    );

    const isPerfectSelection =
      wronglyIncluded.length === 0 && missedEssential.length === 0;

    setIsPerfect(isPerfectSelection);
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
          rubricDecisions={rubricDecisions}
          submitted={submitted}
          isPerfect={isPerfect}
          allCriteriaDecided={allCriteriaDecided}
          onSetRubricDecision={handleSetRubricDecision}
          onContinue={handleContinue}
          onSubmit={handleSubmit}
          onTryAgain={handleTryAgain}
        />
      </div>
    </main>
  );
}