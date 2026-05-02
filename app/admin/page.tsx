"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapCanvas } from "@/components/map/MapCanvas";
import { BuggyList } from "@/components/buggy/BuggyList";
import { FloatingSidebar } from "@/components/sidebar/FloatingSidebar";
import { MobileBottomNav } from "@/components/sidebar/MobileBottomNav";
import { LiveSearchBar } from "@/components/search/LiveSearchBar";
import { AdminDataSection } from "@/components/data/AdminDataSection";
import { BuggyOperationalDetail } from "@/components/data/BuggyOperationalDetail";
import { GeofenceManager } from "@/components/data/GeofenceManager";
import { HistoryPanel } from "@/components/history/HistoryPanel";
import { ToastStack } from "@/components/ui/ToastStack";
import type { ToastItem } from "@/components/ui/ToastStack";
import {
  CENTER_UNDIP,
  createInitialBuggies,
  HALTE_LOCATIONS,
  OFFICIAL_ROUTE_PATH,
} from "@/lib/transit/buggy-data";
import type { Buggy } from "@/types/buggy";
import { haversineMeters } from "@/lib/transit/buggy-route-utils";
import { useBuggyLiveFeed } from "@/hooks/useBuggyLiveFeed";
import { GoogleMapsService } from "@/lib/services/google-maps-service";
import type { PanelView } from "@/types/buggy";
import type { DirectionResult } from "@/components/panel/DirectionPanel";
import type { LatLngLiteral } from "@/types/map-canvas";
import type { Geofence, GeofenceEvent } from "@/types/geofence";
import { BellIcon, MapPinSolidIcon } from "@/components/ui/Icons";

const FALLBACK_BUGGIES = createInitialBuggies();
const GEOFENCE_DEFAULT_RADIUS_METERS = 100;
const GEOFENCE_EVENT_LIMIT = 100;
const GEOFENCE_EVENT_COOLDOWN_MS = 10_000;
const TOAST_LIMIT = 4;
const TOAST_TTL_MS = 4_500;

function makeId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function findHalteByQuery(query: string) {
  const n = normalize(query);
  return HALTE_LOCATIONS.find((h) => normalize(h.name).includes(n)) ?? null;
}

function dist(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  return Math.hypot(a.lat - b.lat, a.lng - b.lng);
}

/**
 * Find the closest index in OFFICIAL_ROUTE_PATH to a given halte position.
 */
