import { OFFICIAL_ROUTE_PATH } from "@/lib/transit/buggy-data";
import { haversineMeters } from "@/lib/transit/buggy-route-utils";

type LatLng = {
  lat: number;
  lng: number;
};

export type TimestampedGpsPoint = LatLng & {
  recordedAt?: string;
};

export type GpsPathPoint = [number, number, number?];

const MAX_DISTANCE_FROM_ROUTE_METERS = 2_500;
const MAX_SEGMENT_SPEED_KMH = 90;
const MIN_SUSTAINED_JUMP_POINTS = 5;

export function isFiniteLatLng(point: LatLng): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

export function getDistanceFromOfficialRouteMeters(point: LatLng): number {
  if (!isFiniteLatLng(point)) return Number.POSITIVE_INFINITY;
  if (OFFICIAL_ROUTE_PATH.length === 0) return 0;

  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const [lat, lng] of OFFICIAL_ROUTE_PATH) {
    const distance = haversineMeters(point, { lat, lng });
    if (distance < nearestDistance) nearestDistance = distance;
  }

  return nearestDistance;
}

export function isPointInsideOperationalArea(point: LatLng): boolean {
  return getDistanceFromOfficialRouteMeters(point) <= MAX_DISTANCE_FROM_ROUTE_METERS;
}

function getPointTimeMs(point: TimestampedGpsPoint): number | null {
  if (!point.recordedAt) return null;
  const time = new Date(point.recordedAt).getTime();
  return Number.isFinite(time) ? time : null;
}

export function sanitizeGpsPoints<T extends TimestampedGpsPoint>(
  points: T[],
): T[] {
  const output: T[] = [];
  let jumpCandidates: T[] = [];

  for (const point of points) {
    if (!isFiniteLatLng(point)) continue;

    const previous = output[output.length - 1];
    if (!previous) {
      output.push(point);
      continue;
    }

    const currentTime = getPointTimeMs(point);
    const previousTime = getPointTimeMs(previous);
    const canMeasureSpeed =
      currentTime !== null && previousTime !== null && currentTime > previousTime;
    const elapsedHours = canMeasureSpeed
      ? (currentTime - previousTime) / 3_600_000
      : 0;
    const distanceKm = haversineMeters(previous, point) / 1000;
    const segmentSpeedKmh =
      canMeasureSpeed && elapsedHours > 0 ? distanceKm / elapsedHours : 0;
    const isJumpOutlier = canMeasureSpeed && segmentSpeedKmh > MAX_SEGMENT_SPEED_KMH;

    if (!isJumpOutlier) {
      jumpCandidates = [];
      output.push(point);
      continue;
    }

    jumpCandidates.push(point);

    if (jumpCandidates.length >= MIN_SUSTAINED_JUMP_POINTS) {
      output.push(...jumpCandidates);
      jumpCandidates = [];
    }
  }

  return output;
}

export function sanitizePath(path: GpsPathPoint[]): GpsPathPoint[] {
  return sanitizeGpsPoints(
    path.map(([lat, lng, tsMs]) => ({
      lat,
      lng,
      recordedAt:
        typeof tsMs === "number" && Number.isFinite(tsMs)
          ? new Date(tsMs).toISOString()
          : undefined,
      tsMs,
    })),
  ).map((point) =>
    typeof point.tsMs === "number"
      ? [point.lat, point.lng, point.tsMs]
      : [point.lat, point.lng],
  );
}

export function calculatePathDistanceKm(path: GpsPathPoint[]): number {
  let totalDistanceMeters = 0;

  for (let index = 1; index < path.length; index += 1) {
    totalDistanceMeters += haversineMeters(
      { lat: path[index - 1][0], lng: path[index - 1][1] },
      { lat: path[index][0], lng: path[index][1] },
    );
  }

  return totalDistanceMeters / 1000;
}
