"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapCanvas } from "@/components/map/MapCanvas";
import { BuggyList } from "@/components/buggy/PanelActive";
import { FloatingSidebar } from "@/components/sidebar/FloatingSidebar";
import { MobileBottomNav } from "@/components/sidebar/MobileBottomNav";
import { LiveSearchBar } from "@/components/search/LiveSearchBar";
import { AdminDataSection } from "@/components/data/AdminDataSection";
import { BuggyOperationalDetail } from "@/components/data/BuggyOperationalDetail";
import { HistoryPanel } from "@/components/history/HistoryPanel";
import { AppSettingsPanel } from "@/components/settings/AppSettingsPanel";
import type { AccountFormMode } from "@/components/settings/AccountFormPanel";
import { ToastStack } from "@/components/ui/ToastStack";
import type { ToastItem } from "@/components/ui/ToastStack";
import {
  CENTER_UNDIP,
  HALTE_LOCATIONS,
  OFFICIAL_ROUTE_PATH,
} from "@/lib/transit/buggy-data";
import type { Buggy } from "@/types/buggy";
import { haversineMeters } from "@/lib/transit/buggy-route-utils";
import { useBuggyLiveFeed } from "@/hooks/useBuggyLiveFeed";
import {
  DEFAULT_ADMIN_SETTINGS,
  useAdminSettings,
} from "@/hooks/useAdminSettings";
import { GoogleMapsService } from "@/lib/services/google-maps-service";
import type { PanelView } from "@/types/buggy";
import type { DirectionResult } from "@/components/panel/DirectionPanel";
import { createClient } from "@/lib/supabase/client";
import type { LatLngLiteral } from "@/types/map-canvas";
import type { Geofence, GeofenceEvent } from "@/types/geofence";
import { LogoutIcon, MapPinSolidIcon, BellIcon } from "@/components/ui/Icons";
import { PenIcon } from "lucide-react";

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
  const { settings, updateSetting } = useAdminSettings();

  // localBuggies: hasil fetch langsung setelah add/delete agar list update instan
  const [localBuggies, setLocalBuggies] = useState<Buggy[] | null>(null);
  const liveBuggies = useMemo(
    () => localBuggies ?? realtimeFeed.liveBuggies ?? [],
    [localBuggies, realtimeFeed.liveBuggies],
  );

  /** Fetch daftar buggy terbaru dari server dan simpan ke localBuggies */
  const handleBuggyMutated = useCallback(async () => {
    try {
      const res = await fetch("/api/buggy", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setLocalBuggies(data as Buggy[]);
      }
    } catch {
      // ignore — SSE akan sync dalam 1 detik
    }
  }, []);

  const [activeView, setActiveView] = useState<PanelView>("buggy");
  const [panelOpen, setPanelOpen] = useState(
    DEFAULT_ADMIN_SETTINGS.openPanelOnDashboard,
  );
  const [selectedBuggyId, setSelectedBuggyId] = useState<string | null>(null);
  const [mapFollowingBuggyId, setMapFollowingBuggyId] = useState<string | null>(
    null,
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

  const [activeGeofences, setActiveGeofences] = useState<Geofence[]>([]);

  const [userProfile, setUserProfile] = useState<{
    name: string;
    role: string;
    avatar: string;
    buggy_id?: string;
  } | null>(null);

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: account } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", user.id)
        .single();

      const name =
        account?.name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "Admin";
      const role = account?.role || "SIMOBI Operator";
      const avatar = name.charAt(0).toUpperCase();

      setUserProfile({ name, role, avatar, buggy_id: account?.buggy_id });
    }
    fetchUser();
  }, []);

  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [geofenceLoading, setGeofenceLoading] = useState(true);
  const [geofenceCreateMode, setGeofenceCreateMode] = useState(false);
  const [editingGeofenceId, setEditingGeofenceId] = useState<string | null>(
    null,
  );
  const [draftGeofenceCenter, setDraftGeofenceCenter] =
    useState<LatLngLiteral | null>(null);
  const [draftGeofenceName, setDraftGeofenceName] = useState("");
  const [draftGeofenceRadius, setDraftGeofenceRadius] = useState(
    GEOFENCE_DEFAULT_RADIUS_METERS,
  );

  const driverFilteredBuggies = useMemo(() => {
    if (userProfile?.role === "Driver" && userProfile.buggy_id) {
      return liveBuggies.filter((b) => b.id === userProfile.buggy_id);
    }
    if (userProfile?.role === "Driver") {
      return [];
    }
    return liveBuggies;
  }, [liveBuggies, userProfile]);
  const isAdminUser = userProfile?.role === "Admin";
  const isDriverUser = userProfile?.role === "Driver";
  const canManageDashboard = isAdminUser;
  const visibleBuggies = driverFilteredBuggies;
  const [geofenceEvents, setGeofenceEvents] = useState<GeofenceEvent[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const browserNotificationEnabled = settings.browserNotificationEnabled;
  const [historyPath, setHistoryPath] = useState<[number, number][]>([]);
  const [selectedAdminBuggyId, setSelectedAdminBuggyId] = useState<
    string | null
  >(null);
  const [mobileAdminMenuOpen, setMobileAdminMenuOpen] = useState(false);
  const [desktopAdminMenuOpen, setDesktopAdminMenuOpen] = useState(false);
  const [settingsAccountForm, setSettingsAccountForm] =
    useState<AccountFormMode | null>(null);

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
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
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
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 15_000 },
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
  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // noop
    }
    window.location.href = "/";
  };

  const handleOpenSettings = (accountForm: AccountFormMode | null = null) => {
    setSettingsAccountForm(accountForm);
    setActiveView("settings");
    setPanelOpen(true);
    setMobileAdminMenuOpen(false);
    setDesktopAdminMenuOpen(false);
  };

  const handleTestBusNotification = useCallback(() => {
    const sampleBuggy = liveBuggies[0];
    const sampleHalte = HALTE_LOCATIONS[0];
    const busName = sampleBuggy?.name ?? "Buggy 1";
    const halteName = sampleHalte?.name ?? "Halte Utama";
    const fakeDistance = Math.floor(Math.random() * 120) + 10;

    const id = makeId();
    setToasts((prev) =>
      [
        {
          id,
          tone: "bus" as ToastItem["tone"],
          title: `${busName} mendekati halte Anda`,
          description: `${halteName} · ${fakeDistance} m lagi`,
          duration: 7_000,
        },
        ...prev,
      ].slice(0, TOAST_LIMIT),
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

  const handleSelectView = useCallback((view: PanelView) => {
    setActiveView(view);
    setPanelOpen(true);
    setSettingsAccountForm(null);
    // Clear history path when leaving history view
    if (view !== "history") {
      setHistoryPath([]);
    }
    // Clear admin detail when explicitly navigating away
    if (view !== "data-detail") {
      setSelectedAdminBuggyId(null);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const viewParam = new URLSearchParams(window.location.search).get("view");
    const dashboardViews: PanelView[] = [
      "buggy",
      "halte",
      "notifikasi",
      "settings",
      "lapor",
      "data",
      "history",
    ];

    if (viewParam && dashboardViews.includes(viewParam as PanelView)) {
      handleSelectView(viewParam as PanelView);
    }
  }, [handleSelectView]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("view")
    ) {
      return;
    }

    setPanelOpen(settings.openPanelOnDashboard);
  }, [settings.openPanelOnDashboard]);

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
    if (!canManageDashboard) return;

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
  }, [canManageDashboard, geofences.length]);

  const handleEditGeofence = useCallback((geofence: Geofence) => {
    if (!canManageDashboard) return;

    setEditingGeofenceId(geofence.id);
    setDraftGeofenceCenter(geofence.center);
    setDraftGeofenceName(geofence.name);
    setDraftGeofenceRadius(geofence.radiusMeters);
    setGeofenceCreateMode(true);
    setPanelOpen(true);
    setActiveView("data");
  }, [canManageDashboard]);

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
    if (!canManageDashboard) return;
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
      const url = isEdit
        ? `/api/geofences/${editingGeofenceId}`
        : "/api/geofences";
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
        setGeofences((prev) =>
          prev.map((g) => (g.id === editingGeofenceId ? createdOrUpdated : g)),
        );
      } else {
        setGeofences((prev) => [...prev, createdOrUpdated]);
      }

      setDraftGeofenceCenter(null);
      setDraftGeofenceName("");
      setDraftGeofenceRadius(GEOFENCE_DEFAULT_RADIUS_METERS);
      setGeofenceCreateMode(false);
      setEditingGeofenceId(null);
      pushToast(
        isEdit ? "Zona berhasil diperbarui" : "Zona berhasil dibuat",
        createdOrUpdated.name,
        "success",
      );
    } catch (error) {
      console.error("Save geofence error:", error);
      pushToast(
        "Gagal menyimpan zona",
        error instanceof Error ? error.message : "Terjadi kesalahan.",
        "warning",
      );
    }
  }, [
    draftGeofenceCenter,
    draftGeofenceName,
    draftGeofenceRadius,
    editingGeofenceId,
    pushToast,
    canManageDashboard,
  ]);

  const handleToggleGeofence = useCallback(
    async (id: string, enabled: boolean) => {
      if (!canManageDashboard) return;

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
    [canManageDashboard, pushToast],
  );

  const handleDeleteGeofence = useCallback(
    async (id: string) => {
      if (!canManageDashboard) return false;

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
    [canManageDashboard, geofences, pushToast],
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
      updateSetting("browserNotificationEnabled", false);
      pushToast("Browser Notification dimatikan", undefined, "info");
      return;
    }

    if (Notification.permission === "granted") {
      updateSetting("browserNotificationEnabled", true);
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
      updateSetting("browserNotificationEnabled", true);
      pushToast("Browser Notification aktif", undefined, "success");
      return;
    }

    pushToast(
      "Browser Notification tetap nonaktif",
      "Permission tidak diberikan.",
      "warning",
    );
  }, [browserNotificationEnabled, pushToast, updateSetting]);

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

  const mapBuggies = activeView === "halte" ? [] : visibleBuggies;
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
        className="absolute inset-x-0 z-50 flex items-center justify-between px-4 xl:hidden"
        style={{ top: "calc(0.75rem + var(--sai-top, 0px))" }}
      >
        <h1 className="text-[26px] font-bold tracking-tight text-white drop-shadow-md">
          SIMOBI
        </h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSelectView("notifikasi")}
            aria-label="Notifikasi"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-900/50 text-white backdrop-blur-md transition active:scale-95"
          >
            <BellIcon className="h-5 w-5" />
          </button>
          <div className="relative">
            <button
              type="button"
              aria-label="Menu admin"
              aria-expanded={mobileAdminMenuOpen}
              title="Admin"
              onClick={() => setMobileAdminMenuOpen((open) => !open)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-900/50 text-white backdrop-blur-md transition hover:bg-slate-800/70 active:scale-95"
            >
              <span className="grid size-8 place-items-center rounded-full bg-[#0f1a3b]/70 text-sm font-black text-white">
                {userProfile?.avatar ?? (isDriverUser ? "D" : "A")}
              </span>
            </button>

            {mobileAdminMenuOpen ? (
              <div className="absolute right-0 z-60 mt-2 w-48 overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-1.5 text-slate-800 shadow-[0_14px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => handleOpenSettings("edit")}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] font-bold transition hover:bg-slate-100 active:scale-[0.98]"
                >
                  <PenIcon className="h-4 w-4 text-slate-500" />
                  Edit Account
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] font-bold text-rose-600 transition hover:bg-rose-50 active:scale-[0.98]"
                >
                  <LogoutIcon className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
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

      <div className="absolute right-3 top-3 z-20 hidden items-center justify-end gap-2 xl:right-4 xl:top-4 xl:flex">
        <div className="relative">
          <button
            type="button"
            aria-label="Menu account"
            aria-expanded={desktopAdminMenuOpen}
            onClick={() => setDesktopAdminMenuOpen((open) => !open)}
            className="flex w-full items-center gap-3 rounded-full border border-white/60 bg-white px-3 py-2 text-left shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl transition hover:bg-white/90 active:scale-[0.98]"
          >
            <div className="grid size-8 place-items-center rounded-full bg-[#0f1a3b] text-sm font-black text-white">
              {userProfile?.avatar ?? "A"}
            </div>
            <div className="min-w-0 pr-1">
              <p className="text-[13px] font-extrabold leading-tight text-slate-900">
                {userProfile?.name ?? (isDriverUser ? "Driver" : "Admin")}
              </p>
              <p className="text-[10px] font-semibold leading-tight text-slate-400">
                {userProfile?.role ?? "SIMOBI Operator"}
              </p>
            </div>
          </button>
          {desktopAdminMenuOpen ? (
            <div className="absolute right-0 top-full mt-1 w-full min-w-[150px] rounded-[22px] border border-white/70 bg-slate-100 p-1.5 text-slate-800 shadow-[0_14px_40px_rgba(15,23,42,0.16)] backdrop-blur-xl">
              <button
                type="button"
                onClick={() => handleOpenSettings("edit")}
                className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-[12px] font-bold transition hover:bg-slate-200 active:scale-[0.98]"
              >
                <PenIcon className="h-4 w-4 text-slate-500" />
                Edit Account
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-[12px] font-bold text-rose-600 transition hover:bg-rose-50 active:scale-[0.98]"
              >
                <LogoutIcon className="h-4 w-4" />
                Logout
              </button>
            </div>
          ) : null}
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
        buggies={visibleBuggies}
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
            buggies={driverFilteredBuggies}
            realtimeConnected={realtimeFeed.connected}
            realtimeSource={realtimeFeed.source}
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
            compactMode={settings.compactAdminPanels}
            readOnly={!canManageDashboard}
            onBuggyMutated={() => void handleBuggyMutated()}
          />
        }
        dataDetailViewContent={
          selectedAdminBuggyId ? (
            <BuggyOperationalDetail
              buggy={
                liveBuggies.find((b) => b.id === selectedAdminBuggyId) ??
                visibleBuggies[0]
              }
              activeZones={geofenceStatuses[selectedAdminBuggyId] ?? []}
              onBack={() => {
                setSelectedAdminBuggyId(null);
                setActiveView("data");
              }}
              onDeleteSuccess={() => {
                setSelectedAdminBuggyId(null);
                setActiveView("data");
                void handleBuggyMutated();
              }}
              readOnly={!canManageDashboard}
            />
          ) : null
        }
        historyViewContent={
          <HistoryPanel
            buggies={driverFilteredBuggies}
            onShowPath={(path) => {
              setHistoryPath(path);
            }}
            readOnly={!canManageDashboard}
          />
        }
        settingsViewContent={
          <AppSettingsPanel
            mode="admin"
            settings={settings}
            onUpdateSetting={updateSetting}
            onToggleBrowserNotification={handleToggleBrowserNotification}
            onLogout={handleLogout}
            accountForm={settingsAccountForm}
            onAccountFormChange={setSettingsAccountForm}
          />
        }
        isAdmin={canManageDashboard}
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
