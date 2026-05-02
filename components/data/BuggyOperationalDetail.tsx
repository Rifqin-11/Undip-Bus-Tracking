"use client";

import { useState } from "react";
import type { Buggy } from "@/types/buggy";
import { getBuggyStopNameAtOffset } from "@/lib/transit/buggy-route-utils";
import { ChevronLeft, Edit2Icon, TrashIcon } from "lucide-react";
import { EditBuggyModal } from "./EditBuggyModal";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";

type BuggyOperationalDetailProps = {
  buggy: Buggy;
  activeZones: string[];
  onBack: () => void;
  geofenceManagerNode?: React.ReactNode;
};

export function BuggyOperationalDetail({
  buggy,
  activeZones,
  onBack,
  geofenceManagerNode,
}: BuggyOperationalDetailProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/buggies/${buggy.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal menghapus buggy");
      onBack();
    } catch (err: any) {
      alert(err.message);
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

  const crowdBadge =
    buggy.crowdLevel === "PENUH"
      ? "bg-rose-100 text-rose-700 border-rose-200"
      : buggy.crowdLevel === "HAMPIR_PENUH"
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-emerald-100 text-emerald-700 border-emerald-200";

  const crowdLabel =
    buggy.crowdLevel === "PENUH"
      ? "Penuh"
      : buggy.crowdLevel === "HAMPIR_PENUH"
        ? "Hampir Penuh"
        : "Longgar";

  const rows: { label: string; value: string }[] = [
    { label: "Kode Armada", value: buggy.code },
    { label: "Nama", value: buggy.name },
    { label: "Rute", value: buggy.routeLabel || "-" },
    {
      label: "Koordinat",
      value: `${buggy.position.lat.toFixed(5)}, ${buggy.position.lng.toFixed(5)}`,
    },
    { label: "Kecepatan", value: `${buggy.speedKmh} km/h` },
    { label: "ETA", value: `${buggy.etaMinutes} menit` },
    { label: "Halte Saat Ini", value: currentStop || "-" },
    { label: "Halte Berikutnya", value: nextStop || "-" },
    {
      label: "Okupansi",
      value: `${buggy.passengers}/${buggy.capacity} penumpang`,
    },
    {
      label: "Status Geofence",
      value: activeZones.length > 0 ? activeZones.join(", ") : "Di luar zona",
    },
    { label: "Terakhir Update", value: buggy.updatedAt },
  ];

  return (
    <section className="space-y-3">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
          aria-label="Kembali ke daftar buggy"
        >
          <ChevronLeft className="size-5" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Detail Operasional
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
      </div>

      <EditBuggyModal
        isOpen={isEditOpen}
        buggy={buggy}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => setIsEditOpen(false)}
      />

      <DeleteConfirmModal
        open={isDeleteOpen}
        title="Hapus Armada Buggy"
        description={`Anda yakin ingin menghapus ${buggy.code} - ${buggy.name}? Aksi ini bersifat permanen.`}
        isLoading={isDeleting}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
      />

      {/* ── Buggy Visual & Energy (Redesigned) ─────────────────────────── */}
      <div className="rounded-3xl border border-slate-200/80 bg-slate-50/50 p-4">
        {/* Cover Image */}
        <div className="relative h-44 w-full flex justify-center mb-3">
          <img
            src="/buggy.webp"
            alt="Buggy EV"
            className="h-full w-full object-contain mix-blend-multiply drop-shadow-xl opacity-95"
          />
        </div>

        {/* 3 Stats Boxes */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3 flex flex-col justify-center shadow-sm">
            <p className="text-[10px] font-semibold text-slate-400 mb-0.5">
              Sisa Jarak
            </p>
            <p className="text-[14px] font-bold text-slate-800">
              120{" "}
              <span className="font-bold text-slate-400 text-[10px]">km</span>
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3 flex flex-col justify-center shadow-sm">
            <p className="text-[10px] font-semibold text-slate-400 mb-0.5">
              Konsumsi
            </p>
            <p className="text-[14px] font-bold text-slate-800">
              142{" "}
              <span className="font-bold text-slate-400 text-[10px]">
                wh/km
              </span>
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3 flex flex-col justify-center shadow-sm">
            <p className="text-[10px] font-semibold text-slate-400 mb-0.5">
              Kapasitas
            </p>
            <p className="text-[14px] font-bold text-slate-800">
              35.5{" "}
              <span className="font-bold text-slate-400 text-[10px]">kWh</span>
            </p>
          </div>
        </div>

        {/* Battery & Action Row */}
        <div className="flex gap-2">
          <div className="relative flex-1 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center p-3 shadow-inner border border-slate-200/60 cursor-default">
            {/* Battery Fill Bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-green-400 transition-all"
              style={{ width: "85%" }}
            />

            {/* Battery Inner Content */}
            <div className="relative z-10 flex items-center">
              <svg
                className="w-5 h-5 text-slate-900 mr-2 drop-shadow-sm"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 7h14a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V9c0-1.1.9-2 2-2z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M22 11v2"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 11h2v2H6z M10 11h2v2h-2z M14 11h2v2h-2z"
                />
              </svg>
              <span className="text-[14px] font-bold text-slate-900 tracking-wide drop-shadow-sm">
                85% Baterai
              </span>
            </div>
          </div>
          <button
            type="button"
            className="w-[52px] shrink-0 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm hover:bg-slate-50 transition active:scale-95"
          >
            {/* Track/Location Icon */}
            <svg
              className="w-5 h-5 text-slate-700"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Occupancy ──────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <div className="mb-2 flex items-center justify-between text-[12px]">
          <span className="font-medium text-slate-500">Tingkat Keterisian</span>
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
          {buggy.passengers} dari {buggy.capacity} kursi terisi
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
            Terdeteksi Memasuki Zona:
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
            Armada berada di luar jangkauan seluruh zona.
          </p>
        </div>
      )}

      {/* ── Embedded Geofence Manager ──────────────────────────────────── */}
      {geofenceManagerNode && <div className="pt-2">{geofenceManagerNode}</div>}
    </section>
  );
}
