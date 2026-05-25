"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CENTER_UNDIP } from "@/lib/transit/buggy-data";
import { useLocale } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
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
  DESTINATION_PIN_ICON,
  buildBuggyIcon,
  buildHalteIcon,
  buildBuggyInfoContent,
} from "@/components/map/MapMarker";
import {
  DIRECTION_POLYLINE_OPTIONS,
  HISTORY_POLYLINE_OPTIONS,
  ROUTE_POLYLINE_OPTIONS,
  WALKING_POLYLINE_OPTIONS,
  buildPolylineEndpointIcon,
} from "@/components/map/MapPolyline";

// ─── Google Maps loader ──────────────────────────────────────────────────────

const SCRIPT_ID = "google-maps-script";
const CALLBACK_NAME = "__simobiGoogleMapsReady";

function getMapsApi(): MapsApi | null {
  return (window as GoogleMapsWindow).google?.maps ?? null;
}

function isMapsApiReady(maps: MapsApi | null): maps is MapsApi {
  return typeof maps?.Map === "function" && typeof maps.Marker === "function";
}

function waitForMapsApiReady(timeoutMs = 10_000): Promise<MapsApi> {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const maps = getMapsApi();

      if (isMapsApiReady(maps)) {
        resolve(maps);
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error("Google Maps JavaScript API tidak siap setelah load."));
        return;
      }

      window.setTimeout(check, 50);
    };

    check();
  });
}

