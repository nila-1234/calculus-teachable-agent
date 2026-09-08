import { NextRequest, NextResponse } from "next/server";
import { MongoBulkWriteError, type Db } from "mongodb";
import getMongoClient from "@/lib/mongodb";

const DUPLICATE_KEY = 11000;

let indexesReady: Promise<void> | null = null;

/**
 * The client retries un-acknowledged batches, so the same event_id can arrive
 * more than once. A unique index turns those retries into duplicate-key errors
 * we can ignore instead of double-counting events in the analysis.
 */
function ensureIndexes(db: Db): Promise<void> {
  indexesReady ??= db
    .collection("logs")
    .createIndex({ event_id: 1 }, { unique: true, sparse: true })
    .then(() => undefined)
    .catch((err) => {
      indexesReady = null;
      throw err;
    });

  return indexesReady;
}

function getDbName(): string {
  const dbName = process.env.MONGODB_DB;
  if (!dbName) {
    // Without this, client.db(undefined) silently falls back to the database in
    // the connection string (or "test") and the run looks healthy while the
    // data lands somewhere nobody is looking.
    throw new Error("MONGODB_DB is not set");
  }
  return dbName;
}

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
    const receivedAt = new Date();
    const dbName = getDbName();

    const client = await getMongoClient();
    const db = client.db(dbName);
    await ensureIndexes(db);

    const documents = entries.map((entry) => ({
      ...(entry as Record<string, unknown>),
      env,
      received_at: receivedAt,
    }));

    let inserted = 0;
    try {
      const result = await db
        .collection("logs")
        .insertMany(documents, { ordered: false });
      inserted = result.insertedCount;
    } catch (err) {
      // With ordered:false the non-duplicate documents are still written, so a
      // batch that is purely retries is a success, not a failure.
      if (!(err instanceof MongoBulkWriteError)) throw err;

      const raw = err.writeErrors ?? [];
      const errors = Array.isArray(raw) ? raw : [raw];
      const onlyDuplicates =
        errors.length > 0 &&
        errors.every((writeError) => writeError.code === DUPLICATE_KEY);
      if (!onlyDuplicates) throw err;

      inserted = err.result?.insertedCount ?? 0;
    }

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
    const dbName = getDbName();
    const client = await getMongoClient();
    const db = client.db(dbName);

    await db.command({ ping: 1 });
    const logCount = await db.collection("logs").countDocuments();

    return NextResponse.json({
      ok: true,
      db: dbName,
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
