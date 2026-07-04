import { Flex, Heading, Text } from "@radix-ui/themes";
import { CheckIcon, Cross2Icon } from "@radix-ui/react-icons";
import MathDisplay from "@/components/math-display";

type FeedbackCardProps = {
  feedback: string;
  llmFeedback?: string;
  loadingLlm?: boolean;
  title?: string;
  llmLabel?: string;
  correct?: boolean;
};

export default function FeedbackCard({
  feedback,
  llmFeedback,
  loadingLlm = false,
  title = "Feedback",
  llmLabel = "Reasoning feedback",
  correct = true,
}: FeedbackCardProps) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <Flex direction="column" gap="3">
        <Flex align="center" gap="2">
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              correct ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {correct ? (
              <CheckIcon className="text-white" width={14} height={14} />
            ) : (
              <Cross2Icon className="text-white" width={14} height={14} />
            )}
          </div>
          <Heading size="4" className="text-stone-800">{title}</Heading>
        </Flex>

        <MathDisplay className="text-md whitespace-pre-wrap leading-7 text-stone-700" text={feedback} />

        {loadingLlm && (
          <Text size="2" color="gray">Analyzing your explanation…</Text>
        )}

        {!loadingLlm && llmFeedback && (
          <Flex direction="column" gap="2" className="border-t border-stone-200 pt-3">
            <Text size="1" weight="bold" className="uppercase tracking-wider text-stone-400">
              {llmLabel}
            </Text>
            <MathDisplay className="text-md whitespace-pre-wrap leading-7 text-stone-700" text={llmFeedback} />
          </Flex>
        )}
      </Flex>
    </div>
  );
}
