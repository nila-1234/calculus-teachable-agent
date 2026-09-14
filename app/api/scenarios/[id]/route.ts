import { NextResponse } from "next/server";
import getFirestore from "@/lib/firestore";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const snapshot = await getFirestore().collection("scenarios").doc(id).get();

  if (!snapshot.exists) {
    return NextResponse.json(
      { error: "Scenario not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(snapshot.data());
}
