/**
 * Route geometry utilities.
 *
 * Provides distance, nearest-path, stop-order, and ETA helpers used by live map
 * positioning, history playback, and route recommendation logic.
 */
import { HALTE_LOCATIONS, OFFICIAL_ROUTE_PATH } from "@/lib/transit/buggy-data";
import { getHalteLocations } from "@/lib/transit/halte-runtime";
import type { Buggy, HaltePoint } from "@/types/buggy";

export type LatLng = {
  lat: number;
  lng: number;
};

const ROUTE_START_NAME = "Rusunawa Undip";
const OPERATIONAL_STOP_ORDER = [
  "Rusunawa Undip",
  "Pos Satpam Astina Undip",
  "Student Center",
  "Teknik Arsitektur",
  "Fakultas Hukum & Fisip",
  "Sekolah Vokasi & FIB",
  "Widya Puraya",
  "SA-MWA & FSM Barat",
  "Fakultas Psikologi",
  "Fakultas Ekonomika dan Bisnis",
  "Fakultas Kesehatan Masyarakat",
  "Fakultas Perikanan dan Kelautan",
  "Fakultas Peternakan dan Pertanian",
  "UPT Laboratorium Terpadu",
  "Bundaran Undip",
] as const;

// Anchor mengikuti urutan OFFICIAL_ROUTE_PATH. Rusunawa menjadi halte pertama
// operasional; Psikologi berada di cabang opsional sehingga progres dapat
// langsung bergerak dari SA-MWA ke anchor FEB saat cabang tersebut dilewati.
const OPERATIONAL_STOP_ROUTE_ANCHORS: Record<string, number> = {
  "Rusunawa Undip": 0,
  "Pos Satpam Astina Undip": 18,
  "Student Center": 21,
  "Teknik Arsitektur": 27,
  "Fakultas Hukum & Fisip": 32,
  "Sekolah Vokasi & FIB": 37,
  "Widya Puraya": 47,
  "SA-MWA & FSM Barat": 53,
  "Fakultas Psikologi": 68,
  "Fakultas Ekonomika dan Bisnis": 73,
  "Fakultas Kesehatan Masyarakat": 77,
  "Fakultas Perikanan dan Kelautan": 80,
  "Fakultas Peternakan dan Pertanian": 84,
  "UPT Laboratorium Terpadu": 92,
  "Bundaran Undip": 94,
};

function normalizeLoopIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function circularDistance(a: number, b: number, length: number): number {
  if (length <= 0) return 0;
  const delta = Math.abs(a - b);
  return Math.min(delta, length - delta);
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const radius = 6_371_000;
  const phi1 = (a.lat * Math.PI) / 180;
  const phi2 = (b.lat * Math.PI) / 180;
  const dPhi = ((b.lat - a.lat) * Math.PI) / 180;
  const dLambda = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function angularDeltaDegrees(a: number, b: number): number {
  const delta = Math.abs((((a - b) % 360) + 540) % 360 - 180);
  return Number.isFinite(delta) ? delta : 180;
}

function bearingDegrees(from: LatLng, to: LatLng): number {
  const phi1 = (from.lat * Math.PI) / 180;
  const phi2 = (to.lat * Math.PI) / 180;
  const dLambda = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function findNearestPathIndex(
  lat: number,
  lng: number,
  routePath: [number, number][] = OFFICIAL_ROUTE_PATH,
): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < routePath.length; i += 1) {
    const [pathLat, pathLng] = routePath[i];
    const distance = Math.hypot(pathLat - lat, pathLng - lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

export function findNearestRoutePoint(
  lat: number,
  lng: number,
  routePath: [number, number][] = OFFICIAL_ROUTE_PATH,
  options: {
    headingDegrees?: number | null;
    preferredIndex?: number;
  } = {},
): { lat: number; lng: number; index: number; distanceMeters: number } | null {
  if (routePath.length === 0) return null;
  if (routePath.length === 1) {
    const [pointLat, pointLng] = routePath[0];
    return {
      lat: pointLat,
      lng: pointLng,
      index: 0,
      distanceMeters: haversineMeters(
        { lat, lng },
        { lat: pointLat, lng: pointLng },
      ),
    };
  }

  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng =
    metersPerDegreeLat * Math.cos((lat * Math.PI) / 180);

  let best:
    | {
        lat: number;
        lng: number;
        index: number;
        distanceMeters: number;
        score: number;
      }
    | null = null;

  for (let i = 0; i < routePath.length - 1; i += 1) {
    const [startLat, startLng] = routePath[i];
    const [endLat, endLng] = routePath[i + 1];
    const ax = (startLng - lng) * metersPerDegreeLng;
    const ay = (startLat - lat) * metersPerDegreeLat;
    const bx = (endLng - lng) * metersPerDegreeLng;
    const by = (endLat - lat) * metersPerDegreeLat;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t =
      lengthSquared > 0
        ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared))
        : 0;
    const projectedX = ax + t * dx;
    const projectedY = ay + t * dy;
    const projectedLat = lat + projectedY / metersPerDegreeLat;
    const projectedLng = lng + projectedX / metersPerDegreeLng;
    const distanceMeters = haversineMeters(
      { lat, lng },
      { lat: projectedLat, lng: projectedLng },
    );
    const index = t >= 0.5 ? i + 1 : i;
    const segmentHeading = bearingDegrees(
      { lat: startLat, lng: startLng },
      { lat: endLat, lng: endLng },
    );
    const headingPenalty =
      typeof options.headingDegrees === "number" &&
      Number.isFinite(options.headingDegrees)
        ? angularDeltaDegrees(options.headingDegrees, segmentHeading) * 2
        : 0;
    const preferredIndexPenalty =
      typeof options.preferredIndex === "number" &&
      Number.isFinite(options.preferredIndex)
        ? circularDistance(index, options.preferredIndex, routePath.length) * 5
        : 0;
    const score = distanceMeters + headingPenalty + preferredIndexPenalty;

    if (!best || score < best.score) {
      best = {
        lat: projectedLat,
        lng: projectedLng,
        index,
        distanceMeters,
        score,
      };
    }
  }

  return best;
}

function buildRouteOrderedStopNames(
  haltes: HaltePoint[] = HALTE_LOCATIONS,
  routeStartName: string = ROUTE_START_NAME,
): string[] {
  const availableNames = new Set(haltes.map((halte) => halte.name));
  const configuredStops = OPERATIONAL_STOP_ORDER.filter((name) =>
    availableNames.has(name),
  );
  const configuredNames = new Set<string>(configuredStops);
  const unconfiguredStops = haltes
    .map((halte) => halte.name)
    .filter((name) => !configuredNames.has(name));
  const routeStops = [...configuredStops, ...unconfiguredStops];

  const routeStartIndex = routeStops.findIndex(
    (stopName) => stopName === routeStartName,
  );

  if (routeStartIndex < 0) {
    return routeStops;
  }

  return [
    ...routeStops.slice(routeStartIndex),
    ...routeStops.slice(0, routeStartIndex),
  ];
}

export function resolveCurrentHalteIndexFromRouteCursor(
  pathCursor: number,
  haltes: HaltePoint[] = getHalteLocations(),
): number {
  if (haltes.length === 0) return 0;

  const routeLength = Math.max(OFFICIAL_ROUTE_PATH.length, 1);
  const normalizedCursor = normalizeLoopIndex(
    Math.round(pathCursor),
    routeLength,
  );
  const unwrappedCursor =
    normalizedCursor < OPERATIONAL_STOP_ROUTE_ANCHORS[ROUTE_START_NAME]
      ? normalizedCursor + routeLength
      : normalizedCursor;

  let currentName = ROUTE_START_NAME;
  for (const stopName of OPERATIONAL_STOP_ORDER) {
    const anchor = OPERATIONAL_STOP_ROUTE_ANCHORS[stopName];
    if (anchor > unwrappedCursor) break;
    currentName = stopName;
  }

  const currentIndex = haltes.findIndex((halte) => halte.name === currentName);
  return currentIndex >= 0 ? currentIndex : 0;
}

/** Lazy — menggunakan data halte runtime (DB) jika tersedia, fallback ke static */
function getRouteOrderedStopNames(): string[] {
  return buildRouteOrderedStopNames(getHalteLocations());
}

/** Lazy map: name → {lat,lng} dari runtime halte (DB) */
function getHalteByName(): Map<string, { lat: number; lng: number }> {
  return new Map(
    getHalteLocations().map((halte) => [
      halte.name,
      { lat: halte.lat, lng: halte.lng },
    ]),
  );
}

export function getBuggyStopsInRouteOrder(
  buggy: Buggy,
  routeOrderedStops: string[] = getRouteOrderedStopNames(),
): string[] {
  const sourceStops = buggy.stops ?? [];
  if (sourceStops.length === 0) return routeOrderedStops;

  const availableStops = new Set(sourceStops);
  return routeOrderedStops.filter((stopName) => availableStops.has(stopName));
}

export function getBuggyCurrentRouteIndex(
  buggy: Buggy,
  stops: string[],
  haltes: HaltePoint[] = HALTE_LOCATIONS,
): number {
  if (stops.length === 0) return -1;

  const halteIndex = normalizeLoopIndex(buggy.currentStopIndex, haltes.length);
  const sourceStops = buggy.stops ?? [];
  const sourceIndex = normalizeLoopIndex(
    buggy.currentStopIndex,
    sourceStops.length,
  );

  const inferredCurrentName =
    (haltes[halteIndex] && stops.includes(haltes[halteIndex].name)
      ? haltes[halteIndex].name
      : null) ??
    (sourceStops[sourceIndex] && stops.includes(sourceStops[sourceIndex])
      ? sourceStops[sourceIndex]
      : null);

  const currentIndex = inferredCurrentName
    ? stops.indexOf(inferredCurrentName)
    : -1;
  return currentIndex >= 0 ? currentIndex : 0;
}

export function getBuggyStopNameAtOffset(buggy: Buggy, offset: number): string {
  const stops = getBuggyStopsInRouteOrder(buggy);
  if (stops.length === 0) return "-";

  const currentIndex = getBuggyCurrentRouteIndex(buggy, stops);
  const stopIndex = normalizeLoopIndex(currentIndex + offset, stops.length);
  return stops[stopIndex] ?? "-";
}

export function estimateMinutesBetweenStops(
  fromStopName: string,
  toStopName: string,
  speedKmh: number,
): number {
  const halteByName = getHalteByName();
  const from = halteByName.get(fromStopName);
  const to = halteByName.get(toStopName);
  if (!from || !to) return 2;

  const distanceMeters = haversineMeters(from, to);
  const speedMps = Math.max(1, speedKmh / 3.6);
  const minutes = Math.round(distanceMeters / speedMps / 60);
  return Math.max(1, minutes);
}
