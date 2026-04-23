"use client";

import type { Buggy } from "@/types/buggy";
import { getBuggyStopNameAtOffset } from "@/lib/transit/buggy-route-utils";

type BuggyOperationalDetailProps = {
  buggy: Buggy;
  activeZones: string[];
  onBack: () => void;
};

export function BuggyOperationalDetail({
  buggy,
  activeZones,
  onBack,
}: BuggyOperationalDetailProps) {
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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95"
          aria-label="Kembali ke daftar buggy"
        >
          ←
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

        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${crowdBadge}`}
        >
          {crowdLabel}
        </span>
      </div>

      {/* ── Occupancy ──────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <div className="mb-2 flex items-center justify-between text-[12px]">
          <span className="font-medium text-slate-500">Tingkat Keterisian</span>
          <span className="font-semibold text-slate-800">
            {occupancyPct}%
          </span>
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
      {activeZones.length > 0 && (
        <div className="rounded-3xl border border-blue-200/80 bg-blue-50/70 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-blue-500">
            Zona Aktif
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
      )}
    </section>
  );
}
