import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import type { Timestamp } from "firebase-admin/firestore";
import getFirestore from "../lib/firestore";
import { MAX_DWELL_MS } from "../lib/tests/export";

type LogDoc = {
  event_id?: string;
  subject_id?: string;
  session_id?: string;
  timestamp?: string;
  received_at?: Timestamp;
  env?: string;
  event?: string;
  scenario_id?: string;
  data?: Record<string, unknown>;
};

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(row[column])).join(","));
  }
  return lines.join("\n") + "\n";
}

function minutesBetween(a: string, b: string): number {
  return Math.round(((Date.parse(b) - Date.parse(a)) / 60000) * 10) / 10;
}

/**
 * Time on each step, in ms.
 *
 * Derived primarily from the gap between consecutive step_entered events within
 * a session, which is robust: it needs no exit event at all. A step_exited
 * dwell_ms is only used for the last step of a session, where there is no
 * following entry to measure against. Exits lost to an abrupt tab close
 * therefore cost at most the final step's duration rather than all of them.
 */
function dwellPerStep(docs: LogDoc[]): Map<string, number> {
  const dwell = new Map<string, number>();
  // Gaps beyond the ceiling mean the participant walked away, not that they
  // spent that long on the step.
  const add = (step: string, ms: number) => {
    if (ms > 0 && ms <= MAX_DWELL_MS) {
      dwell.set(step, (dwell.get(step) ?? 0) + ms);
    }
  };

  const bySession = new Map<string, LogDoc[]>();
  for (const doc of docs) {
    const key = doc.session_id || "unknown";
    const list = bySession.get(key) ?? [];
    list.push(doc);
    bySession.set(key, list);
  }

  for (const list of bySession.values()) {
    const ordered = [...list].sort((a, b) =>
      (a.timestamp ?? "").localeCompare(b.timestamp ?? "")
    );
    const entries = ordered.filter((doc) => doc.event === "step_entered");

    entries.forEach((entry, index) => {
      const step = String((entry.data as Record<string, unknown>)?.path ?? "");
      const next = entries[index + 1];

      if (next?.timestamp && entry.timestamp) {
        add(step, Date.parse(next.timestamp) - Date.parse(entry.timestamp));
        return;
      }

      // Last step in the session: fall back to a reported exit if there is one.
      const exit = ordered.find(
        (doc) =>
          doc.event === "step_exited" &&
          String((doc.data as Record<string, unknown>)?.path ?? "") === step &&
          (doc.timestamp ?? "") >= (entry.timestamp ?? "")
      );
      const reported = (exit?.data as Record<string, unknown>)?.dwell_ms;
      if (typeof reported === "number") add(step, reported);
    });
  }

  return dwell;
}

