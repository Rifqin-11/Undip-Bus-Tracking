"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthModal } from "@/components/auth/AuthModal";
import { MapCanvas } from "@/components/map/MapCanvas";
import { DashboardSidePanel } from "@/components/dashboard/DashboardSidePanel";
import { FloatingSidebar } from "@/components/sidebar/FloatingSidebar";
import { MobileBottomNav } from "@/components/sidebar/MobileBottomNav";
import { LiveSearchBar } from "@/components/search/LiveSearchBar";
import type { AccountFormMode } from "@/components/settings/AccountFormPanel";
import { ToastStack } from "@/components/ui/ToastStack";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { NearestHalteChips } from "@/components/layout/NearestHalteChips";
import {
  AccountPill,
  type AccountMenuItem,
} from "@/components/layout/AccountPill";
import { HALTE_LOCATIONS, OFFICIAL_ROUTE_PATH } from "@/lib/transit/buggy-data";
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
import { useDashboardViewState } from "@/hooks/useDashboardViewState";
import { useDashboardGeofences } from "@/hooks/useDashboardGeofences";
import { useOfflineBuggyAlerts } from "@/hooks/useOfflineBuggyAlerts";
import { useDashboardFleetData } from "@/hooks/useDashboardFleetData";
import { useDriverAssignments } from "@/hooks/useDriverAssignments";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/client";
import { localizePath } from "@/lib/i18n/routing";
import { getDashboardPermissions } from "@/lib/auth/dashboard-permissions";
import { LogoutIcon, BellIcon, LoginIcon } from "@/components/ui/Icons";
import { PenIcon } from "lucide-react";

