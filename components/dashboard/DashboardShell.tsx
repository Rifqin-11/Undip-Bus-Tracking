"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthModal } from "@/components/auth/AuthModal";
import { MapCanvas } from "@/components/map/MapCanvas";
import { BuggyList } from "@/components/buggy/PanelActive";
import { FloatingSidebar } from "@/components/sidebar/FloatingSidebar";
import { MobileBottomNav } from "@/components/sidebar/MobileBottomNav";
import { LiveSearchBar } from "@/components/search/LiveSearchBar";
import {
  AdminDataSection,
  type AdminDataPanel,
} from "@/components/data/AdminDataSection";
import { BuggyOperationalDetail } from "@/components/data/BuggyOperationalDetail";
import { HistoryPanel } from "@/components/history/HistoryPanel";
import { AppSettingsPanel } from "@/components/settings/AppSettingsPanel";
import type { AccountFormMode } from "@/components/settings/AccountFormPanel";
import { ToastStack } from "@/components/ui/ToastStack";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { NearestHalteChips } from "@/components/layout/NearestHalteChips";
import {
  AccountPill,
  type AccountMenuItem,
} from "@/components/layout/AccountPill";
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
import { useFavorites } from "@/hooks/useFavorites";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserPosition } from "@/hooks/useUserPosition";
import { useToastStack } from "@/hooks/useToastStack";
import { useNearestHaltes } from "@/hooks/useNearestHaltes";
import { useBrowserNotificationToggle } from "@/hooks/useBrowserNotificationToggle";
import { useDirectionSearch } from "@/hooks/useDirectionSearch";
import type { PanelView } from "@/types/buggy";
import { createClient } from "@/lib/supabase/client";
import {
  isBuggyAssignedToValue,
  resolveAssignedBuggy,
} from "@/lib/buggy/assignment";
import type { LatLngLiteral } from "@/types/map-canvas";
import type { Geofence, GeofenceEvent } from "@/types/geofence";
import type { HistoryStopPoint } from "@/lib/history/stop-points";
import { useLocale } from "@/lib/i18n/client";
import { localizePath } from "@/lib/i18n/routing";
import { getDashboardPermissions } from "@/lib/auth/dashboard-permissions";
import { isBuggyOffline } from "@/lib/buggy/connection-status";
import { fmtTime } from "@/lib/utils/format-time";
import { LogoutIcon, BellIcon, LoginIcon } from "@/components/ui/Icons";
import { PenIcon } from "lucide-react";

const GEOFENCE_DEFAULT_RADIUS_METERS = 100;
const GEOFENCE_EVENT_LIMIT = 100;
const GEOFENCE_EVENT_COOLDOWN_MS = 10_000;
const OFFLINE_ALERT_MIN_SECONDS = 5 * 60;
const ADMIN_ACTIVE_VIEW_STORAGE_KEY = "simobi.admin.activeView";
const PERSISTED_ADMIN_VIEWS: PanelView[] = [
  "buggy",
  "halte",
  "notifikasi",
  "settings",
  "lapor",
  "data",
  "history",
];

const HALTE_FALLBACK_POSITION = {
  lat: HALTE_LOCATIONS[0].lat,
  lng: HALTE_LOCATIONS[0].lng,
};

type DriverAssignmentAccount = {
  name?: string | null;
  role?: string | null;
  buggy_id?: string | null;
};

type AccountsResponse = {
  accounts?: DriverAssignmentAccount[];
};

function makeId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isPersistedAdminView(value: string | null): value is PanelView {
  return PERSISTED_ADMIN_VIEWS.includes(value as PanelView);
}

function isOperatorPanelView(value: PanelView) {
  return value === "data" || value === "data-detail" || value === "history";
}

