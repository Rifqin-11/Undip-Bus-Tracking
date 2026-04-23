"use client";

import type { Buggy } from "@/types/buggy";
import { BusFrontIcon, ChevronLeftIcon } from "@/components/ui/Icons";
import {
  estimateMinutesBetweenStops,
  getBuggyCurrentRouteIndex,
  getBuggyStopsInRouteOrder,
} from "@/lib/transit/buggy-route-utils";
import { ChevronLeft } from "lucide-react";

function formatClock(date: Date): string {
  const formatter = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });
  return formatter.format(date).replace(":", ".");
}

type BuggyDetailViewProps = {
  buggy: Buggy;
  onBack: () => void;
};

export function BuggyDetailView({ buggy, onBack }: BuggyDetailViewProps) {
  const now = new Date();
  const stops = getBuggyStopsInRouteOrder(buggy);

  if (!stops.length) return null;

  const currentIndex = getBuggyCurrentRouteIndex(buggy, stops);

  const firstArrivalMinutes = Math.max(1, buggy.etaMinutes);
  const safeSpeedKmh = Math.max(5, buggy.speedKmh);

  const orderedStops = stops.map((stopName, routeOrderIndex) => {
    const diff = (routeOrderIndex - currentIndex + stops.length) % stops.length;

    let minuteOffset = 0;
    if (diff > 0) {
      minuteOffset = firstArrivalMinutes;

      for (let segment = 1; segment < diff; segment += 1) {
        const fromIndex = (currentIndex + segment) % stops.length;
        const toIndex = (fromIndex + 1) % stops.length;
        minuteOffset += estimateMinutesBetweenStops(
          stops[fromIndex],
          stops[toIndex],
          safeSpeedKmh,
        );
      }
    }

    return {
      stopName,
      minuteOffset,
      isCurrent: routeOrderIndex === currentIndex,
      timeLabel: formatClock(new Date(now.getTime() + minuteOffset * 60_000)),
    };
  });

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

  return (
    <section>
      {/* Buggy header */}
      <div className="mt-4 mb-3 flex min-w-0 items-start gap-3 rounded-2xl bg-white p-3">
        <button
          type="button"
          aria-label="Kembali"
          onClick={onBack}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#0f1a3b] px-2 py-0.5 text-[11px] font-bold text-white">
              {buggy.code}
            </span>
            <h2 className="truncate text-[16px] font-bold text-slate-900">
              {buggy.name}
            </h2>
          </div>
          <p className="truncate text-[13px] text-slate-600">
            From {stops[currentIndex]}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${crowdBadge}`}
        >
          {crowdLabel}
        </span>
      </div>

      <section className="mt-4 w-full min-w-0 touch-pan-y overflow-x-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-3">
        {/* Seat Stats */}
        <div className="mb-4 grid grid-cols-3 gap-2 rounded-[20px] bg-white border border-slate-100 p-3">
          {/* Total Kursi */}
          <div className="flex flex-col items-center justify-center">
            <p className="text-[17px] font-black text-slate-800 leading-none">
              {buggy.capacity}{" "}
              <span className="text-[10px] font-bold text-slate-400">
                kursi
              </span>
            </p>
            <div className="mt-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <svg
                className="w-3 h-3 text-slate-400"
                viewBox="0 0 195.92 195.92"
                fill="none"
                stroke="currentColor"
                strokeWidth={30}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M138.213,192.029H13.301c-3.921,0-7.276-1.505-9.703-4.352c-2.947-3.458-4.192-8.72-3.332-14.073
    c0.927-5.768,4.281-13.981,10.682-18.15c10.606-6.906,21.658-6.9,25.114-6.696c6.28-5.176,14.753-8.708,26.185-8.708
    c17.838,0,34.099,2.265,46.746,4.813c0.54-4.438,1.943-13.861,5.2-26.121c4.125-15.531,10.641-31.238,11.704-33.761
    c0.231-7.683,0.834-15.535,1.956-23.292c-3.629-1.252-6.669-3.698-8.699-7.035c-2.389-3.93-3.035-8.535-1.82-12.97l5.141-18.769
    c2.283-8.337,10.711-13.551,19.191-11.86l10.096,2.01c18.766-13.123,41.856-8.338,42.194-8.262c1.316,0.289,2.166,1.568,1.922,2.894
    l-29.586,160.944C163.8,182.193,151.992,192.029,138.213,192.029z"
                />
              </svg>
              Total
            </div>
          </div>

          {/* Kursi Terisi */}
          <div className="flex flex-col items-center justify-center border-l border-slate-200">
            <p className="text-[17px] font-black text-slate-800 leading-none">
              {buggy.passengers}{" "}
              <span className="text-[10px] font-bold text-slate-400">
                kursi
              </span>
            </p>
            <div className="mt-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <svg
                className="w-3 h-3 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              Terisi
            </div>
          </div>

          {/* Kursi Kosong */}
          <div className="flex flex-col items-center justify-center border-l border-slate-200">
            <p className="text-[17px] font-black text-emerald-600 leading-none">
              {Math.max(0, buggy.capacity - buggy.passengers)}{" "}
              <span className="text-[10px] font-bold text-slate-400">
                kursi
              </span>
            </p>
            <div className="mt-2 text-[10px] font-semibold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
              <svg
                className="w-3 h-3 text-emerald-500"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Kosong
            </div>
          </div>
        </div>

        {/* Stop timeline */}
        <div className="relative min-w-0 overflow-hidden pl-7 mt-4">
          <div className="absolute bottom-4 left-2 top-3 w-1 rounded-full bg-amber-400/80" />
          <div className="space-y-2.5">
            {orderedStops.map((stop, index) => (
              <div
                key={`${buggy.id}-${stop.stopName}-${index}`}
                className="relative"
              >
                {stop.isCurrent ? (
                  <span className="absolute -left-4.5 top-1/2 z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 ring-[3px] ring-white shadow-md" />
                ) : null}
                <article
                  className={`relative min-w-0 overflow-hidden rounded-[20px] border p-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition-all ${
                    stop.isCurrent 
                      ? "border-blue-200/80 bg-blue-50/60 backdrop-blur-md shadow-blue-200/20" 
                      : "border-white/60 bg-white/40 backdrop-blur-md hover:bg-white/60 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] hover:border-slate-300/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex flex-col justify-center">
                      <p className="truncate text-[15px] font-bold text-slate-800 tracking-tight leading-none mb-1">
                        {stop.stopName}
                      </p>
                      <p className={`text-[12px] font-medium leading-tight ${stop.isCurrent ? "text-blue-600" : "text-slate-500"}`}>
                        {stop.isCurrent
                          ? "Posisi armada saat ini"
                          : `Estimasi tiba · ${stop.minuteOffset} mnt lagi`}
                      </p>
                    </div>
                    <p className={`shrink-0 whitespace-nowrap text-[16px] font-black ${stop.isCurrent ? "text-blue-700" : "text-slate-700"}`}>
                      {stop.timeLabel}
                    </p>
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}
