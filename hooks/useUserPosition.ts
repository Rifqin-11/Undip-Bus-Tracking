"use client";

import { useCallback, useEffect, useState } from "react";

export type LatLng = { lat: number; lng: number };

/**
 * Mengambil, memantau, dan men-cache posisi geolokasi user di browser.
 * - `userPosition`: posisi terakhir yang berhasil diambil (atau `null`)
 * - `getLatestUserPosition`: refetch on-demand (dengan accuracy tinggi); jatuh ke posisi cached jika gagal.
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
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 15_000 },
      );
    });
  }, [userPosition]);

  return { userPosition, getLatestUserPosition };
}
