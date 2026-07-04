"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type {
  CircleHandle,
  MapHandle,
  MapsApi,
  MarkerHandle,
} from "@/types/map-canvas";

const USER_LOCATION_PULSE_MIN_RADIUS = 14;
const USER_LOCATION_PULSE_MAX_RADIUS = 48;
const USER_LOCATION_PULSE_DURATION_MS = 1700;

type UseUserLocationMarkerOptions = {
  mapReady: boolean;
  mapInstanceRef: MutableRefObject<MapHandle | null>;
  mapsApiRef: MutableRefObject<MapsApi | null>;
  userPosition: { lat: number; lng: number } | null;
  title: string;
};

export function useUserLocationMarker({
  mapReady,
  mapInstanceRef,
  mapsApiRef,
  userPosition,
  title,
}: UseUserLocationMarkerOptions) {
  const userLocationMarkerRef = useRef<MarkerHandle | null>(null);
  const userLocationPulseRef = useRef<CircleHandle | null>(null);
  const userLocationPulseAnimationRef = useRef<number | null>(null);

  const stopUserLocationPulse = useCallback(() => {
    if (userLocationPulseAnimationRef.current === null) return;
    window.cancelAnimationFrame(userLocationPulseAnimationRef.current);
    userLocationPulseAnimationRef.current = null;
  }, []);

  const clearUserLocationMarker = useCallback(() => {
    stopUserLocationPulse();
    userLocationMarkerRef.current?.setMap(null);
    userLocationPulseRef.current?.setMap(null);
    userLocationMarkerRef.current = null;
    userLocationPulseRef.current = null;
  }, [stopUserLocationPulse]);

  const startUserLocationPulse = useCallback(() => {
    if (userLocationPulseAnimationRef.current !== null) return;

    const startedAt = performance.now();
    const animate = (time: number) => {
      const pulse = userLocationPulseRef.current;
      if (!pulse) {
        userLocationPulseAnimationRef.current = null;
        return;
      }

      const progress =
        ((time - startedAt) % USER_LOCATION_PULSE_DURATION_MS) /
        USER_LOCATION_PULSE_DURATION_MS;
      const eased = 1 - Math.pow(1 - progress, 3);
      const radius =
        USER_LOCATION_PULSE_MIN_RADIUS +
        (USER_LOCATION_PULSE_MAX_RADIUS - USER_LOCATION_PULSE_MIN_RADIUS) *
          eased;

      pulse.setRadius(radius);
      pulse.setOptions({
        strokeOpacity: 0.34 * (1 - progress),
        fillOpacity: 0.16 * (1 - progress),
      });

      userLocationPulseAnimationRef.current =
        window.requestAnimationFrame(animate);
    };

    userLocationPulseAnimationRef.current =
      window.requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapsApiRef.current) return;

    const map = mapInstanceRef.current;
    const maps = mapsApiRef.current;

    if (!userPosition) {
      clearUserLocationMarker();
      return;
    }

    if (userLocationMarkerRef.current) {
      userLocationMarkerRef.current.setPosition(userPosition);
      userLocationMarkerRef.current.setTitle(title);
      userLocationPulseRef.current?.setCenter(userPosition);
      startUserLocationPulse();
      return;
    }

    userLocationPulseRef.current = new maps.Circle({
      map,
      center: userPosition,
      radius: USER_LOCATION_PULSE_MIN_RADIUS,
      clickable: false,
      strokeColor: "#2563eb",
      strokeOpacity: 0.34,
      strokeWeight: 1,
      fillColor: "#3b82f6",
      fillOpacity: 0.16,
      zIndex: 28,
    });

    userLocationMarkerRef.current = new maps.Marker({
      map,
      position: userPosition,
      title,
      icon: {
        path: maps.SymbolPath.CIRCLE,
        fillColor: "#2563eb",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
        scale: 8,
      },
      zIndex: 35,
    });

    startUserLocationPulse();
  }, [
    clearUserLocationMarker,
    mapInstanceRef,
    mapReady,
    mapsApiRef,
    startUserLocationPulse,
    title,
    userPosition,
  ]);

  useEffect(() => clearUserLocationMarker, [clearUserLocationMarker]);

  return { clearUserLocationMarker };
}
