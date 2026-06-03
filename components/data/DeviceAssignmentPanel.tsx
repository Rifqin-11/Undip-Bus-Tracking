"use client";

import { useEffect, useMemo, useState } from "react";
import { Cpu, Pencil, PlusIcon, Power, RefreshCw, Save, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Buggy } from "@/types/buggy";
import type { DeviceAssignment, DeviceOption } from "@/types/device-assignment";
import { getErrorMessage } from "@/lib/utils/error-message";
import { formatLastSeen } from "@/lib/buggy/connection-status";

type DeviceAssignmentPanelProps = {
  buggies: Buggy[];
  selectedBuggy?: Buggy;
  readOnly?: boolean;
  summaryOnly?: boolean;
};

type FormState = {
  id: string | null;
  devicesId: string;
  label: string;
  buggyId: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  devicesId: "",
  label: "",
  buggyId: "",
  isActive: true,
};

function formatDateTime(value: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function resolveLastSeenSeconds(value: string | null) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 1000));
}

export function DeviceAssignmentPanel({
  buggies,
  selectedBuggy,
  readOnly = false,
  summaryOnly = false,
}: DeviceAssignmentPanelProps) {
  const { t } = useTranslation("admin");
  const [assignments, setAssignments] = useState<DeviceAssignment[]>([]);
  const [deviceOptions, setDeviceOptions] = useState<DeviceOption[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
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

  const loadAssignments = async () => {
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
  };

  useEffect(() => {
    void loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setForm({
      ...EMPTY_FORM,
      buggyId: selectedBuggy?.id ?? buggies[0]?.id ?? "",
    });
    setError(null);
  };

  useEffect(() => {
    const nextBuggyId = selectedBuggy?.id ?? buggies[0]?.id;
    if (!form.buggyId && nextBuggyId) {
      setForm((current) => ({ ...current, buggyId: nextBuggyId }));
    }
  }, [buggies, form.buggyId, selectedBuggy]);

  const handleEdit = (assignment: DeviceAssignment) => {
    setForm({
      id: assignment.id,
      devicesId: assignment.devicesId,
      label: assignment.label ?? "",
      buggyId: assignment.buggyId,
      isActive: assignment.isActive,
    });
    setError(null);
  };

  const handleSubmit = async () => {
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
        : form.id
        && !selectedBuggy
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
  };

  const handleDeactivate = async (assignment: DeviceAssignment) => {
    if (readOnly) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/device-assignments/${assignment.id}`, {
        method: "DELETE",
      });
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
  };

  if (summaryOnly) {
    const summaryAssignments = visibleAssignments.filter(
      (assignment) => assignment.isActive,
    );

    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white/75 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
              {t("deviceAssignments")}
            </p>
            <h2 className="mt-1 text-[15px] font-bold text-slate-900">
              {t("connectedDeviceId")}
            </h2>
            <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
              {t("connectedDeviceIdDescription")}
            </p>
          </div>
          <button
            type="button"
            onClick={loadAssignments}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-[#0f1a3b] hover:text-[#0f1a3b]"
            aria-label={t("refresh")}
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>

        <div className="mt-3">
          {loading ? (
            <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
          ) : summaryAssignments.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-center text-[11px] font-semibold text-slate-400">
              {t("noDeviceAssignedToFleet")}
            </div>
          ) : (
            <div className="space-y-2">
              {summaryAssignments.map((assignment) => {
                const lastSeenSeconds = resolveLastSeenSeconds(
                  assignment.lastSeenAt,
                );
                const isRecentlySeen =
                  lastSeenSeconds !== null && lastSeenSeconds <= 60;

                return (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-white text-[#0f1a3b] shadow-sm">
                        <Cpu className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-black text-slate-900">
                          {assignment.devicesId}
                        </p>
                        <p className="truncate text-[10px] font-semibold text-slate-500">
                          {assignment.label || t("unnamedDevice")}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        isRecentlySeen
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isRecentlySeen ? t("online") : t("offline")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
              {t("deviceAssignments")}
            </p>
            <h2 className="mt-1 text-[17px] font-bold text-slate-900">
              {summaryOnly && selectedBuggy
                ? t("connectedDeviceId")
                : selectedBuggy
                ? t("assignedDevicesForFleet", {
                    buggy: `${selectedBuggy.code} ${selectedBuggy.name}`,
                  })
                : t("deviceAssignmentTitle")}
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              {summaryOnly
                ? t("connectedDeviceIdDescription")
                : selectedBuggy
                ? t("deviceAssignmentDetailDescription")
                : t("deviceAssignmentDescription")}
            </p>
          </div>
          <button
            type="button"
            onClick={loadAssignments}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-[#0f1a3b] hover:text-[#0f1a3b]"
            aria-label={t("refresh")}
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {!readOnly && !summaryOnly ? (
        <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-2xl bg-[#0f1a3b] text-white">
              {form.id ? <Pencil className="size-4" /> : <PlusIcon className="size-4" />}
            </span>
            <div>
              <h3 className="text-[13px] font-bold text-slate-900">
                {selectedBuggy
                  ? t("moveDeviceToThisBuggy")
                  : form.id
                    ? t("editDeviceAssignment")
                    : t("addDeviceAssignment")}
              </h3>
              <p className="text-[10px] text-slate-500">
                {selectedBuggy
                  ? t("chooseExistingDeviceHint")
                  : t("deviceAssignmentFormHint")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {selectedBuggy ? (
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  {t("devicesId")}
                </span>
                <select
                  value={form.id ?? ""}
                  onChange={(event) => {
                    const option = deviceOptions.find(
                      (item) => item.id === event.target.value,
                    );
                    setForm({
                      id: option?.id ?? null,
                      devicesId: option?.devicesId ?? "",
                      label: option?.label ?? "",
                      buggyId: selectedBuggy.id,
                      isActive: true,
                    });
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-900 outline-none transition focus:border-[#0f1a3b]"
                >
                  <option value="">{t("chooseExistingDevice")}</option>
                  {assignableDeviceOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.devicesId} -{" "}
                      {option.source === "registry"
                        ? t("unassignedDevice")
                        : option.buggyCode ?? t("inactive")}
                    </option>
                  ))}
                </select>
                {assignableDeviceOptions.length === 0 ? (
                  <p className="mt-1 text-[10px] font-semibold text-slate-400">
                    {t("noAvailableDeviceToAssign")}
                  </p>
                ) : null}
              </label>
            ) : (
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  {t("devicesId")}
                </span>
                <input
                  value={form.devicesId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      devicesId: event.target.value,
                    }))
                  }
                  placeholder="ESP-1A2B3C4D"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-[#0f1a3b]"
                />
              </label>
            )}

            {!selectedBuggy ? (
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  {t("deviceLabel")}
                </span>
                <input
                  value={form.label}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                  placeholder={t("deviceLabelPlaceholder")}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-[#0f1a3b]"
                />
              </label>
            ) : null}

            {!selectedBuggy ? (
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  {t("assignedBuggy")}
                </span>
                <select
                  value={form.buggyId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      buggyId: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-900 outline-none transition focus:border-[#0f1a3b]"
                >
                  {buggies.map((buggy) => (
                    <option key={buggy.id} value={buggy.id}>
                      {buggy.code} - {buggy.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {!selectedBuggy ? (
              <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span>
                  <span className="block text-[11px] font-bold text-slate-800">
                    {t("activeAssignment")}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {t("activeAssignmentHint")}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[#0f1a3b]"
                />
              </label>
            ) : null}
          </div>

          {error ? (
            <p className="mt-3 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#0f1a3b] px-3 py-2 text-[12px] font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="size-4" />
              {saving
                ? t("saving")
                : selectedBuggy
                  ? t("assignToThisBuggy")
                  : t("saveChanges")}
            </button>
            {form.id ? (
              <button
                type="button"
                onClick={resetForm}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-900 hover:text-slate-900"
                aria-label={t("cancel")}
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-bold text-slate-900">
            {t("registeredDevices")}
          </h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
            {activeAssignments.length} {t("active")}
          </span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-2xl bg-slate-100"
              />
            ))}
          </div>
        ) : visibleAssignments.length === 0 ? (
          <p className="py-5 text-center text-[12px] text-slate-400">
            {selectedBuggy
              ? t("noDeviceAssignedToFleet")
              : t("noDeviceAssignments")}
          </p>
        ) : (
          <div className="space-y-2">
            {visibleAssignments.map((assignment) => {
              const lastSeenSeconds = resolveLastSeenSeconds(assignment.lastSeenAt);
              const isRecentlySeen =
                lastSeenSeconds !== null && lastSeenSeconds <= 60;

              return (
                <article
                  key={assignment.id}
                  className={`rounded-2xl border bg-white p-3 shadow-sm ${
                    assignment.isActive
                      ? "border-slate-200"
                      : "border-slate-100 opacity-65"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 gap-2">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-slate-100 text-[#0f1a3b]">
                        <Cpu className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-black text-slate-900">
                          {assignment.devicesId}
                        </p>
                        <p className="truncate text-[10px] font-semibold text-slate-500">
                          {assignment.label || t("unnamedDevice")}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        assignment.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {assignment.isActive ? t("active") : t("inactive")}
                    </span>
                  </div>

                  <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                    <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
                      {t("assignedBuggy")}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] font-bold text-slate-900">
                      {assignment.buggyCode ?? "--"} ·{" "}
                      {assignment.buggyName ?? assignment.buggyId}
                    </p>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    <div className="rounded-xl border border-slate-100 bg-white px-2 py-1.5">
                      <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">
                        {t("lastSeen")}
                      </p>
                      <p className="truncate text-[10px] font-bold text-slate-800">
                        {lastSeenSeconds !== null
                          ? formatLastSeen(lastSeenSeconds)
                          : "--"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white px-2 py-1.5">
                      <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">
                        {t("speed")}
                      </p>
                      <p className="truncate text-[10px] font-bold text-slate-800">
                        {typeof assignment.speedKmh === "number"
                          ? `${Math.round(assignment.speedKmh)} ${t("speedUnit")}`
                          : "--"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white px-2 py-1.5">
                      <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">
                        {t("status")}
                      </p>
                      <p
                        className={`truncate text-[10px] font-bold ${
                          isRecentlySeen ? "text-emerald-700" : "text-slate-500"
                        }`}
                      >
                        {isRecentlySeen ? t("online") : t("offline")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2 text-[9px] font-semibold text-slate-400">
                    <span>{formatDateTime(assignment.updatedAt)}</span>
                    {!readOnly && !summaryOnly ? (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEdit(assignment)}
                          className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-[#0f1a3b] hover:text-[#0f1a3b]"
                          aria-label={t("editDeviceAssignment")}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        {assignment.isActive ? (
                          <button
                            type="button"
                            onClick={() => void handleDeactivate(assignment)}
                            className="grid h-8 w-8 place-items-center rounded-full border border-rose-100 bg-rose-50 text-rose-600 transition hover:border-rose-200 hover:bg-rose-100"
                            aria-label={t("deactivateAssignment")}
                          >
                            <Power className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
