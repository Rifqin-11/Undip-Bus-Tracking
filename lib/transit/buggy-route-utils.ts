import { HALTE_LOCATIONS, OFFICIAL_ROUTE_PATH } from "@/lib/transit/buggy-data";
import { getHalteLocations } from "@/lib/transit/halte-runtime";
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
  routeStartName: string = ROUTE_START_NAME,
): string[] {
  const routeStops = haltes.map((halte) => halte.name);

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
