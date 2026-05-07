"use client";

import { useMemo } from "react";
import { haversineMeters } from "@/lib/transit/buggy-route-utils";
import type { HaltePoint } from "@/types/buggy";
import type { LatLng } from "@/hooks/useUserPosition";

type UseNearestHaltesOptions = {
  haltes: HaltePoint[];
  userPosition: LatLng | null;
  fallback: LatLng;
  /** Berapa banyak halte teratas. Default 3. */
  limit?: number;
};

export type NearestHalte = HaltePoint & { distanceMeters: number };

/** Mengurutkan halte berdasar jarak haversine ke `userPosition` (atau `fallback`). */
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
