"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { Geofence } from "@/types/geofence";
import type {
  CircleHandle,
  LatLngLiteral,
  MapHandle,
  MapsApi,
} from "@/types/map-canvas";

type DraftGeofence = {
  center: LatLngLiteral;
  radiusMeters: number;
};

type UseGeofenceOverlaysOptions = {
  mapReady: boolean;
  mapInstanceRef: MutableRefObject<MapHandle | null>;
  mapsApiRef: MutableRefObject<MapsApi | null>;
  geofences: Geofence[];
  draftGeofence: DraftGeofence | null;
  onDraftGeofenceChange?: (
    center: LatLngLiteral,
    radiusMeters: number,
  ) => void;
};

export function useGeofenceOverlays({
  mapReady,
  mapInstanceRef,
  mapsApiRef,
  geofences,
  draftGeofence,
  onDraftGeofenceChange,
}: UseGeofenceOverlaysOptions) {
  const geofenceCirclesRef = useRef<Map<string, CircleHandle>>(new Map());
  const draftCircleRef = useRef<CircleHandle | null>(null);
  const draftCircleListenersRef = useRef<{ remove: () => void }[]>([]);
  const isSyncingDraftCircleRef = useRef(false);
  const latestDraftGeofenceRef = useRef<typeof draftGeofence>(null);
  const draftGeofenceActive = draftGeofence !== null;

  const clearGeofenceOverlays = useCallback(() => {
    geofenceCirclesRef.current.forEach((circle) => circle.setMap(null));
    geofenceCirclesRef.current.clear();
    draftCircleListenersRef.current.forEach((listener) => listener.remove());
    draftCircleListenersRef.current = [];
    draftCircleRef.current?.setMap(null);
    draftCircleRef.current = null;
  }, []);

  useEffect(() => {
    latestDraftGeofenceRef.current = draftGeofence;
  }, [draftGeofence]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapsApiRef.current) return;

    const map = mapInstanceRef.current;
    const maps = mapsApiRef.current;
    const geofenceCircles = geofenceCirclesRef.current;

    geofenceCircles.forEach((circle) => circle.setMap(null));
    geofenceCircles.clear();

    geofences.forEach((geofence) => {
      const isEnabled = geofence.enabled;
      const circle = new maps.Circle({
        map,
        center: geofence.center,
        radius: geofence.radiusMeters,
        clickable: false,
        strokeColor: isEnabled ? "#2563eb" : "#64748b",
        strokeOpacity: isEnabled ? 0.95 : 0.7,
        strokeWeight: 2,
        fillColor: isEnabled ? "#3b82f6" : "#94a3b8",
        fillOpacity: isEnabled ? 0.15 : 0.08,
        zIndex: 6,
      });
      geofenceCircles.set(geofence.id, circle);
    });
  }, [geofences, mapInstanceRef, mapReady, mapsApiRef]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapsApiRef.current) return;
    const currentDraft = latestDraftGeofenceRef.current;

    if (!currentDraft) {
      draftCircleListenersRef.current.forEach((listener) => listener.remove());
      draftCircleListenersRef.current = [];
      draftCircleRef.current?.setMap(null);
      draftCircleRef.current = null;
      return;
    }

    if (draftCircleRef.current) return;

    const map = mapInstanceRef.current;
    const maps = mapsApiRef.current;

    const circle = new maps.Circle({
      map,
      center: currentDraft.center,
      radius: currentDraft.radiusMeters,
      draggable: true,
      editable: true,
      strokeColor: "#16a34a",
      strokeOpacity: 0.9,
      strokeWeight: 2,
      fillColor: "#22c55e",
      fillOpacity: 0.15,
      zIndex: 10,
    });
    draftCircleRef.current = circle;

    // Pan only once when the draft is first opened. Re-panning on every radius
    // update makes the map feel like it refreshes while the user is editing.
    map.panTo(currentDraft.center);

    const fireDraftChange = () => {
      if (isSyncingDraftCircleRef.current) return;
      if (!onDraftGeofenceChange) return;
      const center = circle.getCenter();
      if (!center) return;
      onDraftGeofenceChange(
        { lat: center.lat(), lng: center.lng() },
        circle.getRadius(),
      );
    };

    draftCircleListenersRef.current = [
      circle.addListener("dragend", fireDraftChange),
      circle.addListener("radius_changed", fireDraftChange),
    ];

    return () => {
      draftCircleListenersRef.current.forEach((listener) => listener.remove());
      draftCircleListenersRef.current = [];
      draftCircleRef.current?.setMap(null);
      draftCircleRef.current = null;
    };
  }, [
    draftGeofenceActive,
    mapInstanceRef,
    mapReady,
    mapsApiRef,
    onDraftGeofenceChange,
  ]);

  useEffect(() => {
    if (!draftCircleRef.current || !draftGeofence) return;
    const circle = draftCircleRef.current;
    const currentCenter = circle.getCenter();
    const shouldSyncCenter =
      !currentCenter ||
      Math.abs(currentCenter.lat() - draftGeofence.center.lat) > 0.0000001 ||
      Math.abs(currentCenter.lng() - draftGeofence.center.lng) > 0.0000001;
    const shouldSyncRadius =
      Math.abs(circle.getRadius() - draftGeofence.radiusMeters) >= 0.5;

    if (!shouldSyncCenter && !shouldSyncRadius) return;

    isSyncingDraftCircleRef.current = true;
    if (shouldSyncCenter) circle.setCenter(draftGeofence.center);
    if (shouldSyncRadius) circle.setRadius(draftGeofence.radiusMeters);
    window.requestAnimationFrame(() => {
      isSyncingDraftCircleRef.current = false;
    });
  }, [draftGeofence]);

  useEffect(() => clearGeofenceOverlays, [clearGeofenceOverlays]);

  return { clearGeofenceOverlays };
}
