import { haversineMeters } from "@/lib/transit/buggy-route-utils";

export type HistoryPathPoint = [number, number, number?];

export type HistoryStopPoint = {
  lat: number;
  lng: number;
  startedAtMs?: number;
  endedAtMs?: number;
  durationSeconds?: number;
  pointCount: number;
};

const STOP_CLUSTER_RADIUS_METERS = 12;
const STOP_MIN_DURATION_MS = 30_000;
const STOP_MIN_POINTS = 3;

function getTimestampMs(point: HistoryPathPoint): number | null {
  const value = point[2];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toStopPoint(cluster: HistoryPathPoint[]): HistoryStopPoint | null {
  if (cluster.length < STOP_MIN_POINTS) return null;

  const timestamps = cluster
    .map(getTimestampMs)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  if (timestamps.length >= 2) {
    const durationMs = timestamps[timestamps.length - 1] - timestamps[0];
    if (durationMs < STOP_MIN_DURATION_MS) return null;
  }

  const lat =
    cluster.reduce((sum, point) => sum + point[0], 0) / cluster.length;
  const lng =
    cluster.reduce((sum, point) => sum + point[1], 0) / cluster.length;

  return {
    lat,
    lng,
    startedAtMs: timestamps[0],
    endedAtMs: timestamps[timestamps.length - 1],
    durationSeconds:
      timestamps.length >= 2
        ? Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / 1000)
        : undefined,
    pointCount: cluster.length,
  };
}

export function detectHistoryStopPoints(
  path: HistoryPathPoint[],
): HistoryStopPoint[] {
  const stops: HistoryStopPoint[] = [];
  let cluster: HistoryPathPoint[] = [];

  const flushCluster = () => {
    const stop = toStopPoint(cluster);
    if (stop) stops.push(stop);
    cluster = [];
  };

  for (const point of path) {
    if (cluster.length === 0) {
      cluster = [point];
      continue;
    }

    const anchor = cluster[0];
    const distanceFromAnchor = haversineMeters(
      { lat: anchor[0], lng: anchor[1] },
      { lat: point[0], lng: point[1] },
    );

    if (distanceFromAnchor <= STOP_CLUSTER_RADIUS_METERS) {
      cluster.push(point);
      continue;
    }

    flushCluster();
    cluster = [point];
  }

  flushCluster();
  return stops;
}
