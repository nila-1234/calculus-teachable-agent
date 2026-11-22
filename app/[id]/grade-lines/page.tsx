"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import GradeLinesActivity from "@/components/grade-lines-activity";
import { parseScenarioId } from "@/lib/scenarios/utils";

/** Step 3 of the agent scenario. The activity itself lives in the component. */
function GradeLinesPageContent() {
  const params = useParams();
  return <GradeLinesActivity scenarioId={parseScenarioId(params.id)} />;
}

export default function GradeLinesPage() {
  return (
    <Suspense>
      <GradeLinesPageContent />
    </Suspense>
  );
}
