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
    <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-3">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-semibold text-slate-900">
            Daftar Halte
          </h2>
          <p className="text-[11px] text-slate-400">
            {HALTE_LOCATIONS.length} Halte Aktif
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {HALTE_LOCATIONS.map((halte, index) => (
          <button
            key={halte.id}
            type="button"
            onClick={() => onSelectHalte?.(halte.id)}
            className="group flex w-full items-center justify-between rounded-[20px] border border-slate-200/80 bg-white p-3 text-left transition-all hover:bg-slate-50 hover:shadow-sm hover:border-[#0f1a3b]/20 active:scale-[0.98] outline-none"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#0f1a3b] text-white shadow-sm transition-transform group-hover:scale-105">
                <BusStopIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-slate-800 tracking-tight leading-none mb-1">
                  {halte.name}
                </p>
                <p className="text-[12px] font-medium text-slate-500 leading-tight">
                  Titik keberangkatan
                </p>
              </div>
            </div>

            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400 transition-colors group-hover:bg-[#0f1a3b] group-hover:text-white">
              <ChevronRightIcon className="h-4 w-4" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