function replaceAdminViewQuery(view: PanelView) {
  if (typeof window === "undefined") return;
  if (!isPersistedAdminView(view)) return;

  const url = new URL(window.location.href);
  if (url.searchParams.get("view") === view) return;

  url.searchParams.set("view", view);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function DashboardShell() {
  const dashboardShellRef = useRef<HTMLElement | null>(null);
  const locale = useLocale();
  const { t } = useTranslation("admin");
  const { t: tCommon } = useTranslation("common");
  const { t: tNav } = useTranslation("navigation");
  const realtimeFeed = useBuggyLiveFeed();
  const { settings, updateSetting, resetSettings } = useAdminSettings();
  const {
    userProfile,
    loading: userLoading,
    isAdmin: isAdminUser,
    isDriver: isDriverUser,
    isAuthenticated,
    role,
  } = useUserRole();
  const permissions = useMemo(
    () => getDashboardPermissions(role, isAuthenticated),
    [isAuthenticated, role],
  );
  const {
    favoriteBuggies,
    favoriteHaltes,
    canFavorite,
    ready: favoritesReady,
    toggleBuggy: toggleFavoriteBuggy,
    toggleHalte: toggleFavoriteHalte,
  } = useFavorites();
  const [driverNamesByBuggyId, setDriverNamesByBuggyId] = useState<
    Record<string, string>
  >({});

  // localBuggies: fallback instan setelah add/delete; realtime feed tetap prioritas
  // supaya marker selalu mengikuti posisi telemetry terakhir dari /api/buggy.
  const [localBuggies, setLocalBuggies] = useState<Buggy[] | null>(null);
  const [adminFleetBuggies, setAdminFleetBuggies] = useState<Buggy[]>([]);
  const liveBuggies = useMemo(
    () => realtimeFeed.liveBuggies ?? localBuggies ?? [],
    [localBuggies, realtimeFeed.liveBuggies],
  );

  const loadAdminFleetBuggies = useCallback(async () => {
    if (!permissions.canManageDashboard) {
      setAdminFleetBuggies([]);
      return;
    }

    try {
      const res = await fetch("/api/admin/buggies", { cache: "no-store" });
      if (!res.ok) return;
      const payload = (await res.json()) as { buggies?: Buggy[] };
      setAdminFleetBuggies(
        Array.isArray(payload.buggies) ? payload.buggies : [],
      );
    } catch {
      // Live feed remains the source for operational views.
    }
  }, [permissions.canManageDashboard]);

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
    await loadAdminFleetBuggies();
  }, [loadAdminFleetBuggies]);

  const [activeView, setActiveView] = useState<PanelView>("buggy");
  const [panelOpen, setPanelOpen] = useState(
    DEFAULT_ADMIN_SETTINGS.openPanelOnDashboard,
  );
  const [selectedBuggyId, setSelectedBuggyId] = useState<string | null>(null);
  const [selectedAdminBuggyId, setSelectedAdminBuggyId] = useState<
    string | null
  >(null);
  const [adminDataPanel, setAdminDataPanel] =
    useState<AdminDataPanel>("statistics");
  const [mapFollowingBuggyId, setMapFollowingBuggyId] = useState<string | null>(
    null,
  );
  const [selectedHalteId, setSelectedHalteId] = useState<string | null>(null);

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

  const [geofenceEvents, setGeofenceEvents] = useState<GeofenceEvent[]>([]);
  const browserNotificationEnabled = settings.browserNotificationEnabled;
  const [historyPath, setHistoryPath] = useState<[number, number][]>([]);
  const [historyStopPoints, setHistoryStopPoints] = useState<HistoryStopPoint[]>(
    [],
  );
  const [settingsAccountForm, setSettingsAccountForm] =
    useState<AccountFormMode | null>(null);
  const [activeViewHydrated, setActiveViewHydrated] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authRedirectTo, setAuthRedirectTo] = useState(localizePath("/", locale));

  const visibleBuggies = useMemo(() => {
    if (permissions.canViewAssignedBuggyOnly && userProfile?.buggy_id) {
      return liveBuggies.filter((buggy) =>
        isBuggyAssignedToValue(buggy, userProfile.buggy_id),
      );
    }
    if (permissions.canViewAssignedBuggyOnly) {
      return [];
    }

    if (!permissions.canViewAllBuggies) {
      return liveBuggies.filter((buggy) => !isBuggyOffline(buggy));
    }

    return liveBuggies;
  }, [liveBuggies, permissions, userProfile?.buggy_id]);

  const canManageDashboard = permissions.canManageDashboard;
  const dataManagementBuggies = canManageDashboard
    ? adminFleetBuggies
    : visibleBuggies;

  useEffect(() => {
    void loadAdminFleetBuggies();
  }, [loadAdminFleetBuggies]);

  const selectedAdminBuggy = useMemo(() => {
    if (!selectedAdminBuggyId) return null;
    const adminBuggy =
      dataManagementBuggies.find((buggy) => buggy.id === selectedAdminBuggyId) ??
      null;
    const liveBuggy =
      visibleBuggies.find((buggy) => buggy.id === selectedAdminBuggyId) ?? null;

    if (adminBuggy && liveBuggy) {
      return {
        ...adminBuggy,
        isActive: liveBuggy.isActive,
        etaMinutes: liveBuggy.etaMinutes,
        speedKmh: liveBuggy.speedKmh,
        crowdLevel: liveBuggy.crowdLevel,
        passengers: liveBuggy.passengers,
        tag: liveBuggy.tag,
        updatedAt: liveBuggy.updatedAt,
        connectionStatus: liveBuggy.connectionStatus,
        lastSeenAt: liveBuggy.lastSeenAt,
        lastSeenSecondsAgo: liveBuggy.lastSeenSecondsAgo,
        currentStopIndex: liveBuggy.currentStopIndex,
        pathCursor: liveBuggy.pathCursor,
        position: liveBuggy.position,
        gsm: liveBuggy.gsm ?? adminBuggy.gsm,
      };
    }

    return adminBuggy ?? liveBuggy ?? visibleBuggies[0] ?? null;
  }, [dataManagementBuggies, selectedAdminBuggyId, visibleBuggies]);

  const { userPosition, getLatestUserPosition } = useUserPosition();
  const { toasts, addToast, dismissToast } = useToastStack();
  const nearestHalteRecommendations = useNearestHaltes({
    haltes: HALTE_LOCATIONS,
    userPosition,
    fallback: liveBuggies[0]?.position ?? HALTE_FALLBACK_POSITION,
  });

  const openLogin = useCallback((next = "/") => {
    setAuthRedirectTo(localizePath(next, locale));
    setAuthModalOpen(true);
  }, [locale]);

  const {
    fromInput,
    setFromInput,
    toInput,
    setToInput,
    searchStep,
    isSearching,
    directionResult,
    setDirectionResult,
    runDirectionSearch,
    runRecommendedHalteDirection,
    resetToDestination,
  } = useDirectionSearch({
    liveBuggies: visibleBuggies,
    haltes: HALTE_LOCATIONS,
    routePath: OFFICIAL_ROUTE_PATH,
    getLatestUserPosition,
    onSearchComplete: (_result, nearest) => {
      if (nearest) {
        setSelectedBuggyId(nearest.id);
        setMapFollowingBuggyId(nearest.id);
      }
      setActiveView("buggy");
      setPanelOpen(true);
    },
  });

  const loadDriverAssignments = useCallback(async () => {
    if (isDriverUser) {
      const assignedBuggy = resolveAssignedBuggy(
        userProfile?.buggy_id,
        liveBuggies,
      );

      setDriverNamesByBuggyId(
        assignedBuggy
          ? { [assignedBuggy.id]: userProfile?.name ?? "Driver" }
          : {},
      );
      return;
    }

    if (!isAdminUser) {
      setDriverNamesByBuggyId({});
      return;
    }

    try {
      const response = await fetch("/api/admin/accounts", {
        cache: "no-store",
      });

      if (!response.ok) {
        setDriverNamesByBuggyId({});
        return;
      }

      const payload = (await response.json()) as AccountsResponse;
      const nextAssignments: Record<string, string[]> = {};

      for (const account of payload.accounts ?? []) {
        if (account.role !== "Driver" || !account.buggy_id) continue;

        const assignedBuggy = resolveAssignedBuggy(
          account.buggy_id,
          liveBuggies,
        );
        if (!assignedBuggy) continue;

        const driverName = account.name?.trim();
        if (!driverName) continue;

        nextAssignments[assignedBuggy.id] = [
          ...(nextAssignments[assignedBuggy.id] ?? []),
          driverName,
        ];
      }

      setDriverNamesByBuggyId(
        Object.fromEntries(
          Object.entries(nextAssignments).map(([buggyId, names]) => [
            buggyId,
            names.join(", "),
          ]),
        ),
      );
    } catch {
      setDriverNamesByBuggyId({});
    }
  }, [
    isAdminUser,
    isDriverUser,
    liveBuggies,
    userProfile?.buggy_id,
    userProfile?.name,
  ]);

  useEffect(() => {
    if (activeView !== "data" && activeView !== "data-detail") return;
    void loadDriverAssignments();
  }, [activeView, loadDriverAssignments, selectedAdminBuggyId]);

  const geofenceMembershipRef = useRef<Map<string, boolean>>(new Map());
  const geofenceCooldownRef = useRef<Map<string, number>>(new Map());
  const offlineAlertedBuggyIdsRef = useRef<Set<string>>(new Set());

  const handleLogout = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // noop
    }
    setSettingsAccountForm(null);
    window.location.href = localizePath("/", locale);
  }, [locale]);

  const handleOpenSettings = useCallback((accountForm: AccountFormMode | null = null) => {
    setSettingsAccountForm(accountForm);
    setActiveView("settings");
    setPanelOpen(true);
  }, []);

  const { toggle: handleToggleBrowserNotification } =
    useBrowserNotificationToggle({
      enabled: browserNotificationEnabled,
      setEnabled: (next) => updateSetting("browserNotificationEnabled", next),
      addToast,
    });

  const loadGeofences = useCallback(async () => {
    if (!permissions.canViewOperatorPanels) {
      setGeofences([]);
      setGeofenceLoading(false);
      return;
    }

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
      addToast({
        tone: "warning",
        title: t("failedLoadGeofence"),
        description: "Coba refresh halaman.",
      });
      setGeofences([]);
    } finally {
      setGeofenceLoading(false);
    }
  }, [addToast, permissions.canViewOperatorPanels, t]);

  useEffect(() => {
    void loadGeofences();
  }, [loadGeofences]);

  const handleSelectView = useCallback((view: PanelView) => {
    if (!permissions.canViewOperatorPanels && isOperatorPanelView(view)) {
      view = "buggy";
    }

    setActiveView(view);
    setPanelOpen(true);
    setSettingsAccountForm(null);
    if (view !== "history") {
      setHistoryPath([]);
      setHistoryStopPoints([]);
    }
    if (view !== "data-detail") {
      setSelectedAdminBuggyId(null);
    }
  }, [permissions.canViewOperatorPanels]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const viewParam = new URLSearchParams(window.location.search).get("view");
    const storedView = window.localStorage.getItem(ADMIN_ACTIVE_VIEW_STORAGE_KEY);
    const restoredView = isPersistedAdminView(viewParam)
      ? viewParam
      : isPersistedAdminView(storedView)
        ? storedView
        : null;

    if (
      restoredView &&
      (permissions.canViewOperatorPanels || !isOperatorPanelView(restoredView))
    ) {
      handleSelectView(restoredView);
    }

    setActiveViewHydrated(true);
  }, [handleSelectView, permissions.canViewOperatorPanels]);

  useEffect(() => {
    if (!activeViewHydrated) return;
    if (typeof window === "undefined") return;
    if (!isPersistedAdminView(activeView)) return;
    if (!permissions.canViewOperatorPanels && isOperatorPanelView(activeView)) {
      setActiveView("buggy");
      return;
    }

    window.localStorage.setItem(ADMIN_ACTIVE_VIEW_STORAGE_KEY, activeView);
    replaceAdminViewQuery(activeView);
  }, [activeView, activeViewHydrated, permissions.canViewOperatorPanels]);

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
    setAdminDataPanel("buggy");
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

  const handleClearSelectedHalte = useCallback(() => {
    setSelectedHalteId(null);
  }, []);

  const handleToggleCreateMode = useCallback(() => {
    if (!canManageDashboard) return;

    setGeofenceCreateMode((prev) => {
      const next = !prev;
      if (next) {
        setEditingGeofenceId(null);
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

  const handleEditGeofence = useCallback(
    (geofence: Geofence) => {
      if (!canManageDashboard) return;

      setEditingGeofenceId(geofence.id);
      setDraftGeofenceCenter(geofence.center);
      setDraftGeofenceName(geofence.name);
      setDraftGeofenceRadius(geofence.radiusMeters);
      setGeofenceCreateMode(true);
      setPanelOpen(true);
      setActiveView("data");
    },
    [canManageDashboard],
  );

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
      addToast({ tone: "warning", title: "Nama zona wajib diisi" });
      return;
    }
    if (!Number.isFinite(draftGeofenceRadius) || draftGeofenceRadius <= 0) {
      addToast({
        tone: "warning",
        title: "Radius tidak valid",
        description: "Isi radius > 0 meter.",
      });
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
      addToast({
        tone: "success",
        title: isEdit ? "Zona berhasil diperbarui" : "Zona berhasil dibuat",
        description: createdOrUpdated.name,
      });
    } catch (error) {
      console.error("Save geofence error:", error);
      addToast({
        tone: "warning",
        title: t("failedSaveZone"),
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan.",
      });
    }
  }, [
    addToast,
    t,
    canManageDashboard,
    draftGeofenceCenter,
    draftGeofenceName,
    draftGeofenceRadius,
    editingGeofenceId,
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
        addToast({
          tone: "success",
          title: `Geofence ${updated.enabled ? "diaktifkan" : "dinonaktifkan"}`,
          description: updated.name,
        });
      } catch (error) {
        console.error("Toggle geofence error:", error);
        addToast({
          tone: "warning",
          title: t("failedChangeGeofence"),
          description:
            error instanceof Error ? error.message : "Terjadi kesalahan.",
        });
      }
    },
    [addToast, canManageDashboard, t],
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
        addToast({
          tone: "success",
          title: t("geofenceDeleted"),
          description: target?.name,
        });
        return true;
      } catch (error) {
        console.error("Delete geofence error:", error);
        addToast({
          tone: "warning",
          title: t("failedDeleteGeofence"),
          description:
            error instanceof Error ? error.message : "Terjadi kesalahan.",
        });
        return false;
      }
    },
    [addToast, canManageDashboard, geofences, t],
  );

  const emitGeofenceEvent = useCallback(
    (event: GeofenceEvent) => {
      if (!settings.geofenceEventAlertsEnabled) return;

      setGeofenceEvents((prev) =>
        [event, ...prev].slice(0, GEOFENCE_EVENT_LIMIT),
      );

      const actionLabel = event.type === "ENTER" ? "masuk" : "keluar";
      addToast({
        tone: event.type === "ENTER" ? "success" : "warning",
        title: `${event.buggyName} ${actionLabel}`,
        description: `${event.geofenceName} • ${fmtTime(event.timestamp)}`,
      });

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
    [
      addToast,
      browserNotificationEnabled,
      settings.geofenceEventAlertsEnabled,
    ],
  );

  const geofenceStatuses = useMemo(() => {
    const statusByBuggy: Record<string, string[]> = {};
    const enabledGeofences = geofences.filter((geofence) => geofence.enabled);
    if (enabledGeofences.length === 0) return statusByBuggy;

    liveBuggies.forEach((buggy) => {
      const activeZoneNames: string[] = [];
      enabledGeofences.forEach((geofence) => {
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
    const enabledGeofences = geofences.filter((geofence) => geofence.enabled);
    const previousMembership = geofenceMembershipRef.current;
    const nextMembership = new Map<string, boolean>();

    if (enabledGeofences.length === 0) {
      geofenceMembershipRef.current = nextMembership;
      return;
    }

    const now = Date.now();

    liveBuggies.forEach((buggy) => {
      enabledGeofences.forEach((geofence) => {
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

  useEffect(() => {
    if (!isAdminUser || !settings.offlineBuggyAlertsEnabled) {
      offlineAlertedBuggyIdsRef.current.clear();
      return;
    }

    liveBuggies.forEach((buggy) => {
      const secondsAgo =
        typeof buggy.lastSeenSecondsAgo === "number"
          ? buggy.lastSeenSecondsAgo
          : null;
      const isOfflineTooLong =
        buggy.connectionStatus === "offline" &&
        secondsAgo !== null &&
        secondsAgo >= OFFLINE_ALERT_MIN_SECONDS;

      if (!isOfflineTooLong) {
        offlineAlertedBuggyIdsRef.current.delete(buggy.id);
        return;
      }

      if (offlineAlertedBuggyIdsRef.current.has(buggy.id)) return;

      offlineAlertedBuggyIdsRef.current.add(buggy.id);
      const minutesAgo = Math.max(1, Math.floor(secondsAgo / 60));

      addToast({
        tone: "warning",
        title: t("offlineBuggyAlertTitle", { buggyName: buggy.name }),
        description: t("offlineBuggyAlertDescription", { minutes: minutesAgo }),
        duration: 7000,
      });

      if (
        browserNotificationEnabled &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification(t("offlineBuggyNotificationTitle"), {
          body: t("offlineBuggyNotificationBody", {
            buggyName: buggy.name,
            minutes: minutesAgo,
          }),
          tag: `offline-${buggy.id}`,
        });
      }
    });
  }, [
    addToast,
    browserNotificationEnabled,
    isAdminUser,
    liveBuggies,
    settings.offlineBuggyAlertsEnabled,
    t,
  ]);

  const accountMenuItems = useMemo<AccountMenuItem[]>(
    () =>
      isAuthenticated
        ? [
            {
              label: t("editAccount"),
              icon: <PenIcon className="h-4 w-4 text-slate-500" />,
              onClick: (): void => {
                handleOpenSettings("edit");
              },
            },
            {
              label: tNav("signOut"),
              icon: <LogoutIcon className="h-4 w-4" />,
              onClick: (): void => {
                void handleLogout();
              },
              tone: "danger",
            },
          ]
        : [],
    [handleLogout, handleOpenSettings, isAuthenticated, t, tNav],
  );

  const mapBuggies = activeView === "halte" ? [] : visibleBuggies;
  const mapRoutePath = activeView === "buggy" ? OFFICIAL_ROUTE_PATH : [];
  const mapDirectionPath =
    activeView === "buggy" ? (directionResult?.directionPath ?? []) : [];
  const mapHistoryPath = activeView === "history" ? historyPath : [];
  const mapHistoryStopPoints =
    activeView === "history" ? historyStopPoints : [];

  return (
    <main
      ref={dashboardShellRef}
      className="relative h-screen w-screen overflow-hidden bg-slate-100"
    >
      <MapCanvas
        buggies={mapBuggies}
        haltes={HALTE_LOCATIONS}
        routePath={mapRoutePath}
        mapStyle={settings.mapStyle}
        directionPath={mapDirectionPath}
        walkingToHaltePath={directionResult?.walkingToHalte?.path}
        walkingFromHaltePath={directionResult?.walkingFromHalte?.path}
        userPosition={userPosition}
        originMarkerPosition={directionResult?.originPosition}
        destinationMarkerPosition={directionResult?.destinationPosition}
        selectedBuggyId={mapFollowingBuggyId}
        selectedHalteId={selectedHalteId}
        geofences={permissions.canViewOperatorPanels ? geofences : []}
        geofenceCreateMode={
          permissions.canManageDashboard && geofenceCreateMode
        }
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
        historyStopPoints={mapHistoryStopPoints}
      />

      <MobileTopBar
        actions={
          <>
            <button
              type="button"
              onClick={() => handleSelectView("notifikasi")}
              aria-label={tNav("notifications")}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-900/50 text-white backdrop-blur-md transition active:scale-95"
            >
              <BellIcon className="h-5 w-5" />
            </button>
            <AccountPill
              variant="mobile-icon"
              loading={userLoading}
              user={userProfile}
              menuItems={accountMenuItems}
              fallback={{
                label: tNav("signIn"),
                icon: <LoginIcon className="h-5 w-5" />,
                onClick: () => openLogin("/"),
              }}
            />
          </>
        }
      />

      <NearestHalteChips
        haltes={nearestHalteRecommendations}
        onPick={(id) => void runRecommendedHalteDirection(id)}
        topClass={searchStep === "origin" ? "top-40" : "top-28"}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <div className="absolute right-3 top-3 z-20 hidden items-center justify-end gap-2 xl:right-4 xl:top-4 xl:flex">
        <AccountPill
          variant="desktop"
          loading={userLoading}
          user={userProfile}
          menuItems={accountMenuItems}
          fallback={{
            label: tNav("signIn"),
            description: tCommon("signInHere"),
            icon: <LoginIcon className="size-4" />,
            onClick: () => openLogin("/"),
          }}
          defaultName={isDriverUser ? tCommon("driver") : "User"}
        />
      </div>

      <FloatingSidebar
        activeView={activeView}
        onSelectView={handleSelectView}
        showDataButton={permissions.canViewOperatorPanels}
        onLogin={() => openLogin("/")}
      />

      <LiveSearchBar
        fromValue={fromInput}
        toValue={toInput}
        onFromChange={setFromInput}
        onToChange={(val) => {
          setToInput(val);
          setDirectionResult(null);
        }}
        userPosition={userPosition}
        getLatestUserPosition={getLatestUserPosition}
        onSubmit={runDirectionSearch}
        showOriginField={searchStep === "origin"}
        onBackToDestination={resetToDestination}
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
        onClearSelectedHalte={handleClearSelectedHalte}
        directionResult={directionResult}
        onCloseDirection={() => setDirectionResult(null)}
        canFavorite={permissions.canUseFavorites && canFavorite && favoritesReady}
        favoriteBuggies={favoriteBuggies}
        favoriteHaltes={favoriteHaltes}
        onToggleFavoriteBuggy={toggleFavoriteBuggy}
        onToggleFavoriteHalte={toggleFavoriteHalte}
        showApnStatus={permissions.canViewOperatorPanels}
        dataViewContent={
          permissions.canViewDataPanel ? (
            <AdminDataSection
              buggies={dataManagementBuggies}
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
              activePanel={adminDataPanel}
              onActivePanelChange={setAdminDataPanel}
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
          ) : null
        }
        dataDetailViewContent={
          permissions.canViewDataPanel && selectedAdminBuggy ? (
            <BuggyOperationalDetail
              buggy={selectedAdminBuggy}
              assignedDriverName={driverNamesByBuggyId[selectedAdminBuggy.id]}
              activeZones={geofenceStatuses[selectedAdminBuggy.id] ?? []}
              onBack={() => {
                setSelectedAdminBuggyId(null);
                setActiveView("data");
              }}
              onDeleteSuccess={() => {
                setSelectedAdminBuggyId(null);
                setActiveView("data");
                void handleBuggyMutated();
              }}
              onSaved={() => void handleBuggyMutated()}
              readOnly={!canManageDashboard}
            />
          ) : null
        }
        historyViewContent={
          permissions.canViewHistory ? (
            <HistoryPanel
              buggies={visibleBuggies}
              onShowPath={(path, stopPoints = []) => {
                setHistoryPath(path);
                setHistoryStopPoints(stopPoints);
              }}
              readOnly={!canManageDashboard}
            />
          ) : null
        }
        settingsViewContent={
          <AppSettingsPanel
            mode={permissions.canViewOperatorPanels ? "admin" : "public"}
            settings={settings}
            onUpdateSetting={updateSetting}
            onResetSettings={resetSettings}
            onToggleBrowserNotification={handleToggleBrowserNotification}
            onLogin={() => openLogin("/")}
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
        showDataButton={permissions.canViewOperatorPanels}
      />
      <AuthModal
        open={authModalOpen}
        redirectTo={authRedirectTo}
        onClose={() => setAuthModalOpen(false)}
      />
    </main>
  );
}
