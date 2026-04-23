import { useState } from "react";
import { ChevronLeftIcon, TrashIcon, SpinnerIcon } from "@/components/ui/Icons";
import { fmtDate, fmtTime, fmtTimestamp, fmtDuration } from "@/lib/utils/format-time";
import type { Buggy } from "@/types/buggy";
import type { BuggySession } from "@/types/buggy-session";

type HistorySessionDetailProps = {
  selectedBuggy: Buggy;
  selectedSession: BuggySession;
  onBack: () => void;
  onDeleteSuccess?: () => void;
};

export function HistorySessionDetail({
  selectedBuggy,
  selectedSession: s,
  onBack,
  onDeleteSuccess,
}: HistorySessionDetailProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/buggy-sessions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: s.id,
          buggyId: s.buggyId,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
        }),
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error || "Gagal menghapus");
      }

      setShowDeleteModal(false);
      onDeleteSuccess?.();
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan saat menghapus");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="space-y-3 relative">
      {/* Header */}
      <div className="flex items-center gap-3 rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95"
          aria-label="Kembali ke daftar sesi"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Detail Sesi
          </p>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#0f1a3b] px-2 py-0.5 text-[11px] font-bold text-white">
              {selectedBuggy.code}
            </span>
            <h2 className="truncate text-[15px] font-bold text-slate-900">
              {s.isOngoing ? "Sesi Berlangsung" : `Sesi ${s.sessionNumber}`}
            </h2>
          </div>
        </div>
        {s.isOngoing ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">
              Selesai
            </span>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-100/50 bg-rose-50 text-rose-500 transition hover:bg-rose-100 hover:text-rose-600 active:scale-95"
              aria-label="Hapus Sesi"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Waktu mulai & selesai */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Waktu
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-slate-50 p-2.5 text-center">
            <p className="text-[15px] font-bold tabular-nums text-slate-900">{fmtTimestamp(s.startedAt)}</p>
            <p className="text-[10px] text-slate-400">{fmtDate(s.startedAt)} · Mulai</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-2.5 text-center">
            {s.isOngoing ? (
              <p className="text-[15px] font-bold text-emerald-600">Berlangsung</p>
            ) : (
              <p className="text-[15px] font-bold tabular-nums text-slate-900">{fmtTimestamp(s.endedAt)}</p>
            )}
            <p className="text-[10px] text-slate-400">{s.isOngoing ? "" : `${fmtDate(s.endedAt)} · `}Selesai</p>
          </div>
        </div>
      </div>

      {/* Statistik */}
      <div className="rounded-3xl border border-slate-200/80 bg-white/70">
        {[
          { label: "Durasi", value: fmtDuration(s.durationMinutes) },
          { label: "Titik GPS", value: `${s.pointCount} titik` },
          { label: "Jarak Tempuh", value: s.totalDistanceKm !== null ? `${s.totalDistanceKm.toFixed(2)} km` : "—" },
          { label: "Kec. Rata-rata", value: s.avgSpeedKmh !== null ? `${s.avgSpeedKmh.toFixed(1)} km/h` : "—" },
          {
            label: "Baterai",
            value: s.batteryStart !== null && s.batteryEnd !== null
              ? `${s.batteryStart}% → ${s.batteryEnd}%`
              : "—",
          },
          {
            label: "Pemakaian Baterai",
            value: s.batteryUsed !== null
              ? `${s.batteryUsed > 0 ? "-" : "+"}${Math.abs(s.batteryUsed)}%`
              : "—",
          },
        ].map((row, idx, arr) => (
          <div
            key={row.label}
            className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3 text-[12px] ${
              idx < arr.length - 1 ? "border-b border-slate-100" : ""
            }`}
          >
            <span className="shrink-0 font-medium text-slate-500">{row.label}</span>
            <span className="text-right font-medium text-slate-800">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Jalur GPS */}
      {s.path.length > 0 && (
        <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Jalur GPS · {s.path.length} titik
          </p>
          <div className="max-h-[260px] space-y-1 overflow-y-auto pr-1">
            {s.path.map(([lat, lng, tsMs], idx) => (
              <div
                key={`${lat}-${lng}-${idx}`}
                className="grid grid-cols-[auto_auto_1fr] items-center gap-x-3 rounded-xl border border-slate-100 bg-white px-3 py-1.5"
              >
                <span className="shrink-0 text-[9px] tabular-nums text-slate-300">#{idx + 1}</span>
                <span className="shrink-0 text-[10px] font-semibold tabular-nums text-slate-500">
                  {tsMs !== undefined ? fmtTimestamp(tsMs) : fmtTime(s.startedAt)}
                </span>
                <span className="text-right text-[11px] tabular-nums text-slate-700">
                  {lat.toFixed(6)}, {lng.toFixed(6)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm shrink-0 animate-in fade-in zoom-in-95 rounded-[24px] bg-white p-5 shadow-2xl">
            <div className="mb-4 flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 shadow-sm">
                <TrashIcon className="h-6 w-6" />
              </div>
              <h3 className="text-[17px] font-bold text-slate-900">Hapus Riwayat Sesi?</h3>
              <p className="mt-1 text-[13px] text-slate-500 leading-relaxed max-w-[280px]">
                Data rekaman GPS untuk sesi ini akan dihapus secara permanen dari server. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-95 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-rose-600/20 transition hover:bg-rose-700 active:scale-95 disabled:opacity-50"
              >
                {isDeleting && <SpinnerIcon className="h-4 w-4" />}
                {isDeleting ? "Menghapus..." : "Ya, Hapus Sesi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
