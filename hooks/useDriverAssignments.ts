"use client";

import { useCallback, useEffect, useState } from "react";
import { resolveAssignedBuggy } from "@/lib/buggy/assignment";
import type { Buggy } from "@/types/buggy";

type DriverAssignmentAccount = {
  name?: string | null;
  role?: string | null;
  buggy_id?: string | null;
};

type AccountsResponse = {
  accounts?: DriverAssignmentAccount[];
};

type UseDriverAssignmentsOptions = {
  enabled: boolean;
  isAdminUser: boolean;
  isDriverUser: boolean;
  userProfile?: {
    name?: string | null;
    buggy_id?: string | null;
  } | null;
  liveBuggies: Buggy[];
  refreshKey?: string | null;
};

export function useDriverAssignments({
  enabled,
  isAdminUser,
  isDriverUser,
  userProfile,
  liveBuggies,
  refreshKey,
}: UseDriverAssignmentsOptions) {
  const [driverNamesByBuggyId, setDriverNamesByBuggyId] = useState<
    Record<string, string>
  >({});

  const loadDriverAssignments = useCallback(async () => {
    if (!enabled) return;

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
    enabled,
    isAdminUser,
    isDriverUser,
    liveBuggies,
    userProfile?.buggy_id,
    userProfile?.name,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDriverAssignments();
  }, [loadDriverAssignments, refreshKey]);

  return {
    driverNamesByBuggyId,
    refreshDriverAssignments: loadDriverAssignments,
  };
}
