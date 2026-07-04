"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Buggy } from "@/types/buggy";
import type { DeviceAssignment, DeviceOption } from "@/types/device-assignment";
import { getErrorMessage } from "@/lib/utils/error-message";

export type DeviceAssignmentFormState = {
  id: string | null;
  devicesId: string;
  label: string;
  buggyId: string;
  isActive: boolean;
};

const EMPTY_FORM: DeviceAssignmentFormState = {
  id: null,
  devicesId: "",
  label: "",
  buggyId: "",
  isActive: true,
};

type UseDeviceAssignmentsOptions = {
  buggies: Buggy[];
  selectedBuggy?: Buggy;
  readOnly: boolean;
};

export function useDeviceAssignments({
  buggies,
  selectedBuggy,
  readOnly,
}: UseDeviceAssignmentsOptions) {
  const { t } = useTranslation("admin");
  const [assignments, setAssignments] = useState<DeviceAssignment[]>([]);
  const [deviceOptions, setDeviceOptions] = useState<DeviceOption[]>([]);
  const [form, setForm] = useState<DeviceAssignmentFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          assignment.isActive &&
          (!selectedBuggy || assignment.buggyId === selectedBuggy.id),
      ),
    [assignments, selectedBuggy],
  );
  const visibleAssignments = useMemo(
    () =>
      selectedBuggy
        ? assignments.filter((assignment) => assignment.buggyId === selectedBuggy.id)
        : assignments,
    [assignments, selectedBuggy],
  );
  const assignableDeviceOptions = useMemo(
    () =>
      selectedBuggy
        ? deviceOptions.filter(
            (option) =>
              !(
                option.source === "assignment" &&
                option.isActive &&
                option.buggyId === selectedBuggy.id
              ),
          )
        : assignments.map((assignment) => ({
            ...assignment,
            source: "assignment" as const,
          })),
    [assignments, deviceOptions, selectedBuggy],
  );

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/device-assignments", {
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? t("failedLoadDeviceAssignments"),
        );
      }
      const data = (await res.json()) as {
        assignments?: DeviceAssignment[];
        deviceOptions?: DeviceOption[];
      };
      setAssignments(Array.isArray(data.assignments) ? data.assignments : []);
      setDeviceOptions(
        Array.isArray(data.deviceOptions)
          ? data.deviceOptions
          : Array.isArray(data.assignments)
            ? data.assignments.map((assignment) => ({
                ...assignment,
                source: "assignment" as const,
              }))
            : [],
      );
    } catch (err) {
      setError(getErrorMessage(err, t("failedLoadDeviceAssignments")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const resetForm = useCallback(() => {
    setForm({
      ...EMPTY_FORM,
      buggyId: selectedBuggy?.id ?? buggies[0]?.id ?? "",
    });
    setError(null);
  }, [buggies, selectedBuggy]);

  useEffect(() => {
    const nextBuggyId = selectedBuggy?.id ?? buggies[0]?.id;
    if (!form.buggyId && nextBuggyId) {
      setForm((current) => ({ ...current, buggyId: nextBuggyId }));
    }
  }, [buggies, form.buggyId, selectedBuggy]);

  const handleEdit = useCallback((assignment: DeviceAssignment) => {
    setForm({
      id: assignment.id,
      devicesId: assignment.devicesId,
      label: assignment.label ?? "",
      buggyId: assignment.buggyId,
      isActive: assignment.isActive,
    });
    setError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (readOnly) return;

    const selectedDeviceOption = selectedBuggy
      ? deviceOptions.find((option) => option.id === form.id)
      : null;
    const selectedExistingAssignment =
      selectedDeviceOption?.source === "assignment"
        ? selectedDeviceOption
        : null;
    const devicesId = selectedDeviceOption
      ? selectedDeviceOption.devicesId
      : null;
    const resolvedDevicesId = devicesId ?? form.devicesId.trim();
    const targetBuggyId = selectedBuggy?.id ?? form.buggyId;

    if (!resolvedDevicesId || !targetBuggyId) {
      setError(t("deviceAssignmentRequired"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const endpoint = selectedExistingAssignment
        ? `/api/admin/device-assignments/${selectedExistingAssignment.id}`
        : form.id && !selectedBuggy
          ? `/api/admin/device-assignments/${form.id}`
          : "/api/admin/device-assignments";
      const res = await fetch(endpoint, {
        method:
          selectedExistingAssignment || (form.id && !selectedBuggy)
            ? "PUT"
            : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          devicesId: resolvedDevicesId,
          label:
            selectedDeviceOption?.label ??
            selectedExistingAssignment?.label ??
            (form.label.trim() || null),
          buggyId: targetBuggyId,
          isActive: selectedBuggy ? true : form.isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? t("failedSaveDeviceAssignment"),
        );
      }

      resetForm();
      await loadAssignments();
    } catch (err) {
      setError(getErrorMessage(err, t("failedSaveDeviceAssignment")));
    } finally {
      setSaving(false);
    }
  }, [
    deviceOptions,
    form,
    loadAssignments,
    readOnly,
    resetForm,
    selectedBuggy,
    t,
  ]);

  const handleDeactivate = useCallback(
    async (assignment: DeviceAssignment) => {
      if (readOnly) return;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/device-assignments/${assignment.id}`,
          {
            method: "DELETE",
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ??
              t("failedDeactivateDeviceAssignment"),
          );
        }
        if (form.id === assignment.id) resetForm();
        await loadAssignments();
      } catch (err) {
        setError(getErrorMessage(err, t("failedDeactivateDeviceAssignment")));
      } finally {
        setSaving(false);
      }
    },
    [form.id, loadAssignments, readOnly, resetForm, t],
  );

  return {
    activeAssignments,
    assignableDeviceOptions,
    deviceOptions,
    error,
    form,
    handleDeactivate,
    handleEdit,
    handleSubmit,
    loadAssignments,
    loading,
    resetForm,
    saving,
    setForm,
    visibleAssignments,
  };
}
