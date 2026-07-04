"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CENTER_UNDIP } from "@/lib/transit/buggy-data";
import { useLocale } from "@/lib/i18n/client";
import type {
  InfoWindowHandle,
  MapHandle,
  MapCanvasProps,
  MapsApi,
  MarkerHandle,
  PolylineHandle,
} from "@/types/map-canvas";
import {
  DESTINATION_PIN_ICON,
  buildBuggyIcon,
  buildHalteIcon,
  buildBuggyInfoContent,
} from "@/components/map/MapMarker";
import {
  DIRECTION_POLYLINE_OPTIONS,
  ROUTE_POLYLINE_OPTIONS,
  WALKING_POLYLINE_OPTIONS,
  buildPolylineEndpointIcon,
} from "@/components/map/MapPolyline";
import { loadGoogleMapsScript } from "@/components/map/google-maps-loader";
import {
  distanceMeters,
  easeOutCubic,
  getPathEndpoints,
} from "@/components/map/map-geometry";
import { useHistoryTrail } from "@/components/map/hooks/useHistoryTrail";
import { useUserLocationMarker } from "@/components/map/hooks/useUserLocationMarker";
import { useGeofenceOverlays } from "@/components/map/hooks/useGeofenceOverlays";

// ─── Component ───────────────────────────────────────────────────────────────

// Mapping dari preset SIMOBI → mapTypeId Google Maps.
const MAP_TYPE_ID_BY_STYLE: Record<
  "standard" | "satellite" | "terrain",
  string
> = {
  standard: "roadmap",
  satellite: "satellite",
  terrain: "terrain",
};

const BUGGY_MARKER_ANIMATION_MS = 850;
const BUGGY_MARKER_MAX_ANIMATE_METERS = 250;
const BUGGY_MARKER_MIN_ANIMATE_METERS = 0.75;

function getHalteIconSize(zoom: number, isSelected: boolean) {
  const baseSize = zoom <= 13 ? 16 : zoom <= 14 ? 20 : 24;
  return isSelected ? baseSize + 4 : baseSize;
}

