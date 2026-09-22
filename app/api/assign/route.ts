import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import getFirestore from "@/lib/firestore";

/**
 * Balanced condition assignment.
 *
 * A hash of the subject id spreads participants evenly only in expectation —
 * simulation put a 40-person pilot anywhere from 15/25 to 25/15. This assigns
 * against a running count instead, so the split is balanced by construction:
 * each new participant joins whichever arm currently has fewer people.
 *
 * The read of the counts and the write of the assignment happen in one
 * transaction. Without that, two people starting at the same moment both read
 * the same counts and both go to the same arm — which is exactly when a study
 * is most likely to have people arriving at once.
 *
 * Assignment is idempotent: an already-assigned subject always gets back what
 * they were given, so a reload or a second tab can never move someone to a
 * different arm mid-study.
 */

export const dynamic = "force-dynamic";

const CONDITIONS = ["agent", "lesson"] as const;
type Condition = (typeof CONDITIONS)[number];

const ASSIGNMENTS = "assignments";
const COUNTS_DOC = "assignment_counts/global";

function isCondition(value: unknown): value is Condition {
  return typeof value === "string" && (CONDITIONS as readonly string[]).includes(value);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const subjectId = String(body?.subject_id ?? "").trim();
    if (!subjectId) {
      return NextResponse.json(
        { ok: false, error: "subject_id is required" },
        { status: 400 }
      );
    }

    // What the client already fell back to while the server was unreachable.
    // Honoured only for a subject with no record yet, so it can never move
    // someone who is already assigned.
    const preferred = isCondition(body?.preferred) ? body.preferred : null;

    const db = getFirestore();
    const subjectRef = db.collection(ASSIGNMENTS).doc(encodeURIComponent(subjectId));
    const countsRef = db.doc(COUNTS_DOC);

    const condition = await db.runTransaction(async (tx) => {
      const existing = await tx.get(subjectRef);
      const already = existing.data()?.condition;
      if (isCondition(already)) return already;

      const counts = (await tx.get(countsRef)).data() ?? {};
      const tally = Object.fromEntries(
        CONDITIONS.map((c) => [c, Number(counts[c]) || 0])
      ) as Record<Condition, number>;

      let chosen: Condition;
      if (preferred) {
        chosen = preferred;
      } else {
        const fewest = Math.min(...CONDITIONS.map((c) => tally[c]));
        const trailing = CONDITIONS.filter((c) => tally[c] === fewest);
        // A tie is the even case — break it randomly so the first participant
        // of each pair is not always sent to the same arm.
        chosen = trailing[Math.floor(Math.random() * trailing.length)];
      }

      tx.set(subjectRef, {
        subject_id: subjectId,
        condition: chosen,
        // Recorded so a fallback assignment is visible as one when the split is
        // audited — it bypassed the balancing.
        via: preferred ? "client-fallback" : "balanced",
        assigned_at: FieldValue.serverTimestamp(),
      });
      tx.set(
        countsRef,
        { ...tally, [chosen]: tally[chosen] + 1, updated_at: FieldValue.serverTimestamp() },
        { merge: true }
      );

      return chosen;
    });

    return NextResponse.json({ ok: true, condition });
  } catch (err) {
    console.error("Assignment failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

/** Current split, for checking balance during a run. */
export async function GET() {
  try {
    const counts = (await getFirestore().doc(COUNTS_DOC).get()).data() ?? {};
    const tally = Object.fromEntries(
      CONDITIONS.map((c) => [c, Number(counts[c]) || 0])
    );
    const total = Object.values(tally).reduce((a, b) => a + b, 0);
    return NextResponse.json({ ok: true, counts: tally, total });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
