import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const env = process.env.VERCEL_ENV ?? "local";

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    await db.collection("logs").insertOne({ ...body, env });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Logging error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
