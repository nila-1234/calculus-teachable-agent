import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import getFirestore from "@/lib/firestore";
import { mirrorEvents, type LogEntry } from "@/lib/tree";

const ALREADY_EXISTS = 6;

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
    const writeBatch = async (collectionName: string, items: unknown[]) => {
      if (!items.length) return 0;
      const coll = db.collection(collectionName);
      const results = await Promise.allSettled(
        items.map((entry) => {
          const record = entry as Record<string, unknown>;
          const eventId = record.event_id;
          if (typeof eventId !== "string" || !eventId) {
            return Promise.reject(new Error("log entry missing event_id"));
          }
          return coll
            .doc(eventId)
            .create({ ...record, env, received_at: receivedAt });
        })
      );

      let inserted = 0;
      const nonDuplicateErrors: unknown[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") {
          inserted += 1;
        } else {
          const err = result.reason as { code?: number };
          if (err?.code === ALREADY_EXISTS) continue;
          nonDuplicateErrors.push(result.reason);
        }
      }
      // A batch that is purely retries is a success, not a failure.
      if (nonDuplicateErrors.length) throw nonDuplicateErrors[0];
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

    return NextResponse.json({ ok: true, inserted });
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
