"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ToastItem } from "@/components/ui/ToastStack";
import { CENTER_UNDIP } from "@/lib/transit/buggy-data";
import { haversineMeters } from "@/lib/transit/buggy-route-utils";
import { fmtTime } from "@/lib/utils/format-time";
import type { Buggy } from "@/types/buggy";
import type { Geofence, GeofenceEvent } from "@/types/geofence";
import type { LatLngLiteral } from "@/types/map-canvas";

const GEOFENCE_DEFAULT_RADIUS_METERS = 100;
const GEOFENCE_EVENT_LIMIT = 100;
const GEOFENCE_EVENT_COOLDOWN_MS = 10_000;

type AddToast = (toast: Omit<ToastItem, "id">) => void;

type UseDashboardGeofencesOptions = {
  canManageDashboard: boolean;
  canViewOperatorPanels: boolean;
  liveBuggies: Buggy[];
  geofenceEventAlertsEnabled: boolean;
  browserNotificationEnabled: boolean;
  addToast: AddToast;
  onOpenDataView: () => void;
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

export function useDashboardGeofences({
  canManageDashboard,
  canViewOperatorPanels,
  liveBuggies,
  geofenceEventAlertsEnabled,
  browserNotificationEnabled,
  addToast,
  onOpenDataView,
}: UseDashboardGeofencesOptions) {
  const { t } = useTranslation("admin");
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
  const geofenceMembershipRef = useRef<Map<string, boolean>>(new Map());
  const geofenceCooldownRef = useRef<Map<string, number>>(new Map());

  const draftGeofence = useMemo(
    () =>
      geofenceCreateMode && draftGeofenceCenter
        ? {
            center: draftGeofenceCenter,
            radiusMeters: draftGeofenceRadius,
          }
        : null,
    [draftGeofenceCenter, draftGeofenceRadius, geofenceCreateMode],
  );

  const loadGeofences = useCallback(async () => {
    if (!canViewOperatorPanels) {
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
  }, [addToast, canViewOperatorPanels, t]);

  useEffect(() => {
    void loadGeofences();
  }, [loadGeofences]);

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
    onOpenDataView();
  }, [canManageDashboard, geofences.length, onOpenDataView]);

  const handleEditGeofence = useCallback(
    (geofence: Geofence) => {
      if (!canManageDashboard) return;

      setEditingGeofenceId(geofence.id);
      setDraftGeofenceCenter(geofence.center);
      setDraftGeofenceName(geofence.name);
      setDraftGeofenceRadius(geofence.radiusMeters);
      setGeofenceCreateMode(true);
      onOpenDataView();
    },
    [canManageDashboard, onOpenDataView],
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
    canManageDashboard,
    draftGeofenceCenter,
    draftGeofenceName,
    draftGeofenceRadius,
    editingGeofenceId,
    t,
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
      if (!geofenceEventAlertsEnabled) return;

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
    [addToast, browserNotificationEnabled, geofenceEventAlertsEnabled],
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

  return {
    geofences,
    geofenceLoading,
    geofenceCreateMode,
    geofenceEvents,
    geofenceStatuses,
    draftGeofence,
    draftGeofenceName,
    draftGeofenceRadius,
    setDraftGeofenceName,
    setDraftGeofenceRadius,
    handleDraftGeofenceChange,
    handleToggleCreateMode,
    handleEditGeofence,
    handleCancelDraft,
    handleSaveDraft,
    handleToggleGeofence,
    handleDeleteGeofence,
  };
}
