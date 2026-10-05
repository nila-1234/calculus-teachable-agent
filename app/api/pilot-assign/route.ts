import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import getFirestore from "@/lib/firestore";

/**
 * Balanced A/B assignment for the pilot, in its own Firestore collections so it
 * never touches the main study's assignment or counts. Same one-transaction
 * balancing and idempotency as /api/assign: each new subject joins whichever
 * form has fewer participants; an already-assigned subject always gets back
 * the same form.
 */

export const dynamic = "force-dynamic";

const FORMS = ["A", "B"] as const;
type Form = (typeof FORMS)[number];

/**
 * TEMPORARY OVERRIDE — force every new assignment onto one form.
 * "B" collects the posttest only; set back to null to restore balanced A/B.
 * (A matching override exists in lib/pilot/condition.ts — flip both.)
 */
const FORCE_FORM: Form | null = "B";

const ASSIGNMENTS = "pilot_assignments";
const COUNTS_DOC = "pilot_assignment_counts/global";

function isForm(value: unknown): value is Form {
  return typeof value === "string" && (FORMS as readonly string[]).includes(value);
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

    const preferred = isForm(body?.preferred) ? body.preferred : null;

    const db = getFirestore();
    const subjectRef = db.collection(ASSIGNMENTS).doc(encodeURIComponent(subjectId));
    const countsRef = db.doc(COUNTS_DOC);

    const form = await db.runTransaction(async (tx) => {
      const existing = await tx.get(subjectRef);
      const already = existing.data()?.form;
      if (isForm(already)) return already;

      const counts = (await tx.get(countsRef)).data() ?? {};
      const tally = Object.fromEntries(
        FORMS.map((f) => [f, Number(counts[f]) || 0])
      ) as Record<Form, number>;

      let chosen: Form;
      if (FORCE_FORM) {
        chosen = FORCE_FORM;
      } else if (preferred) {
        chosen = preferred;
      } else {
        const fewest = Math.min(...FORMS.map((f) => tally[f]));
        const trailing = FORMS.filter((f) => tally[f] === fewest);
        chosen = trailing[Math.floor(Math.random() * trailing.length)];
      }

      tx.set(subjectRef, {
        subject_id: subjectId,
        form: chosen,
        via: FORCE_FORM ? "forced" : preferred ? "client-fallback" : "balanced",
        assigned_at: FieldValue.serverTimestamp(),
      });
      tx.set(
        countsRef,
        { ...tally, [chosen]: tally[chosen] + 1, updated_at: FieldValue.serverTimestamp() },
        { merge: true }
      );

      return chosen;
    });

    return NextResponse.json({ ok: true, form });
  } catch (err) {
    console.error("Pilot assignment failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

/** Current A/B split, for checking balance during the pilot. */
export async function GET() {
  try {
    const counts = (await getFirestore().doc(COUNTS_DOC).get()).data() ?? {};
    const tally = Object.fromEntries(FORMS.map((f) => [f, Number(counts[f]) || 0]));
    const total = Object.values(tally).reduce((a, b) => a + b, 0);
    return NextResponse.json({ ok: true, counts: tally, total });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
