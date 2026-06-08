/**
 * Live buggy snapshot API.
 *
 * Returns the current fleet state for map panels by merging the process-local
 * live store with Supabase master data and latest telemetry. Hidden fleets are
 * removed here so every frontend surface receives the same visibility rules.
 */
import { NextResponse } from "next/server";
import { getBuggyApiSnapshot } from "@/lib/realtime/buggy-api-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getBuggyApiSnapshot();

  return NextResponse.json(snapshot.buggies, {
    headers: {
      "x-buggy-source": snapshot.source,
      "x-buggy-updated-at": String(snapshot.updatedAt),
    },
  });
}
