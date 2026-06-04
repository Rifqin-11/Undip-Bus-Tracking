/**
 * History stop-point detection.
 *
 * Derives meaningful halte stops from GPS playback by matching session points to
 * campus halte coordinates. Used by the history detail map and CSV exports.
 */
import { haversineMeters } from "@/lib/transit/buggy-route-utils";
import { HALTE_LOCATIONS } from "@/lib/transit/buggy-data";
import type { HaltePoint } from "@/types/buggy";

export type HistoryPathPoint = [number, number, number?, number?];

export type HistoryStopPoint = {
  halteId: string;
  halteName: string;
  lat: number;
  lng: number;
  startedAtMs?: number;
  endedAtMs?: number;
  durationSeconds?: number;
  pointCount: number;
  distanceMeters?: number;
};

const HALTE_STOP_RADIUS_METERS = 45;

function getTimestampMs(point: HistoryPathPoint): number | null {
  const value = point[2];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

type HalteMatchedPoint = {
  point: HistoryPathPoint;
  halte: HaltePoint;
  distanceMeters: number;
};

function findNearestHalteStop(
  point: HistoryPathPoint,
  haltes: HaltePoint[],
): HalteMatchedPoint | null {
  let nearest: HalteMatchedPoint | null = null;

  for (const halte of haltes) {
    const distanceMeters = haversineMeters(
      { lat: point[0], lng: point[1] },
      { lat: halte.lat, lng: halte.lng },
    );

    if (distanceMeters > HALTE_STOP_RADIUS_METERS) continue;
    if (nearest && nearest.distanceMeters <= distanceMeters) continue;

    nearest = { point, halte, distanceMeters };
  }

  return nearest;
}

function toStopPoint(cluster: HalteMatchedPoint[]): HistoryStopPoint | null {
  const first = cluster[0];
  if (!first) return null;

  const timestamps = cluster
    .map((entry) => getTimestampMs(entry.point))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  const averageDistanceMeters =
    cluster.reduce((sum, entry) => sum + entry.distanceMeters, 0) /
    cluster.length;

  return {
    halteId: first.halte.id,
    halteName: first.halte.name,
    lat: first.halte.lat,
    lng: first.halte.lng,
    startedAtMs: timestamps[0],
    endedAtMs: timestamps[timestamps.length - 1],
    durationSeconds:
      timestamps.length >= 2
        ? Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / 1000)
        : undefined,
    pointCount: cluster.length,
    distanceMeters: Math.round(averageDistanceMeters),
  };
}

export function detectHistoryStopPoints(
  path: HistoryPathPoint[],
  haltes: HaltePoint[] = HALTE_LOCATIONS,
): HistoryStopPoint[] {
  const stops: HistoryStopPoint[] = [];
  let cluster: HalteMatchedPoint[] = [];

  const flushCluster = () => {
    const stop = toStopPoint(cluster);
    if (stop) stops.push(stop);
    cluster = [];
  };

  for (const point of path) {
    const match = findNearestHalteStop(point, haltes);
    if (!match) {
      flushCluster();
      continue;
    }

    if (cluster.length === 0) {
      cluster = [match];
      continue;
    }

    const anchor = cluster[0];
    if (anchor.halte.id === match.halte.id) {
      cluster.push(match);
      continue;
    }

    flushCluster();
    cluster = [match];
  }

  flushCluster();
  return stops;
}
