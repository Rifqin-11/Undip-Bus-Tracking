import { NextResponse } from "next/server";
import { getBuggyLiveSnapshot } from "@/lib/realtime/buggy-live-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = getBuggyLiveSnapshot();
  return NextResponse.json(snapshot.buggies, {
    headers: {
      "x-buggy-source": snapshot.source,
      "x-buggy-updated-at": String(snapshot.updatedAt),
    },
  });
}
