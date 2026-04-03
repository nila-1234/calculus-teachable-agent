"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CreateRubricPanel from "@/components/create-rubric-panel";
import { RUBRIC_OPTIONS, SAMPLE_ANSWERS } from "@/lib/question-schema";

export default function CreateRubricPage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [selectedRubricIds, setSelectedRubricIds] = useState<string[]>([]);

  useEffect(() => {
    setQuestion(
      sessionStorage.getItem("studentQuestion") || "Question placeholder"
    );
  }, []);

  const handleToggleRubric = (id: string) => {
    setSelectedRubricIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    sessionStorage.setItem(
      "selectedRubricIds",
      JSON.stringify(selectedRubricIds)
    );
    router.push("/apply-rubric");
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
        />
      </div>
    </main>
  );
}