/**
 * Shared live snapshot builder for `/api/buggy` and `/api/buggy/stream`.
 *
 * The in-memory live store is fast, but production/serverless requests may not
 * always land on the same process that receives telemetry. This builder overlays
 * fleet master data and durable latest telemetry so refresh and realtime stream
 * expose the same fleet state.
 */
import { getBuggyLiveSnapshot } from "@/lib/realtime/buggy-live-store";
import { bootstrapFromDatabase } from "@/lib/supabase/data-loader";
import { mergeLatestBuggyTelemetry } from "@/lib/supabase/latest-buggy-telemetry";
import { createAdminClient } from "@/lib/supabase/server";
import type { Buggy, CrowdLevel } from "@/types/buggy";

type BuggyMasterRow = {
  id: string;
  code: string;
  name: string;
  capacity: number | null;
  numeric_id: number | null;
  is_active: boolean | null;
};

type BuggyLiveSource = "seed" | "ingest_snapshot" | "ingest_telemetry";

export type BuggyApiSnapshot = {
  source: BuggyLiveSource;
  updatedAt: number;
  buggies: Buggy[];
};

const SNAPSHOT_CACHE_TTL_MS = 3_000;

declare global {
  var __BUGGY_API_SNAPSHOT_CACHE__:
    | { cachedAt: number; snapshot: BuggyApiSnapshot }
    | undefined;
}

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
    .select("id, code, name, capacity, numeric_id, is_active");

  if (error || !data) {
    if (error) {
      console.warn("[buggy-api-snapshot] Gagal overlay master buggy:", error.message);
    }
    return buggies;
  }

  const rows = data as BuggyMasterRow[];
  const visibleRows = rows.filter((row) => row.is_active !== false);
  const byId = new Map(visibleRows.map((row) => [row.id, row]));
  const byNumericId = new Map(
    visibleRows
      .filter((row) => typeof row.numeric_id === "number")
      .map((row) => [row.numeric_id as number, row]),
  );
  const byCode = new Map(visibleRows.map((row) => [row.code, row]));

  return buggies.flatMap((buggy) => {
    const row =
      byId.get(buggy.id) ??
      (typeof buggy.numericId === "number"
        ? byNumericId.get(buggy.numericId)
        : undefined) ??
      byCode.get(buggy.code);

    if (!row) return [];

    const capacity =
      typeof row.capacity === "number" && Number.isFinite(row.capacity)
        ? Math.max(1, Math.round(row.capacity))
        : buggy.capacity;
    const passengers = Math.max(0, Math.min(buggy.passengers, capacity));

    return [{
      ...buggy,
      numericId: row.numeric_id ?? buggy.numericId,
      code: row.code,
      name: row.name,
      capacity,
      passengers,
      crowdLevel: resolveCrowdLevel(passengers, capacity),
    }];
  });
}

export async function getBuggyApiSnapshot(): Promise<BuggyApiSnapshot> {
  const cached = globalThis.__BUGGY_API_SNAPSHOT_CACHE__;
  const now = Date.now();
  if (cached && now - cached.cachedAt < SNAPSHOT_CACHE_TTL_MS) {
    return cached.snapshot;
  }

  await bootstrapFromDatabase();

  const snapshot = getBuggyLiveSnapshot();
  const masterSyncedBuggies = await overlayBuggyMasterData(snapshot.buggies);
  const latest = await mergeLatestBuggyTelemetry(masterSyncedBuggies);
  const hasLatestTelemetry = latest.mergedCount > 0;

  const apiSnapshot = {
    source: hasLatestTelemetry ? "ingest_telemetry" : snapshot.source,
    updatedAt: latest.updatedAt ?? snapshot.updatedAt,
    buggies: latest.buggies,
  };

  globalThis.__BUGGY_API_SNAPSHOT_CACHE__ = {
    cachedAt: now,
    snapshot: apiSnapshot,
  };

  return apiSnapshot;
}
