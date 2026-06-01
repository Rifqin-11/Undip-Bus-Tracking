"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AuthModal } from "@/components/auth/AuthModal";
import { MapCanvas } from "@/components/map/MapCanvas";
import { BuggyList } from "@/components/buggy/PanelActive";
import { FloatingSidebar } from "@/components/sidebar/FloatingSidebar";
import { MobileBottomNav } from "@/components/sidebar/MobileBottomNav";
import { LiveSearchBar } from "@/components/search/LiveSearchBar";
import { AppSettingsPanel } from "@/components/settings/AppSettingsPanel";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { NearestHalteChips } from "@/components/layout/NearestHalteChips";
import { AccountPill } from "@/components/layout/AccountPill";
import { BellIcon, LoginIcon } from "@/components/ui/Icons";
import { ToastStack } from "@/components/ui/ToastStack";
import { useNearbyBusAlert } from "@/hooks/useNearbyBusAlert";
import { useAdminSettings, type AdminSettings } from "@/hooks/useAdminSettings";
import { useFavorites } from "@/hooks/useFavorites";
import { HALTE_LOCATIONS, OFFICIAL_ROUTE_PATH } from "@/lib/transit/buggy-data";
import { useBuggyLiveFeed } from "@/hooks/useBuggyLiveFeed";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserPosition } from "@/hooks/useUserPosition";
import { useToastStack } from "@/hooks/useToastStack";
import { useNearestHaltes } from "@/hooks/useNearestHaltes";
import { useBrowserNotificationToggle } from "@/hooks/useBrowserNotificationToggle";
import { useDirectionSearch } from "@/hooks/useDirectionSearch";
import type { PanelView } from "@/types/buggy";
import { useLocale } from "@/lib/i18n/client";
import { localizePath } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/client";

const HALTE_FALLBACK_POSITION = {
  lat: HALTE_LOCATIONS[0].lat,
  lng: HALTE_LOCATIONS[0].lng,
};

