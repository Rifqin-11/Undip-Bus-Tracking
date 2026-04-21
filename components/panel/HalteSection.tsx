"use client";

import { HALTE_LOCATIONS } from "@/lib/transit/buggy-data";
import {
  StationIcon,
  BusStopIcon,
  ChevronRightIcon,
} from "@/components/ui/Icons";

type HalteSectionProps = {
  onSelectHalte?: (halteId: string) => void;
};

export function HalteSection({ onSelectHalte }: HalteSectionProps) {
  return (
    <div className="rounded-3xl border border-white/40 bg-white/60 p-4 shadow-[0_8px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500 text-white shadow-sm">
          <StationIcon className="h-4 w-4" />
        </div>
        <h2 className="text-[18px] font-bold text-slate-800">Daftar Halte</h2>
      </div>

      <div className="space-y-3">
        {HALTE_LOCATIONS.map((halte, index) => (
          <button
            key={halte.id}
            type="button"
            onClick={() => onSelectHalte?.(halte.id)}
            className="flex w-full items-center justify-between rounded-2xl border border-white/50 bg-white/50 p-3.5 text-left transition-all duration-300 hover:bg-white/70 hover:shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-200/80 text-[11px] font-bold text-slate-600 transition-colors">
                <BusStopIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-slate-700 transition-colors">
                  {halte.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  Titik awal keberangkatan
                </p>
              </div>
            </div>

            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400 transition-all duration-300">
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
