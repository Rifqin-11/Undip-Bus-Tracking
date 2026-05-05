import { NextResponse } from "next/server";
import { getBuggyLiveSnapshot } from "@/lib/realtime/buggy-live-store";
import { bootstrapFromDatabase } from "@/lib/supabase/data-loader";
import { mergeLatestBuggyTelemetryFromHistory } from "@/lib/supabase/latest-buggy-telemetry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Lazy bootstrap: load data dari Supabase jika belum pernah dilakukan
  await bootstrapFromDatabase();

  const snapshot = getBuggyLiveSnapshot();
  const latest = await mergeLatestBuggyTelemetryFromHistory(snapshot.buggies);
  const hasHistoryTelemetry = latest.mergedCount > 0;

  return NextResponse.json(latest.buggies, {
    headers: {
      "x-buggy-source": hasHistoryTelemetry ? "ingest_telemetry" : snapshot.source,
      "x-buggy-updated-at": String(latest.updatedAt ?? snapshot.updatedAt),
    },
  });
}
