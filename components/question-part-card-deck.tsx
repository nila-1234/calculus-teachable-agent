"use client";

import { useMemo, useRef, useEffect } from "react";
import { Flex, Heading, Text } from "@radix-ui/themes";
import FeedbackCard from "@/components/feedback-card";
import OptionRow, { OptionRowState } from "@/components/option-row";
import Button from "@/components/button";

type Choice = {
  id: string;
  text: string;
  correct?: boolean;
  feedback?: string;
};

type QuestionPart = {
  id: string;
  label: string;
  options: readonly Choice[];
};

type Props = {
  parts: readonly QuestionPart[];
  selectedParts: Record<string, string>;
  submittedParts: Record<string, boolean>;
  activeIndex: number;
  onSelectPart: (partId: string, choiceId: string) => void;
  onSubmitPart: (partId: string) => void;
  onTryAgainPart: (partId: string) => void;
  onNextPart: () => void;
  onContinue?: () => void;
  mode?: number;
  explanations?: Record<string, string>;
  onExplanationChange?: (partId: string, value: string) => void;
  onExplanationBlur?: (partId: string, value: string) => void;
  llmFeedback?: Record<string, string>;
  loadingFeedback?: Record<string, boolean>;
};

export default function QuestionPartCardDeck({
  parts,
  selectedParts,
  submittedParts,
  activeIndex,
  onSelectPart,
  onSubmitPart,
  onTryAgainPart,
  onNextPart,
  onContinue,
  mode = 1,
  explanations = {},
  onExplanationChange,
  onExplanationBlur,
  llmFeedback = {},
  loadingFeedback = {},
}: Props) {
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  const part = parts[activeIndex];
  const isLastPart = activeIndex === parts.length - 1;

  const selectedChoice = useMemo(() => {
    if (!part) return undefined;
    return part.options.find((choice) => choice.id === selectedParts[part.id]);
  }, [part, selectedParts]);

  const isSubmitted = part ? Boolean(submittedParts[part.id]) : false;
  const isCorrect = Boolean(selectedChoice?.correct);
  const canSubmit = Boolean(selectedChoice) && !isSubmitted;
  const isMode2 = mode === 2;

  useEffect(() => {
    if (isSubmitted && feedbackRef.current) {
      feedbackRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [isSubmitted]);

  if (!part) return null;

  const getOptionState = (choice: Choice): OptionRowState => {
    const isSelected = selectedParts[part.id] === choice.id;

    if (!isSubmitted) {
      return isSelected ? "selected" : "default";
    }

    if (isSelected) {
      return choice.correct ? "correct" : "incorrect";
    }

    return "dimmed";
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <Flex direction="column" gap="4">
        <Flex align="center" justify="between">
          <Heading size="4" className="text-stone-800">{part.label}</Heading>
          <span className="shrink-0 rounded-full bg-lime-600 px-3 py-1 text-xs font-semibold text-white">
            Part {activeIndex + 1} / {parts.length}
          </span>
        </Flex>

        <div className={isMode2 ? "grid grid-cols-[3fr_2fr] gap-4 items-stretch" : ""}>
          <Flex direction="column" gap="2" className="w-full">
            {part.options.map((choice, index) => (
              <OptionRow
                key={choice.id}
                index={index}
                text={choice.text}
                state={getOptionState(choice)}
                disabled={isSubmitted}
                onClick={() => onSelectPart(part.id, choice.id)}
              />
            ))}
          </Flex>

          {isMode2 && (
            <Flex direction="column" gap="2" className="h-full">
              <Text size="2" weight="medium" className="text-stone-600">
                Explain your reasoning
              </Text>
              <textarea
                placeholder="Why did you choose this answer?"
                value={explanations[part.id] || ""}
                onChange={(e) => onExplanationChange?.(part.id, e.target.value)}
                onBlur={(e) => onExplanationBlur?.(part.id, e.target.value)}
                disabled={isSubmitted}
                className="flex-1 min-h-0 w-full resize-none rounded-xl border-2 border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 transition-colors focus:outline-none focus:border-lime-600 focus:ring-4 focus:ring-lime-50 disabled:bg-stone-50 disabled:opacity-60"
              />
            </Flex>
          )}
        </div>

        {!isSubmitted && (
          <Flex justify="center">
            <Button onClick={() => onSubmitPart(part.id)} disabled={!canSubmit}>
              Submit
            </Button>
          </Flex>
        )}

        {isSubmitted ? (
          <div ref={feedbackRef} className="pb-1">
            <Flex direction="column" gap="4">
              <FeedbackCard
                feedback={selectedChoice?.feedback || "No feedback available."}
                llmFeedback={isMode2 ? llmFeedback[part.id] : undefined}
                loadingLlm={isMode2 && loadingFeedback[part.id]}
                correct={isCorrect}
              />

              <Flex justify="center">
                {isCorrect ? (
                  isLastPart ? (
                    <Button onClick={onContinue}>
                      Continue →
                    </Button>
                  ) : (
                    <Button onClick={onNextPart}>
                      Next Question
                    </Button>
                  )
                ) : (
                  <Button onClick={() => onTryAgainPart(part.id)}>
                    Try Again
                  </Button>
                )}
              </Flex>
            </Flex>
          </div>
        ) : null}
      </Flex>
    </div>
  );
}
