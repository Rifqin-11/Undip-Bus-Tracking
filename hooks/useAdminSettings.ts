"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export type AdminSettings = {
  browserNotificationEnabled: boolean;
  openPanelOnDashboard: boolean;
  compactAdminPanels: boolean;
};

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  browserNotificationEnabled: false,
  openPanelOnDashboard: true,
  compactAdminPanels: false,
};

const ADMIN_SETTINGS_STORAGE_KEY = "simobi_admin_settings";
const ADMIN_SETTINGS_EVENT = "simobi-admin-settings-change";
const DEFAULT_ADMIN_SETTINGS_JSON = JSON.stringify(DEFAULT_ADMIN_SETTINGS);

function readStoredSettingsSnapshot(): string {
  if (typeof window === "undefined") return DEFAULT_ADMIN_SETTINGS_JSON;
  return (
    window.localStorage.getItem(ADMIN_SETTINGS_STORAGE_KEY) ??
    DEFAULT_ADMIN_SETTINGS_JSON
  );
}

function parseStoredSettings(raw: string): AdminSettings {
  try {
    const parsed = JSON.parse(raw) as Partial<AdminSettings>;
    return {
      ...DEFAULT_ADMIN_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_ADMIN_SETTINGS;
  }
}

function writeStoredSettings(settings: AdminSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    ADMIN_SETTINGS_STORAGE_KEY,
    JSON.stringify(settings),
  );
  window.dispatchEvent(new Event(ADMIN_SETTINGS_EVENT));
}

function subscribeToSettings(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === ADMIN_SETTINGS_STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(ADMIN_SETTINGS_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(ADMIN_SETTINGS_EVENT, onStoreChange);
  };
}

export function useAdminSettings() {
  const settingsSnapshot = useSyncExternalStore(
    subscribeToSettings,
    readStoredSettingsSnapshot,
    () => DEFAULT_ADMIN_SETTINGS_JSON,
  );

  const settings = useMemo(
    () => parseStoredSettings(settingsSnapshot),
    [settingsSnapshot],
  );

  const updateSetting = useCallback(
    <Key extends keyof AdminSettings>(key: Key, value: AdminSettings[Key]) => {
      const next = {
        ...parseStoredSettings(readStoredSettingsSnapshot()),
        [key]: value,
      };
      writeStoredSettings(next);
    },
    [],
  );

  return { settings, updateSetting };
}
