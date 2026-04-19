"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapCanvas } from "@/components/map/MapCanvas";
import { BuggyList } from "@/components/buggy/BuggyList";
import { FloatingSidebar } from "@/components/sidebar/FloatingSidebar";
import { MobileBottomNav } from "@/components/sidebar/MobileBottomNav";
import { LiveSearchBar } from "@/components/search/LiveSearchBar";
import { AdminDataSection } from "@/components/panel/AdminDataSection";
import { ToastStack } from "@/components/ui/ToastStack";
import type { ToastItem } from "@/components/ui/ToastStack";
import {
  createInitialBuggies,
  HALTE_LOCATIONS,
  OFFICIAL_ROUTE_PATH,
} from "@/lib/transit/buggy-data";
import { haversineMeters } from "@/lib/transit/buggy-route-utils";
import { useBuggySimulation } from "@/hooks/useBuggySimulation";
import { GoogleMapsService } from "@/lib/services/google-maps-service";
import type { PanelView } from "@/types/buggy";
import type { DirectionResult } from "@/components/panel/DirectionPanel";
import type { LatLngLiteral } from "@/types/map-canvas";
import type { Geofence, GeofenceEvent } from "@/types/geofence";

const INITIAL_BUGGIES = createInitialBuggies();
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
  const liveBuggies = useBuggySimulation(INITIAL_BUGGIES);

  const [activeView, setActiveView] = useState<PanelView>("buggy");
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedBuggyId, setSelectedBuggyId] = useState<string | null>(
    INITIAL_BUGGIES[0]?.id ?? null,
  );
  const [mapFollowingBuggyId, setMapFollowingBuggyId] = useState<string | null>(
    INITIAL_BUGGIES[0]?.id ?? null,
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
  const [pendingGeofenceCenter, setPendingGeofenceCenter] =
    useState<LatLngLiteral | null>(null);
  const [pendingGeofenceName, setPendingGeofenceName] = useState("");
  const [pendingGeofenceRadiusMeters, setPendingGeofenceRadiusMeters] =
    useState(GEOFENCE_DEFAULT_RADIUS_METERS);
  const [geofenceEvents, setGeofenceEvents] = useState<GeofenceEvent[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [browserNotificationEnabled, setBrowserNotificationEnabled] =
    useState(false);

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
  };

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

  const handleMapClickForGeofence = useCallback(
    (position: LatLngLiteral) => {
      if (!geofenceCreateMode) return;
      setPendingGeofenceCenter(position);
      setPendingGeofenceRadiusMeters(GEOFENCE_DEFAULT_RADIUS_METERS);
      setPendingGeofenceName((prev) =>
        prev.trim()
          ? prev
          : `Zona ${String(geofences.length + 1).padStart(2, "0")}`,
      );
      setPanelOpen(true);
      setActiveView("data");
      pushToast(
        "Titik geofence dipilih",
        `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`,
        "info",
      );
    },
    [geofenceCreateMode, geofences.length, pushToast],
  );

  const handleToggleCreateMode = useCallback(() => {
    setGeofenceCreateMode((prev) => {
      const next = !prev;
      if (!next) {
        setPendingGeofenceCenter(null);
        setPendingGeofenceName("");
        setPendingGeofenceRadiusMeters(GEOFENCE_DEFAULT_RADIUS_METERS);
      }
      return next;
    });
    setPanelOpen(true);
    setActiveView("data");
  }, []);

  const handleCancelPendingGeofence = useCallback(() => {
    setPendingGeofenceCenter(null);
    setPendingGeofenceName("");
    setPendingGeofenceRadiusMeters(GEOFENCE_DEFAULT_RADIUS_METERS);
  }, []);

  const handleSavePendingGeofence = useCallback(async () => {
    if (!pendingGeofenceCenter) {
      pushToast(
        "Pusat geofence belum dipilih",
        "Klik peta terlebih dahulu.",
        "warning",
      );
      return;
    }

    const name = pendingGeofenceName.trim();
    if (!name) {
      pushToast("Nama geofence wajib diisi", undefined, "warning");
      return;
    }

    if (
      !Number.isFinite(pendingGeofenceRadiusMeters) ||
      pendingGeofenceRadiusMeters <= 0
    ) {
      pushToast(
        "Radius geofence tidak valid",
        "Isi radius > 0 meter.",
        "warning",
      );
      return;
    }

    try {
      const response = await fetch("/api/geofences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          center: pendingGeofenceCenter,
          radiusMeters: pendingGeofenceRadiusMeters,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message ?? "Gagal menyimpan geofence.");
      }

      const created = (await response.json()) as Geofence;
      setGeofences((prev) => [...prev, created]);
      setPendingGeofenceCenter(null);
      setPendingGeofenceName("");
      setPendingGeofenceRadiusMeters(GEOFENCE_DEFAULT_RADIUS_METERS);
      setGeofenceCreateMode(false);
      pushToast("Geofence berhasil dibuat", created.name, "success");
    } catch (error) {
      console.error("Create geofence error:", error);
      pushToast(
        "Gagal membuat geofence",
        error instanceof Error ? error.message : "Terjadi kesalahan.",
        "warning",
      );
    }
  }, [
    pendingGeofenceCenter,
    pendingGeofenceName,
    pendingGeofenceRadiusMeters,
    pushToast,
  ]);

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
      } catch (error) {
        console.error("Delete geofence error:", error);
        pushToast(
          "Gagal menghapus geofence",
          error instanceof Error ? error.message : "Terjadi kesalahan.",
          "warning",
        );
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

      if (!originHalte) {
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
        onMapClick={handleMapClickForGeofence}
        onInfoWindowClose={handleInfoWindowClose}
        onBuggyMarkerClick={handleBuggyMarkerClick}
        onHalteMarkerClick={handleHalteMarkerClick}
        focusHaltes={activeView === "halte"}
      />

      <ToastStack toasts={toasts} />

      <div className="absolute right-3 top-3 z-20 rounded-full border border-emerald-200 bg-emerald-100/90 px-2 py-0.5 text-xs font-semibold text-emerald-700 shadow-sm backdrop-blur-sm xl:right-4 xl:top-4 xl:px-3 xl:py-1 xl:text-sm">
        Realtime aktif
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
            pendingCenter={pendingGeofenceCenter}
            pendingName={pendingGeofenceName}
            pendingRadiusMeters={pendingGeofenceRadiusMeters}
            browserNotificationEnabled={browserNotificationEnabled}
            onToggleCreateMode={handleToggleCreateMode}
            onPendingNameChange={setPendingGeofenceName}
            onPendingRadiusChange={setPendingGeofenceRadiusMeters}
            onSavePending={handleSavePendingGeofence}
            onCancelPending={handleCancelPendingGeofence}
            onToggleGeofence={handleToggleGeofence}
            onDeleteGeofence={handleDeleteGeofence}
            onToggleBrowserNotification={handleToggleBrowserNotification}
          />
        }
      />

      <MobileBottomNav
        activeView={activeView}
        onSelectView={handleSelectView}
        showDataButton
      />
    </main>
  );
}
