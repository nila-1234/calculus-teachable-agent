import {Card, Flex, Heading, Text} from "@radix-ui/themes";

type FeedbackCardProps = {
  title?: string;
  text?: string;
  loading?: boolean;
  emptyMessage?: string;
};

export default function FeedbackCard({
  title = "Feedback",
  text = "",
  loading = false,
  emptyMessage = "Submit to receive AI feedback.",
}: FeedbackCardProps) {
  const showEmpty = !loading && !text.trim();

  return (

    <Card size="3" className="h-full">
      <Flex direction="column" gap="3" className="h-full">
        <Heading size="5">{title}</Heading>

        {loading ? (
          <Text color="gray">Generating feedback...</Text>
        ) : text ? (
          <Text size="3">{text}</Text>
        ) : (
          <Text color="gray">{emptyMessage}</Text>
        )}
      </Flex>
    </Card>
  );
}