import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const client = await clientPromise;

  const db = client.db(process.env.MONGODB_DB);

  const scenario = await db.collection("scenarios")
    .findOne(
      { scenarioId: id },
      { projection: { _id: 0 } }
    );

  if (!scenario) {
    return NextResponse.json(
      { error: "Scenario not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(scenario);
}