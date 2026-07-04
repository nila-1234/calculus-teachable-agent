import { Avatar, Flex, Text } from "@radix-ui/themes";

export default function AppHeader() {
  return (
    <Flex
      align="center"
      justify="between"
      className="border-b border-stone-200 bg-white px-4 py-3 sm:px-6"
    >
      <Flex align="center" gap="2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lime-600 text-white">
          <span className="text-sm font-bold">A</span>
        </div>
        <Text size="3" weight="bold" className="text-stone-800">
          Teachable Calculus Agent
        </Text>
      </Flex>

      <Avatar
        fallback="TA"
        radius="full"
        size="2"
        color="gray"
        variant="soft"
      />
    </Flex>
  );
}
