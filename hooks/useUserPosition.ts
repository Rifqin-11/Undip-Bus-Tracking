"use client";

/**
 * Browser geolocation hook.
 *
 * Watches the user's location continuously and exposes an on-demand high
 * accuracy getter. If a fresh request fails, callers can still use the cached
 * position already shown on the map.
 */
import { useCallback, useEffect, useState } from "react";

export type LatLng = { lat: number; lng: number };

/**
 * Tracks and caches the user's browser geolocation.
 * - `userPosition`: last known successful position, or `null`.
 * - `getLatestUserPosition`: high-accuracy refetch with cached fallback.
 */
export function useUserPosition() {
  const [userPosition, setUserPosition] = useState<LatLng | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // ignore — biarkan posisi tetap null/cached
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 5_000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const getLatestUserPosition = useCallback(async (): Promise<LatLng | null> => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      return userPosition;
    }

    return new Promise<LatLng | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latest: LatLng = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserPosition(latest);
          resolve(latest);
        },
        () => resolve(userPosition),
        { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
      );
    });
  }, [userPosition]);

  return { userPosition, getLatestUserPosition };
}
