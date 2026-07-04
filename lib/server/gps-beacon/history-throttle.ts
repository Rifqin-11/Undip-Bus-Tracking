import { isKnownNoFixCoordinate, isSameGpsCoordinate } from "@/lib/buggy/gps-quality";
import { haversineMeters } from "@/lib/transit/buggy-route-utils";

// Membatasi insert ke Supabase maksimal 1 kali setiap 10 detik per buggy.
const HISTORY_INSERT_INTERVAL_MS = 10_000;
const HISTORY_DISTANCE_THRESHOLD_METERS = 10;
const HISTORY_SPEED_DELTA_THRESHOLD_KMH = 5;

const lastHistoryInsertPerBuggy: Record<
  string,
  { insertedAtMs: number; lat: number; lng: number; speedKmh: number }
> = {};

export function shouldInsertHistoryPoint(
  historyKey: string,
  lat: number,
  lng: number,
  speedKmh: number,
  now: number,
): boolean {
  const currentPoint = { lat, lng };
  if (isKnownNoFixCoordinate(currentPoint)) return false;

  const lastInsert = lastHistoryInsertPerBuggy[historyKey];
  if (!lastInsert) return true;
  if (isSameGpsCoordinate(lastInsert, currentPoint)) return false;

  const elapsedMs = now - lastInsert.insertedAtMs;
  const distanceMeters = haversineMeters(
    { lat: lastInsert.lat, lng: lastInsert.lng },
    { lat, lng },
  );
  const speedDeltaKmh = Math.abs(speedKmh - lastInsert.speedKmh);

  return (
    elapsedMs >= HISTORY_INSERT_INTERVAL_MS ||
    distanceMeters >= HISTORY_DISTANCE_THRESHOLD_METERS ||
    speedDeltaKmh >= HISTORY_SPEED_DELTA_THRESHOLD_KMH
  );
}

export function markHistoryPointInserted(
  historyKey: string,
  lat: number,
  lng: number,
  speedKmh: number,
  insertedAtMs: number,
) {
  lastHistoryInsertPerBuggy[historyKey] = {
    insertedAtMs,
    lat,
    lng,
    speedKmh,
  };
}
