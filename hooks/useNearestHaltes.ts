"use client";

/**
 * Nearest-halte derivation hook.
 *
 * Sorts runtime halte data by haversine distance to the user's current position
 * or a fallback point. It is pure memoized UI logic and performs no network IO.
 */
import { useMemo } from "react";
import { haversineMeters } from "@/lib/transit/buggy-route-utils";
import type { HaltePoint } from "@/types/buggy";
import type { LatLng } from "@/hooks/useUserPosition";

type UseNearestHaltesOptions = {
  haltes: HaltePoint[];
  userPosition: LatLng | null;
  fallback: LatLng;
  /** Number of nearest halte items to return. Defaults to 3. */
  limit?: number;
};

export type NearestHalte = HaltePoint & { distanceMeters: number };

/** Sort haltes by haversine distance to `userPosition` or `fallback`. */
export function useNearestHaltes({
  haltes,
  userPosition,
  fallback,
  limit = 3,
}: UseNearestHaltesOptions): NearestHalte[] {
  return useMemo(() => {
    const sourcePos = userPosition ?? fallback;

    return haltes
      .map((halte) => ({
        ...halte,
        distanceMeters: haversineMeters(sourcePos, {
          lat: halte.lat,
          lng: halte.lng,
        }),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);
  }, [haltes, userPosition, fallback, limit]);
}
