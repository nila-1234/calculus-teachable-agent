import { NextRequest, NextResponse } from "next/server";
import getFirestore from "@/lib/firestore";
import { authorizeInstructor } from "@/lib/instructor-auth";
import { mirrorEvents, type LogEntry } from "@/lib/tree";

/**
 * Rebuilds the browsable `subjects/` tree from the `logs` collection.
 *
 * Needed for two things: backfilling everything logged before the tree existed,
 * and repairing it if a live mirror write ever fails (those are deliberately
 * non-fatal, so a failure leaves the tree stale rather than stopping the study).
 *
 * Safe to run repeatedly — every write is a merge on a deterministic id, so a
 * rebuild converges on the same tree instead of duplicating anything. `logs` is
 * only ever read.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const denied = authorizeInstructor(req);
  if (denied) return denied;

  try {
    const subject = req.nextUrl.searchParams.get("subject")?.trim();

    let query: FirebaseFirestore.Query = getFirestore().collection("logs");
    if (subject) query = query.where("subject_id", "==", subject);

    const snapshot = await query.get();
    const entries = snapshot.docs.map((doc) => doc.data() as LogEntry);

    const writes = await mirrorEvents(entries);

    return NextResponse.json({
      ok: true,
      subject: subject ?? "(all)",
      events_read: entries.length,
      documents_written: writes,
    });
  } catch (err) {
    console.error("Tree rebuild failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

/** Convenience: the same rebuild, so it can be triggered from a browser bar. */
export async function GET(req: NextRequest) {
  return POST(req);
}
