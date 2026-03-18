"use client";

import type { HaltePoint } from "@/types/buggy";

// Generate mock schedule (same logic as HalteSection)
function generateSchedule(halteId: string): string[] {
  const baseHour = 7;
  const offset = parseInt(halteId.replace(/\D/g, "")) * 3;
  const schedule: string[] = [];
  for (let i = 0; i < 8; i++) {
    const hour = baseHour + Math.floor((offset + i * 45) / 60);
    const minute = (offset + i * 45) % 60;
    schedule.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`);
  }
  return schedule;
}

type HalteDetailViewProps = {
  halte: HaltePoint;
  halteIndex: number;
  onBack: () => void;
};

export function HalteDetailView({ halte, halteIndex, onBack }: HalteDetailViewProps) {
  const schedule = generateSchedule(halte.id);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${halte.lat},${halte.lng}`;

  const handleShare = async () => {
    const shareData = {
      title: `Halte ${halte.name}`,
      text: `Halte ${halte.name} - UNDIP Transit\nKoordinat: ${halte.lat.toFixed(6)}, ${halte.lng.toFixed(6)}`,
      url: mapsUrl,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
      alert("Link halte telah disalin ke clipboard!");
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-3">
      {/* Header */}
      <div className="mb-3 flex items-start gap-3 rounded-2xl bg-emerald-50/80 p-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-sm font-bold text-white shadow-sm">
          H{halteIndex + 1}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[20px] font-bold text-slate-900">
            {halte.name}
          </h3>
          <p className="text-[13px] text-slate-500">
            {halte.lat.toFixed(6)}, {halte.lng.toFixed(6)}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Kembali
        </button>
      </div>

      {/* Action Buttons */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1.5 rounded-xl border border-blue-200/80 bg-blue-50/60 p-2.5 transition hover:bg-blue-100/60"
        >
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500 text-white shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M12 2L6 8l1.41 1.41L11 5.83V22h2V5.83l3.59 3.58L18 8z" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <span className="text-[11px] font-semibold text-blue-700">Navigate</span>
        </a>

        <button
          type="button"
          onClick={handleShare}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-2.5 transition hover:bg-emerald-100/60"
        >
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-white shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="m8.59 13.51 6.83 3.98" />
              <path d="m15.41 6.51-6.82 3.98" />
            </svg>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700">Share</span>
        </button>

        <a
          href={`https://www.google.com/maps/@${halte.lat},${halte.lng},18z`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1.5 rounded-xl border border-amber-200/80 bg-amber-50/60 p-2.5 transition hover:bg-amber-100/60"
        >
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500 text-white shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
              <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z" />
            </svg>
          </div>
          <span className="text-[11px] font-semibold text-amber-700">Maps</span>
        </a>
      </div>

      {/* Info Cards */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-200/60 bg-slate-50/60 p-2.5">
          <p className="text-[10px] font-medium tracking-wide text-slate-400">STATUS</p>
          <div className="mt-1 flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <p className="text-[13px] font-semibold text-slate-800">Aktif</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/60 bg-slate-50/60 p-2.5">
          <p className="text-[10px] font-medium tracking-wide text-slate-400">RUTE</p>
          <p className="mt-1 text-[13px] font-semibold text-slate-800">Loop Utama</p>
        </div>
      </div>

      {/* Schedule */}
      <div className="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-3">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-slate-700">Jadwal Hari Ini</p>
          <span className="rounded-md bg-emerald-100/80 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            Aktif
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {schedule.map((time, idx) => (
            <div
              key={idx}
              className="flex items-center justify-center rounded-lg border border-slate-200/60 bg-white py-1.5 shadow-sm"
            >
              <span className="font-mono text-[12px] font-medium text-slate-700">{time}</span>
            </div>
          ))}
        </div>

        <p className="mt-2.5 rounded-lg bg-blue-50/50 p-2 text-center text-[10px] leading-relaxed text-blue-600/90">
          *Estimasi keberangkatan dapat berubah tergantung pada lalu lintas.
        </p>
      </div>

      {/* Nearby Info */}
      <div className="mt-3 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-3">
        <p className="mb-2 text-[13px] font-semibold text-slate-700">Fasilitas Terdekat</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[12px] text-slate-600">
            <span className="text-[14px]">🏫</span>
            <span>Gedung kuliah terdekat</span>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-slate-600">
            <span className="text-[14px]">🅿️</span>
            <span>Area parkir tersedia</span>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-slate-600">
            <span className="text-[14px]">♿</span>
            <span>Akses ramah disabilitas</span>
          </div>
        </div>
      </div>
    </section>
  );
}
