"use client";

import type { HaltePoint } from "@/types/buggy";

function generateSchedule(halteId: string): string[] {
  const baseHour = 7;
  const offset = parseInt(halteId.replace(/\D/g, ""), 10) * 3;
  const schedule: string[] = [];

  for (let i = 0; i < 8; i += 1) {
    const hour = baseHour + Math.floor((offset + i * 45) / 60);
    const minute = (offset + i * 45) % 60;
    schedule.push(
      `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
    );
  }

  return schedule;
}

function getHaltePhotoUrl(halte: HaltePoint): string {
  const lat = halte.lat.toFixed(6);
  const lng = halte.lng.toFixed(6);
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=17&size=1280x640&markers=${lat},${lng},red-pushpin`;
}

type HalteDetailViewProps = {
  halte: HaltePoint;
  halteIndex: number;
  onBack: () => void;
};

export function HalteDetailView({
  halte,
  halteIndex: _halteIndex,
  onBack,
}: HalteDetailViewProps) {
  const schedule = generateSchedule(halte.id);
  const haltePhotoUrl = getHaltePhotoUrl(halte);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${halte.lat},${halte.lng}`;

  const handleShare = async () => {
    const shareData = {
      title: `Halte ${halte.name}`,
      text: `Halte ${halte.name} - UNDIP Transit\nKoordinat: ${halte.lat.toFixed(6)}, ${halte.lng.toFixed(6)}`,
      url: mapsUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // cancelled
      }
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(
        `${shareData.text}\n${shareData.url}`,
      );
      alert("Link halte telah disalin ke clipboard!");
    }
  };

  return (
    <section className="mt-4 w-full min-w-0 overflow-x-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-3">
      <div className="mb-3 flex min-w-0 items-start gap-3 rounded-2xl bg-slate-100 p-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-sm font-bold text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            className="icon icon-tabler icons-tabler-outline icon-tabler-bus-stop"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M3 4a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -4" />
            <path d="M16 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
            <path d="M10 5h7c2.761 0 5 3.134 5 7v5h-2" />
            <path d="M16 17h-8" />
            <path d="M16 5l1.5 7h4.5" />
            <path d="M9.5 10h7.5" />
            <path d="M12 5v5" />
            <path d="M5 9v11" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate break-words text-[20px] leading-tight font-bold text-slate-900">
            {halte.name}
          </h3>
        </div>

        <button
          type="button"
          aria-label="Kembali"
          onClick={onBack}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <figure className="relative mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        <img
          src={haltePhotoUrl}
          alt={`Foto area ${halte.name}`}
          className="h-44 w-full object-cover"
          loading="lazy"
        />
        <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent p-3">
          <p className="text-[14px] font-semibold text-white">{halte.name}</p>
          <p className="text-[11px] text-white/80">
            Area halte pada peta kampus
          </p>
        </figcaption>
      </figure>

      <div className="mb-3 grid w-full min-w-0 grid-cols-3 gap-2 min-[360px]:gap-2.5">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
          >
            <path d="M12 2L6 8l1.41 1.41L11 5.83V22h2V5.83l3.59 3.58L18 8z" />
          </svg>
          <span className="truncate">Arahkan</span>
        </a>

        <button
          type="button"
          onClick={handleShare}
          className="flex min-w-0 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white p-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 min-[360px]:gap-1.5 min-[360px]:p-2.5 min-[360px]:text-[12px]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="m8.59 13.51 6.83 3.98" />
            <path d="m15.41 6.51-6.82 3.98" />
          </svg>
          <span className="truncate">Bagikan</span>
        </button>

        <a
          href={`https://www.google.com/maps/@${halte.lat},${halte.lng},18z`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white p-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 min-[360px]:gap-1.5 min-[360px]:p-2.5 min-[360px]:text-[12px]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
          >
            <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
            <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z" />
          </svg>
          <span className="truncate">Maps</span>
        </a>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <p className="text-[10px] font-medium tracking-wide text-slate-400">
            STATUS
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <p className="text-[13px] font-semibold text-slate-800">Aktif</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <p className="text-[10px] font-medium tracking-wide text-slate-400">
            RUTE
          </p>
          <p className="mt-1 text-[13px] font-semibold text-slate-800">
            Loop Utama
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-slate-700">
            Jadwal Hari Ini
          </p>
          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            Aktif
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4">
          {schedule.map((time, idx) => (
            <div
              key={idx}
              className="flex items-center justify-center rounded-lg border border-slate-200 bg-white py-1.5"
            >
              <span className="font-mono text-[12px] font-medium text-slate-700">
                {time}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-2.5 rounded-lg bg-slate-100 p-2 text-center text-[10px] leading-relaxed text-slate-600">
          *Estimasi keberangkatan dapat berubah tergantung pada lalu lintas.
        </p>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-[13px] font-semibold text-slate-700">
          Fasilitas Terdekat
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[12px] text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            <span>Gedung kuliah terdekat</span>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            <span>Area parkir tersedia</span>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            <span>Akses ramah disabilitas</span>
          </div>
        </div>
      </div>
    </section>
  );
}
