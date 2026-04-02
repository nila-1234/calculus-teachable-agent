"use client";

import { SCENARIO } from "@/lib/prompts";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  RadioCards,
  Text,
} from "@radix-ui/themes";

type ChoiceId = "A" | "B" | "C";

type Choice = {
  id: ChoiceId;
  text: string;
};

const CHOICES: Choice[] = [
  {
    id: "A",
    text: "Which weeks should be treated as especially important because the rate at which profit is changing is zero or is not defined?",
  },
  {
    id: "B",
    text: "Which weeks should be treated as especially important because the profit value itself is zero or is not defined?",
  },
  {
    id: "C",
    text: "Which weeks should be treated as especially important because the profit reaches a local high or a local low?",
  },
];

type AuthorQuestionPanelProps = {
  selectedChoice: ChoiceId | "";
  setSelectedChoice: (value: ChoiceId) => void;
  submitted: boolean;
  loading: boolean;
  onSubmit: () => void;
  onContinue: () => void;
  feedback: string;
};

export default function AuthorQuestionPanel({
  selectedChoice,
  setSelectedChoice,
  submitted,
  loading,
  onSubmit,
  onContinue,
  feedback,
}: AuthorQuestionPanelProps) {
  const isEmpty = !selectedChoice;
  const isSubmitDisabled = isEmpty || loading || submitted;
  const showContinue = submitted && selectedChoice === "A";

  return (
    <Card size="3" className="h-full">
      <Flex direction="column" gap="5" className="h-full">
        <Heading size="5">Choose a Question</Heading>

        <Card size="2">
          <Flex direction="column" gap="3">
            <Heading size="4">Scenario</Heading>
            <Text className="whitespace-pre-line leading-7 text-slate-800">
              {SCENARIO}
            </Text>
            <Text weight="medium">
              Student task: Choose the question that best translates the team’s
              concern into mathematical language.
            </Text>
          </Flex>
        </Card>

        <Card size="2">
          <Flex direction="column" gap="4">
            <Heading size="4">Question Choices</Heading>

            <RadioCards.Root
              value={selectedChoice}
              onValueChange={(value) => setSelectedChoice(value as ChoiceId)}
              columns="1"
              className="w-full"
            >
              {CHOICES.map((choice) => (
                <RadioCards.Item
                  key={choice.id}
                  value={choice.id}
                  disabled={loading || submitted}
                >
                  <Flex align="start" gap="2" className="w-full text-left">
                    <Text weight="bold">{choice.id}.</Text>
                    <Text>{choice.text}</Text>
                  </Flex>
                </RadioCards.Item>
              ))}
            </RadioCards.Root>

            <Flex direction="column" gap="2">
              {/* {!loading && !submitted && isEmpty ? (
                <Text size="2" color="gray">
                  Select a question to continue.
                </Text>
              ) : null} */}

              <Flex align="center" justify="between">
                <Button
                  type="button"
                  onClick={onSubmit}
                  disabled={isSubmitDisabled}
                  color="lime"
                  variant="solid"
                >
                  {loading ? "Submitting..." : submitted ? "Submitted" : "Submit"}
                </Button>

                {showContinue ? (
                  <Button type="button" onClick={onContinue} color="lime">
                    Continue
                    <ArrowRightIcon width={16} height={16} />
                  </Button>
                ) : <div />}
              </Flex>
            </Flex>
          </Flex>
        </Card>

        <Card size="2">
          <Flex direction="column" gap="3">
            <Heading size="4">Feedback</Heading>

            {loading ? (
              <Text color="gray">Generating feedback...</Text>
            ) : feedback ? (
              <Text size="3" className="whitespace-pre-wrap">
                {feedback}
              </Text>
            ) : (
              <Text color="gray">
                Submit your selected question to receive AI feedback.
              </Text>
            )}
          </Flex>
        </Card>
      </Flex>
    </Card>
  );
}