function loadGoogleMapsScript(apiKey: string, locale: Locale): Promise<MapsApi> {
  const mapsApi = getMapsApi();
  if (isMapsApiReady(mapsApi)) return Promise.resolve(mapsApi);

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(
      SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existingScript) {
      waitForMapsApiReady().then(resolve).catch(reject);
      existingScript.addEventListener("error", () =>
        reject(new Error("Failed to load Google Maps script")),
      );
      return;
    }

    (
      window as unknown as GoogleMapsWindow &
        Record<typeof CALLBACK_NAME, () => void>
    )[CALLBACK_NAME] = () => {
      waitForMapsApiReady().then(resolve).catch(reject);
    };

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&libraries=marker&language=${locale}&callback=${CALLBACK_NAME}`;
    script.async = true;
    script.defer = true;
    script.onerror = () =>
      reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });
}

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

const USER_LOCATION_PULSE_MIN_RADIUS = 14;
const USER_LOCATION_PULSE_MAX_RADIUS = 48;
const USER_LOCATION_PULSE_DURATION_MS = 1700;

function getPathEndpoints(path: [number, number][]) {
  if (path.length < 2) return [];
  const [startLat, startLng] = path[0];
  const [endLat, endLng] = path[path.length - 1];

  return [
    { lat: startLat, lng: startLng },
    { lat: endLat, lng: endLng },
  ];
}

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
  selectedBuggyId,
  selectedHalteId,
  centerTarget,
  onInfoWindowClose,
  onMapClick,
  onBuggyMarkerClick,
  onHalteMarkerClick,
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
  const halteMarkersRef = useRef<Map<string, MarkerHandle>>(new Map());
  const infoWindowRef = useRef<InfoWindowHandle | null>(null);
  const routePolylineRef = useRef<PolylineHandle | null>(null);
  const directionPolylineRef = useRef<PolylineHandle | null>(null);
  const walkingToPolylineRef = useRef<PolylineHandle | null>(null);
  const walkingFromPolylineRef = useRef<PolylineHandle | null>(null);
  const routeEndpointMarkersRef = useRef<MarkerHandle[]>([]);
  const historyPolylineRef = useRef<PolylineHandle | null>(null);
  const userLocationMarkerRef = useRef<MarkerHandle | null>(null);
  const userLocationPulseRef = useRef<CircleHandle | null>(null);
  const userLocationPulseAnimationRef = useRef<number | null>(null);
  const originMarkerRef = useRef<MarkerHandle | null>(null);
  const destinationMarkerRef = useRef<MarkerHandle | null>(null);
  const geofenceCirclesRef = useRef<Map<string, CircleHandle>>(new Map());
  const draftCircleRef = useRef<CircleHandle | null>(null);
  const draftCircleListenersRef = useRef<{ remove: () => void }[]>([]);
  const isSyncingDraftCircleRef = useRef(false);
  const latestDraftGeofenceRef = useRef<typeof draftGeofence>(null);
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
  const draftGeofenceActive = draftGeofence !== null;

  useEffect(() => {
    latestDraftGeofenceRef.current = draftGeofence;
  }, [draftGeofence]);

  const stopUserLocationPulse = useCallback(() => {
    if (userLocationPulseAnimationRef.current === null) return;
    window.cancelAnimationFrame(userLocationPulseAnimationRef.current);
    userLocationPulseAnimationRef.current = null;
  }, []);

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

  // ── Initialize map ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || !apiKey) return;

    let isMounted = true;
    const buggyMarkers = buggyMarkersRef.current;
    const halteMarkers = halteMarkersRef.current;
    const geofenceCircles = geofenceCirclesRef.current;

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
      buggyMarkers.forEach((m) => m.setMap(null));
      halteMarkers.forEach((m) => m.setMap(null));
      buggyMarkers.clear();
      halteMarkers.clear();
      routePolylineRef.current?.setMap(null);
      directionPolylineRef.current?.setMap(null);
      walkingToPolylineRef.current?.setMap(null);
      walkingFromPolylineRef.current?.setMap(null);
      routeEndpointMarkersRef.current.forEach((marker) => marker.setMap(null));
      routeEndpointMarkersRef.current = [];
      historyPolylineRef.current?.setMap(null);
      stopUserLocationPulse();
      userLocationMarkerRef.current?.setMap(null);
      userLocationPulseRef.current?.setMap(null);
      originMarkerRef.current?.setMap(null);
      destinationMarkerRef.current?.setMap(null);
      geofenceCircles.forEach((circle) => circle.setMap(null));
      geofenceCircles.clear();
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
  }, [apiKey, locale, onInfoWindowClose, tErrors]);

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

  // ── Render current device/user location marker ───────────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapsApiRef.current) return;

    const map = mapInstanceRef.current;
    const maps = mapsApiRef.current;

    if (!userPosition) {
      stopUserLocationPulse();
      userLocationMarkerRef.current?.setMap(null);
      userLocationPulseRef.current?.setMap(null);
      userLocationMarkerRef.current = null;
      userLocationPulseRef.current = null;
      return;
    }

    if (userLocationMarkerRef.current) {
      userLocationMarkerRef.current.setPosition(userPosition);
      userLocationMarkerRef.current.setTitle(t("userLocation"));
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
      title: t("userLocation"),
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
    mapReady,
    startUserLocationPulse,
    stopUserLocationPulse,
    t,
    userPosition,
  ]);

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

  // ── Draft circle for geofence creation/editing ───────────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mapsApiRef.current) return;
    const currentDraft = latestDraftGeofenceRef.current;

    if (!currentDraft) {
      draftCircleListenersRef.current.forEach((l) => l.remove());
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
      const c = circle.getCenter();
      if (!c) return;
      onDraftGeofenceChange({ lat: c.lat(), lng: c.lng() }, circle.getRadius());
    };

    draftCircleListenersRef.current = [
      // Update center only after drag finishes — avoids React re-render loop
      circle.addListener("dragend", fireDraftChange),
      // Update radius live as user drags the resize handle
      circle.addListener("radius_changed", fireDraftChange),
    ];

    return () => {
      draftCircleListenersRef.current.forEach((l) => l.remove());
      draftCircleListenersRef.current = [];
      draftCircleRef.current?.setMap(null);
      draftCircleRef.current = null;
    };
  }, [
    draftGeofenceActive,
    mapReady,
    onDraftGeofenceChange,
  ]);

  // ── Sync draft circle when state changes from form/slider ────────────────

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
      const icon = buildBuggyIcon(maps, buggy.code, isSelected);

      if (existing) {
        existing.setPosition(buggy.position);
        existing.setTitle(`${buggy.name} - ETA ${buggy.etaMinutes} menit`);
        existing.setIcon(icon);
        return;
      }

      const marker = new maps.Marker({
        map,
        position: buggy.position,
        title: `${buggy.name} - ETA ${buggy.etaMinutes} menit`,
        icon,
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

    haltes.forEach((halte) => {
      const isSelected = selectedHalteId === halte.id;
      const existing = halteMarkersRef.current.get(halte.id);

      if (existing) {
        existing.setPosition({ lat: halte.lat, lng: halte.lng });
        existing.setTitle(halte.name);
        existing.setIcon(isSelected ? halteActiveIcon : halteIcon);
        return;
      }

      const marker = new maps.Marker({
        map,
        position: { lat: halte.lat, lng: halte.lng },
        title: halte.name,
        icon: isSelected ? halteActiveIcon : halteIcon,
        zIndex: isSelected ? 18 : 10,
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
  }, [haltes, mapReady, mapZoom, onHalteMarkerClick, selectedHalteId]);

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
