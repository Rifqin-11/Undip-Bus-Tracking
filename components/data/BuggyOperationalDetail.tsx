"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import type { Buggy } from "@/types/buggy";
import { getBuggyStopNameAtOffset } from "@/lib/transit/buggy-route-utils";
import {
  ChevronLeft,
  Edit2Icon,
  BatteryMedium,
  Gauge,
  Route,
  Zap,
  MapPin,
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
  const occupancyPct = Math.min(
    Math.round((buggy.passengers / buggy.capacity) * 100),
    100,
  );

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
                buggy.isActive
                  ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                  : "bg-slate-200/70 text-slate-500 border border-slate-300/40"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  buggy.isActive
                    ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"
                    : "bg-slate-400"
                }`}
              />
              {buggy.isActive ? t("operating") : t("standby")}
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

        {/* Prominent Battery Row */}
        <div className="mb-3 rounded-2xl border border-slate-200/70 bg-white/80 p-3 shadow-sm">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <BatteryMedium className="size-4 text-emerald-600" />
              <span className="text-[12px] font-semibold text-slate-700">
                {t("battery")}
              </span>
            </div>
            <span className="text-[13px] font-bold text-slate-900 tabular-nums">
              85%
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-emerald-400 to-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)] transition-all"
              style={{ width: "85%" }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">
            {t("estimatedRemainingDistance")}{" "}
            <span className="font-semibold text-slate-600">120 km</span>
          </p>
        </div>

        {/* 3 Stats — with icons */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-2.5 shadow-sm">
            <div className="mb-1 flex items-center gap-1 text-slate-400">
              <Route className="size-3" />
              <p className="text-[10px] font-semibold uppercase tracking-wider">
                {t("distance")}
              </p>
            </div>
            <p className="text-[14px] font-bold text-slate-800 tabular-nums">
              120
              <span className="ml-0.5 text-[10px] font-semibold text-slate-400">
                km
              </span>
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-2.5 shadow-sm">
            <div className="mb-1 flex items-center gap-1 text-slate-400">
              <Gauge className="size-3" />
              <p className="text-[10px] font-semibold uppercase tracking-wider">
                {t("consumption")}
              </p>
            </div>
            <p className="text-[14px] font-bold text-slate-800 tabular-nums">
              142
              <span className="ml-0.5 text-[10px] font-semibold text-slate-400">
                wh/km
              </span>
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-2.5 shadow-sm">
            <div className="mb-1 flex items-center gap-1 text-slate-400">
              <Zap className="size-3" />
              <p className="text-[10px] font-semibold uppercase tracking-wider">
                {t("capacity")}
              </p>
            </div>
            <p className="text-[14px] font-bold text-slate-800 tabular-nums">
              35.5
              <span className="ml-0.5 text-[10px] font-semibold text-slate-400">
                kWh
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Occupancy ──────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <div className="mb-2 flex items-center justify-between text-[12px]">
          <span className="font-medium text-slate-500">
            {t("occupancyLevel")}
          </span>
          <span className="font-semibold text-slate-800">{occupancyPct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${
              occupancyPct >= 90
                ? "bg-rose-500"
                : occupancyPct >= 60
                  ? "bg-amber-400"
                  : "bg-emerald-500"
            }`}
            style={{ width: `${occupancyPct}%` }}
          />
        </div>
        <p className="mt-1.5 text-right text-[11px] text-slate-400">
          {t("seatsFilled", {
            passengers: buggy.passengers,
            capacity: buggy.capacity,
          })}
        </p>
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
