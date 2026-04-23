import type { BuggyHistoryEntry } from "@/types/buggy-history";

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function normalizeBuggyId(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return "-";
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
}

function getFirstDefined<T>(values: T[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null);
}

export function mapBuggyHistoryRow(
  row: Record<string, unknown>,
): BuggyHistoryEntry | null {
  const lat = asNumber(getFirstDefined([row.lat, row.latitude]));
  const lng = asNumber(getFirstDefined([row.lng, row.longitude, row.lon]));

  if (lat === null || lng === null) return null;

  const buggyId = normalizeBuggyId(
    getFirstDefined([row.buggy_id, row.buggyId, row.buggy, row.vehicle_id]),
  );

  const recordedAt = normalizeTimestamp(
    getFirstDefined([
      row.recorded_at,
      row.recordedAt,
      row.created_at,
      row.timestamp,
      row.updated_at,
    ]),
  );

  const idRaw = getFirstDefined([row.id, row.uuid, row.history_id]);
  const id =
    asString(idRaw) ??
    `${buggyId}-${recordedAt}-${lat.toFixed(6)}-${lng.toFixed(6)}`;

  return {
    id,
    buggyId,
    lat,
    lng,
    speedKmh: asNumber(
      getFirstDefined([row.speed_kmh, row.speedKmh, row.speed]),
    ),
    accuracy: asNumber(row.accuracy),
    heading: asNumber(row.heading),
    altitude: asNumber(row.altitude),
    source: asString(getFirstDefined([row.source, row.tag])),
    recordedAt,
    batteryLevel: asNumber(
      getFirstDefined([row.battery_level, row.batteryLevel, row.battery]),
    ),
  };
}

export function sortHistoryNewestFirst(
  entries: BuggyHistoryEntry[],
): BuggyHistoryEntry[] {
  return [...entries].sort((a, b) => {
    const ta = new Date(a.recordedAt).getTime();
    const tb = new Date(b.recordedAt).getTime();
    return tb - ta;
  });
}
