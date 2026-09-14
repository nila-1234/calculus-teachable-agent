import { NextResponse } from "next/server";
import getFirestore from "@/lib/firestore";

export async function GET() {
  try {
    await getFirestore().collection("test").add({
      connected: true,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