function findNearestPathIndex(lat: number, lng: number): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < OFFICIAL_ROUTE_PATH.length; i++) {
    const d = Math.hypot(
      OFFICIAL_ROUTE_PATH[i][0] - lat,
      OFFICIAL_ROUTE_PATH[i][1] - lng,
    );
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Extract the actual road path segment between two haltes
 * by tracing along OFFICIAL_ROUTE_PATH (forward direction, wrapping).
 */
function getRouteBetweenHaltes(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): [number, number][] {
  const startIdx = findNearestPathIndex(originLat, originLng);
  const endIdx = findNearestPathIndex(destLat, destLng);
  const totalPoints = OFFICIAL_ROUTE_PATH.length;

  const path: [number, number][] = [];
  let cursor = startIdx;

  // Walk forward along the route (the bus goes in one direction in a loop)
  for (let i = 0; i < totalPoints; i++) {
    path.push(OFFICIAL_ROUTE_PATH[cursor]);
    if (cursor === endIdx) break;
    cursor = (cursor + 1) % totalPoints;
  }

  return path;
}

export default function DashboardPage() {
  const realtimeFeed = useBuggyLiveFeed();
  const liveBuggies = realtimeFeed.liveBuggies ?? FALLBACK_BUGGIES;

  const [activeView, setActiveView] = useState<PanelView>("buggy");
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedBuggyId, setSelectedBuggyId] = useState<string | null>(
    FALLBACK_BUGGIES[0]?.id ?? null,
  );
  const [mapFollowingBuggyId, setMapFollowingBuggyId] = useState<string | null>(
    FALLBACK_BUGGIES[0]?.id ?? null,
  );
  const [selectedHalteId, setSelectedHalteId] = useState<string | null>(null);

  const [searchStep, setSearchStep] = useState<"destination" | "origin">(
    "destination",
  );
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [directionResult, setDirectionResult] =
    useState<DirectionResult | null>(null);

  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [geofenceLoading, setGeofenceLoading] = useState(true);
  const [geofenceCreateMode, setGeofenceCreateMode] = useState(false);
  const [editingGeofenceId, setEditingGeofenceId] = useState<string | null>(null);
  const [draftGeofenceCenter, setDraftGeofenceCenter] =
    useState<LatLngLiteral | null>(null);
  const [draftGeofenceName, setDraftGeofenceName] = useState("");
  const [draftGeofenceRadius, setDraftGeofenceRadius] =
    useState(GEOFENCE_DEFAULT_RADIUS_METERS);
  const [geofenceEvents, setGeofenceEvents] = useState<GeofenceEvent[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [browserNotificationEnabled, setBrowserNotificationEnabled] =
    useState(false);
  const [historyPath, setHistoryPath] = useState<[number, number][]>([]);
  const [selectedAdminBuggyId, setSelectedAdminBuggyId] = useState<string | null>(null);

  const [userPosition, setUserPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
    );
  }, []);

  const nearestHalteRecommendations = useMemo(() => {
    const fallbackPos = liveBuggies[0]?.position ?? {
      lat: HALTE_LOCATIONS[0].lat,
      lng: HALTE_LOCATIONS[0].lng,
    };
    const sourcePos = userPosition ?? fallbackPos;

    return HALTE_LOCATIONS.map((halte) => ({
      ...halte,
      distanceMeters: haversineMeters(sourcePos, {
        lat: halte.lat,
        lng: halte.lng,
      }),
    }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 3);
  }, [liveBuggies, userPosition]);

  const getLatestUserPosition = useCallback(async () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      return userPosition;
    }
    return new Promise<{ lat: number; lng: number } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latest = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserPosition(latest);
          resolve(latest);
        },
        () => resolve(userPosition),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 15_000 }
      );
    });
  }, [userPosition]);

  const handleRecommendedHalteDirection = useCallback(
    async (halteId: string) => {
      const destinationHalte =
        HALTE_LOCATIONS.find((halte) => halte.id === halteId) ?? null;
      if (!destinationHalte) return;

      setIsSearching(true);

      try {
        if (
          !(window as Window & { google?: { maps?: unknown } }).google?.maps
        ) {
          alert("Google Maps belum loading. Coba lagi.");
          return;
        }

        const currentPos = await getLatestUserPosition();
        if (!currentPos) {
          alert(
            "Lokasi pengguna belum tersedia. Aktifkan izin lokasi lalu coba lagi.",
          );
          return;
        }

        const mapsService = GoogleMapsService.fromWindow();
        const originHalte = mapsService.findNearestHalte(
          currentPos,
          HALTE_LOCATIONS,
        );
        if (!originHalte) {
          alert("Halte asal terdekat tidak ditemukan.");
          return;
        }

        const walkToOriginHalte = await mapsService.getWalkingDirections(
          currentPos,
          { lat: originHalte.lat, lng: originHalte.lng },
        );

        const originIdx = HALTE_LOCATIONS.findIndex(
          (h) => h.id === originHalte.id,
        );
        const destIdx = HALTE_LOCATIONS.findIndex(
          (h) => h.id === destinationHalte.id,
        );
        if (originIdx < 0 || destIdx < 0) {
          return;
        }

        const routeStopNames: string[] = [];
        let cursor = originIdx;
        while (true) {
          routeStopNames.push(HALTE_LOCATIONS[cursor].name);
          if (cursor === destIdx) break;
          cursor = (cursor + 1) % HALTE_LOCATIONS.length;
        }

        const busRoutePath = getRouteBetweenHaltes(
          originHalte.lat,
          originHalte.lng,
          destinationHalte.lat,
          destinationHalte.lng,
        );

        const nearest = liveBuggies.reduce((best, buggy) => {
          if (!best) return buggy;
          return dist(buggy.position, originHalte) <
            dist(best.position, originHalte)
            ? buggy
            : best;
        }, liveBuggies[0]);

        setFromInput("Lokasi Saya");
        setToInput(destinationHalte.name);
        setSearchStep("origin");
        setSelectedHalteId(destinationHalte.id);

        setDirectionResult({
          originName: "Lokasi Saya",
          destinationName: destinationHalte.name,
          originPosition: currentPos,
          destinationPosition: {
            lat: destinationHalte.lat,
            lng: destinationHalte.lng,
          },
          routeStopNames,
          nearestBuggyName: nearest?.name,
          nearestBuggyId: nearest?.id,
          directionPath: busRoutePath,
          walkingToHalte: walkToOriginHalte
            ? {
                originHalteName: originHalte.name,
                distance: walkToOriginHalte.totalDistance,
                duration: walkToOriginHalte.totalDuration,
                path: walkToOriginHalte.decodedPath,
              }
            : undefined,
        });

        if (nearest) {
          setSelectedBuggyId(nearest.id);
          setMapFollowingBuggyId(nearest.id);
        }
        setActiveView("buggy");
        setPanelOpen(true);
      } catch (err) {
        console.error("Recommendation direction error:", err);
        alert("Terjadi kesalahan saat membuat rute dari lokasi Anda.");
      } finally {
        setIsSearching(false);
      }
    },
    [getLatestUserPosition, liveBuggies],
  );

  const geofenceMembershipRef = useRef<Map<string, boolean>>(new Map());
  const geofenceCooldownRef = useRef<Map<string, number>>(new Map());
  const notificationPermissionRequestedRef = useRef(false);

  const pushToast = useCallback(
    (title: string, description?: string, tone: ToastItem["tone"] = "info") => {
      const id = makeId();
      setToasts((prev) =>
        [{ id, title, description, tone }, ...prev].slice(0, TOAST_LIMIT),
      );
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, TOAST_TTL_MS);
    },
    [],
  );

  /** Simulasikan notifikasi bus mendekati halte — untuk keperluan testing */
  const handleTestBusNotification = useCallback(() => {
    const sampleBuggy = liveBuggies[0];
    const sampleHalte = HALTE_LOCATIONS[0];
    const busName = sampleBuggy?.name ?? "Buggy 1";
    const halteName = sampleHalte?.name ?? "Halte Utama";
    const fakeDistance = Math.floor(Math.random() * 120) + 10;

    const id = makeId();
    setToasts((prev) =>
      [{
        id,
        tone: "bus" as ToastItem["tone"],
        title: `${busName} mendekati halte Anda`,
        description: `${halteName} · ${fakeDistance} m lagi`,
        duration: 7_000,
      }, ...prev].slice(0, TOAST_LIMIT),
    );
  }, [liveBuggies]);

  const loadGeofences = useCallback(async () => {
    setGeofenceLoading(true);
    try {
      const response = await fetch("/api/geofences", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Gagal memuat geofence.");
      }
      const data: unknown = await response.json();
      setGeofences(Array.isArray(data) ? (data as Geofence[]) : []);
    } catch (error) {
      console.error("Load geofence error:", error);
      pushToast("Gagal memuat geofence", "Coba refresh halaman.", "warning");
      setGeofences([]);
    } finally {
      setGeofenceLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void loadGeofences();
  }, [loadGeofences]);

  const handleSelectView = (view: PanelView) => {
    setActiveView(view);
    setPanelOpen(true);
    // Clear history path when leaving history view
    if (view !== "history") {
      setHistoryPath([]);
    }
    // Clear admin detail when explicitly navigating away
    if (view !== "data-detail") {
      setSelectedAdminBuggyId(null);
    }
  };

  const handleSelectAdminBuggy = useCallback((buggyId: string) => {
    setSelectedAdminBuggyId(buggyId);
    setActiveView("data-detail");
    setPanelOpen(true);
  }, []);

  const handleInfoWindowClose = useCallback(() => {
    setMapFollowingBuggyId(null);
  }, []);

  const handleBuggyMarkerClick = useCallback((buggyId: string) => {
    setPanelOpen(true);
    setActiveView("buggy");
    setSelectedBuggyId(buggyId);
    setMapFollowingBuggyId(buggyId);
  }, []);

  const handleHalteMarkerClick = useCallback((halteId: string) => {
    setPanelOpen(true);
    setActiveView("halte");
    setSelectedHalteId(halteId);
  }, []);

  const handleFocusBuggy = useCallback((buggyId: string) => {
    setSelectedBuggyId(buggyId);
    setMapFollowingBuggyId(buggyId);
  }, []);

  const handleSelectBuggy = useCallback((buggyId: string) => {
    setSelectedBuggyId(buggyId);
    setMapFollowingBuggyId(buggyId);
  }, []);

  const handleSelectHalte = useCallback((halteId: string) => {
    setSelectedHalteId(halteId);
  }, []);


  const handleToggleCreateMode = useCallback(() => {
    setGeofenceCreateMode((prev) => {
      const next = !prev;
      if (next) {
        setEditingGeofenceId(null);
        // Place draft at current map center (CENTER_UNDIP as fallback)
        setDraftGeofenceCenter({ lat: CENTER_UNDIP[0], lng: CENTER_UNDIP[1] });
        setDraftGeofenceRadius(GEOFENCE_DEFAULT_RADIUS_METERS);
        setDraftGeofenceName(
          `Zona ${String(geofences.length + 1).padStart(2, "0")}`,
        );
      } else {
        setEditingGeofenceId(null);
        setDraftGeofenceCenter(null);
        setDraftGeofenceName("");
        setDraftGeofenceRadius(GEOFENCE_DEFAULT_RADIUS_METERS);
      }
      return next;
    });
    setPanelOpen(true);
    setActiveView("data");
  }, [geofences.length]);

  const handleEditGeofence = useCallback((geofence: Geofence) => {
    setEditingGeofenceId(geofence.id);
    setDraftGeofenceCenter(geofence.center);
    setDraftGeofenceName(geofence.name);
    setDraftGeofenceRadius(geofence.radiusMeters);
    setGeofenceCreateMode(true);
    setPanelOpen(true);
    setActiveView("data");
  }, []);

  const handleDraftGeofenceChange = useCallback(
    (center: LatLngLiteral, radiusMeters: number) => {
      setDraftGeofenceCenter(center);
      setDraftGeofenceRadius(radiusMeters);
    },
    [],
  );

  const handleCancelDraft = useCallback(() => {
    setEditingGeofenceId(null);
    setDraftGeofenceCenter(null);
    setDraftGeofenceName("");
    setDraftGeofenceRadius(GEOFENCE_DEFAULT_RADIUS_METERS);
    setGeofenceCreateMode(false);
  }, []);

  const handleSaveDraft = useCallback(async () => {
    if (!draftGeofenceCenter) return;
    const name = draftGeofenceName.trim();
    if (!name) {
      pushToast("Nama zona wajib diisi", undefined, "warning");
      return;
    }
    if (!Number.isFinite(draftGeofenceRadius) || draftGeofenceRadius <= 0) {
      pushToast("Radius tidak valid", "Isi radius > 0 meter.", "warning");
      return;
    }
    try {
      const isEdit = !!editingGeofenceId;
      const url = isEdit ? `/api/geofences/${editingGeofenceId}` : "/api/geofences";
      const response = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          center: draftGeofenceCenter,
          radiusMeters: draftGeofenceRadius,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message ?? "Gagal menyimpan geofence.");
      }
      const createdOrUpdated = (await response.json()) as Geofence;

      if (isEdit) {
        setGeofences((prev) => prev.map(g => g.id === editingGeofenceId ? createdOrUpdated : g));
      } else {
        setGeofences((prev) => [...prev, createdOrUpdated]);
      }

      setDraftGeofenceCenter(null);
      setDraftGeofenceName("");
      setDraftGeofenceRadius(GEOFENCE_DEFAULT_RADIUS_METERS);
      setGeofenceCreateMode(false);
      setEditingGeofenceId(null);
      pushToast(isEdit ? "Zona berhasil diperbarui" : "Zona berhasil dibuat", createdOrUpdated.name, "success");
    } catch (error) {
      console.error("Save geofence error:", error);
      pushToast(
        "Gagal menyimpan zona",
        error instanceof Error ? error.message : "Terjadi kesalahan.",
        "warning",
      );
    }
  }, [draftGeofenceCenter, draftGeofenceName, draftGeofenceRadius, editingGeofenceId, pushToast]);

  const handleToggleGeofence = useCallback(
    async (id: string, enabled: boolean) => {
      try {
        const response = await fetch(`/api/geofences/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        });

        if (!response.ok) {
          const data = (await response.json()) as { message?: string };
          throw new Error(data.message ?? "Gagal mengubah status geofence.");
        }

        const updated = (await response.json()) as Geofence;
        setGeofences((prev) =>
          prev.map((item) => (item.id === id ? updated : item)),
        );
        pushToast(
          `Geofence ${updated.enabled ? "diaktifkan" : "dinonaktifkan"}`,
          updated.name,
          "success",
        );
      } catch (error) {
        console.error("Toggle geofence error:", error);
        pushToast(
          "Gagal mengubah geofence",
          error instanceof Error ? error.message : "Terjadi kesalahan.",
          "warning",
        );
      }
    },
    [pushToast],
  );

  const handleDeleteGeofence = useCallback(
    async (id: string) => {
      const target = geofences.find((item) => item.id === id);
      try {
        const response = await fetch(`/api/geofences/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const data = (await response.json()) as { message?: string };
          throw new Error(data.message ?? "Gagal menghapus geofence.");
        }

        setGeofences((prev) => prev.filter((item) => item.id !== id));
        geofenceMembershipRef.current.forEach((_, key) => {
          if (key.endsWith(`:${id}`)) {
            geofenceMembershipRef.current.delete(key);
          }
        });
        pushToast("Geofence dihapus", target?.name, "success");
        return true;
      } catch (error) {
        console.error("Delete geofence error:", error);
        pushToast(
          "Gagal menghapus geofence",
          error instanceof Error ? error.message : "Terjadi kesalahan.",
          "warning",
        );
        return false;
      }
    },
    [geofences, pushToast],
  );

  const handleToggleBrowserNotification = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      pushToast(
        "Browser Notification tidak didukung",
        "Gunakan browser modern untuk fitur ini.",
        "warning",
      );
      return;
    }

    if (browserNotificationEnabled) {
      setBrowserNotificationEnabled(false);
      pushToast("Browser Notification dimatikan", undefined, "info");
      return;
    }

    if (Notification.permission === "granted") {
      setBrowserNotificationEnabled(true);
      pushToast("Browser Notification aktif", undefined, "success");
      return;
    }

    if (Notification.permission === "denied") {
      pushToast(
        "Izin notifikasi ditolak",
        "Izinkan notifikasi dari pengaturan browser jika ingin mengaktifkan.",
        "warning",
      );
      return;
    }

    if (notificationPermissionRequestedRef.current) {
      pushToast("Izin notifikasi belum diberikan", undefined, "warning");
      return;
    }

    notificationPermissionRequestedRef.current = true;
    const result = await Notification.requestPermission();
    if (result === "granted") {
      setBrowserNotificationEnabled(true);
      pushToast("Browser Notification aktif", undefined, "success");
      return;
    }

    pushToast(
      "Browser Notification tetap nonaktif",
      "Permission tidak diberikan.",
      "warning",
    );
  }, [browserNotificationEnabled, pushToast]);

  const emitGeofenceEvent = useCallback(
    (event: GeofenceEvent) => {
      setGeofenceEvents((prev) =>
        [event, ...prev].slice(0, GEOFENCE_EVENT_LIMIT),
      );

      const actionLabel = event.type === "ENTER" ? "masuk" : "keluar";
      pushToast(
        `${event.buggyName} ${actionLabel}`,
        `${event.geofenceName} • ${new Date(event.timestamp).toLocaleTimeString("id-ID")}`,
        event.type === "ENTER" ? "success" : "warning",
      );

      if (
        browserNotificationEnabled &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification(`Geofence ${event.type}`, {
          body: `${event.buggyName} ${actionLabel} ${event.geofenceName}`,
        });
      }
    },
    [browserNotificationEnabled, pushToast],
  );

  const geofenceStatuses = useMemo(() => {
    const statusByBuggy: Record<string, string[]> = {};
    const activeGeofences = geofences.filter((geofence) => geofence.enabled);
    if (activeGeofences.length === 0) return statusByBuggy;

    liveBuggies.forEach((buggy) => {
      const activeZoneNames: string[] = [];
      activeGeofences.forEach((geofence) => {
        const inside =
          haversineMeters(buggy.position, geofence.center) <=
          geofence.radiusMeters;
        if (inside) activeZoneNames.push(geofence.name);
      });

      if (activeZoneNames.length > 0) {
        statusByBuggy[buggy.id] = activeZoneNames;
      }
    });

    return statusByBuggy;
  }, [geofences, liveBuggies]);

  useEffect(() => {
    const activeGeofences = geofences.filter((geofence) => geofence.enabled);
    const previousMembership = geofenceMembershipRef.current;
    const nextMembership = new Map<string, boolean>();

    if (activeGeofences.length === 0) {
      geofenceMembershipRef.current = nextMembership;
      return;
    }

    const now = Date.now();

    liveBuggies.forEach((buggy) => {
      activeGeofences.forEach((geofence) => {
        const key = `${buggy.id}:${geofence.id}`;
        const inside =
          haversineMeters(buggy.position, geofence.center) <=
          geofence.radiusMeters;
        const previous = previousMembership.get(key);

        nextMembership.set(key, inside);

        if (typeof previous !== "boolean" || previous === inside) return;

        const type = inside ? "ENTER" : "EXIT";
        const cooldownKey = `${key}:${type}`;
        const lastTriggerAt = geofenceCooldownRef.current.get(cooldownKey) ?? 0;

        if (now - lastTriggerAt < GEOFENCE_EVENT_COOLDOWN_MS) {
          return;
        }

        geofenceCooldownRef.current.set(cooldownKey, now);

        emitGeofenceEvent({
          id: makeId(),
          buggyId: buggy.id,
          buggyName: buggy.name,
          geofenceId: geofence.id,
          geofenceName: geofence.name,
          type,
          timestamp: new Date().toISOString(),
          position: {
            lat: buggy.position.lat,
            lng: buggy.position.lng,
          },
        });
      });
    });

    geofenceMembershipRef.current = nextMembership;
  }, [emitGeofenceEvent, geofences, liveBuggies]);

  // ── Direction search ─────────────────────────────────────────────────────

  const handleDirectionSearch = async () => {
    if (searchStep === "destination") {
      if (!normalize(toInput)) return;
      setSearchStep("origin");
      return;
    }

    setIsSearching(true);

    try {
      if (!(window as Window & { google?: { maps?: unknown } }).google?.maps) {
        alert("Google Maps belum loading. Coba lagi.");
        setIsSearching(false);
        return;
      }

      const mapsService = GoogleMapsService.fromWindow();

      // Resolve origin
      let originHalte = findHalteByQuery(fromInput);
      let walkingToHalte: DirectionResult["walkingToHalte"];
      let originPos: { lat: number; lng: number };

      // Jika fromInput kosong, otomatis gunakan posisi GPS user
      const effectiveFrom = normalize(fromInput);
      if (!effectiveFrom) {
        const currentPos = await getLatestUserPosition();
        if (currentPos) {
          originPos = currentPos;
          setFromInput("Lokasi Saya");
          originHalte = mapsService.findNearestHalte(
            currentPos,
            HALTE_LOCATIONS,
          );
          if (!originHalte) {
            alert("Halte terdekat dari lokasi Anda tidak ditemukan.");
            setIsSearching(false);
            return;
          }
          const walk = await mapsService.getWalkingDirections(currentPos, {
            lat: originHalte.lat,
            lng: originHalte.lng,
          });
          if (walk) {
            walkingToHalte = {
              originHalteName: originHalte.name,
              distance: walk.totalDistance,
              duration: walk.totalDuration,
              path: walk.decodedPath,
            };
          }
        } else {
          alert("Aktifkan izin lokasi atau ketik lokasi asal Anda.");
          setIsSearching(false);
          return;
        }
      } else if (!originHalte) {
        const geocoded = await mapsService.geocodePlace(fromInput);
        if (!geocoded) {
          alert(
            `Lokasi "${fromInput}" tidak ditemukan. Coba nama lengkap + UNDIP.`,
          );
          setIsSearching(false);
          return;
        }
        originPos = { lat: geocoded.lat, lng: geocoded.lng };
        originHalte = mapsService.findNearestHalte(geocoded, HALTE_LOCATIONS);
        if (!originHalte) {
          setIsSearching(false);
          return;
        }

        const walk = await mapsService.getWalkingDirections(geocoded, {
          lat: originHalte.lat,
          lng: originHalte.lng,
        });
        if (walk) {
          walkingToHalte = {
            originHalteName: originHalte.name,
            distance: walk.totalDistance,
            duration: walk.totalDuration,
            path: walk.decodedPath,
          };
        }
      } else {
        originPos = { lat: originHalte.lat, lng: originHalte.lng };
      }

      // Resolve destination
      let destHalte = findHalteByQuery(toInput);
      let walkingFromHalte: DirectionResult["walkingFromHalte"];
      let destPos: { lat: number; lng: number };

      if (!destHalte) {
        const geocoded = await mapsService.geocodePlace(toInput);
        if (!geocoded) {
          alert(
            `Lokasi "${toInput}" tidak ditemukan. Coba nama lengkap + UNDIP.`,
          );
          setIsSearching(false);
          return;
        }
        destPos = { lat: geocoded.lat, lng: geocoded.lng };
        destHalte = mapsService.findNearestHalte(geocoded, HALTE_LOCATIONS);
        if (!destHalte) {
          setIsSearching(false);
          return;
        }

        const walk = await mapsService.getWalkingDirections(
          { lat: destHalte.lat, lng: destHalte.lng },
          geocoded,
        );
        if (walk) {
          walkingFromHalte = {
            destinationHalteName: destHalte.name,
            distance: walk.totalDistance,
            duration: walk.totalDuration,
            path: walk.decodedPath,
          };
        }
      } else {
        destPos = { lat: destHalte.lat, lng: destHalte.lng };
      }

      const originIdx = HALTE_LOCATIONS.findIndex(
        (h) => h.id === originHalte?.id,
      );
      const destIdx = HALTE_LOCATIONS.findIndex((h) => h.id === destHalte?.id);
      if (originIdx < 0 || destIdx < 0) {
        setIsSearching(false);
        return;
      }

      const routeStopNames: string[] = [];
      let cursor = originIdx;
      while (true) {
        routeStopNames.push(HALTE_LOCATIONS[cursor].name);
        if (cursor === destIdx) break;
        cursor = (cursor + 1) % HALTE_LOCATIONS.length;
      }

      const busRoutePath = getRouteBetweenHaltes(
        originHalte!.lat,
        originHalte!.lng,
        destHalte!.lat,
        destHalte!.lng,
      );

      const nearest = liveBuggies.reduce((best, b) => {
        if (!best) return b;
        return dist(b.position, originHalte!) <
          dist(best.position, originHalte!)
          ? b
          : best;
      }, liveBuggies[0]);

      if (!nearest) {
        setIsSearching(false);
        return;
      }

      setDirectionResult({
        originName: fromInput,
        destinationName: toInput,
        originPosition: originPos,
        destinationPosition: destPos,
        routeStopNames,
        nearestBuggyName: nearest.name,
        nearestBuggyId: nearest.id,
        directionPath: busRoutePath,
        walkingToHalte,
        walkingFromHalte,
      });

      setSelectedBuggyId(nearest.id);
      setMapFollowingBuggyId(nearest.id);
      setActiveView("buggy");
      setPanelOpen(true);
    } catch (err) {
      console.error("Direction search error:", err);
      alert("Terjadi kesalahan saat mencari rute.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleBackToDestination = () => {
    setSearchStep("destination");
    setFromInput("");
    setDirectionResult(null);
  };

  const mapBuggies = activeView === "halte" ? [] : liveBuggies;
  const mapRoutePath = activeView === "buggy" ? OFFICIAL_ROUTE_PATH : [];
  const mapDirectionPath =
    activeView === "buggy" ? (directionResult?.directionPath ?? []) : [];
  const mapHistoryPath = activeView === "history" ? historyPath : [];

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-100">
      <MapCanvas
        buggies={mapBuggies}
        haltes={HALTE_LOCATIONS}
        routePath={mapRoutePath}
        directionPath={mapDirectionPath}
        walkingToHaltePath={directionResult?.walkingToHalte?.path}
        walkingFromHaltePath={directionResult?.walkingFromHalte?.path}
        originMarkerPosition={directionResult?.originPosition}
        destinationMarkerPosition={directionResult?.destinationPosition}
        selectedBuggyId={mapFollowingBuggyId}
        selectedHalteId={selectedHalteId}
        geofences={geofences}
        geofenceCreateMode={geofenceCreateMode}
        draftGeofence={
          geofenceCreateMode && draftGeofenceCenter
            ? { center: draftGeofenceCenter, radiusMeters: draftGeofenceRadius }
            : null
        }
        onDraftGeofenceChange={handleDraftGeofenceChange}
        onInfoWindowClose={handleInfoWindowClose}
        onBuggyMarkerClick={handleBuggyMarkerClick}
        onHalteMarkerClick={handleHalteMarkerClick}
        focusHaltes={activeView === "halte"}
        historyPath={mapHistoryPath}
      />

      {/* Gradient overlay for mobile view */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-52 bg-linear-to-b from-slate-900/45 via-slate-900/20 to-transparent xl:hidden" />

      <section
        className="absolute inset-x-0 z-40 flex items-center justify-between px-4 xl:hidden"
        style={{ top: "calc(0.75rem + var(--sai-top, 0px))" }}
      >
        <h1 className="text-[26px] font-bold tracking-tight text-white drop-shadow-md">
          SIMOBI
        </h1>

        <button
          type="button"
          aria-label="Test notifikasi bus"
          title="Test notifikasi bus mendekati"
          onClick={handleTestBusNotification}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-900/50 text-white backdrop-blur-md transition hover:bg-slate-800/70 active:scale-95"
        >
          <BellIcon className="h-5 w-5" />
          {/* Badge TEST */}
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[7px] font-black text-slate-900 leading-none">
            T
          </span>
        </button>
      </section>

      <section
        className={`absolute left-1/2 z-40 w-[min(92vw,420px)] -translate-x-1/2 xl:hidden ${
          searchStep === "origin" ? "top-40" : "top-28"
        }`}
      >
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {nearestHalteRecommendations.map((halte) => (
            <button
              key={halte.id}
              type="button"
              className="shrink-0 flex items-center gap-2 rounded-full border border-white/35 bg-slate-900/50 px-3 py-1.5 text-white backdrop-blur-md transition active:scale-[0.98]"
              onClick={() => void handleRecommendedHalteDirection(halte.id)}
            >
              <MapPinSolidIcon className="h-4 w-4 shrink-0 text-white" />
              <p className="text-[12px] font-bold leading-none">{halte.name}</p>
            </button>
          ))}
        </div>
      </section>



      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      <div className="absolute right-3 top-3 z-20 flex items-center gap-2 xl:right-4 xl:top-4">
        <button
          type="button"
          onClick={handleTestBusNotification}
          title="Test notifikasi bus mendekati"
          className="relative hidden xl:flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm backdrop-blur-sm transition hover:bg-amber-100 active:scale-95"
        >
          <BellIcon className="h-3.5 w-3.5" />
          Test Notif
        </button>
        <div className="rounded-full border border-emerald-200 bg-emerald-100/90 px-2 py-0.5 text-xs font-semibold text-emerald-700 shadow-sm backdrop-blur-sm xl:px-3 xl:py-1 xl:text-sm">
          Realtime aktif
        </div>
      </div>

      <FloatingSidebar
        activeView={activeView}
        onSelectView={handleSelectView}
        showDataButton
      />

      <LiveSearchBar
        fromValue={fromInput}
        toValue={toInput}
        onFromChange={setFromInput}
        onToChange={(val) => {
          setToInput(val);
          setDirectionResult(null);
        }}
        onSubmit={handleDirectionSearch}
        showOriginField={searchStep === "origin"}
        onBackToDestination={handleBackToDestination}
        panelOpen={panelOpen}
        isSearching={isSearching}
        mobileTopClass="top-14"
      />

      <BuggyList
        buggies={liveBuggies}
        panelOpen={panelOpen}
        activeView={activeView}
        onClose={() => setPanelOpen(false)}
        selectedBuggyId={selectedBuggyId}
        selectedHalteId={selectedHalteId}
        onFocusBuggy={handleFocusBuggy}
        onSelectBuggy={handleSelectBuggy}
        onSelectHalte={handleSelectHalte}
        directionResult={directionResult}
        onCloseDirection={() => setDirectionResult(null)}
        dataViewContent={
          <AdminDataSection
            buggies={liveBuggies}
            geofences={geofences}
            events={geofenceEvents}
            geofenceStatuses={geofenceStatuses}
            geofenceLoading={geofenceLoading}
            geofenceCreateMode={geofenceCreateMode}
            draftGeofence={
              geofenceCreateMode && draftGeofenceCenter
                ? {
                    center: draftGeofenceCenter,
                    radiusMeters: draftGeofenceRadius,
                  }
                : null
            }
            draftName={draftGeofenceName}
            browserNotificationEnabled={browserNotificationEnabled}
            onSelectBuggy={handleSelectAdminBuggy}
            onToggleCreateMode={handleToggleCreateMode}
            onDraftNameChange={setDraftGeofenceName}
            onDraftRadiusChange={setDraftGeofenceRadius}
            onSaveDraft={handleSaveDraft}
            onCancelDraft={handleCancelDraft}
            onToggleGeofence={handleToggleGeofence}
            onEditGeofence={handleEditGeofence}
            onDeleteGeofence={handleDeleteGeofence}
            onToggleBrowserNotification={handleToggleBrowserNotification}
          />
        }
        dataDetailViewContent={
          selectedAdminBuggyId ? (
            <BuggyOperationalDetail
              buggy={
                liveBuggies.find((b) => b.id === selectedAdminBuggyId) ??
                liveBuggies[0]
              }
              activeZones={geofenceStatuses[selectedAdminBuggyId] ?? []}
              onBack={() => {
                setSelectedAdminBuggyId(null);
                setActiveView("data");
              }}
            />
          ) : null
        }
        historyViewContent={
          <HistoryPanel
            buggies={liveBuggies}
            onShowPath={(path) => {
              setHistoryPath(path);
            }}
          />
        }
      />

      <MobileBottomNav
        activeView={activeView}
        onSelectView={handleSelectView}
        onDragOpenPanel={() => setPanelOpen(true)}
        showDataButton
      />
    </main>
  );
}
