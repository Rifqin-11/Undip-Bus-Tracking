"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ToastItem } from "@/components/ui/ToastStack";
import type { Buggy } from "@/types/buggy";

const OFFLINE_ALERT_MIN_SECONDS = 5 * 60;

type AddToast = (toast: Omit<ToastItem, "id">) => void;

type UseOfflineBuggyAlertsOptions = {
  isAdminUser: boolean;
  enabled: boolean;
  browserNotificationEnabled: boolean;
  liveBuggies: Buggy[];
  addToast: AddToast;
};

export function useOfflineBuggyAlerts({
  isAdminUser,
  enabled,
  browserNotificationEnabled,
  liveBuggies,
  addToast,
}: UseOfflineBuggyAlertsOptions) {
  const { t } = useTranslation("admin");
  const alertedBuggyIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isAdminUser || !enabled) {
      alertedBuggyIdsRef.current.clear();
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
        alertedBuggyIdsRef.current.delete(buggy.id);
        return;
      }

      if (alertedBuggyIdsRef.current.has(buggy.id)) return;

      alertedBuggyIdsRef.current.add(buggy.id);
      const minutesAgo = Math.max(1, Math.floor(secondsAgo / 60));

      addToast({
        tone: "warning",
        title: t("offlineBuggyAlertTitle", { buggyName: buggy.name }),
        description: t("offlineBuggyAlertDescription", {
          minutes: minutesAgo,
        }),
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
  }, [addToast, browserNotificationEnabled, enabled, isAdminUser, liveBuggies, t]);
}
