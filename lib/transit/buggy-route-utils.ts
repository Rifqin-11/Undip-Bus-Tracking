import { HALTE_LOCATIONS, OFFICIAL_ROUTE_PATH } from "@/lib/transit/buggy-data";
import type { Buggy, HaltePoint } from "@/types/buggy";

export type LatLng = {
  lat: number;
  lng: number;
};

const ROUTE_START_NAME = "SA-MWA & FSM Barat";

function normalizeLoopIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
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

function buildRouteOrderedStopNames(
  haltes: HaltePoint[] = HALTE_LOCATIONS,
  routePath: [number, number][] = OFFICIAL_ROUTE_PATH,
  routeStartName: string = ROUTE_START_NAME,
): string[] {
  const stopsWithPathIndex = haltes
    .map((halte) => ({
      name: halte.name,
      pathIndex: findNearestPathIndex(halte.lat, halte.lng, routePath),
    }))
    .sort((a, b) => a.pathIndex - b.pathIndex);

  const routeStartIndex = stopsWithPathIndex.findIndex(
    (halte) => halte.name === routeStartName,
  );

  if (routeStartIndex < 0) {
    return stopsWithPathIndex.map((halte) => halte.name);
  }

  return [
    ...stopsWithPathIndex.slice(routeStartIndex),
    ...stopsWithPathIndex.slice(0, routeStartIndex),
  ].map((halte) => halte.name);
}

const ROUTE_ORDERED_STOP_NAMES = buildRouteOrderedStopNames();

const HALTE_BY_NAME = new Map(
  HALTE_LOCATIONS.map((halte) => [
    halte.name,
    { lat: halte.lat, lng: halte.lng },
  ]),
);

export function getRouteOrderedStopNames(): string[] {
  return ROUTE_ORDERED_STOP_NAMES;
}

export function getBuggyStopsInRouteOrder(
  buggy: Buggy,
  routeOrderedStops: string[] = ROUTE_ORDERED_STOP_NAMES,
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
  const from = HALTE_BY_NAME.get(fromStopName);
  const to = HALTE_BY_NAME.get(toStopName);
  if (!from || !to) return 2;

  const distanceMeters = haversineMeters(from, to);
  const speedMps = Math.max(1, speedKmh / 3.6);
  const minutes = Math.round(distanceMeters / speedMps / 60);
  return Math.max(1, minutes);
}
