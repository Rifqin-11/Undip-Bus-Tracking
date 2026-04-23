"use client";

import { useEffect, useRef, useState } from "react";
import { CENTER_UNDIP } from "@/lib/transit/buggy-data";
import type {
  CircleHandle,
  GoogleMapsWindow,
  InfoWindowHandle,
  MapHandle,
  MapCanvasProps,
  MapsApi,
  MarkerHandle,
  PolylineHandle,
} from "@/types/map-canvas";
import {
  BUGGY_PIN_ICON,
  BUGGY_SELECTED_PIN_ICON,
  HALTE_PIN_ICON,
  HALTE_SELECTED_PIN_ICON,
  buildBuggyInfoContent,
} from "@/components/map/MapMarker";
import {
  DIRECTION_POLYLINE_OPTIONS,
  HISTORY_POLYLINE_OPTIONS,
  ROUTE_POLYLINE_OPTIONS,
  WALKING_POLYLINE_OPTIONS,
} from "@/components/map/MapPolyline";

// ─── Google Maps loader ──────────────────────────────────────────────────────

const SCRIPT_ID = "google-maps-script";

function getMapsApi(): MapsApi | null {
  return (window as GoogleMapsWindow).google?.maps ?? null;
}

function loadGoogleMapsScript(apiKey: string): Promise<MapsApi> {
  const mapsApi = getMapsApi();
  if (mapsApi) return Promise.resolve(mapsApi);

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(
      SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        const ready = getMapsApi();
        if (ready) resolve(ready);
      });
      existingScript.addEventListener("error", () =>
        reject(new Error("Failed to load Google Maps script")),
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      const ready = getMapsApi();
      if (!ready) {
        reject(new Error("Google Maps API not available after load"));
        return;
      }
      resolve(ready);
    };
    script.onerror = () =>
      reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MapCanvas({
  buggies,
  haltes,
  routePath,
  directionPath = [],
  walkingToHaltePath = [],
  walkingFromHaltePath = [],
  originMarkerPosition,
  destinationMarkerPosition,
  geofences = [],
  geofenceCreateMode = false,
  draftGeofence = null,
  onDraftGeofenceChange,
  focusHaltes = false,
  historyPath = [],
  selectedBuggyId,
  selectedHalteId,
  centerTarget,
  onInfoWindowClose,
  onMapClick,
  onBuggyMarkerClick,
  onHalteMarkerClick,
}: MapCanvasProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const mapInstanceRef = useRef<MapHandle | null>(null);
  const mapsApiRef = useRef<MapsApi | null>(null);
  const buggyMarkersRef = useRef<Map<string, MarkerHandle>>(new Map());
  const halteMarkersRef = useRef<Map<string, MarkerHandle>>(new Map());
  const infoWindowRef = useRef<InfoWindowHandle | null>(null);
  const routePolylineRef = useRef<PolylineHandle | null>(null);
  const directionPolylineRef = useRef<PolylineHandle | null>(null);
  const walkingToPolylineRef = useRef<PolylineHandle | null>(null);
  const walkingFromPolylineRef = useRef<PolylineHandle | null>(null);
  const historyPolylineRef = useRef<PolylineHandle | null>(null);
  const originMarkerRef = useRef<MarkerHandle | null>(null);
  const destinationMarkerRef = useRef<MarkerHandle | null>(null);
  const geofenceCirclesRef = useRef<Map<string, CircleHandle>>(new Map());
  const draftCircleRef = useRef<CircleHandle | null>(null);
  const draftCircleListenersRef = useRef<{ remove: () => void }[]>([]);
  const infoWindowCloseListenerRef = useRef<{ remove: () => void } | null>(
    null,
  );
  const mapClickListenerRef = useRef<{ remove: () => void } | null>(null);
  const mapDragStartListenerRef = useRef<{ remove: () => void } | null>(null);
  const followSelectedBuggyRef = useRef(false);
  const lastSelectedBuggyIdRef = useRef<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const keyError = apiKey
    ? null
    : "Isi NEXT_PUBLIC_GOOGLE_MAPS_API_KEY agar peta dapat tampil.";

  // ── Initialize map ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || !apiKey) return;

    let isMounted = true;
    const buggyMarkers = buggyMarkersRef.current;
    const halteMarkers = halteMarkersRef.current;
    const geofenceCircles = geofenceCirclesRef.current;

    loadGoogleMapsScript(apiKey)
      .then((maps) => {
        if (!isMounted || !mapRef.current) return;

        mapsApiRef.current = maps;
        mapInstanceRef.current = new maps.Map(mapRef.current, {
          center: { lat: CENTER_UNDIP[0], lng: CENTER_UNDIP[1] },
          zoom: 15,
          minZoom: 13,
          maxZoom: 19,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
          zoomControl: true,
          clickableIcons: false,
          styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
        });

        infoWindowRef.current = new maps.InfoWindow();
        mapDragStartListenerRef.current?.remove();
        mapDragStartListenerRef.current = mapInstanceRef.current.addListener(
          "dragstart",
          () => {
            followSelectedBuggyRef.current = false;
          },
        );
        infoWindowCloseListenerRef.current?.remove();
        infoWindowCloseListenerRef.current = infoWindowRef.current.addListener(
          "closeclick",
          () => onInfoWindowClose?.(),
        );

        setMapReady(true);
        setErrorMessage(null);

        // Trigger resize agar Google Maps mengisi container dengan benar
        // (penting untuk iOS Safari dengan safe area & dynamic viewport)
        requestAnimationFrame(() => {
          if (mapInstanceRef.current && mapsApiRef.current) {
            mapsApiRef.current.event.trigger(
              mapInstanceRef.current,
              "resize",
            );
          }
        });
      })
      .catch((error: unknown) => {
        setErrorMessage(
          error instanceof Error ? error.message : "Gagal memuat Google Maps.",
        );
      });

    return () => {
      isMounted = false;
      buggyMarkers.forEach((m) => m.setMap(null));
      halteMarkers.forEach((m) => m.setMap(null));
      buggyMarkers.clear();
      halteMarkers.clear();
      routePolylineRef.current?.setMap(null);
      directionPolylineRef.current?.setMap(null);
      walkingToPolylineRef.current?.setMap(null);
      walkingFromPolylineRef.current?.setMap(null);
      historyPolylineRef.current?.setMap(null);
      originMarkerRef.current?.setMap(null);
      destinationMarkerRef.current?.setMap(null);
      geofenceCircles.forEach((circle) => circle.setMap(null));
      geofenceCircles.clear();
      mapClickListenerRef.current?.remove();
      mapDragStartListenerRef.current?.remove();
      infoWindowCloseListenerRef.current?.remove();
      infoWindowRef.current?.close();
      mapClickListenerRef.current = null;
      mapDragStartListenerRef.current = null;
      infoWindowCloseListenerRef.current = null;
      mapInstanceRef.current = null;
      followSelectedBuggyRef.current = false;
      lastSelectedBuggyIdRef.current = null;
      setMapReady(false);
    };
  }, [apiKey, onInfoWindowClose]);

  // ── Render route polyline ──────────────────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapsApiRef.current) return;

    routePolylineRef.current?.setMap(null);
    routePolylineRef.current = new mapsApiRef.current.Polyline({
      map: mapInstanceRef.current,
      path: routePath.map(([lat, lng]) => ({ lat, lng })),
      ...ROUTE_POLYLINE_OPTIONS,
    });
  }, [mapReady, routePath]);

  // ── Render direction and walking polylines ───────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapsApiRef.current) return;

    const map = mapInstanceRef.current;
    const maps = mapsApiRef.current;

    directionPolylineRef.current?.setMap(null);
    directionPolylineRef.current =
      directionPath.length > 1
        ? new maps.Polyline({
            map,
            path: directionPath.map(([lat, lng]) => ({ lat, lng })),
            ...DIRECTION_POLYLINE_OPTIONS,
          })
        : null;

    walkingToPolylineRef.current?.setMap(null);
    walkingToPolylineRef.current =
      walkingToHaltePath.length > 1
        ? new maps.Polyline({
            map,
            path: walkingToHaltePath.map(([lat, lng]) => ({ lat, lng })),
            ...WALKING_POLYLINE_OPTIONS,
          })
        : null;

    walkingFromPolylineRef.current?.setMap(null);
    walkingFromPolylineRef.current =
      walkingFromHaltePath.length > 1
        ? new maps.Polyline({
            map,
            path: walkingFromHaltePath.map(([lat, lng]) => ({ lat, lng })),
            ...WALKING_POLYLINE_OPTIONS,
          })
        : null;
  }, [directionPath, mapReady, walkingFromHaltePath, walkingToHaltePath]);

  // ── Render GPS history trail polyline ────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapsApiRef.current) return;

    const map = mapInstanceRef.current;
    const maps = mapsApiRef.current;

    historyPolylineRef.current?.setMap(null);
    historyPolylineRef.current =
      historyPath.length > 1
        ? new maps.Polyline({
            map,
            path: historyPath.map(([lat, lng]) => ({ lat, lng })),
            ...HISTORY_POLYLINE_OPTIONS,
          })
        : null;
  }, [historyPath, mapReady]);

  // ── Render geofence circles ───────────────────────────────────────────────

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
  }, [geofences, mapReady]);

  // ── Render origin/destination markers (search result) ────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapsApiRef.current) return;

    const map = mapInstanceRef.current;
    const maps = mapsApiRef.current;

    originMarkerRef.current?.setMap(null);
    originMarkerRef.current = originMarkerPosition
      ? new maps.Marker({
          map,
          position: originMarkerPosition,
          title: "Titik awal",
          icon: {
            path: maps.SymbolPath.CIRCLE,
            fillColor: "#3b82f6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 7,
          },
          zIndex: 25,
        })
      : null;

    destinationMarkerRef.current?.setMap(null);
    destinationMarkerRef.current = destinationMarkerPosition
      ? new maps.Marker({
          map,
          position: destinationMarkerPosition,
          title: "Tujuan",
          icon: {
            path: maps.SymbolPath.CIRCLE,
            fillColor: "#ef4444",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 7,
          },
          zIndex: 25,
        })
      : null;
  }, [destinationMarkerPosition, mapReady, originMarkerPosition]);

  // ── Draft circle for geofence creation ───────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapsApiRef.current) return;

    // Cleanup previous draft
    draftCircleListenersRef.current.forEach((l) => l.remove());
    draftCircleListenersRef.current = [];
    draftCircleRef.current?.setMap(null);
    draftCircleRef.current = null;

    if (!draftGeofence) return;

    const map = mapInstanceRef.current;
    const maps = mapsApiRef.current;

    const circle = new maps.Circle({
      map,
      center: draftGeofence.center,
      radius: draftGeofence.radiusMeters,
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

    // Pan map to draft center
    map.panTo(draftGeofence.center);

    const fireCenterCb = () => {
      if (!onDraftGeofenceChange) return;
      const c = circle.getCenter();
      if (!c) return;
      onDraftGeofenceChange(
        { lat: c.lat(), lng: c.lng() },
        circle.getRadius(),
      );
    };

    const fireRadiusCb = () => {
      if (!onDraftGeofenceChange) return;
      const c = circle.getCenter();
      if (!c) return;
      onDraftGeofenceChange(
        { lat: c.lat(), lng: c.lng() },
        circle.getRadius(),
      );
    };

    draftCircleListenersRef.current = [
      // Update center only after drag finishes — avoids React re-render loop
      circle.addListener("dragend", fireCenterCb),
      // Update radius live as user drags the resize handle
      circle.addListener("radius_changed", fireRadiusCb),
    ];

    return () => {
      draftCircleListenersRef.current.forEach((l) => l.remove());
      draftCircleListenersRef.current = [];
      draftCircleRef.current?.setMap(null);
      draftCircleRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftGeofence?.center.lat, draftGeofence?.center.lng, draftGeofence?.radiusMeters, mapReady, onDraftGeofenceChange]);

  // ── Sync draft circle radius when slider changes ──────────────────────────

  useEffect(() => {
    if (!draftCircleRef.current || !draftGeofence) return;
    const current = draftCircleRef.current.getRadius();
    if (Math.abs(current - draftGeofence.radiusMeters) < 0.5) return;
    draftCircleRef.current.setRadius(draftGeofence.radiusMeters);
  }, [draftGeofence?.radiusMeters]);

  // ── Map click callback (kept for legacy fallback, inactive in create mode) ─

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !onMapClick) return;
    if (geofenceCreateMode) return; // draft circle mode — no click handler needed

    mapClickListenerRef.current?.remove();
    mapClickListenerRef.current = null;
    return () => {
      mapClickListenerRef.current?.remove();
      mapClickListenerRef.current = null;
    };
  }, [geofenceCreateMode, mapReady, onMapClick]);

  // ── Render buggy markers ───────────────────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapsApiRef.current) return;

    const map = mapInstanceRef.current;
    const maps = mapsApiRef.current;
    const buggyById = new Map(buggies.map((b) => [b.id, b]));

    buggies.forEach((buggy) => {
      const isSelected = selectedBuggyId === buggy.id;
      const existing = buggyMarkersRef.current.get(buggy.id);

      if (existing) {
        existing.setPosition(buggy.position);
        existing.setTitle(`${buggy.name} - ETA ${buggy.etaMinutes} menit`);
        existing.setIcon(isSelected ? BUGGY_SELECTED_PIN_ICON : BUGGY_PIN_ICON);
        return;
      }

      const marker = new maps.Marker({
        map,
        position: buggy.position,
        title: `${buggy.name} - ETA ${buggy.etaMinutes} menit`,
        label: { text: buggy.code, color: "#ffffff", fontWeight: "700" },
        icon: isSelected ? BUGGY_SELECTED_PIN_ICON : BUGGY_PIN_ICON,
        zIndex: 20,
      });
      marker.addListener("click", () => onBuggyMarkerClick?.(buggy.id));
      buggyMarkersRef.current.set(buggy.id, marker);
    });

    buggyMarkersRef.current.forEach((marker, id) => {
      if (!buggyById.has(id)) {
        marker.setMap(null);
        buggyMarkersRef.current.delete(id);
      }
    });
  }, [buggies, mapReady, onBuggyMarkerClick, selectedBuggyId]);

  // ── Render halte markers ───────────────────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapsApiRef.current) return;

    const map = mapInstanceRef.current;
    const maps = mapsApiRef.current;
    const halteById = new Map(haltes.map((h) => [h.id, h]));

    haltes.forEach((halte, index) => {
      const isSelected = selectedHalteId === halte.id;
      const existing = halteMarkersRef.current.get(halte.id);

      if (existing) {
        existing.setPosition({ lat: halte.lat, lng: halte.lng });
        existing.setTitle(halte.name);
        existing.setIcon(isSelected ? HALTE_SELECTED_PIN_ICON : HALTE_PIN_ICON);
        return;
      }

      const marker = new maps.Marker({
        map,
        position: { lat: halte.lat, lng: halte.lng },
        title: halte.name,
        label: { text: `H${index + 1}`, color: "#0f172a", fontWeight: "700" },
        icon: isSelected ? HALTE_SELECTED_PIN_ICON : HALTE_PIN_ICON,
        zIndex: 10,
      });
      marker.addListener("click", () => onHalteMarkerClick?.(halte.id));
      halteMarkersRef.current.set(halte.id, marker);
    });

    halteMarkersRef.current.forEach((marker, id) => {
      if (!halteById.has(id)) {
        marker.setMap(null);
        halteMarkersRef.current.delete(id);
      }
    });
  }, [haltes, mapReady, onHalteMarkerClick, selectedHalteId]);

  // ── Info window on selected buggy ──────────────────────────────────────────

  useEffect(() => {
    if (!mapInstanceRef.current || !infoWindowRef.current) return;

    const map = mapInstanceRef.current;
    const infoWindow = infoWindowRef.current;

    if (!selectedBuggyId) {
      infoWindow.close();
      followSelectedBuggyRef.current = false;
      lastSelectedBuggyIdRef.current = null;
      return;
    }

    if (lastSelectedBuggyIdRef.current !== selectedBuggyId) {
      followSelectedBuggyRef.current = true;
      lastSelectedBuggyIdRef.current = selectedBuggyId;
    }

    const selectedBuggy = buggies.find((b) => b.id === selectedBuggyId);
    const selectedMarker = buggyMarkersRef.current.get(selectedBuggyId);

    if (!selectedBuggy || !selectedMarker) {
      infoWindow.close();
      return;
    }

    infoWindow.setContent(buildBuggyInfoContent(selectedBuggy));
    infoWindow.open({ map, anchor: selectedMarker });

    if (followSelectedBuggyRef.current) {
      map.panTo(selectedBuggy.position);
    }
  }, [buggies, selectedBuggyId]);

  // ── Center on target (from search) ─────────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !centerTarget) return;
    mapInstanceRef.current.panTo(centerTarget);
  }, [centerTarget, mapReady]);

  // ── Focus map to all halte markers when halte view is active ─────────────

  useEffect(() => {
    if (
      !mapReady ||
      !mapInstanceRef.current ||
      !mapsApiRef.current ||
      !focusHaltes
    ) {
      return;
    }

    if (haltes.length === 0) return;

    const bounds = new mapsApiRef.current.LatLngBounds();
    haltes.forEach((halte) =>
      bounds.extend({ lat: halte.lat, lng: halte.lng }),
    );
    mapInstanceRef.current.fitBounds(bounds, 50);
  }, [focusHaltes, haltes, mapReady]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="absolute inset-0">
      <div ref={mapRef} className="absolute inset-0" />
      {(keyError ?? errorMessage) && (
        <div className="pointer-events-none absolute inset-x-4 top-4 rounded-2xl border border-amber-200 bg-amber-50/95 p-3 text-xs font-medium text-amber-800 shadow-lg md:inset-x-auto md:right-6 md:max-w-sm">
          {keyError ?? errorMessage}
        </div>
      )}
    </div>
  );
}
