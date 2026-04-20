"use client";

import type { Buggy } from "@/types/buggy";
import {
  estimateMinutesBetweenStops,
  getBuggyCurrentRouteIndex,
  getBuggyStopsInRouteOrder,
} from "@/lib/transit/buggy-route-utils";

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

  const capacityPercent = buggy.capacity
    ? Math.min(100, (buggy.passengers / buggy.capacity) * 100)
    : 0;

  return (
    <section className="mt-4 rounded-3xl border border-slate-200/80 bg-white/80 p-3">
      {/* Buggy header */}
      <div className="mb-3 flex items-start gap-3 rounded-2xl bg-slate-100 p-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-500 text-sm font-bold text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="currentColor"
            className="bi bi-bus-front"
            viewBox="0 0 16 16"
          >
            <path d="M5 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0m8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m-6-1a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2zm1-6c-1.876 0-3.426.109-4.552.226A.5.5 0 0 0 3 4.723v3.554a.5.5 0 0 0 .448.497C4.574 8.891 6.124 9 8 9s3.426-.109 4.552-.226A.5.5 0 0 0 13 8.277V4.723a.5.5 0 0 0-.448-.497A44 44 0 0 0 8 4m0-1c-1.837 0-3.353.107-4.448.22a.5.5 0 1 1-.104-.994A44 44 0 0 1 8 2c1.876 0 3.426.109 4.552.226a.5.5 0 1 1-.104.994A43 43 0 0 0 8 3" />
            <path d="M15 8a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1V2.64c0-1.188-.845-2.232-2.064-2.372A44 44 0 0 0 8 0C5.9 0 4.208.136 3.064.268 1.845.408 1 1.452 1 2.64V4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1v3.5c0 .818.393 1.544 1 2v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5V14h6v1.5a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2c.607-.456 1-1.182 1-2zM8 1c2.056 0 3.71.134 4.822.261.676.078 1.178.66 1.178 1.379v8.86a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5V2.64c0-.72.502-1.301 1.178-1.379A43 43 0 0 1 8 1" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[20px] font-bold text-slate-900">
            {buggy.name}
          </h3>
          <p className="truncate text-[13px] text-slate-600">
            From {stops[currentIndex]}
          </p>
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

      {/* Stop timeline */}
      <div className="relative pl-7">
        <div className="absolute bottom-3 left-2 top-2 w-1 rounded-full bg-amber-400" />
        <div className="space-y-2">
          {orderedStops.map((stop, index) => (
            <article
              key={`${buggy.id}-${stop.stopName}-${index}`}
              className={`relative rounded-xl border p-3 ${stop.isCurrent ? "border-slate-300 bg-slate-100" : "border-slate-200 bg-white"}`}
            >
              <span
                className={`absolute -left-5.75 top-5 h-2.5 w-2.5 rounded-full ${stop.isCurrent ? "bg-slate-700" : "bg-sky-500"}`}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-slate-900">
                    {stop.stopName}
                  </p>
                  <p className="text-[12px] text-slate-500">
                    {stop.isCurrent
                      ? "Posisi buggy saat ini"
                      : `Estimasi tiba · ${stop.minuteOffset} min lagi`}
                  </p>
                </div>
                <p className="text-[16px] font-bold text-slate-700">
                  {stop.timeLabel}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Capacity bar */}
      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] text-slate-600">Capacity</p>
          <p className="text-[13px] font-semibold text-slate-700">
            {buggy.passengers}/{buggy.capacity} Seats
          </p>
        </div>
        <div className="h-3 w-full rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${capacityPercent}%` }}
          />
        </div>
      </div>
    </section>
  );
}
