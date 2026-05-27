import { Card, Flex, Heading, Text } from "@radix-ui/themes";
import MathDisplay from "@/components/math-display";

type FeedbackCardProps = {
  feedback: string;
  llmFeedback?: string;
  loadingLlm?: boolean;
  title?: string;
  llmLabel?: string;
};

export default function FeedbackCard({
  feedback,
  llmFeedback,
  loadingLlm = false,
  title = "Feedback",
  llmLabel = "Explanation feedback",
}: FeedbackCardProps) {
  return (
    <Card size="2">
      <Flex direction="column" gap="3">
        <Heading size="4">{title}</Heading>

        <MathDisplay className="text-md whitespace-pre-wrap leading-7" text={feedback} />

        {loadingLlm && (
          <Text size="2" color="gray">Analyzing your explanation…</Text>
        )}

        {!loadingLlm && llmFeedback && (
          <Flex direction="column" gap="2">
            <Text size="2" weight="medium" color="gray">{llmLabel}</Text>
            <MathDisplay className="text-md whitespace-pre-wrap leading-7" text={llmFeedback} />
          </Flex>
        )}
      </Flex>
    </Card>
  );
}
