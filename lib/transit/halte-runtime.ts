/**
 * Mutable runtime halte store.
 *
 * Starts with the static HALTE_LOCATIONS from buggy-data.ts and can be
 * overridden at runtime with data fetched from Supabase (see data-loader.ts).
 * All server-side code that needs the halte list should call getHalteLocations()
 * instead of importing HALTE_LOCATIONS directly.
 */

import { HALTE_LOCATIONS as STATIC_HALTE_LOCATIONS } from "@/lib/transit/buggy-data";
import type { HaltePoint } from "@/types/buggy";

declare global {
  // eslint-disable-next-line no-var
  var __HALTE_RUNTIME__: HaltePoint[] | undefined;
}

/** Returns the current halte list (DB override if available, else static fallback). */
export function getHalteLocations(): HaltePoint[] {
  return globalThis.__HALTE_RUNTIME__ ?? STATIC_HALTE_LOCATIONS;
}

/** Override the runtime halte list (called by data-loader after DB fetch). */
export function setHalteLocations(haltes: HaltePoint[]): void {
  if (haltes.length > 0) {
    globalThis.__HALTE_RUNTIME__ = haltes;
  }
}

/** Returns whether the runtime list has been populated from DB. */
export function isHalteRuntimeReady(): boolean {
  return Array.isArray(globalThis.__HALTE_RUNTIME__);
}
