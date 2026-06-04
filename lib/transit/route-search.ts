/**
 * Campus route search helpers.
 *
 * Contains pure utility functions for matching halte names, slicing the loop
 * route, and selecting the nearest online buggy candidate.
 */
import { OFFICIAL_ROUTE_PATH } from "@/lib/transit/buggy-data";
import { findNearestPathIndex } from "@/lib/transit/buggy-route-utils";
import type { Buggy, HaltePoint } from "@/types/buggy";

export type LatLng = { lat: number; lng: number };

/** Lowercase and trim input for tolerant halte-name matching. */
export function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/** Find a halte by case-insensitive name substring. */
export function findHalteByQuery(
  query: string,
  haltes: HaltePoint[],
): HaltePoint | null {
  const n = normalize(query);
  if (!n) return null;
  return haltes.find((h) => normalize(h.name).includes(n)) ?? null;
}

/** Jarak Euclidean sederhana untuk lat/lng ringan (urutan saja, bukan jarak fisik) */
export function cartesianDistance(a: LatLng, b: LatLng): number {
  return Math.hypot(a.lat - b.lat, a.lng - b.lng);
}

/**
 * Ekstrak segmen jalan antara dua titik di OFFICIAL_ROUTE_PATH (forward direction, wrapping).
 */
export function getRouteBetweenHaltes(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  routePath: [number, number][] = OFFICIAL_ROUTE_PATH,
): [number, number][] {
  const startIdx = findNearestPathIndex(originLat, originLng, routePath);
  const endIdx = findNearestPathIndex(destLat, destLng, routePath);
  const totalPoints = routePath.length;
  if (totalPoints === 0) return [];

  const path: [number, number][] = [];
  let cursor = startIdx;
  for (let i = 0; i < totalPoints; i += 1) {
    path.push(routePath[cursor]);
    if (cursor === endIdx) break;
    cursor = (cursor + 1) % totalPoints;
  }
  return path;
}

/** Buggy terdekat (Cartesian) ke posisi halte. Return null jika list kosong. */
export function findNearestBuggyToHalte(
  buggies: Buggy[],
  halte: LatLng,
): Buggy | null {
  if (buggies.length === 0) return null;
  return buggies.reduce<Buggy>((best, buggy) => {
    return cartesianDistance(buggy.position, halte) <
      cartesianDistance(best.position, halte)
      ? buggy
      : best;
  }, buggies[0]);
}

/**
 * Rangkaian nama halte sepanjang rute dari originIdx ke destIdx (forward, wrapping).
 */
export function routeStopNamesBetween(
  originIdx: number,
  destIdx: number,
  haltes: HaltePoint[],
): string[] {
  if (haltes.length === 0 || originIdx < 0 || destIdx < 0) return [];
  const names: string[] = [];
  let cursor = originIdx;
  while (true) {
    names.push(haltes[cursor].name);
    if (cursor === destIdx) break;
    cursor = (cursor + 1) % haltes.length;
  }
  return names;
}
