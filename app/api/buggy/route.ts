import { NextResponse } from "next/server";
import { getBuggyLiveSnapshot } from "@/lib/realtime/buggy-live-store";
import { bootstrapFromDatabase } from "@/lib/supabase/data-loader";
import { mergeLatestBuggyTelemetryFromHistory } from "@/lib/supabase/latest-buggy-telemetry";
import { createAdminClient } from "@/lib/supabase/server";
import type { Buggy, CrowdLevel } from "@/types/buggy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BuggyMasterRow = {
  id: string;
  code: string;
  name: string;
  capacity: number | null;
  numeric_id: number | null;
};

function resolveCrowdLevel(passengers: number, capacity: number): CrowdLevel {
  const ratio = capacity > 0 ? passengers / capacity : 0;
  if (ratio >= 0.85) return "PENUH";
  if (ratio >= 0.55) return "HAMPIR_PENUH";
  return "LONGGAR";
}

async function overlayBuggyMasterData(buggies: Buggy[]): Promise<Buggy[]> {
  const supabase = createAdminClient();
  if (!supabase || buggies.length === 0) return buggies;

  const { data, error } = await supabase
    .from("buggies")
    .select("id, code, name, capacity, numeric_id");

  if (error || !data) {
    if (error) {
      console.warn("[api/buggy] Gagal overlay master buggy:", error.message);
    }
    return buggies;
  }

  const rows = data as BuggyMasterRow[];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const byNumericId = new Map(
    rows
      .filter((row) => typeof row.numeric_id === "number")
      .map((row) => [row.numeric_id as number, row]),
  );
  const byCode = new Map(rows.map((row) => [row.code, row]));

  return buggies.map((buggy) => {
    const row =
      byId.get(buggy.id) ??
      (typeof buggy.numericId === "number"
        ? byNumericId.get(buggy.numericId)
        : undefined) ??
      byCode.get(buggy.code);

    if (!row) return buggy;

    const capacity =
      typeof row.capacity === "number" && Number.isFinite(row.capacity)
        ? Math.max(1, Math.round(row.capacity))
        : buggy.capacity;
    const passengers = Math.max(0, Math.min(buggy.passengers, capacity));

    return {
      ...buggy,
      numericId: row.numeric_id ?? buggy.numericId,
      code: row.code,
      name: row.name,
      capacity,
      passengers,
      crowdLevel: resolveCrowdLevel(passengers, capacity),
    };
  });
}

export async function GET() {
  // Lazy bootstrap: load data dari Supabase jika belum pernah dilakukan
  await bootstrapFromDatabase();

  const snapshot = getBuggyLiveSnapshot();
  const masterSyncedBuggies = await overlayBuggyMasterData(snapshot.buggies);
  const latest = await mergeLatestBuggyTelemetryFromHistory(masterSyncedBuggies);
  const hasHistoryTelemetry = latest.mergedCount > 0;

  return NextResponse.json(latest.buggies, {
    headers: {
      "x-buggy-source": hasHistoryTelemetry ? "ingest_telemetry" : snapshot.source,
      "x-buggy-updated-at": String(latest.updatedAt ?? snapshot.updatedAt),
    },
  });
}
