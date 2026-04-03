"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthorQuestionPanel from "@/components/author-question-panel";

type Choice = {
  id: string;
  text: string;
  correct?: boolean;
  feedback: string;
};

const SCENARIO_PLACEHOLDER = `A startup is reviewing its daily profit over the past month to better understand its overall business performance and decide whether any changes to its current strategy may be needed. The following chart shows the company’s daily profit throughout the month. Based on this chart, which of the following questions would best help the team analyze the trend in profit over time?`;

const QUESTION_PLACEHOLDER = `Which option is the best choice?`;

const CHOICES: Choice[] = [
  {
    id: "A",
    text: "Use the function \\(f(x)=−2x^2 + 12x + 2\\) to model the company’s profit and find its critical point(s).",
    correct: true,
    feedback:
      "Correct! This is the strongest choice because the function matches the overall shape of the data: the profit rises, reaches a highest point, and then falls. Since this model has a maximum point, finding its critical point is a meaningful way to identify the key point in the company’s profit trend.",
  },
  {
    id: "B",
    text: "Use the function \\(f(x)=2x^2+12x+2\\) to model the company’s profit and find its critical point(s).",
    correct: false,
    feedback:
      "This choice is less appropriate because the function opens upward, which means it has a minimum point rather than a maximum point. The chart suggests the company’s profit increases and then decreases, so this model does not represent the overall trend very well.",
  },
  {
    id: "C",
    text: "Use the function \\(f(x)=2x^3+2\\) to model the company’s profit and find its critical point(s).",
    correct: false,
    feedback:
      "This choice is not the best fit because the function is cubic and does not match the single peak shape suggested by the chart. Although it is still a nonlinear function, it does not model the company’s profit trend as clearly as a downward-opening quadratic would.",
  },
];

export default function AuthorQuestionPage() {
  const router = useRouter();
  const [selectedChoice, setSelectedChoice] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const selected = useMemo(
    () => CHOICES.find((choice) => choice.id === selectedChoice),
    [selectedChoice]
  );

  const handleSelectChoice = (id: string) => {
    if (submitted) return;
    setSelectedChoice(id);
  };

  const handleSubmit = () => {
    if (!selectedChoice) return;
    setSubmitted(true);
  };

  const handleTryAgain = () => {
    setSubmitted(false);
    setSelectedChoice("");
  }

  const handleContinue = () => {
    if (!selected?.correct) return;

    sessionStorage.setItem("authorScenario", SCENARIO_PLACEHOLDER);
    sessionStorage.setItem("studentQuestion", selected.text);
    sessionStorage.setItem("selectedChoice", selected.id);
    sessionStorage.setItem(
      "selectedChoiceCorrect",
      selected.correct ? "true" : "false"
    );
    sessionStorage.setItem("selectedChoiceFeedback", selected.feedback);

    router.push("/create-rubric");
  };

  return (
    <main
      className="min-h-screen p-3 overflow-y-auto"
      style={{ backgroundColor: "var(--lime-8)" }}
    >
      {/* <div className="flex-1"> */}
        <AuthorQuestionPanel
          scenario={SCENARIO_PLACEHOLDER}
          question={QUESTION_PLACEHOLDER}
          scatterPlotSrc="/data/plot-data.json"
          choices={CHOICES}
          selectedChoice={selectedChoice}
          submitted={submitted}
          selectedFeedback={submitted ? selected?.feedback || "" : ""}
          isCorrectSelection={submitted && Boolean(selected?.correct)}
          onSelectChoice={handleSelectChoice}
          onSubmit={handleSubmit}
          onContinue={handleContinue}
          onTryAgain={handleTryAgain}
        />
      {/* </div> */}
    </main>
  );
}