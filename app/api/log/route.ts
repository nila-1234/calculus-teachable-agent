import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const LOG_PATH = path.join(process.cwd(), "data", "logs.jsonl");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entry = JSON.stringify(body) + "\n";

    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, entry, "utf8");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Logging error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
