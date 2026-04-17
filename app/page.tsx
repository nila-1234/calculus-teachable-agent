"use client";

import { useRouter } from "next/navigation";
import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";

export default function HomePage() {
  const router = useRouter();

  return (
    <main
      className="h-screen p-3 flex"
      style={{ backgroundColor: "var(--lime-5)" }}
    >
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        {/* App Title */}
        <Heading size="8">Teachable Calculus Agent</Heading>

        <Card size="3" className="w-full max-w-xl">
          <Flex direction="column" gap="5" align="center">
            <Heading size="6">Choose a Scenario</Heading>

            {/* <Text size="3" color="gray" align="center">
              Select a scenario.
            </Text> */}

            <Flex direction="column" gap="3" className="w-full">
              <Button
                size="3"
                color="lime"
                variant="soft"
                onClick={() => router.push("/1/question")}
              >
                Scenario 1
              </Button>

              <Button
                size="3"
                color="lime"
                variant="soft"
                onClick={() => router.push("/2/question")}
              >
                Scenario 2
              </Button>
            </Flex>
          </Flex>
        </Card>
      </div>
    </main>
  );
}