import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;

    const db = client.db(process.env.MONGODB_DB);

    await db.collection("test").insertOne({
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