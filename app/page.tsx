"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Flex, Heading } from "@radix-ui/themes";

const scenarios = [
  { id: 1, name: "Company Profit Analysis" },
  { id: 2, name: "Water Reservoir Levels" },
  { id: 3, name: "Machine Risk Scores" },
  { id: 4, name: "Delivery Cost Analysis" },
  // { id: 5, name: "Company Profit Analysis Pt. 2" },
];

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "1";

  return (
    <main
      className="h-screen p-3 flex"
      style={{ backgroundColor: "var(--lime-5)" }}
    >
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <Heading size="8">Teachable Calculus Agent</Heading>

        <Card size="3" className="w-full max-w-xl">
          <Flex direction="column" gap="5" align="center">
            <Heading size="6">Choose a Scenario</Heading>

            <Flex direction="column" gap="3" className="w-full">
              {scenarios.map((scenario) => (
                <Button
                  key={scenario.id}
                  size="3"
                  color="lime"
                  variant="soft"
                  onClick={() =>
                    router.push(`/${scenario.id}/question?mode=${mode}`)
                  }
                >
                  {scenario.id}. {scenario.name}
                </Button>
              ))}
            </Flex>
          </Flex>
        </Card>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <HomePageContent />
    </Suspense>
  );
}