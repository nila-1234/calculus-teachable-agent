const USERNAME = "user1";

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
        username: USERNAME,
        timestamp: new Date().toISOString(),
        event,
        scenario_id: String(scenarioId),
        data,
      }),
    });
  } catch {
  }
}
