"use client";

import { useEffect, useState } from "react";
import type { HaltePoint } from "@/types/buggy";
import {
  BusStopIcon,
  ChevronLeftIcon,
  MapPinOutlineIcon,
  EyeIcon,
  NavigateIcon,
  ShareIcon,
  MapPinIcon,
} from "@/components/ui/Icons";

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

const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function getStreetViewUrl(halte: HaltePoint): string {
  const lat = halte.lat.toFixed(7);
  const lng = halte.lng.toFixed(7);
  return (
    `https://maps.googleapis.com/maps/api/streetview` +
    `?size=640x320&location=${lat},${lng}` +
    `&fov=90&pitch=0&radius=100&source=outdoor` +
    `&key=${GMAPS_KEY}`
  );
}

function getStreetViewMetadataUrl(halte: HaltePoint): string {
  const lat = halte.lat.toFixed(7);
  const lng = halte.lng.toFixed(7);
  return (
    `https://maps.googleapis.com/maps/api/streetview/metadata` +
    `?location=${lat},${lng}&radius=100&source=outdoor` +
    `&key=${GMAPS_KEY}`
  );
}

function getStaticMapUrl(halte: HaltePoint): string {
  const lat = halte.lat.toFixed(7);
  const lng = halte.lng.toFixed(7);
  return (
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lng}&zoom=18&size=640x320` +
    `&maptype=satellite` +
    `&markers=color:red%7C${lat},${lng}` +
    `&key=${GMAPS_KEY}`
  );
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
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${halte.lat},${halte.lng}`;

  // Lazy-load Street View: URL hanya diset setelah komponen mount (panel terbuka)
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageType, setImageType] = useState<"streetview" | "satellite">(
    "streetview",
  );
  const [svError, setSvError] = useState(false);

  useEffect(() => {
    setImageUrl(null);
    setSvError(false);

    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(getStreetViewMetadataUrl(halte), {
          signal: controller.signal,
        });
        const data = (await res.json()) as { status: string };

        if (data.status === "OK") {
          setImageType("streetview");
          setImageUrl(getStreetViewUrl(halte));
        } else {
          // Tidak ada Street View — gunakan Static Map satellite
          setImageType("satellite");
          setImageUrl(getStaticMapUrl(halte));
        }
      } catch {
        // Jika metadata gagal, coba langsung Street View
        setImageType("streetview");
        setImageUrl(getStreetViewUrl(halte));
      }
    }, 150);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [halte.id, halte.lat, halte.lng]);

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
    <section className="mt-3 min-w-0 items-start">
      <div className="mb-3 flex items-start gap-3 rounded-[20px] border border-white/60 bg-white/40 backdrop-blur-md p-3 shadow-sm transition-all">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#0f1a3b] shadow-md text-sm font-bold text-white transition-transform hover:scale-105">
          <BusStopIcon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-0.5">
            Detail Halte
          </p>
          <h3 className="truncate text-lg leading-tight font-bold text-slate-900 tracking-tight">
            {halte.name}
          </h3>
        </div>

        <button
          type="button"
          aria-label="Kembali"
          onClick={onBack}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-300/60 bg-white/60 text-slate-700 shadow-sm transition hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 w-full min-w-0 overflow-x-hidden rounded-3xl border border-slate-200/80 bg-white/70 p-3">
        <figure className="relative mb-3 overflow-hidden rounded-[20px] border border-white/60 bg-white/70 backdrop-blur-md shadow-sm">
          {/* Skeleton saat Street View belum dimuat */}
          {!imageUrl && !svError && (
            <div className="flex h-44 w-full animate-pulse items-center justify-center bg-white/40">
              <MapPinOutlineIcon className="h-8 w-8 text-slate-400" />
            </div>
          )}

          {/* Street View dimuat setelah panel terbuka */}
          {imageUrl && !svError && (
            <img
              src={imageUrl}
              alt={`Street View ${halte.name}`}
              className="h-44 w-full object-cover mix-blend-multiply opacity-95"
              onError={() => setSvError(true)}
            />
          )}

          {/* Fallback jika gambar gagal dimuat */}
          {svError && (
            <div className="flex h-44 w-full flex-col items-center justify-center gap-2 bg-white/40 text-slate-400">
              <EyeIcon className="h-8 w-8" />
              <p className="text-[12px] font-medium">Gambar tidak tersedia</p>
            </div>
          )}

          <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-3 pt-6">
            <p className="text-[14px] font-bold tracking-tight text-white">
              {halte.name}
            </p>
            <p className="text-[11px] font-medium text-white/80">
              {imageType === "streetview"
                ? "Street View · Google Maps"
                : "Citra Satelit · Google Maps"}
            </p>
          </figcaption>
        </figure>

        <div className="mb-3 grid w-full min-w-0 grid-cols-3 gap-2 min-[360px]:gap-2.5">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-[16px] border border-white/60 bg-white/60 backdrop-blur-md p-2.5 text-[12px] font-bold text-slate-800 shadow-sm transition hover:bg-white hover:shadow-md active:scale-95"
          >
            <NavigateIcon className="h-4 w-4" />
            <span className="truncate">Arahkan</span>
          </a>

          <button
            type="button"
            onClick={handleShare}
            className="flex min-w-0 items-center justify-center gap-1 rounded-[16px] border border-white/60 bg-white/60 backdrop-blur-md p-2 text-[11px] font-bold text-slate-800 shadow-sm transition hover:bg-white hover:shadow-md active:scale-95 min-[360px]:gap-1.5 min-[360px]:p-2.5 min-[360px]:text-[12px]"
          >
            <ShareIcon className="h-4 w-4" />
            <span className="truncate">Bagikan</span>
          </button>

          <a
            href={`https://www.google.com/maps/@${halte.lat},${halte.lng},18z`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center justify-center gap-1 rounded-[16px] border border-white/60 bg-white/60 backdrop-blur-md p-2 text-[11px] font-bold text-slate-800 shadow-sm transition hover:bg-white hover:shadow-md active:scale-95 min-[360px]:gap-1.5 min-[360px]:p-2.5 min-[360px]:text-[12px]"
          >
            <MapPinIcon className="h-4 w-4" />
            <span className="truncate">Maps</span>
          </a>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-[20px] border border-white/60 bg-white/50 backdrop-blur-md p-3 shadow-sm">
            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
              STATUS
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <p className="text-[13px] font-bold text-slate-800">Aktif</p>
            </div>
          </div>

          <div className="rounded-[20px] border border-white/60 bg-white/50 backdrop-blur-md p-3 shadow-sm">
            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
              RUTE
            </p>
            <p className="mt-1 text-[13px] font-bold text-slate-800">
              Loop Utama
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-[20px] border border-white/60 bg-white/70 backdrop-blur-md p-3.5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[14px] font-bold text-slate-800 tracking-tight">
            Jadwal Hari Ini
          </p>
          <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-700">
            AKTIF
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4">
          {schedule.map((time, idx) => (
            <div
              key={idx}
              className="flex items-center justify-center rounded-xl border border-white/80 bg-white/80 py-1.5 shadow-sm transition hover:bg-white"
            >
              <span className="font-mono text-[12px] font-bold text-slate-700">
                {time}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-center text-[10px] font-medium leading-relaxed text-slate-500">
          *Estimasi keberangkatan dapat berubah tergantung kondisi jalan.
        </p>
      </div>

      <div className="mt-3 rounded-[20px] border border-white/60 bg-white/70 backdrop-blur-md p-3.5 shadow-sm">
        <p className="mb-2.5 text-[13px] font-bold text-slate-800 tracking-tight">
          Fasilitas Terdekat
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 text-[12px] font-medium text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0f1a3b]/60" />
            <span>Gedung kuliah terdekat</span>
          </div>
          <div className="flex items-center gap-2.5 text-[12px] font-medium text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0f1a3b]/60" />
            <span>Area parkir tersedia</span>
          </div>
          <div className="flex items-center gap-2.5 text-[12px] font-medium text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0f1a3b]/60" />
            <span>Akses ramah disabilitas</span>
          </div>
        </div>
      </div>
    </section>
  );
}