const HALTE_FALLBACK_POSITION = {
  lat: HALTE_LOCATIONS[0].lat,
  lng: HALTE_LOCATIONS[0].lng,
};

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
  const assignedBuggyId = userProfile?.buggy_id;
  const {
    favoriteBuggies,
    favoriteHaltes,
    canFavorite,
    ready: favoritesReady,
    toggleBuggy: toggleFavoriteBuggy,
    toggleHalte: toggleFavoriteHalte,
  } = useFavorites();
  const browserNotificationEnabled = settings.browserNotificationEnabled;
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authRedirectTo, setAuthRedirectTo] = useState(localizePath("/", locale));
  const {
    activeView,
    setActiveView,
    panelOpen,
    setPanelOpen,
    selectedBuggyId,
    setSelectedBuggyId,
    selectedAdminBuggyId,
    setSelectedAdminBuggyId,
    adminDataPanel,
    setAdminDataPanel,
    mapFollowingBuggyId,
    setMapFollowingBuggyId,
    selectedHalteId,
    setSelectedHalteId,
    historyPath,
    setHistoryPath,
    historyStopPoints,
    setHistoryStopPoints,
    settingsAccountForm,
    setSettingsAccountForm,
    handleSelectView,
  } = useDashboardViewState({
    canViewOperatorPanels: permissions.canViewOperatorPanels,
    configuredPanelOpen: settings.openPanelOnDashboard,
    defaultPanelOpen: DEFAULT_ADMIN_SETTINGS.openPanelOnDashboard,
  });

  const canManageDashboard = permissions.canManageDashboard;
  const {
    liveBuggies,
    visibleBuggies,
    dataManagementBuggies,
    selectedAdminBuggy,
    haltes,
    activeHaltes,
    loadHaltes,
    handleBuggyMutated,
  } = useDashboardFleetData({
    realtimeBuggies: realtimeFeed.liveBuggies,
    assignedBuggyId,
    canViewAssignedBuggyOnly: permissions.canViewAssignedBuggyOnly,
    canViewAllBuggies: permissions.canViewAllBuggies,
    canManageDashboard,
    selectedAdminBuggyId,
  });

  const { userPosition, getLatestUserPosition } = useUserPosition();
  const { toasts, addToast, dismissToast } = useToastStack();
  const nearestHalteRecommendations = useNearestHaltes({
    haltes: activeHaltes,
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
    haltes: activeHaltes,
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

  const { driverNamesByBuggyId } = useDriverAssignments({
    enabled: activeView === "data" || activeView === "data-detail",
    isAdminUser,
    isDriverUser,
    userProfile,
    liveBuggies,
    refreshKey: selectedAdminBuggyId,
  });

  const handleLogout = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // noop
    }
    setSettingsAccountForm(null);
    window.location.href = localizePath("/", locale);
  }, [locale, setSettingsAccountForm]);

  const handleOpenSettings = useCallback(
    (accountForm: AccountFormMode | null = null) => {
      setSettingsAccountForm(accountForm);
      setActiveView("settings");
      setPanelOpen(true);
    },
    [setActiveView, setPanelOpen, setSettingsAccountForm],
  );

  const { toggle: handleToggleBrowserNotification } =
    useBrowserNotificationToggle({
      enabled: browserNotificationEnabled,
      setEnabled: (next) => updateSetting("browserNotificationEnabled", next),
      addToast,
    });

  const openDataView = useCallback(() => {
    setPanelOpen(true);
    setActiveView("data");
  }, [setActiveView, setPanelOpen]);

  const {
    geofences,
    geofenceLoading,
    geofenceCreateMode,
    geofenceEvents,
    geofenceStatuses,
    draftGeofence,
    draftGeofenceName,
    setDraftGeofenceName,
    setDraftGeofenceRadius,
    handleDraftGeofenceChange,
    handleToggleCreateMode,
    handleEditGeofence,
    handleCancelDraft,
    handleSaveDraft,
    handleToggleGeofence,
    handleDeleteGeofence,
  } = useDashboardGeofences({
    canManageDashboard,
    canViewOperatorPanels: permissions.canViewOperatorPanels,
    liveBuggies,
    geofenceEventAlertsEnabled: settings.geofenceEventAlertsEnabled,
    browserNotificationEnabled,
    addToast,
    onOpenDataView: openDataView,
  });

  useOfflineBuggyAlerts({
    isAdminUser,
    enabled: settings.offlineBuggyAlertsEnabled,
    browserNotificationEnabled,
    liveBuggies,
    addToast,
  });

  const handleSelectAdminBuggy = useCallback((buggyId: string) => {
    setSelectedAdminBuggyId(buggyId);
    setActiveView("data-detail");
    setAdminDataPanel("buggy");
    setPanelOpen(true);
  }, [setActiveView, setAdminDataPanel, setPanelOpen, setSelectedAdminBuggyId]);

  const handleInfoWindowClose = useCallback(() => {
    setMapFollowingBuggyId(null);
  }, [setMapFollowingBuggyId]);

  const handleBuggyMarkerClick = useCallback((buggyId: string) => {
    setPanelOpen(true);
    setActiveView("buggy");
    setSelectedBuggyId(buggyId);
    setMapFollowingBuggyId(buggyId);
  }, [setActiveView, setMapFollowingBuggyId, setPanelOpen, setSelectedBuggyId]);

  const handleHalteMarkerClick = useCallback((halteId: string) => {
    setPanelOpen(true);
    setActiveView("halte");
    setSelectedHalteId(halteId);
  }, [setActiveView, setPanelOpen, setSelectedHalteId]);

  const handleFocusBuggy = useCallback((buggyId: string) => {
    setSelectedBuggyId(buggyId);
    setMapFollowingBuggyId(buggyId);
  }, [setMapFollowingBuggyId, setSelectedBuggyId]);

  const handleSelectBuggy = useCallback((buggyId: string) => {
    setSelectedBuggyId(buggyId);
    setMapFollowingBuggyId(buggyId);
  }, [setMapFollowingBuggyId, setSelectedBuggyId]);

  const handleSelectHalte = useCallback((halteId: string) => {
    setSelectedHalteId(halteId);
  }, [setSelectedHalteId]);

  const handleClearSelectedHalte = useCallback(() => {
    setSelectedHalteId(null);
  }, [setSelectedHalteId]);

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
  const mapRoutePath =
    activeView === "buggy" || activeView === "halte"
      ? OFFICIAL_ROUTE_PATH
      : [];
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
        haltes={activeHaltes}
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
        draftGeofence={draftGeofence}
        onDraftGeofenceChange={handleDraftGeofenceChange}
        onInfoWindowClose={handleInfoWindowClose}
        onBuggyMarkerClick={handleBuggyMarkerClick}
        onHalteMarkerClick={handleHalteMarkerClick}
        halteMarkersClickable={activeView !== "history"}
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

      <DashboardSidePanel
        buggies={visibleBuggies}
        haltes={canManageDashboard ? haltes : activeHaltes}
        panelOpen={panelOpen}
        activeView={activeView}
        onClose={() => setPanelOpen(false)}
        selectedBuggyId={selectedBuggyId}
        selectedHalteId={selectedHalteId}
        onFocusBuggy={handleFocusBuggy}
        onSelectBuggy={handleSelectBuggy}
        onSelectHalte={handleSelectHalte}
        onClearSelectedHalte={handleClearSelectedHalte}
        onHaltesChanged={loadHaltes}
        directionResult={directionResult}
        onCloseDirection={() => setDirectionResult(null)}
        canFavorite={permissions.canUseFavorites && canFavorite && favoritesReady}
        favoriteBuggies={favoriteBuggies}
        favoriteHaltes={favoriteHaltes}
        onToggleFavoriteBuggy={toggleFavoriteBuggy}
        onToggleFavoriteHalte={toggleFavoriteHalte}
        showApnStatus={permissions.canViewOperatorPanels}
        isAdmin={canManageDashboard}
        canViewDataPanel={permissions.canViewDataPanel}
        canViewHistory={permissions.canViewHistory}
        adminDataProps={{
          buggies: dataManagementBuggies,
          realtimeConnected: realtimeFeed.connected,
          realtimeSource: realtimeFeed.source,
          geofences,
          events: geofenceEvents,
          geofenceStatuses,
          geofenceLoading,
          geofenceCreateMode,
          draftGeofence,
          draftName: draftGeofenceName,
          browserNotificationEnabled,
          onSelectBuggy: handleSelectAdminBuggy,
          activePanel: adminDataPanel,
          onActivePanelChange: setAdminDataPanel,
          onToggleCreateMode: handleToggleCreateMode,
          onDraftNameChange: setDraftGeofenceName,
          onDraftRadiusChange: setDraftGeofenceRadius,
          onSaveDraft: handleSaveDraft,
          onCancelDraft: handleCancelDraft,
          onToggleGeofence: handleToggleGeofence,
          onEditGeofence: handleEditGeofence,
          onDeleteGeofence: handleDeleteGeofence,
          onToggleBrowserNotification: handleToggleBrowserNotification,
          compactMode: settings.compactAdminPanels,
          readOnly: !canManageDashboard,
          onBuggyMutated: () => void handleBuggyMutated(),
        }}
        selectedAdminBuggy={selectedAdminBuggy}
        assignedDriverName={
          selectedAdminBuggy
            ? driverNamesByBuggyId[selectedAdminBuggy.id]
            : undefined
        }
        activeZones={
          selectedAdminBuggy
            ? (geofenceStatuses[selectedAdminBuggy.id] ?? [])
            : []
        }
        onDetailBack={() => {
          setSelectedAdminBuggyId(null);
          setActiveView("data");
        }}
        onDetailDeleteSuccess={() => {
          setSelectedAdminBuggyId(null);
          setActiveView("data");
          void handleBuggyMutated();
        }}
        onDetailSaved={() => void handleBuggyMutated()}
        historyPanelProps={{
          buggies: visibleBuggies,
          enabled: activeView === "history",
          onShowPath: (path, stopPoints = []) => {
            setHistoryPath(path);
            setHistoryStopPoints(stopPoints);
          },
          readOnly: !canManageDashboard,
        }}
        settingsPanelProps={{
          mode: permissions.canViewOperatorPanels ? "admin" : "public",
          settings,
          onUpdateSetting: updateSetting,
          onResetSettings: resetSettings,
          onToggleBrowserNotification: handleToggleBrowserNotification,
          onLogin: () => openLogin("/"),
          onLogout: handleLogout,
          accountForm: settingsAccountForm,
          onAccountFormChange: setSettingsAccountForm,
        }}
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
