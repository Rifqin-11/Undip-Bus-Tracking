"use client";

import { useCallback, useRef } from "react";
import type { ToastItem } from "@/components/ui/ToastStack";

type AddToastFn = (toast: Omit<ToastItem, "id">) => void;

type UseBrowserNotificationToggleOptions = {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  addToast: AddToastFn;
};

/**
 * Hook untuk mengelola toggle Notifikasi Browser.
 * Menangani: dukungan API, izin (granted/denied/default), permintaan izin satu kali per session.
 */
export function useBrowserNotificationToggle({
  enabled,
  setEnabled,
  addToast,
}: UseBrowserNotificationToggleOptions) {
  const requestedRef = useRef(false);

  const toggle = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      addToast({
        tone: "warning",
        title: "Notifikasi browser tidak didukung",
        description: "Gunakan browser modern untuk fitur ini.",
        duration: 5_000,
      });
      return;
    }

    if (enabled) {
      setEnabled(false);
      addToast({
        tone: "info",
        title: "Notifikasi browser dimatikan",
        duration: 3_000,
      });
      return;
    }

    if (Notification.permission === "granted") {
      setEnabled(true);
      addToast({
        tone: "success",
        title: "Notifikasi browser aktif",
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
      setEnabled(true);
      addToast({
        tone: "success",
        title: "Notifikasi browser aktif",
        duration: 3_000,
      });
      return;
    }

    addToast({
      tone: "warning",
      title: "Notifikasi browser tetap nonaktif",
      description: "Izin tidak diberikan.",
      duration: 5_000,
    });
  }, [addToast, enabled, setEnabled]);

  return { toggle };
}
