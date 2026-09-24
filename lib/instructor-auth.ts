import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Shared gate for the instructor-only endpoints.
 *
 * Fails closed: an unset GRADING_EXPORT_TOKEN disables the endpoint entirely
 * rather than leaving it open, so forgetting to configure it cannot expose
 * participant data. Extracted so the export and the tree rebuild cannot drift
 * into two different ideas of who is allowed in.
 */

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Returns an error response to send back, or null when the caller is allowed. */
export function authorizeInstructor(req: NextRequest): NextResponse | null {
  const expected = process.env.GRADING_EXPORT_TOKEN?.trim();

  if (!expected) {
    return NextResponse.json(
      {
        error:
          "This endpoint is disabled. Set GRADING_EXPORT_TOKEN in the environment to enable it.",
      },
      { status: 503 }
    );
  }

  const provided =
    req.headers.get("x-grading-token")?.trim() ||
    req.nextUrl.searchParams.get("token")?.trim() ||
    "";

  if (!provided || !tokenMatches(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