async function main() {
  // --env production / --subject S01 narrow the export; default is everything.
  const args = process.argv.slice(2);
  const envFilter = args[args.indexOf("--env") + 1];
  const subjectFilter = args[args.indexOf("--subject") + 1];

  let query: FirebaseFirestore.Query = getFirestore().collection("logs");
  if (args.includes("--env") && envFilter) query = query.where("env", "==", envFilter);
  if (args.includes("--subject") && subjectFilter) {
    query = query.where("subject_id", "==", subjectFilter);
  }
  query = query.orderBy("timestamp", "asc");

  const docs = (await query.get()).docs.map((doc) => doc.data() as LogDoc);

  if (!docs.length) {
    console.log("No log documents matched in the logs collection.");
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(process.cwd(), "exports");
  await fs.mkdir(outDir, { recursive: true });

  // 1. Raw JSONL — lossless, the copy to keep.
  const jsonlPath = path.join(outDir, `logs-${stamp}.jsonl`);
  await fs.writeFile(
    jsonlPath,
    docs.map((doc) => JSON.stringify(doc)).join("\n") + "\n",
    "utf8"
  );

  // 2. Flat event CSV — one row per event.
  const eventRows = docs.map((doc) => ({
    subject_id: doc.subject_id ?? "",
    session_id: doc.session_id ?? "",
    timestamp: doc.timestamp ?? "",
    received_at: doc.received_at?.toDate?.().toISOString() ?? "",
    env: doc.env ?? "",
    event: doc.event ?? "",
    scenario_id: doc.scenario_id ?? "",
    dwell_ms: (doc.data as Record<string, unknown>)?.dwell_ms ?? "",
    path: (doc.data as Record<string, unknown>)?.path ?? "",
    data: doc.data ?? {},
    event_id: doc.event_id ?? "",
  }));

  const eventsPath = path.join(outDir, `events-${stamp}.csv`);
  await fs.writeFile(
    eventsPath,
    toCsv(eventRows, [
      "subject_id",
      "session_id",
      "timestamp",
      "received_at",
      "env",
      "event",
      "scenario_id",
      "dwell_ms",
      "path",
      "data",
      "event_id",
    ]),
    "utf8"
  );

  // 3. Per-subject summary — the sanity check before any analysis.
  const bySubject = new Map<string, LogDoc[]>();
  for (const doc of docs) {
    const key = doc.subject_id || "unknown";
    const list = bySubject.get(key) ?? [];
    list.push(doc);
    bySubject.set(key, list);
  }

  const summaryRows = [...bySubject.entries()].map(([subject, list]) => {
    const times = list
      .map((doc) => doc.timestamp)
      .filter((t): t is string => !!t)
      .sort();

    const dwellByStep = dwellPerStep(list);
    const activeMs = [...dwellByStep.values()].reduce((a, b) => a + b, 0);

    const eventCounts: Record<string, number> = {};
    for (const doc of list) {
      const name = doc.event ?? "unknown";
      eventCounts[name] = (eventCounts[name] ?? 0) + 1;
    }

    return {
      subject_id: subject,
      sessions: new Set(list.map((d) => d.session_id ?? "")).size,
      total_events: list.length,
      first_event: times[0] ?? "",
      last_event: times[times.length - 1] ?? "",
      elapsed_min:
        times.length > 1 ? minutesBetween(times[0], times[times.length - 1]) : 0,
      active_min: Math.round((activeMs / 60000) * 10) / 10,
      steps_visited: dwellByStep.size,
      surveys_completed: eventCounts["survey_completed"] ?? 0,
      tests_completed: eventCounts["test_completed"] ?? 0,
      rubric_decisions: eventCounts["rubric_decision"] ?? 0,
      event_breakdown: eventCounts,
    };
  });

  summaryRows.sort((a, b) => a.subject_id.localeCompare(b.subject_id));

  const summaryPath = path.join(outDir, `subjects-${stamp}.csv`);
  await fs.writeFile(
    summaryPath,
    toCsv(summaryRows, [
      "subject_id",
      "sessions",
      "total_events",
      "first_event",
      "last_event",
      "elapsed_min",
      "active_min",
      "steps_visited",
      "surveys_completed",
      "tests_completed",
      "rubric_decisions",
      "event_breakdown",
    ]),
    "utf8"
  );

  console.log(`Exported ${docs.length} events from the logs collection`);
  console.log(`  ${path.relative(process.cwd(), jsonlPath)}`);
  console.log(`  ${path.relative(process.cwd(), eventsPath)}`);
  console.log(`  ${path.relative(process.cwd(), summaryPath)}`);
  console.log("");
  console.table(
    summaryRows.map((row) => ({
      subject: row.subject_id,
      events: row.total_events,
      elapsed_min: row.elapsed_min,
      active_min: row.active_min,
      steps: row.steps_visited,
    }))
  );

  const unknown = bySubject.get("unknown");
  if (unknown) {
    console.warn(
      `\nWARNING: ${unknown.length} event(s) have no subject ID and cannot be attributed.`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
