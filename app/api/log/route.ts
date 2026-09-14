import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import getFirestore from "@/lib/firestore";

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
    const logs = getFirestore().collection("logs");

    // Each event carries its own event_id, so using it as the document ID
    // makes a retried event a no-op create() rejection (ALREADY_EXISTS)
    // instead of a duplicate row — the same de-dupe the old unique Mongo
    // index gave us.
    const results = await Promise.allSettled(
      entries.map((entry) => {
        const record = entry as Record<string, unknown>;
        const eventId = record.event_id;
        if (typeof eventId !== "string" || !eventId) {
          return Promise.reject(new Error("log entry missing event_id"));
        }
        return logs.doc(eventId).create({
          ...record,
          env,
          received_at: receivedAt,
        });
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

    // A batch that is purely retries is a success, not a failure — only a
    // genuine write error fails the request.
    if (nonDuplicateErrors.length) throw nonDuplicateErrors[0];

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
