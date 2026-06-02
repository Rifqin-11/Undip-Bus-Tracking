"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import type { Buggy } from "@/types/buggy";
import { getBuggyStopNameAtOffset } from "@/lib/transit/buggy-route-utils";
import { getApnConnectionState } from "@/lib/buggy/gsm-status";
import {
  formatLastSeen,
  getBuggyConnectionTone,
} from "@/lib/buggy/connection-status";
import {
  ChevronLeft,
  Edit2Icon,
  Clock,
  Gauge,
  MapPin,
  Radio,
  Users,
  Wifi,
} from "lucide-react";
import { AdminBuggyFormPanel } from "./AdminBuggyFormPanel";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { getErrorMessage } from "@/lib/utils/error-message";

type BuggyOperationalDetailProps = {
  buggy: Buggy;
  assignedDriverName?: string | null;
  activeZones: string[];
  onBack: () => void;
  /** Dipanggil setelah buggy berhasil dihapus — bisa berbeda dari onBack jika perlu refresh */
  onDeleteSuccess?: () => void;
  geofenceManagerNode?: React.ReactNode;
  readOnly?: boolean;
};

function titleCaseStatus(value: string) {
  return value
    .replace(/^(MQTT|SIM|GSM|GPRS)_/i, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMqttStatus(value?: string) {
  if (!value) return "-";
  if (value === "MQTT_CONNECTED") return "Connected";
  if (value === "MQTT_DISCONNECTED") return "Disconnected";
  return titleCaseStatus(value);
}

function formatSimStatus(value?: string) {
  if (!value) return "-";
  if (value === "SIM_READY") return "Ready";
  return titleCaseStatus(value);
}

function formatNetworkType(value?: string) {
  if (!value) return "-";
  return value
    .replace(/^GSM_GPRS_/i, "")
    .replace(/^GSM_/i, "")
    .replace(/_/g, " ");
}

export function BuggyOperationalDetail({
  buggy,
  assignedDriverName,
  activeZones,
  onBack,
  onDeleteSuccess,
  geofenceManagerNode,
  readOnly = false,
}: BuggyOperationalDetailProps) {
  const { t } = useTranslation("admin");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/buggies/${buggy.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(t("failedDeleteFleet"));
      (onDeleteSuccess ?? onBack)();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
      setIsDeleteOpen(false);
    }
  };

  const currentStop = getBuggyStopNameAtOffset(buggy, 0);
  const nextStop = getBuggyStopNameAtOffset(buggy, 1);
  const apnState = getApnConnectionState(buggy);
  const connectionTone = getBuggyConnectionTone(buggy.connectionStatus);
  const apnStateLabel =
    apnState === "connected"
      ? t("connected")
      : apnState === "disconnected"
        ? t("disconnected")
        : "-";
  const apnValue = buggy.gsm?.apn || "-";
  const signalValue =
    typeof buggy.gsm?.signalPercent === "number"
      ? `${buggy.gsm.signalPercent}%`
      : "-";
  const networkValue = buggy.gsm
    ? [
        formatNetworkType(buggy.gsm.networkType),
        buggy.gsm.networkConnected === true
          ? t("connected")
          : buggy.gsm.networkConnected === false
            ? t("disconnected")
            : null,
        buggy.gsm.gprsConnected === true
          ? "GPRS"
          : buggy.gsm.gprsConnected === false
            ? null
            : null,
      ]
        .filter((value) => value && value !== "-")
        .join(" · ") || "-"
    : "-";
  const simValue = formatSimStatus(buggy.gsm?.simStatusText);
  const mqttValue = formatMqttStatus(buggy.gsm?.mqttStateText);
  const signalDetailValue =
    typeof buggy.gsm?.signalDbm === "number" &&
    typeof buggy.gsm?.signalCsq === "number"
      ? `${buggy.gsm.signalDbm} dBm · CSQ ${buggy.gsm.signalCsq}`
      : typeof buggy.gsm?.signalDbm === "number"
        ? `${buggy.gsm.signalDbm} dBm`
        : typeof buggy.gsm?.signalCsq === "number"
          ? `CSQ ${buggy.gsm.signalCsq}`
          : "-";
  const occupancyPct = Math.min(
    Math.round((buggy.passengers / buggy.capacity) * 100),
    100,
  );
  const safeOccupancyPct = Number.isFinite(occupancyPct) ? occupancyPct : 0;
  const speedValue =
    typeof buggy.speedKmh === "number" && Number.isFinite(buggy.speedKmh)
      ? `${Math.max(0, Math.round(buggy.speedKmh))} ${t("speedUnit")}`
      : "--";
  const connectionStatusValue = buggy.connectionStatus
    ? connectionTone.label
    : "--";
  const lastSeenValue =
    typeof buggy.lastSeenSecondsAgo === "number" &&
    Number.isFinite(buggy.lastSeenSecondsAgo)
      ? formatLastSeen(buggy.lastSeenSecondsAgo)
      : "--";

  if (isEditOpen && !readOnly) {
    return (
      <AdminBuggyFormPanel
        buggy={buggy}
        onBack={() => setIsEditOpen(false)}
        onSaved={() => setIsEditOpen(false)}
        onDeleted={onDeleteSuccess ?? onBack}
      />
    );
  }

  const rows: { label: string; value: string }[] = [
    { label: t("fleetCode"), value: buggy.code },
    { label: t("name"), value: buggy.name },
    { label: t("driver"), value: assignedDriverName || "-" },
    { label: t("route"), value: buggy.routeLabel || "-" },
    {
      label: t("coordinates"),
      value: `${buggy.position.lat.toFixed(5)}, ${buggy.position.lng.toFixed(5)}`,
    },
    { label: t("speed"), value: `${buggy.speedKmh} ${t("speedUnit")}` },
    { label: t("eta"), value: `${buggy.etaMinutes} ${t("minutes")}` },
    { label: t("currentStop"), value: currentStop || "-" },
    { label: t("nextStop"), value: nextStop || "-" },
    {
      label: "Status koneksi",
      value: `${connectionTone.label} · ${formatLastSeen(buggy.lastSeenSecondsAgo)}`,
    },
    {
      label: t("occupancy"),
      value: `${buggy.passengers}/${buggy.capacity} ${t("passengers")}`,
    },
    {
      label: t("geofenceStatus"),
      value: activeZones.length > 0 ? activeZones.join(", ") : t("outsideZone"),
    },
    { label: t("lastUpdated"), value: buggy.updatedAt },
  ];

  return (
    <section className="space-y-3">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
          aria-label={t("backToBuggyList")}
        >
          <ChevronLeft className="size-5" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {t("operationalDetail")}
          </p>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#0f1a3b] px-2 py-0.5 text-[11px] font-bold text-white">
              {buggy.code}
            </span>
            <h2 className="truncate text-[16px] font-bold text-slate-900">
              {buggy.name}
            </h2>
          </div>
        </div>

        {!readOnly ? (
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
              >
                <Edit2Icon className="size-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <DeleteConfirmModal
        open={isDeleteOpen}
        title={t("deleteFleetTitle")}
        description={t("deleteFleetDescription", {
          code: buggy.code,
          name: buggy.name,
        })}
        isLoading={isDeleting}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
      />

      {/* ── Buggy Visual & Energy (Redesigned) ─────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-linear-to-b from-white via-white to-slate-50/80 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        {/* Hero: image on a soft glow backdrop with floating chips */}
        <div className="relative h-40 w-full mb-4">
          {/* Soft gradient backdrop */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-28 w-60 rounded-full bg-linear-to-tr from-blue-100/70 via-emerald-50/60 to-amber-50/40 blur-2xl" />
          </div>

          {/* Status pill — top left */}
          <div className="absolute top-0 left-0 z-10">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${
                `${connectionTone.bgClass} ${connectionTone.textClass} border ${connectionTone.borderClass}`
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${connectionTone.dotClass}`}
              />
              {connectionTone.label}
            </span>
          </div>

          {/* Locate button — top right */}
          <button
            type="button"
            aria-label={t("viewFleetLocation")}
            className="absolute top-0 right-0 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 shadow-sm backdrop-blur-md transition hover:bg-[#0f1a3b] hover:text-white active:scale-95"
          >
            <MapPin className="size-3.5" />
          </button>

          {/* The image itself */}
          <Image
            src="/buggy.webp"
            alt="Buggy EV"
            fill
            sizes="(max-width: 768px) 92vw, 420px"
            className="h-full w-full object-contain mix-blend-multiply drop-shadow-xl opacity-95"
          />
        </div>

        {/* Prominent Occupancy Row */}
        <div className="mb-3 rounded-2xl border border-slate-200/70 bg-white/80 p-3 shadow-sm">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Users className="size-4 text-emerald-600" />
              <span className="text-[12px] font-semibold text-slate-700">
                {t("passengerLoad")}
              </span>
            </div>
            <span className="text-[13px] font-bold text-slate-900 tabular-nums">
              {safeOccupancyPct}%
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`absolute inset-y-0 left-0 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.35)] transition-all ${
                safeOccupancyPct >= 90
                  ? "bg-linear-to-r from-rose-400 to-rose-500"
                  : safeOccupancyPct >= 60
                    ? "bg-linear-to-r from-amber-300 to-amber-400"
                    : "bg-linear-to-r from-emerald-400 to-emerald-500"
              }`}
              style={{ width: `${safeOccupancyPct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">
            <span className="font-semibold text-slate-600">
              {t("seatsFilled", {
                passengers: buggy.passengers,
                capacity: buggy.capacity,
              })}
            </span>
          </p>
        </div>

        {/* 3 Stats — live operational telemetry */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-2.5 shadow-sm">
            <div className="mb-1 flex items-center gap-1 text-slate-400">
              <Gauge className="size-3" />
              <p className="text-[10px] font-semibold uppercase tracking-wider">
                {t("speed")}
              </p>
            </div>
            <p
              className="truncate text-[14px] font-bold text-slate-800 tabular-nums"
              title={speedValue}
            >
              {speedValue}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-2.5 shadow-sm">
            <div className="mb-1 flex items-center gap-1 text-slate-400">
              <Radio className="size-3" />
              <p className="text-[10px] font-semibold uppercase tracking-wider">
                {t("connectionStatus")}
              </p>
            </div>
            <p
              className={`truncate text-[14px] font-bold tabular-nums ${connectionTone.textClass}`}
              title={connectionStatusValue}
            >
              {connectionStatusValue}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-2.5 shadow-sm">
            <div className="mb-1 flex items-center gap-1 text-slate-400">
              <Clock className="size-3" />
              <p className="text-[10px] font-semibold uppercase tracking-wider">
                {t("lastSeen")}
              </p>
            </div>
            <p
              className="truncate text-[14px] font-bold text-slate-800 tabular-nums"
              title={lastSeenValue}
            >
              {lastSeenValue}
            </p>
          </div>
        </div>
      </div>

      {/* ── Connectivity Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200/80 bg-white/75 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 text-sky-600">
                <Radio className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {t("gsmStatus")}
                </p>
                <p className="truncate text-[13px] font-bold text-slate-900">
                  {networkValue}
                </p>
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                apnState === "connected"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : apnState === "disconnected"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              {apnStateLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: t("apnStatus"), value: apnValue },
              { label: t("gsmSignal"), value: signalValue },
              { label: t("simStatus"), value: simValue },
              { label: t("localIp"), value: buggy.gsm?.localIp || "-" },
            ].map((item) => (
              <div
                key={item.label}
                className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 p-2.5"
              >
                <p className="truncate text-[10px] font-semibold text-slate-400">
                  {item.label}
                </p>
                <p className="mt-1 break-words text-[12px] font-bold leading-snug text-slate-800">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-2 rounded-2xl border border-slate-100 bg-white p-2.5">
            <p className="text-[10px] font-semibold text-slate-400">
              {t("signalDetail")}
            </p>
            <p className="mt-1 text-[12px] font-bold leading-snug text-slate-800">
              {signalDetailValue}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white/75 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600">
                <Wifi className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {t("mqttStatus")}
                </p>
                <p className="truncate text-[13px] font-bold text-slate-900">
                  {mqttValue}
                </p>
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                mqttValue === "Connected"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : buggy.gsm?.mqttStateText
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              {mqttValue}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 p-2.5">
              <p className="truncate text-[10px] font-semibold text-slate-400">
                {t("mqttStatus")}
              </p>
              <p className="mt-1 break-words text-[12px] font-bold leading-snug text-slate-800">
                {mqttValue}
              </p>
            </div>
            <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 p-2.5">
              <p className="truncate text-[10px] font-semibold text-slate-400">
                {t("apnStatus")}
              </p>
              <p className="mt-1 break-words text-[12px] font-bold leading-snug text-slate-800">
                {buggy.gsm?.apn || "-"}
              </p>
            </div>
          </div>

          <div className="mt-2 rounded-2xl border border-slate-100 bg-white p-2.5">
            <p className="text-[10px] font-semibold text-slate-400">
              {t("lastUpdated")}
            </p>
            <p className="mt-1 text-[12px] font-bold text-slate-800">
              {buggy.updatedAt}
            </p>
          </div>
        </div>
      </div>

      {/* ── Data Rows ──────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/70">
        {rows.map((row, idx) => (
          <div
            key={row.label}
            className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3 text-[12px] ${
              idx < rows.length - 1 ? "border-b border-slate-100" : ""
            }`}
          >
            <span className="shrink-0 font-medium text-slate-500">
              {row.label}
            </span>
            <span className="text-right font-medium text-slate-800">
              {row.value}
            </span>
          </div>
        ))}
      </div>
      {/* ── Geofence Zones ─────────────────────────────────────────────── */}
      {activeZones.length > 0 ? (
        <div className="rounded-3xl border border-blue-200/80 bg-blue-50/70 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-blue-500">
            {t("detectedInsideZone")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activeZones.map((zone) => (
              <span
                key={zone}
                className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-medium text-blue-700"
              >
                📡 {zone}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-3">
          <p className="text-[12px] font-medium text-slate-500 text-center">
            {t("outsideAllZones")}
          </p>
        </div>
      )}

      {/* ── Embedded Geofence Manager ──────────────────────────────────── */}
      {geofenceManagerNode && <div className="pt-2">{geofenceManagerNode}</div>}
    </section>
  );
}
