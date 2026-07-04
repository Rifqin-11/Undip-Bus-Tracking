"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccountFormMode } from "@/components/settings/AccountFormPanel";
import type { AdminDataPanel } from "@/components/admin/fleet/AdminDataSection";
import type { HistoryStopPoint } from "@/lib/history/stop-points";
import type { PanelView } from "@/types/buggy";

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
  window.history.replaceState(
    null,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

type UseDashboardViewStateOptions = {
  canViewOperatorPanels: boolean;
  configuredPanelOpen: boolean;
  defaultPanelOpen: boolean;
};

export function useDashboardViewState({
  canViewOperatorPanels,
  configuredPanelOpen,
  defaultPanelOpen,
}: UseDashboardViewStateOptions) {
  const [activeView, setActiveView] = useState<PanelView>("buggy");
  const [panelOpen, setPanelOpen] = useState(defaultPanelOpen);
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
  const [historyPath, setHistoryPath] = useState<[number, number][]>([]);
  const [historyStopPoints, setHistoryStopPoints] = useState<
    HistoryStopPoint[]
  >([]);
  const [settingsAccountForm, setSettingsAccountForm] =
    useState<AccountFormMode | null>(null);
  const [activeViewHydrated, setActiveViewHydrated] = useState(false);

  const handleSelectView = useCallback(
    (view: PanelView) => {
      if (!canViewOperatorPanels && isOperatorPanelView(view)) {
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
    },
    [canViewOperatorPanels],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const viewParam = new URLSearchParams(window.location.search).get("view");
    const storedView = window.localStorage.getItem(
      ADMIN_ACTIVE_VIEW_STORAGE_KEY,
    );
    const restoredView = isPersistedAdminView(viewParam)
      ? viewParam
      : isPersistedAdminView(storedView)
        ? storedView
        : null;

    if (
      restoredView &&
      (canViewOperatorPanels || !isOperatorPanelView(restoredView))
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleSelectView(restoredView);
    }

    setActiveViewHydrated(true);
  }, [canViewOperatorPanels, handleSelectView]);

  useEffect(() => {
    if (!activeViewHydrated) return;
    if (typeof window === "undefined") return;
    if (!isPersistedAdminView(activeView)) return;
    if (!canViewOperatorPanels && isOperatorPanelView(activeView)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveView("buggy");
      return;
    }

    window.localStorage.setItem(ADMIN_ACTIVE_VIEW_STORAGE_KEY, activeView);
    replaceAdminViewQuery(activeView);
  }, [activeView, activeViewHydrated, canViewOperatorPanels]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("view")
    ) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPanelOpen(configuredPanelOpen);
  }, [configuredPanelOpen]);

  return {
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
  };
}
