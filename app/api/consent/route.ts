import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import getFirestore from "@/lib/firestore";

/**
 * Consent records, including the participant's name.
 *
 * Deliberately a separate `consents` collection rather than an event in `logs`.
 * The approved consent text says "Your data and consent form will be kept
 * separate" and that study data is "recorded by subject ID, not by name" — so
 * the name must not sit in the same collection every analysis reads. Nothing in
 * the export or the results page touches this collection.
 *
 * The subject ID is stored alongside, which is what makes the record useful:
 * it lets a researcher find who to pay, or honour a withdrawal request, without
 * a name ever appearing in the analysis data.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const subjectId = String(body?.subject_id ?? "").trim();
    const name = String(body?.name ?? "").trim();

    if (!subjectId || !name) {
      return NextResponse.json(
        { ok: false, error: "subject_id and name are required" },
        { status: 400 }
      );
    }

    // One document per subject, so re-submitting consent updates rather than
    // accumulating duplicates.
    await getFirestore()
      .collection("consents")
      .doc(encodeURIComponent(subjectId))
      .set({
        subject_id: subjectId,
        name,
        agreements: Array.isArray(body?.agreements) ? body.agreements : [],
        prolific_pid: body?.prolific_pid ?? null,
        env: process.env.VERCEL_ENV ?? "local",
        consented_at: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Consent record failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
