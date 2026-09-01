import { getSubjectId } from "@/lib/subject";

export async function logEvent(
  event: string,
  scenarioId: string | number,
  data: Record<string, unknown>
) {
  try {
    await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject_id: getSubjectId(),
        timestamp: new Date().toISOString(),
        event,
        scenario_id: String(scenarioId),
        data,
      }),
    });
  } catch {
  }
}