export function MapCanvas({
  buggies,
  haltes,
  routePath,
  mapStyle = "standard",
  directionPath = [],
  walkingToHaltePath = [],
  walkingFromHaltePath = [],
  userPosition = null,
  originMarkerPosition,
  destinationMarkerPosition,
  geofences = [],
  geofenceCreateMode = false,
  draftGeofence = null,
  onDraftGeofenceChange,
  focusHaltes = false,
  historyPath = [],
  historyStopPoints = [],
  selectedBuggyId,
  selectedHalteId,
  centerTarget,
  onInfoWindowClose,
  onMapClick,
  onBuggyMarkerClick,
  onHalteMarkerClick,
  halteMarkersClickable = true,
}: MapCanvasProps) {
  const locale = useLocale();
  const { t } = useTranslation("dashboard");
  const { t: tErrors } = useTranslation("errors");
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapZoom, setMapZoom] = useState(15);

  const mapInstanceRef = useRef<MapHandle | null>(null);
  const mapsApiRef = useRef<MapsApi | null>(null);
  const buggyMarkersRef = useRef<Map<string, MarkerHandle>>(new Map());
  const buggyMarkerPositionsRef = useRef<
    Map<string, { lat: number; lng: number }>
  >(new Map());
  const buggyMarkerAnimationFramesRef = useRef<Map<string, number>>(new Map());
  const buggyMarkerIconKeysRef = useRef<Map<string, string>>(new Map());
  const halteMarkersRef = useRef<Map<string, MarkerHandle>>(new Map());
  const halteMarkerListenersRef = useRef<Map<string, { remove: () => void }>>(
    new Map(),
  );
  const infoWindowRef = useRef<InfoWindowHandle | null>(null);
  const routePolylineRef = useRef<PolylineHandle | null>(null);
  const directionPolylineRef = useRef<PolylineHandle | null>(null);
  const walkingToPolylineRef = useRef<PolylineHandle | null>(null);
  const walkingFromPolylineRef = useRef<PolylineHandle | null>(null);
  const routeEndpointMarkersRef = useRef<MarkerHandle[]>([]);
  const originMarkerRef = useRef<MarkerHandle | null>(null);
  const destinationMarkerRef = useRef<MarkerHandle | null>(null);
  const infoWindowCloseListenerRef = useRef<{ remove: () => void } | null>(
    null,
  );
  const mapClickListenerRef = useRef<{ remove: () => void } | null>(null);
  const mapDragStartListenerRef = useRef<{ remove: () => void } | null>(null);
  const mapZoomListenerRef = useRef<{ remove: () => void } | null>(null);
  const followSelectedBuggyRef = useRef(false);
  const lastSelectedBuggyIdRef = useRef<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const keyError = apiKey
    ? null
    : "Isi NEXT_PUBLIC_GOOGLE_MAPS_API_KEY agar peta dapat tampil.";
  const { clearHistoryTrail } = useHistoryTrail({
    mapReady,
    mapInstanceRef,
    mapsApiRef,
    infoWindowRef,
    historyPath,
    historyStopPoints,
    locale,
  });
  const { clearUserLocationMarker } = useUserLocationMarker({
    mapReady,
    mapInstanceRef,
    mapsApiRef,
    userPosition,
    title: t("userLocation"),
  });
  const { clearGeofenceOverlays } = useGeofenceOverlays({
    mapReady,
    mapInstanceRef,
    mapsApiRef,
    geofences,
    draftGeofence,
    onDraftGeofenceChange,
  });

  const setBuggyMarkerPosition = useCallback(
    (
      buggyId: string,
      marker: MarkerHandle,
      next: { lat: number; lng: number },
    ) => {
      const previousFrame = buggyMarkerAnimationFramesRef.current.get(buggyId);
      if (previousFrame !== undefined) {
        window.cancelAnimationFrame(previousFrame);
        buggyMarkerAnimationFramesRef.current.delete(buggyId);
      }

      const from = buggyMarkerPositionsRef.current.get(buggyId) ?? next;
      const distance = distanceMeters(from, next);
      const shouldAnimate =
        distance >= BUGGY_MARKER_MIN_ANIMATE_METERS &&
        distance <= BUGGY_MARKER_MAX_ANIMATE_METERS;

      if (!shouldAnimate) {
        marker.setPosition(next);
        buggyMarkerPositionsRef.current.set(buggyId, next);
        return;
      }

      const startedAt = performance.now();
      const animate = (now: number) => {
        const progress = Math.min(
          1,
          (now - startedAt) / BUGGY_MARKER_ANIMATION_MS,
        );
        const eased = easeOutCubic(progress);
        const current = {
          lat: from.lat + (next.lat - from.lat) * eased,
          lng: from.lng + (next.lng - from.lng) * eased,
        };

        marker.setPosition(current);
        buggyMarkerPositionsRef.current.set(buggyId, current);

        if (progress < 1) {
          const frame = window.requestAnimationFrame(animate);
          buggyMarkerAnimationFramesRef.current.set(buggyId, frame);
        } else {
          buggyMarkerAnimationFramesRef.current.delete(buggyId);
          buggyMarkerPositionsRef.current.set(buggyId, next);
        }
      };

      const frame = window.requestAnimationFrame(animate);
      buggyMarkerAnimationFramesRef.current.set(buggyId, frame);
    },
    [],
  );

  // ── Initialize map ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || !apiKey) return;

    let isMounted = true;
    const buggyMarkers = buggyMarkersRef.current;
    const buggyMarkerAnimationFrames =
      buggyMarkerAnimationFramesRef.current;
    const buggyMarkerPositions = buggyMarkerPositionsRef.current;
    const buggyMarkerIconKeys = buggyMarkerIconKeysRef.current;
    const halteMarkers = halteMarkersRef.current;
    const halteMarkerListeners = halteMarkerListenersRef.current;

    loadGoogleMapsScript(apiKey, locale)
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
          mapTypeId: MAP_TYPE_ID_BY_STYLE[mapStyle],
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
        setMapZoom(mapInstanceRef.current.getZoom() ?? 15);
        mapZoomListenerRef.current?.remove();
        mapZoomListenerRef.current = mapInstanceRef.current.addListener(
          "zoom_changed",
          () => {
            setMapZoom(mapInstanceRef.current?.getZoom() ?? 15);
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
            mapsApiRef.current.event.trigger(mapInstanceRef.current, "resize");
          }
        });
      })
      .catch((error: unknown) => {
        setErrorMessage(
          error instanceof Error ? error.message : tErrors("googleMapsLoad"),
        );
      });

    return () => {
      isMounted = false;
      buggyMarkerAnimationFrames.forEach((frame) =>
        window.cancelAnimationFrame(frame),
      );
      buggyMarkerAnimationFrames.clear();
      buggyMarkerPositions.clear();
      buggyMarkerIconKeys.clear();
      buggyMarkers.forEach((m) => m.setMap(null));
      halteMarkers.forEach((m) => m.setMap(null));
      halteMarkerListeners.forEach((listener) => listener.remove());
      buggyMarkers.clear();
      halteMarkers.clear();
      halteMarkerListeners.clear();
      routePolylineRef.current?.setMap(null);
      directionPolylineRef.current?.setMap(null);
      walkingToPolylineRef.current?.setMap(null);
      walkingFromPolylineRef.current?.setMap(null);
      routeEndpointMarkersRef.current.forEach((marker) => marker.setMap(null));
      routeEndpointMarkersRef.current = [];
      clearHistoryTrail();
      clearUserLocationMarker();
      originMarkerRef.current?.setMap(null);
      destinationMarkerRef.current?.setMap(null);
      clearGeofenceOverlays();
      mapClickListenerRef.current?.remove();
      mapDragStartListenerRef.current?.remove();
      mapZoomListenerRef.current?.remove();
      infoWindowCloseListenerRef.current?.remove();
      infoWindowRef.current?.close();
      mapClickListenerRef.current = null;
      mapDragStartListenerRef.current = null;
      mapZoomListenerRef.current = null;
      infoWindowCloseListenerRef.current = null;
      mapInstanceRef.current = null;
      followSelectedBuggyRef.current = false;
      lastSelectedBuggyIdRef.current = null;
      setMapReady(false);
    };
    // mapStyle sengaja tidak masuk deps: perubahannya di-handle di effect terpisah
    // (lihat di bawah) agar tidak re-init seluruh instance Google Maps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    apiKey,
    clearGeofenceOverlays,
    clearHistoryTrail,
    clearUserLocationMarker,
    locale,
    onInfoWindowClose,
    tErrors,
  ]);

  // ── Update map style on prop change ────────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    mapInstanceRef.current.setMapTypeId(MAP_TYPE_ID_BY_STYLE[mapStyle]);
  }, [mapReady, mapStyle]);

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

    routeEndpointMarkersRef.current.forEach((marker) => marker.setMap(null));
    routeEndpointMarkersRef.current = [];

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

    const endpointIcon = buildPolylineEndpointIcon(maps);
    const endpointPositions = [
      ...getPathEndpoints(walkingToHaltePath),
      ...getPathEndpoints(directionPath),
      ...getPathEndpoints(walkingFromHaltePath),
    ];

    routeEndpointMarkersRef.current = endpointPositions.map(
      (position, index) =>
        new maps.Marker({
          map,
          position,
          title: index % 2 === 0 ? "Awal garis" : "Akhir garis",
          icon: endpointIcon,
          zIndex: 30,
        }),
    );
  }, [directionPath, mapReady, walkingFromHaltePath, walkingToHaltePath]);

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
          title: t("originLabel"),
          icon: {
            path: maps.SymbolPath.CIRCLE,
            fillColor: "#fefefe",
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
          title: t("destination"),
          icon: DESTINATION_PIN_ICON,
          zIndex: 25,
        })
      : null;
  }, [destinationMarkerPosition, mapReady, originMarkerPosition, t]);

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
      const iconKey = `${buggy.code}:${isSelected ? "selected" : "normal"}:${buggy.connectionStatus ?? "unknown"}`;

      if (existing) {
        setBuggyMarkerPosition(buggy.id, existing, buggy.position);
        existing.setTitle(`${buggy.name} - ETA ${buggy.etaMinutes} menit`);
        if (buggyMarkerIconKeysRef.current.get(buggy.id) !== iconKey) {
          const icon = buildBuggyIcon(maps, buggy.code, isSelected, buggy);
          existing.setIcon(icon);
          buggyMarkerIconKeysRef.current.set(buggy.id, iconKey);
        }
        return;
      }

      const icon = buildBuggyIcon(maps, buggy.code, isSelected, buggy);
      const marker = new maps.Marker({
        map,
        position: buggy.position,
        title: `${buggy.name} - ETA ${buggy.etaMinutes} menit`,
        icon,
        zIndex: 20,
      });
      marker.addListener("click", () => onBuggyMarkerClick?.(buggy.id));
      buggyMarkersRef.current.set(buggy.id, marker);
      buggyMarkerPositionsRef.current.set(buggy.id, buggy.position);
      buggyMarkerIconKeysRef.current.set(buggy.id, iconKey);
    });

    buggyMarkersRef.current.forEach((marker, id) => {
      if (!buggyById.has(id)) {
        const frame = buggyMarkerAnimationFramesRef.current.get(id);
        if (frame !== undefined) {
          window.cancelAnimationFrame(frame);
          buggyMarkerAnimationFramesRef.current.delete(id);
        }
        buggyMarkerPositionsRef.current.delete(id);
        buggyMarkerIconKeysRef.current.delete(id);
        marker.setMap(null);
        buggyMarkersRef.current.delete(id);
      }
    });
  }, [
    buggies,
    mapReady,
    onBuggyMarkerClick,
    selectedBuggyId,
    setBuggyMarkerPosition,
  ]);

  // ── Render halte markers ───────────────────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapsApiRef.current) return;

    const map = mapInstanceRef.current;
    const maps = mapsApiRef.current;
    const halteById = new Map(haltes.map((h) => [h.id, h]));
    halteMarkerListenersRef.current.forEach((listener) => listener.remove());
    halteMarkerListenersRef.current.clear();
    const halteIcon = buildHalteIcon(
      maps,
      "default",
      getHalteIconSize(mapZoom, false),
    );
    const halteActiveIcon = buildHalteIcon(
      maps,
      "active",
      getHalteIconSize(mapZoom, true),
    );
    const buildHalteLabel = (name: string, isSelected: boolean) => ({
      text: name,
      className: `simobi-halte-marker-label${isSelected ? " simobi-halte-marker-label-active" : ""}`,
      color: isSelected ? "#92400e" : "#111827",
      fontSize: "8px",
      fontWeight: isSelected ? "700" : "500",
    });

    haltes.forEach((halte) => {
      const isSelected = selectedHalteId === halte.id;
      const existing = halteMarkersRef.current.get(halte.id);

      if (existing) {
        existing.setPosition({ lat: halte.lat, lng: halte.lng });
        existing.setTitle(halte.name);
        existing.setIcon(isSelected ? halteActiveIcon : halteIcon);
        existing.setLabel(buildHalteLabel(halte.name, isSelected));
        if (halteMarkersClickable) {
          const listener = existing.addListener("click", () =>
            onHalteMarkerClick?.(halte.id),
          );
          halteMarkerListenersRef.current.set(halte.id, listener);
        }
        return;
      }

      const marker = new maps.Marker({
        map,
        position: { lat: halte.lat, lng: halte.lng },
        title: halte.name,
        icon: isSelected ? halteActiveIcon : halteIcon,
        label: buildHalteLabel(halte.name, isSelected),
        zIndex: isSelected ? 18 : 10,
      });
      if (halteMarkersClickable) {
        const listener = marker.addListener("click", () =>
          onHalteMarkerClick?.(halte.id),
        );
        halteMarkerListenersRef.current.set(halte.id, listener);
      }
      halteMarkersRef.current.set(halte.id, marker);
    });

    halteMarkersRef.current.forEach((marker, id) => {
      if (!halteById.has(id)) {
        halteMarkerListenersRef.current.get(id)?.remove();
        halteMarkerListenersRef.current.delete(id);
        marker.setMap(null);
        halteMarkersRef.current.delete(id);
      }
    });
  }, [
    halteMarkersClickable,
    haltes,
    mapReady,
    mapZoom,
    onHalteMarkerClick,
    selectedHalteId,
  ]);

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
