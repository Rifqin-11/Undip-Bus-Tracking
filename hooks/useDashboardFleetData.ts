"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HALTE_LOCATIONS } from "@/lib/transit/buggy-data";
import { isBuggyAssignedToValue } from "@/lib/buggy/assignment";
import { isBuggyOffline } from "@/lib/buggy/connection-status";
import type { Buggy, HaltePoint } from "@/types/buggy";

type UseDashboardFleetDataOptions = {
  realtimeBuggies: Buggy[] | null | undefined;
  assignedBuggyId?: string | null;
  canViewAssignedBuggyOnly: boolean;
  canViewAllBuggies: boolean;
  canManageDashboard: boolean;
  selectedAdminBuggyId: string | null;
};

export function useDashboardFleetData({
  realtimeBuggies,
  assignedBuggyId,
  canViewAssignedBuggyOnly,
  canViewAllBuggies,
  canManageDashboard,
  selectedAdminBuggyId,
}: UseDashboardFleetDataOptions) {
  // Fallback instan setelah add/delete; realtime feed tetap prioritas supaya
  // marker selalu mengikuti posisi telemetry terakhir dari /api/buggy.
  const [localBuggies, setLocalBuggies] = useState<Buggy[] | null>(null);
  const [adminFleetBuggies, setAdminFleetBuggies] = useState<Buggy[]>([]);
  const [haltes, setHaltes] = useState<HaltePoint[]>(HALTE_LOCATIONS);

  const liveBuggies = useMemo(
    () => realtimeBuggies ?? localBuggies ?? [],
    [localBuggies, realtimeBuggies],
  );

  const loadAdminFleetBuggies = useCallback(async () => {
    if (!canManageDashboard) {
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
  }, [canManageDashboard]);

  const handleBuggyMutated = useCallback(async () => {
    try {
      const res = await fetch("/api/buggy", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setLocalBuggies(data as Buggy[]);
      }
    } catch {
      // Polling/realtime feed will sync shortly.
    }
    await loadAdminFleetBuggies();
  }, [loadAdminFleetBuggies]);

  const loadHaltes = useCallback(async () => {
    try {
      const response = await fetch("/api/haltes", { cache: "no-store" });
      if (!response.ok) return;

      const data = await response.json();
      if (Array.isArray(data)) {
        setHaltes(data as HaltePoint[]);
      }
    } catch {
      // Data statis tetap menjadi fallback jika API tidak tersedia.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHaltes();
  }, [loadHaltes]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAdminFleetBuggies();
  }, [loadAdminFleetBuggies]);

  const activeHaltes = useMemo(
    () => haltes.filter((halte) => halte.isActive !== false),
    [haltes],
  );

  const visibleBuggies = useMemo(() => {
    if (canViewAssignedBuggyOnly && assignedBuggyId) {
      return liveBuggies.filter((buggy) =>
        isBuggyAssignedToValue(buggy, assignedBuggyId),
      );
    }
    if (canViewAssignedBuggyOnly) {
      return [];
    }

    if (!canViewAllBuggies) {
      return liveBuggies.filter((buggy) => !isBuggyOffline(buggy));
    }

    return liveBuggies;
  }, [
    assignedBuggyId,
    canViewAllBuggies,
    canViewAssignedBuggyOnly,
    liveBuggies,
  ]);

  const dataManagementBuggies = canManageDashboard
    ? adminFleetBuggies
    : visibleBuggies;

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

  return {
    liveBuggies,
    visibleBuggies,
    dataManagementBuggies,
    selectedAdminBuggy,
    haltes,
    activeHaltes,
    loadHaltes,
    handleBuggyMutated,
  };
}
