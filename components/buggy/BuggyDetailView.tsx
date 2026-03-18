"use client";

import type { Buggy } from "@/types/buggy";

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
  const stops = buggy.stops ?? [];

  if (!stops.length) return null;

  const currentIndex =
    ((buggy.currentStopIndex % stops.length) + stops.length) % stops.length;
  const orderedStops = stops.map((stopName, index) => {
    const diff = (index - currentIndex + stops.length) % stops.length;
    const minuteOffset = diff * 2;
    return {
      stopName,
      minuteOffset,
      isCurrent: index === currentIndex,
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
          B
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
          onClick={onBack}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
        >
          Kembali
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
                    {stop.minuteOffset === 0
                      ? "Scheduled · now"
                      : `Scheduled · in ${stop.minuteOffset} min`}
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
