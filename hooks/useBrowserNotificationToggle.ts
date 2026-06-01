"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ToastItem } from "@/components/ui/ToastStack";
import {
  subscribeToWebPush,
  unsubscribeFromWebPush,
} from "@/lib/push/client";
import { haversineMeters } from "@/lib/transit/buggy-route-utils";
import type { LatLng } from "@/hooks/useUserPosition";

type AddToastFn = (toast: Omit<ToastItem, "id">) => void;

type UseBrowserNotificationToggleOptions = {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  addToast: AddToastFn;
  webPushEnabled?: boolean;
  userPosition?: LatLng | null;
  nearbyAlertRadiusMeters?: number;
};

/**
 * Hook untuk mengelola toggle Notifikasi Browser.
 * Menangani: dukungan API, izin (granted/denied/default), permintaan izin satu kali per session.
 */
export function useBrowserNotificationToggle({
  enabled,
  setEnabled,
  addToast,
  webPushEnabled = false,
  userPosition,
  nearbyAlertRadiusMeters,
}: UseBrowserNotificationToggleOptions) {
  const { t } = useTranslation("notifications");
  const requestedRef = useRef(false);
  const lastSyncRef = useRef<{ at: number; position: LatLng | null }>({
    at: 0,
    position: null,
  });

  useEffect(() => {
    if (
      !enabled ||
      !webPushEnabled ||
      typeof window === "undefined" ||
      !("Notification" in window) ||
      Notification.permission !== "granted" ||
      !userPosition
    ) {
      return;
    }

    const lastSync = lastSyncRef.current;
    const elapsedMs = Date.now() - lastSync.at;
    const movedMeters = lastSync.position
      ? haversineMeters(lastSync.position, userPosition)
      : Number.POSITIVE_INFINITY;

    if (elapsedMs < 30_000 && movedMeters < 25) return;

    lastSyncRef.current = { at: Date.now(), position: userPosition };
    void subscribeToWebPush({ userPosition, nearbyAlertRadiusMeters }).catch(
      () => undefined,
    );
  }, [enabled, nearbyAlertRadiusMeters, userPosition, webPushEnabled]);

  const toggle = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      addToast({
        tone: "warning",
        title: t("browserUnsupportedTitle"),
        description: "Gunakan browser modern untuk fitur ini.",
        duration: 5_000,
      });
      return;
    }

    if (enabled) {
      if (webPushEnabled) {
        await unsubscribeFromWebPush();
      }
      setEnabled(false);
      addToast({
        tone: "info",
        title: t("browserDisabledTitle"),
        duration: 3_000,
      });
      return;
    }

    if (Notification.permission === "granted") {
      if (webPushEnabled) {
        try {
          await subscribeToWebPush({ userPosition, nearbyAlertRadiusMeters });
        } catch (err) {
          addToast({
            tone: "warning",
            title: "Push notification belum aktif",
            description:
              err instanceof Error
                ? err.message
                : "Service Worker atau Push API belum siap.",
            duration: 5_000,
          });
          return;
        }
      }
      setEnabled(true);
      addToast({
        tone: "success",
        title: t("browserActiveTitle"),
        duration: 3_000,
      });
      return;
    }

    if (Notification.permission === "denied") {
      addToast({
        tone: "warning",
        title: "Izin notifikasi ditolak",
        description: "Izinkan notifikasi dari pengaturan browser.",
        duration: 5_000,
      });
      return;
    }

    if (requestedRef.current) {
      addToast({
        tone: "warning",
        title: "Izin notifikasi belum diberikan",
        duration: 4_000,
      });
      return;
    }

    requestedRef.current = true;
    const result = await Notification.requestPermission();
    if (result === "granted") {
      if (webPushEnabled) {
        try {
          await subscribeToWebPush({ userPosition, nearbyAlertRadiusMeters });
        } catch (err) {
          addToast({
            tone: "warning",
            title: "Push notification belum aktif",
            description:
              err instanceof Error
                ? err.message
                : "Service Worker atau Push API belum siap.",
            duration: 5_000,
          });
          return;
        }
      }
      setEnabled(true);
      addToast({
        tone: "success",
        title: t("browserActiveTitle"),
        duration: 3_000,
      });
      return;
    }

    addToast({
      tone: "warning",
      title: t("browserStillInactiveTitle"),
      description: "Izin tidak diberikan.",
      duration: 5_000,
    });
  }, [
    addToast,
    enabled,
    nearbyAlertRadiusMeters,
    setEnabled,
    t,
    userPosition,
    webPushEnabled,
  ]);

  return { toggle };
}
