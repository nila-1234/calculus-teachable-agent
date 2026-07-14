"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import GradePanel, {
  AnswerReviewState,
  RubricCriterion,
} from "@/components/grade-panel";
import GradeChat, { ChatMessage } from "@/components/grade-chat";
import { getScenario } from "@/lib/scenarios/registry";
import StepProgress from "@/components/step-progress";
import StepIntro from "@/components/step-intro";
import AppHeader from "@/components/app-header";
import { parseScenarioId } from "@/lib/scenarios/utils";
import { logEvent } from "@/lib/logger";

function GradePageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const mode = parseInt(searchParams.get("applyRubricMode") || "1", 10);

  const scenarioId = parseScenarioId(params.id);
  const scenario = scenarioId ? getScenario(scenarioId) : null;

  if (!scenarioId || !scenario) {
    return <main className="p-6">Scenario not found.</main>;
  }

  const { RUBRIC_OPTIONS, FINAL_AI_ANSWERS, SAMPLE_ANSWERS } = scenario.schema;

  const [question, setQuestion] = useState("");
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [reviewStates, setReviewStates] = useState<Record<string, AnswerReviewState>>({});
  const [loadingAnswerId, setLoadingAnswerId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});

  useEffect(() => {
    setQuestion(
      sessionStorage.getItem(`scenario:${scenarioId}:studentQuestion`) || ""
    );
  }, [scenarioId]);

  useEffect(() => {
    const raw = sessionStorage.getItem(`scenario:${scenarioId}:selectedRubricIds`);
    const ids: string[] = raw ? JSON.parse(raw) : [];

    const selectedRubric = ids.map((id) => {
      const match = RUBRIC_OPTIONS.find((option) => option.id === id);
      return { id, label: match?.label || id };
    });

    setRubric(selectedRubric);

    const initialReviewStates: Record<string, AnswerReviewState> = Object.fromEntries(
      FINAL_AI_ANSWERS.map((answer) => [
        answer.id,
        {
          results: Object.fromEntries(
            selectedRubric.map((criterion) => [criterion.id, ""])
          ) as Record<string, "" | "pass" | "fail">,
          submitted: false,
          feedback: [],
        },
      ])
    );

    setReviewStates(initialReviewStates);
  }, [RUBRIC_OPTIONS, FINAL_AI_ANSWERS, scenarioId]);

  const currentAnswer = FINAL_AI_ANSWERS[currentIndex];

  const handleToggleResult = async (
    answerId: string,
    criterionId: string,
    value: "pass" | "fail"
  ) => {
    logEvent("apply_rubric_toggle", scenarioId, {
      answer_id: answerId,
      criterion_id: criterionId,
      value,
    });
    setReviewStates((prev) => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        results: { ...prev[answerId].results, [criterionId]: value },
      },
    }));

    const answer = FINAL_AI_ANSWERS.find((item) => item.id === answerId);
    const criterion = rubric.find((item) => item.id === criterionId);

    try {
      const res = await fetch("/api/grade-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId,
          answerId,
          answerTitle: answer?.label,
          answerText: answer?.text,
          question,
          trigger: "grade",
          criterion,
          value,
          messages: chatMessages[answerId] ?? [],
        }),
      });
      const data = await res.json();

      setChatMessages((prev) => ({
        ...prev,
        [answerId]: [
          ...(prev[answerId] ?? []),
          { id: `${criterionId}-${value}-${Date.now()}`, role: "student", text: data.reply ?? "" },
        ],
      }));
    } catch {
      // Ignore chat errors for now; the rubric result above is unaffected.
    }
  };

  const handleSendChatMessage = async (answerId: string, text: string) => {
    setChatMessages((prev) => ({
      ...prev,
      [answerId]: [
        ...(prev[answerId] ?? []),
        { id: `user-${Date.now()}`, role: "user", text },
      ],
    }));

    const answer = FINAL_AI_ANSWERS.find((item) => item.id === answerId);

    try {
      const res = await fetch("/api/grade-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId,
          answerId,
          answerTitle: answer?.label,
          answerText: answer?.text,
          question,
          trigger: "message",
          userMessage: text,
          messages: chatMessages[answerId] ?? [],
        }),
      });
      const data = await res.json();

      setChatMessages((prev) => ({
        ...prev,
        [answerId]: [
          ...(prev[answerId] ?? []),
          { id: `student-${Date.now()}`, role: "student", text: data.reply ?? "" },
        ],
      }));
    } catch {
      // Ignore chat errors for now.
    }
  };

  const handleComplete = () => {
    sessionStorage.setItem(`scenario:${scenarioId}:rubricCompleted`, "true");
    router.push("/");
  };

  const handleSubmitAnswer = async (answerId: string) => {
    const review = reviewStates[answerId];
    const answer = FINAL_AI_ANSWERS.find((item) => item.id === answerId);

    if (!review || !answer) return;

    logEvent("apply_rubric_submitted", scenarioId, {
      answer_id: answerId,
      results: review.results,
      mode,
    });

    const rubricWithReviews = rubric.map((criterion) => ({
      criterionId: criterion.id,
      criterion: criterion.label,
      evaluation: review.results[criterion.id],
    }));

    try {
      setLoadingAnswerId(answerId);

      const res = await fetch("/api/apply-rubric-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId,
          answerId,
          answerTitle: answer.label,
          answerText: answer.text,
          rubric: rubricWithReviews,
          results: review.results,
          rubricFit: answer.rubricFit,
          explanations: {},
        }),
      });

      const data = await res.json();

      logEvent("apply_rubric_feedback_received", scenarioId, {
        answer_id: answerId,
        feedback: Array.isArray(data.feedback) ? data.feedback : [],
      });

      setReviewStates((prev) => {
        const next = {
          ...prev,
          [answerId]: {
            ...prev[answerId],
            submitted: true,
            feedback: Array.isArray(data.feedback) ? data.feedback : [],
          },
        };

        sessionStorage.setItem(
          `scenario:${scenarioId}:appliedRubricResults`,
          JSON.stringify(next)
        );
        return next;
      });
    } catch {
      setReviewStates((prev) => {
        const next = {
          ...prev,
          [answerId]: { ...prev[answerId], submitted: true, feedback: [] },
        };

        sessionStorage.setItem(
          `scenario:${scenarioId}:appliedRubricResults`,
          JSON.stringify(next)
        );
        return next;
      });
    } finally {
      setLoadingAnswerId(null);
    }
  };

  return (
    <main className="min-h-screen bg-stone-100">
      <AppHeader />
      <div className="mx-auto max-w-7xl p-3 py-6 sm:px-6">
        <StepProgress currentStep={2} scenarioId={scenarioId} />
        <StepIntro
          className="max-w-7xl"
          eyebrow="Your task"
          title="Step 3 · Evaluate AI student answers"
          paragraphs={[
            "Before applying your rubric to real student answers, test it with sample solutions. You asked AI to role-play as students and generate several responses.",
            "Use your rubric to evaluate each solution: what's right, what's missing, and what's wrong? The student may ask you to justify your grading in the chat.",
          ]}
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          <GradePanel
            question={question}
            rubric={rubric}
            answers={FINAL_AI_ANSWERS}
            reviewStates={reviewStates}
            loadingAnswerId={loadingAnswerId}
            currentIndex={currentIndex}
            onCurrentIndexChange={setCurrentIndex}
            onToggleResult={handleToggleResult}
            onSubmitAnswer={handleSubmitAnswer}
            onComplete={handleComplete}
            correctSample={SAMPLE_ANSWERS.correct}
          />

          <div className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
            <GradeChat
              studentLabel={currentAnswer.label}
              messages={chatMessages[currentAnswer.id] ?? []}
              onSend={(text) => handleSendChatMessage(currentAnswer.id, text)}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function GradePage() {
  return (
    <Suspense>
      <GradePageContent />
    </Suspense>
  );
}