export default function DashboardPage() {
  const router = useRouter();
  const locale = useLocale();
  const { t } = useTranslation("dashboard");
  const { t: tAuth } = useTranslation("auth");
  const { t: tNav } = useTranslation("navigation");
  const realtimeFeed = useBuggyLiveFeed();
  const { settings, updateSetting, resetSettings } = useAdminSettings();
  const { userProfile, loading: userLoading, isAuthenticated } = useUserRole();
  const {
    favoriteBuggies,
    favoriteHaltes,
    canFavorite,
    ready: favoritesReady,
    toggleBuggy: toggleFavoriteBuggy,
    toggleHalte: toggleFavoriteHalte,
  } = useFavorites();
  const liveBuggies = useMemo(
    () => realtimeFeed.liveBuggies ?? [],
    [realtimeFeed.liveBuggies],
  );

  const [activeView, setActiveView] = useState<PanelView>("buggy");
  const [panelOpen, setPanelOpen] = useState(settings.openPanelOnDashboard);
  const [selectedBuggyId, setSelectedBuggyId] = useState<string | null>(null);
  const [mapFollowingBuggyId, setMapFollowingBuggyId] = useState<string | null>(
    null,
  );
  const [selectedHalteId, setSelectedHalteId] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authRedirectTo, setAuthRedirectTo] = useState(localizePath("/", locale));

  const { userPosition, getLatestUserPosition } = useUserPosition();
  const { toasts, addToast, dismissToast } = useToastStack();
  const nearestHalteRecommendations = useNearestHaltes({
    haltes: HALTE_LOCATIONS,
    userPosition,
    fallback: liveBuggies[0]?.position ?? HALTE_FALLBACK_POSITION,
  });

  const openAuthModal = useCallback(
    (next = "/") => {
      setAuthRedirectTo(localizePath(next, locale));
      setAuthModalOpen(true);
    },
    [locale],
  );

  const requireDirectionLogin = useCallback(() => {
    if (userLoading) {
      addToast({
        tone: "info",
        title: t("loading", { ns: "common" }),
        description: "Tunggu sebentar lalu coba lagi.",
        duration: 3_000,
      });
      return false;
    }

    if (isAuthenticated) {
      return true;
    }

    addToast({
      tone: "warning",
      title: tAuth("signInRequired"),
      description: tAuth("signInRouteSearch"),
      duration: 5_000,
    });
    openAuthModal("/");
    return false;
  }, [addToast, isAuthenticated, openAuthModal, t, tAuth, userLoading]);

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
    liveBuggies,
    haltes: HALTE_LOCATIONS,
    routePath: OFFICIAL_ROUTE_PATH,
    getLatestUserPosition,
    requireAuth: requireDirectionLogin,
    onSearchComplete: (_result, nearest) => {
      if (nearest) {
        setSelectedBuggyId(nearest.id);
        setMapFollowingBuggyId(nearest.id);
      }
      setActiveView("buggy");
      setPanelOpen(true);
    },
  });

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setDirectionResult(null);
    setFromInput("");
    setToInput("");
    resetToDestination();
    router.push(localizePath("/", locale));
    router.refresh();
  }, [
    resetToDestination,
    locale,
    router,
    setDirectionResult,
    setFromInput,
    setToInput,
  ]);

  const handleSelectView = useCallback((view: PanelView) => {
    setActiveView(view);
    setPanelOpen(true);
  }, []);

  const handleUpdateSetting = useCallback(
    <Key extends keyof AdminSettings>(key: Key, value: AdminSettings[Key]) => {
      updateSetting(key, value);
      if (key === "openPanelOnDashboard") {
        setPanelOpen(Boolean(value));
      }
    },
    [updateSetting],
  );

  const { toggle: handleToggleBrowserNotification } =
    useBrowserNotificationToggle({
      enabled: settings.browserNotificationEnabled,
      setEnabled: (next) => updateSetting("browserNotificationEnabled", next),
      addToast,
      webPushEnabled: true,
      userPosition,
      nearbyAlertRadiusMeters: settings.nearbyAlertRadiusMeters,
    });

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

  // ── Nearby bus alert ──────────────────────────────────────────────────────
  useNearbyBusAlert({
    buggies: liveBuggies,
    userPosition,
    thresholdMeters: settings.nearbyAlertRadiusMeters,
    onAlert: ({ busName, halteName, distanceMeters }) => {
      addToast({
        tone: "bus",
        title: t("nearbyBusTitle", { busName }),
        description: `${halteName} · ${t("metersLeft", { ns: "common", distance: distanceMeters })}`,
        duration: 7_000,
      });

      if (
        settings.browserNotificationEnabled &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification(t("nearbyBusTitle", { busName }), {
          body: `${halteName} · ${t("metersLeft", { ns: "common", distance: distanceMeters })}`,
        });
      }
    },
  });

  // Map data
  const mapBuggies = activeView === "halte" ? [] : liveBuggies;
  const mapRoutePath = activeView === "buggy" ? OFFICIAL_ROUTE_PATH : [];
  const mapDirectionPath =
    activeView === "buggy" ? (directionResult?.directionPath ?? []) : [];

  return (
    <main className="fixed inset-0 overflow-hidden bg-slate-100">
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
        onInfoWindowClose={handleInfoWindowClose}
        onBuggyMarkerClick={handleBuggyMarkerClick}
        onHalteMarkerClick={handleHalteMarkerClick}
        focusHaltes={activeView === "halte"}
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
              user={userProfile}
              loading={userLoading}
              onClick={() => handleSelectView("settings")}
              fallback={{
                label: tNav("signIn"),
                icon: <LoginIcon className="h-5 w-5" />,
                onClick: () => openAuthModal("/admin"),
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

      <div className="absolute right-3 top-3 z-20 hidden items-center justify-end gap-2 xl:right-4 xl:top-4 xl:flex">
        <AccountPill
          variant="desktop"
          user={userProfile}
          loading={userLoading}
          onClick={() => handleSelectView("settings")}
          fallback={{
            label: tNav("signIn"),
            description: t("signInHere", { ns: "common" }),
            icon: <LoginIcon className="size-4" />,
            onClick: () => openAuthModal("/admin"),
          }}
        />
      </div>



      <FloatingSidebar
        activeView={activeView}
        onSelectView={handleSelectView}
        onLogin={() => openAuthModal("/admin")}
      />

      <LiveSearchBar
        fromValue={fromInput}
        toValue={toInput}
        onFromChange={setFromInput}
        onToChange={(val) => {
          setToInput(val);
          setDirectionResult(null);
        }}
        onSubmit={runDirectionSearch}
        showOriginField={searchStep === "origin"}
        onBackToDestination={resetToDestination}
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
        onClearSelectedHalte={handleClearSelectedHalte}
        directionResult={directionResult}
        onCloseDirection={() => setDirectionResult(null)}
        canFavorite={canFavorite && favoritesReady}
        favoriteBuggies={favoriteBuggies}
        favoriteHaltes={favoriteHaltes}
        onToggleFavoriteBuggy={toggleFavoriteBuggy}
        onToggleFavoriteHalte={toggleFavoriteHalte}
        settingsViewContent={
          <AppSettingsPanel
            mode="public"
            settings={settings}
            onUpdateSetting={handleUpdateSetting}
            onResetSettings={resetSettings}
            onToggleBrowserNotification={handleToggleBrowserNotification}
            onLogin={() => openAuthModal("/")}
            onLogout={handleLogout}
          />
        }
      />

      <MobileBottomNav
        activeView={activeView}
        onSelectView={handleSelectView}
        onDragOpenPanel={() => setPanelOpen(true)}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <AuthModal
        open={authModalOpen}
        redirectTo={authRedirectTo}
        onClose={() => setAuthModalOpen(false)}
      />
    </main>
  );
}
