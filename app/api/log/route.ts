import { NextRequest, NextResponse, after } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import getFirestore from "@/lib/firestore";
import { mirrorEvents, type LogEntry } from "@/lib/tree";
import { gradeFinishedRun } from "@/lib/tests/study-data";

// Grading a finished run (below) runs after the response, within this budget.
export const maxDuration = 300;

/**
 * Subjects whose run just ended: the post-survey is the last step, so its
 * arrival is when their pre- and post-test get graded.
 */
function finishedSubjects(entries: unknown[]): string[] {
  const ids = entries
    .map((e) => e as Record<string, unknown>)
    .filter((e) => e?.event === "survey_completed" && e?.scenario_id === "post")
    .map((e) => String(e.subject_id ?? "").trim())
    .filter((id) => id && id !== "unknown");
  return [...new Set(ids)];
}

const ALREADY_EXISTS = 6;

/** Top-level string / number / boolean / null fields of an event. */
function scalarFields(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(
      ([key, v]) =>
        key !== "data" &&
        (v === null || ["string", "number", "boolean"].includes(typeof v))
    )
  );
}

/** JSON text of any value, never throwing. */
function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "null";
  } catch {
    return String(value);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entries: unknown[] = Array.isArray(body?.entries)
      ? body.entries
      : [body];

    if (!entries.length) {
      return NextResponse.json({ ok: true, inserted: 0 });
    }

    const env = process.env.VERCEL_ENV ?? "local";
    const receivedAt = FieldValue.serverTimestamp();
    const db = getFirestore();

    // Pilot events live in their own collection so the pilot's data never mixes
    // with the main study's.
    const isPilot = (e: unknown) =>
      (e as Record<string, unknown>)?.study === "pilot";
    const pilotEntries = entries.filter(isPilot);
    const mainEntries = entries.filter((e) => !isPilot(e));

    // Each event carries its own event_id, so using it as the document ID makes
    // a retried event a no-op create() rejection (ALREADY_EXISTS) rather than a
    // duplicate — the same de-dupe the old unique Mongo index gave us.
    // Event ids that could not be stored at all (reported back so the client
    // retries just those, instead of the whole batch blocking the queue).
    const failed: string[] = [];

    const writeBatch = async (collectionName: string, items: unknown[]) => {
      if (!items.length) return 0;
      const coll = db.collection(collectionName);
      let inserted = 0;
      await Promise.all(
        items.map(async (entry) => {
          const record = entry as Record<string, unknown>;
          const eventId = record.event_id;
          if (typeof eventId !== "string" || !eventId) return;
          const ref = coll.doc(eventId);
          try {
            await ref.create({ ...record, env, received_at: receivedAt });
            inserted += 1;
            return;
          } catch (err) {
            const e = err as { code?: number };
            if (e?.code === ALREADY_EXISTS) return; // a retry: already stored
            // Firestore rejected this event's shape (e.g. a nested array or an
            // oversize document). Store it anyway, with its payload as JSON
            // text — the exports turn it back into `data`. Nothing is dropped.
            try {
              await ref.create({
                ...scalarFields(record),
                data: null,
                data_json: safeJson(record.data).slice(0, 900_000),
                store_error: String(err).slice(0, 500),
                env,
                received_at: receivedAt,
              });
              inserted += 1;
            } catch (err2) {
              const e2 = err2 as { code?: number };
              if (e2?.code === ALREADY_EXISTS) return;
              console.error("Could not store log event", eventId, err2);
              failed.push(eventId);
            }
          }
        })
      );
      return inserted;
    };

    const inserted =
      (await writeBatch("logs", mainEntries)) +
      (await writeBatch("pilot_logs", pilotEntries));

    // Mirror only the main study into the browsable subjects/ tree; the pilot
    // analysis reads pilot_logs flat. Deliberately swallowed: the tree is a
    // convenience projection, and losing data because a display copy failed
    // would be an absurd trade. /api/rebuild-tree repairs anything missed.
    if (mainEntries.length) {
      try {
        await mirrorEvents(mainEntries as LogEntry[]);
      } catch (err) {
        console.error("Tree mirror failed (logs are unaffected):", err);
      }
    }

    // Grade a run as soon as it finishes, in the background so the participant's
    // request returns immediately. Only whole runs are graded (gradeFinishedRun
    // checks every step is there). A failure here is not lost: the dashboard
    // grades any finished run that has no stored grade on its next load.
    const finished = finishedSubjects(mainEntries);
    if (finished.length) {
      after(async () => {
        for (const subjectId of finished) {
          try {
            console.log("Completion grading:", await gradeFinishedRun(subjectId));
          } catch (err) {
            console.error(`Completion grading failed for ${subjectId}:`, err);
          }
        }
      });
    }

    return NextResponse.json({ ok: failed.length === 0, inserted, failed });
  } catch (err) {
    console.error("Logging error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

/**
 * Health probe: confirms the deployment can actually reach the logs collection.
 * Hit this before a session rather than discovering after it that nothing was
 * being written.
 */
export async function GET() {
  try {
    const db = getFirestore();
    const logCount = (await db.collection("logs").count().get()).data().count;

    return NextResponse.json({
      ok: true,
      db: process.env.FIREBASE_PROJECT_ID,
      env: process.env.VERCEL_ENV ?? "local",
      logCount,
    });
  } catch (err) {
    console.error("Log health check failed:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
